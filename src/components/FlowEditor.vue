<script setup>
import { ref, markRaw, provide } from 'vue'
import { VueFlow, useVueFlow, MarkerType, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import CustomNode from './Flow/CustomNode.vue'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue'
import InfoPanel from './Flow/InfoPanel.vue'
import { useLayout } from '../utils/useLayout'

// --- 状态管理 ---
const currentEdgeType = ref('smoothstep')
const currentSpacing = ref('normal')
const SPACING_OPTIONS = {
  compact: { ranksep: 40, nodesep: 30 },
  normal:  { ranksep: 80, nodesep: 60 },
  loose:   { ranksep: 120, nodesep: 150 }
}

// --- 端口映射配置 ---
const PORT_MAPPING = {
  'source-a': { field: 'next',         type: 'array',  color: '#3b82f6' }, // Blue
  'source-b': { field: 'interrupt',    type: 'array',  color: '#f59e0b' }, // Amber
  'source-c': { field: 'on_error',     type: 'string', color: '#f43f5e' }  // Rose
}

const getEdgeStyle = (handleId) => {
  const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }
  return {
    style: { stroke: config.color, strokeWidth: 2 },
    animated: true,
    type: currentEdgeType.value,
    markerEnd: MarkerType.ArrowClosed,
  }
}

// --- 初始化 ---
const nodes = ref([])
const edges = ref([])
const nodeTypes = { custom: markRaw(CustomNode) }

// --- Vue Flow Hooks ---
const {
  onConnect,
  addEdges,
  removeEdges,
  onEdgesChange,
  findNode,
  setViewport,
  screenToFlowCoordinate,
  fitView
} = useVueFlow()
const { layout } = useLayout()

// --- 1. 连接校验 ---
const onValidateConnection = (connection) => {
  if (connection.targetHandle !== 'in') return false
  return true
}

// --- 2. 建立连接 (Toggle模式: 无则连, 有则断) ---
onConnect((params) => {
  const existingEdge = edges.value.find(e =>
    e.source === params.source && e.target === params.target &&
    e.sourceHandle === params.sourceHandle
  )

  const portConfig = PORT_MAPPING[params.sourceHandle]
  const sourceNode = findNode(params.source)

  // A. [Toggle] 已存在连线 -> 断开
  if (existingEdge) {
    removeEdges([existingEdge.id])
    // 手动清理数据 (比等待 onEdgesChange 更快更安全)
    if (sourceNode && portConfig && sourceNode.data.data) {
      const field = portConfig.field
      const targetId = params.target

      if (portConfig.type === 'array') {
        const arr = sourceNode.data.data[field]
        if (Array.isArray(arr)) {
          const idx = arr.indexOf(targetId)
          if (idx > -1) {
            arr.splice(idx, 1)
            console.log(`[Flow] Unlinked (Toggle): ${params.source} -x-> ${targetId}`)
          }
        }
      } else {
        if (sourceNode.data.data[field] === targetId) {
          delete sourceNode.data.data[field]
          console.log(`[Flow] Unlinked (Toggle): ${params.source} -x-> ${targetId}`)
        }
      }
    }
    return
  }

  // B. [Connect] 不存在连线 -> 连接
  addEdges({
    ...params,
    ...getEdgeStyle(params.sourceHandle),
    label: portConfig ? portConfig.field : undefined
  })

  // 写入数据
  if (sourceNode && portConfig) {
    const field = portConfig.field
    const targetId = params.target

    if (!sourceNode.data.data) sourceNode.data.data = {}

    if (portConfig.type === 'array') {
      if (!Array.isArray(sourceNode.data.data[field])) sourceNode.data.data[field] = []
      if (!sourceNode.data.data[field].includes(targetId)) {
        sourceNode.data.data[field].push(targetId)
        console.log(`[Flow] Linked: ${sourceNode.id} -> ${targetId}`)
      }
    } else {
      sourceNode.data.data[field] = targetId
      console.log(`[Flow] Linked: ${sourceNode.id} -> ${targetId}`)
    }
  }
})

