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

// ... (SPACING_OPTIONS, PORT_MAPPING, getEdgeStyle 保持不变) ...
const currentEdgeType = ref('smoothstep')
const currentSpacing = ref('normal')
const SPACING_OPTIONS = {
  compact: { ranksep: 40, nodesep: 30 },
  normal:  { ranksep: 80, nodesep: 60 },
  loose:   { ranksep: 120, nodesep: 150 }
}

const PORT_MAPPING = {
  'source-a': { field: 'next',         type: 'array',  color: '#3b82f6' },
  'source-b': { field: 'interrupt',    type: 'array',  color: '#f59e0b' },
  'source-c': { field: 'on_error',     type: 'string', color: '#f43f5e' }
}

const getEdgeStyle = (handleId) => {
  const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }
  return {
    style: { stroke: config.color, strokeWidth: 2 },
    animated: true,
    type: currentEdgeType.value, // 使用当前的 type
    markerEnd: MarkerType.ArrowClosed,
  }
}

// ... (初始化变量保持不变) ...
const nodes = ref([])
const edges = ref([])
const nodeTypes = { custom: markRaw(CustomNode) }

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

// ... (onValidateConnection, onConnect, onEdgesChange, handleNodeUpdate 保持不变) ...
const onValidateConnection = (connection) => {
    if (connection.targetHandle !== 'in') return false
    return true
}

// --- 2. 建立连接 (Toggle模式: 无则连, 有则断) ---
onConnect((params) => {
  // 1. 查找是否存在完全相同的连线
  const existingEdge = edges.value.find(e =>
    e.source === params.source && e.target === params.target &&
    e.sourceHandle === params.sourceHandle
  )

  // 获取端口配置
  const portConfig = PORT_MAPPING[params.sourceHandle]
  const sourceNode = findNode(params.source)

  // 2. [Toggle 逻辑] 如果已存在连线 -> 执行断开逻辑
  if (existingEdge) {
    // A. 移除视觉连线
    removeEdges([existingEdge.id])

    // B. 移除业务数据 (确保数据立刻同步，不依赖 onEdgesChange 的异步查找)
    if (sourceNode && portConfig && sourceNode.data.data) {
      const field = portConfig.field
      const targetId = params.target

      if (portConfig.type === 'array') {
        const arr = sourceNode.data.data[field]
        if (Array.isArray(arr)) {
          const idx = arr.indexOf(targetId)
          if (idx > -1) {
            arr.splice(idx, 1)
            console.log(`[Flow] Toggle: Unlinked ${params.source} -x-> ${targetId} (${field})`)
          }
        }
      } else {
        // 字符串类型 (如 on_error)
        if (sourceNode.data.data[field] === targetId) {
          delete sourceNode.data.data[field]
           console.log(`[Flow] Toggle: Unlinked ${params.source} -x-> ${targetId} (${field})`)
        }
      }
    }
    // C. 阻止后续的添加逻辑
    return
  }

  // 3. [原有逻辑] 如果不存在连线 -> 执行连接逻辑

  // 添加视觉连线
  addEdges({
    ...params,
    ...getEdgeStyle(params.sourceHandle),
    label: portConfig ? portConfig.field : undefined
  })

  // 更新业务数据: 将目标ID写入源节点
  if (sourceNode && portConfig) {
    const field = portConfig.field
    const targetId = params.target

    if (!sourceNode.data.data) sourceNode.data.data = {}

    if (portConfig.type === 'array') {
      if (!Array.isArray(sourceNode.data.data[field])) sourceNode.data.data[field] = []
      if (!sourceNode.data.data[field].includes(targetId)) {
        sourceNode.data.data[field].push(targetId)
        console.log(`[Flow] Linked: ${sourceNode.id} -> ${targetId} (${field})`)
      }
    } else {
      sourceNode.data.data[field] = targetId
      console.log(`[Flow] Linked: ${sourceNode.id} -> ${targetId} (${field})`)
    }
  }
})
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

