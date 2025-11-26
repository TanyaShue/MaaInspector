<script setup>
import { ref } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import CustomNode from './Flow/CustomNode.vue'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue'
import { useLayout } from '../utils/useLayout' // 确保你之前创建了此文件

// --- 状态管理 ---
const currentEdgeType = ref('smoothstep')
const currentSpacing = ref('normal')
const SPACING_OPTIONS = {
  compact: { ranksep: 40, nodesep: 30 },
  normal:  { ranksep: 80, nodesep: 60 },
  loose:   { ranksep: 120, nodesep: 150 }
}

// --- 样式配置 ---
const EDGE_COLORS = { 'source-a': '#3b82f6', 'source-b': '#f59e0b', 'source-c': '#f43f5e' }
const getEdgeStyle = (handleId) => {
  const color = EDGE_COLORS[handleId] || '#94a3b8'
  return {
    style: { stroke: color, strokeWidth: 2 },
    animated: true,
    type: currentEdgeType.value,
    markerEnd: MarkerType.ArrowClosed,
  }
}

// --- 初始化 ---
const nodes = ref([
  { id: '1', type: 'custom', position: { x: 250, y: 50 }, data: { id: 'N-1', type: 'DirectHit', description: 'Start Node', status: 'success' } },
  { id: '2', type: 'custom', position: { x: 250, y: 250 }, data: { id: 'N-2', type: 'NeuralNetworkClassify', modelLabel: 'Initial_Check', confidence: 88, status: 'idle' } },
])
const edges = ref([{ id: 'e1-2', source: '1', target: '2', sourceHandle: 'source-a', targetHandle: 'in', ...getEdgeStyle('source-a') }])
const nodeTypes = { custom: CustomNode }

// --- Vue Flow Hooks ---
const { onConnect, addEdges, removeEdges, setViewport, screenToFlowCoordinate, findNode, fitView } = useVueFlow()
const { layout } = useLayout()

// 连线逻辑：互斥 (重复连接则断开)
onConnect((params) => {
  const existingEdge = edges.value.find(e =>
    e.source === params.source && e.target === params.target &&
    e.sourceHandle === params.sourceHandle && e.targetHandle === params.targetHandle
  )
  if (existingEdge) removeEdges([existingEdge.id])
  else addEdges({ ...params, ...getEdgeStyle(params.sourceHandle) })
})

// --- 菜单与编辑状态 ---
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

// --- 核心：菜单动作处理 ---
const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()

  switch (action) {
    case 'add':
      const newNodeType = payload || 'DirectHit'
      const newId = `N-${Date.now()}`
      let defaultData = { id: newId, type: newNodeType, status: 'idle' }

      // 生成对应类型的默认数据
      if(['TemplateMatch', 'FeatureMatch'].includes(newNodeType)) defaultData = {...defaultData, imageName: 'template_01.png', threshold: 0.8}
      else if(newNodeType === 'ColorMatch') defaultData = {...defaultData, targetColor: '#ec4899', tolerance: 10}
      else if(newNodeType === 'OCR') defaultData = {...defaultData, text: '', language: 'eng'}
      else if(['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(newNodeType)) defaultData = {...defaultData, modelLabel: 'Defect_Model_A', confidence: 0}
      else if(newNodeType === 'Custom') defaultData = {...defaultData, script: 'return true;', modelLabel: 'MyScript'}
      else defaultData = {...defaultData, description: 'Standard Match'}

      nodes.value.push({
        id: String(Date.now()),
        type: 'custom',
        position: menu.value.flowPos || { x: 100, y: 100 },
        data: defaultData
      })
      break

    // --- 调试功能 ---
    case 'debug':
      const targetNode = findNode(data.id)
      if (targetNode) {
        console.log(`[Debug] Node ${data.id} started.`)
        targetNode.data = { ...targetNode.data, status: 'running' } // 设置运行状态

        // 模拟异步耗时
        const delay = 800 + Math.random() * 1200
        setTimeout(() => {
          // 随机结果
          const statuses = ['success', 'success', 'success', 'error', 'ignored']
          const resStatus = statuses[Math.floor(Math.random() * statuses.length)]

          // 模拟识别结果表格
          const mockResults = [
            { key: 'Process Time', value: (Math.random() * 50).toFixed(2) + ' ms' },
            { key: 'Score', value: (Math.random()).toFixed(4) },
            { key: 'Coordinates', value: `{x:${Math.floor(Math.random()*100)}, y:${Math.floor(Math.random()*100)}}` },
            { key: 'Memory', value: '14.2 MB' },
            { key: 'Thread', value: 'Worker-01' }
          ]

          // 更新数据
          targetNode.data = {
            ...targetNode.data,
            status: resStatus,
            confidence: resStatus === 'success' ? (80 + Math.random() * 20).toFixed(1) : 0,
            results: resStatus === 'success' ? mockResults : [{ key: 'Error', value: 'Timeout / Not Found' }]
          }
        }, delay)
      }
      break

    case 'layout':
      const options = SPACING_OPTIONS[currentSpacing.value]
      nodes.value = layout(nodes.value, edges.value, options)
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      break

    case 'changeSpacing':
      if (payload) {
        currentSpacing.value = payload
        const newOpts = SPACING_OPTIONS[payload]
        nodes.value = layout(nodes.value, edges.value, newOpts)
        setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      }
      break

    case 'changeEdgeType':
      if (payload) {
        currentEdgeType.value = payload
        edges.value = edges.value.map(edge => ({ ...edge, type: payload }))
      }
      break

    case 'edit':
      editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data)) }
      break

    case 'duplicate':
      const copyNode = JSON.parse(JSON.stringify(data))
      copyNode.id = `${data.id}-copy-${Date.now()}`
      copyNode.position = { x: data.position.x + 50, y: data.position.y + 50 }
      copyNode.data.id = copyNode.id
      copyNode.selected = false
      nodes.value.push(copyNode)
      break

    case 'delete':
      removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id))
      nodes.value = nodes.value.filter(n => n.id !== data.id)
      break

    case 'reset': setViewport({ x: 0, y: 0, zoom: 1 }); break
    case 'clear': nodes.value = []; edges.value = []; break
  }
}

// --- 编辑保存 ---
const handleEditorSave = (newData) => {
  const targetNode = findNode(editor.value.nodeId)
  if (targetNode) {
    // 简单的类型保护，实际生产可增加更多校验
    targetNode.data = { ...newData, type: newData.type || targetNode.data.type }
    nodes.value = [...nodes.value] // 触发响应式更新
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
      fit-view-on-init
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      @pane-click="closeMenu"
      @node-click="closeMenu"
      @move-start="closeMenu"
    >
      <Background pattern-color="#cbd5e1" :gap="20" />
      <Controls />

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
</style>