// --- 3. 断开连接 (监听外部删除事件) ---
onEdgesChange((changes) => {
  changes.forEach(change => {
    if (change.type === 'remove') {
      const edge = edges.value.find(e => e.id === change.id)
      if (edge) {
        const sourceNode = findNode(edge.source)
        const targetId = edge.target
        const portConfig = PORT_MAPPING[edge.sourceHandle]

        if (sourceNode && portConfig && sourceNode.data.data) {
          const field = portConfig.field
          if (portConfig.type === 'array') {
            const arr = sourceNode.data.data[field]
            if (Array.isArray(arr)) {
              const idx = arr.indexOf(targetId)
              if (idx > -1) arr.splice(idx, 1)
            }
          } else {
            if (sourceNode.data.data[field] === targetId) delete sourceNode.data.data[field]
          }
        }
      }
    }
  })
})

// --- 4. 节点更新处理 ---
const handleNodeUpdate = ({ oldId, newId, newType }) => {
  const node = findNode(oldId)
  if (!node) return

  if (oldId !== newId) {
    if (findNode(newId)) { alert(`ID "${newId}" already exists!`); return }

    // 更新自身 ID
    node.id = newId
    node.data.id = newId
    node.data.data.id = newId

    // 更新连线
    edges.value = edges.value.map(e => {
      let update = {}
      if (e.source === oldId) update.source = newId
      if (e.target === oldId) update.target = newId
      if (update.source || update.target) {
        return { ...e, ...update, id: e.id.replace(oldId, newId) }
      }
      return e
    })

    // 更新其他节点引用
    nodes.value.forEach(n => {
      if (n.id === newId) return
      const d = n.data.data
      if (!d) return
      ['next', 'interrupt'].forEach(field => {
        if (Array.isArray(d[field])) {
          const idx = d[field].indexOf(oldId)
          if (idx > -1) d[field][idx] = newId
        }
      })
      const singleFields = ['on_error', 'timeout_next']
      singleFields.forEach(field => {
        if (d[field] === oldId) d[field] = newId
      })
    })
  }

  node.data.type = newType
  node.data.data.recognition = newType
  nodes.value = [...nodes.value]
}

provide('updateNode', handleNodeUpdate)

// --- 菜单状态 ---
const menu = ref({ visible: false, x: 0, y: 0, type: null, data: null, flowPos: { x: 0, y: 0 } })
const editor = ref({ visible: false, nodeId: null, nodeData: null })

const closeMenu = () => { menu.value.visible = false }
const getEvent = (params) => params.event || params

const onPaneContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'pane', data: null, flowPos }
}

const onNodeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'node', data: params.node }
}

const onEdgeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'edge', data: params.edge }
}

// --- 数据辅助 ---
const createNodeObject = (id, rawContent, isMissing = false) => {
  let logicType = rawContent.recognition || 'DirectHit'
  if (isMissing) logicType = 'Unknown'
  return {
    id: id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      id: id,
      type: logicType,
      data: { ...rawContent, id: id, recognition: logicType },
      _isMissing: isMissing,
      status: 'idle' // 默认状态
    }
  }
}

const onNodesLoaded = ({ filename, nodes: rawNodesData }) => {
  const newNodes = []
  const newEdges = []
  const createdNodeIds = new Set()

  for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
    newNodes.push(createNodeObject(nodeId, nodeContent))
    createdNodeIds.add(nodeId)
  }

  for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
    const linkFields = [
      { key: 'next',         handle: 'source-a' },
      { key: 'interrupt',    handle: 'source-b' },
      { key: 'on_error',     handle: 'source-c' },
      { key: 'timeout_next', handle: 'source-c' }
    ]

    linkFields.forEach(({ key, handle }) => {
      if (nodeContent[key]) {
        const targets = Array.isArray(nodeContent[key]) ? nodeContent[key] : [nodeContent[key]]
        targets.forEach(targetId => {
          if (!targetId) return
          if (!createdNodeIds.has(targetId)) {
            newNodes.push(createNodeObject(targetId, {}, true))
            createdNodeIds.add(targetId)
          }
          newEdges.push({
            id: `e-${nodeId}-${targetId}-${key}`,
            source: nodeId,
            target: targetId,
            sourceHandle: handle,
            targetHandle: 'in',
            label: key,
            ...getEdgeStyle(handle)
          })
        })
      }
    })
  }

  const layoutedNodes = layout(newNodes, newEdges, SPACING_OPTIONS[currentSpacing.value])
  nodes.value = layoutedNodes
  edges.value = newEdges
  setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50)
}