const handleNodeUpdate = ({ oldId, newId, newType }) => {
    const node = findNode(oldId)
    if (!node) return
    if (oldId !== newId) {
        if (findNode(newId)) return alert(`ID "${newId}" already exists!`)
        node.id = newId
        node.data.id = newId
        node.data.data.id = newId
        edges.value = edges.value.map(e => {
            let update = {}
            if (e.source === oldId) update.source = newId
            if (e.target === oldId) update.target = newId
            if (update.source || update.target) return { ...e, ...update, id: e.id.replace(oldId, newId) }
            return e
        })
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
            singleFields.forEach(field => { if (d[field] === oldId) d[field] = newId })
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

// 画布右键
const onPaneContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'pane', data: null, flowPos }
}

// 节点右键
const onNodeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'node', data: params.node }
}

// --- 修复1：新增连线右键 ---
const onEdgeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'edge', data: params.edge }
}

const createNodeObject = (id, rawContent, isMissing = false) => {
  let logicType = rawContent.recognition || 'DirectHit'
  if (isMissing) logicType = 'Unknown'
  return {
    id: id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { id: id, type: logicType, data: { ...rawContent, id: id, recognition: logicType }, _isMissing: isMissing }
  }
}

// --- 数据加载 ---
const onNodesLoaded = ({ filename, nodes: rawNodesData }) => {
    // ... (保持原有的加载逻辑) ...
    const newNodes = []
    const newEdges = []
    const createdNodeIds = new Set()
    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
        newNodes.push(createNodeObject(nodeId, nodeContent))
        createdNodeIds.add(nodeId)
    }
    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
        const linkFields = [
            { key: 'next', handle: 'source-a' }, { key: 'interrupt', handle: 'source-b' },
            { key: 'on_error', handle: 'source-c' }, { key: 'timeout_next', handle: 'source-c' }
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
                        id: `e-${nodeId}-${targetId}-${key}`, source: nodeId, target: targetId,
                        sourceHandle: handle, targetHandle: 'in', label: key, ...getEdgeStyle(handle)
                    })
                })
            }
        })
    }
    // 加载时使用当前配置的间距
    const layoutedNodes = layout(newNodes, newEdges, SPACING_OPTIONS[currentSpacing.value])
    nodes.value = layoutedNodes
    edges.value = newEdges
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50)
}


// --- 修复2：完善 handleMenuAction ---
const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()

  switch (action) {
    // --- 节点操作 ---
    case 'add':
      const newNodeType = payload || 'DirectHit'
      const newId = `N-${Date.now()}`
      let defaultBusinessData = { id: newId, recognition: newNodeType }
      nodes.value.push(createNodeObject(newId, defaultBusinessData))
      // 放在鼠标点击的位置
      if (menu.value.flowPos) {
         // 这里要确保获取的是最新的 nodes 引用中的最后一个元素
         const lastNode = nodes.value[nodes.value.length - 1]
         lastNode.position = { ...menu.value.flowPos }
      }
      break

    case 'duplicate':
        // 简单实现复制
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
      // 如果是节点
      if (type === 'node') {
        removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id))
        nodes.value = nodes.value.filter(n => n.id !== data.id)
      }
      // 如果是连线
      else if (type === 'edge') {
        removeEdges([data.id])
      }
      break

    case 'edit':
       editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data.data)) }
       break

    // --- 全局操作 ---
    case 'clear':
      nodes.value = []
      edges.value = []
      break

    case 'reset':
      fitView({ padding: 0.2, duration: 500 })
      break

    case 'layout':
      nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[currentSpacing.value])
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      break

    // --- 修复3：布局间距切换 ---
    case 'changeSpacing':
      if (payload && SPACING_OPTIONS[payload]) {
        currentSpacing.value = payload
        // 切换后立即重新布局
        nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[payload])
        setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      }
      break

    // --- 修复4：连线样式切换 ---
    case 'changeEdgeType':
      if (payload) {
        currentEdgeType.value = payload
        // 遍历更新所有现存连线的 type
        edges.value = edges.value.map(edge => ({
          ...edge,
          type: payload
        }))
      }
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