// --- 菜单动作处理 ---
const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()

  switch (action) {
    case 'add':
      const newNodeType = payload || 'DirectHit'
      const newId = `N-${Date.now()}`
      let defaultBusinessData = { id: newId, recognition: newNodeType }
      nodes.value.push(createNodeObject(newId, defaultBusinessData))
      if (menu.value.flowPos) {
        const lastNode = nodes.value[nodes.value.length - 1]
        lastNode.position = { ...menu.value.flowPos }
      }
      break

    // --- 修复: 调试节点逻辑 ---
    case 'debug':
      if (type === 'node') {
        const node = findNode(data.id)
        if (node) {
          console.log(`[Debug] Running node: ${data.id}`, node.data.data)
          // 模拟状态变更: Idle -> Running -> Success
          node.data.status = 'running'
          setTimeout(() => {
            node.data.status = 'success'
          }, 1500)

          // 如果需要自动恢复成 idle，可以再加个 timeout
          // setTimeout(() => { node.data.status = 'idle' }, 4000)
        }
      }
      break

    case 'edit':
      editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data.data)) }
      break

    case 'duplicate':
      if (data) {
        const copyId = `N-${Date.now()}`
        const copyData = JSON.parse(JSON.stringify(data.data.data))
        copyData.id = copyId
        const copyNode = createNodeObject(copyId, copyData)
        copyNode.position = { x: data.position.x + 50, y: data.position.y + 50 }
        nodes.value.push(copyNode)
      }
      break

    case 'delete':
      if (type === 'node') {
        removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id))
        nodes.value = nodes.value.filter(n => n.id !== data.id)
      } else if (type === 'edge') {
        removeEdges([data.id])
      }
      break

    case 'layout':
      nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[currentSpacing.value])
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      break

    case 'changeSpacing':
      if (payload && SPACING_OPTIONS[payload]) {
        currentSpacing.value = payload
        nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[payload])
        setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      }
      break

    case 'changeEdgeType':
      if (payload) {
        currentEdgeType.value = payload
        edges.value = edges.value.map(edge => ({ ...edge, type: payload }))
      }
      break

    case 'reset':
      fitView({ padding: 0.2, duration: 500 })
      break

    case 'clear':
      nodes.value = []
      edges.value = []
      break
  }
}

const handleEditorSave = (newBusinessData) => {
  const targetNode = findNode(editor.value.nodeId)
  if (targetNode) {
    targetNode.data.data = { ...newBusinessData, id: targetNode.id }
    if (newBusinessData.recognition) targetNode.data.type = newBusinessData.recognition
    nodes.value = [...nodes.value]
  }
  editor.value.visible = false
}
</script>

<template>
  <div class="w-full h-full min-h-[500px] bg-slate-50 relative">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-zoom="1"
      :min-zoom="0.1"
      :max-zoom="4"
      fit-view-on-init
      :is-valid-connection="onValidateConnection"
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      @edge-context-menu="onEdgeContextMenu"
      @pane-click="closeMenu"
      @node-click="closeMenu"
      @edge-click="closeMenu"
      @move-start="closeMenu"
    >
      <Background pattern-color="#cbd5e1" :gap="20" />
      <Controls />

      <Panel position="top-right" class="m-4">
        <InfoPanel
          :node-count="nodes.length"
          :edge-count="edges.length"
          @load-nodes="onNodesLoaded"
        />
      </Panel>

      <ContextMenu
        v-if="menu.visible"
        v-bind="menu"
        :currentEdgeType="currentEdgeType"
        :currentSpacing="currentSpacing"
        @close="closeMenu"
        @action="handleMenuAction"
      />
    </VueFlow>
    <NodeEditorModal :visible="editor.visible" :nodeData="editor.nodeData" @close="editor.visible = false" @save="handleEditorSave" />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
.vue-flow__panel { pointer-events: none; }
</style>