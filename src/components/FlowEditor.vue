<script setup>
import { ref } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import CustomNode from './Flow/CustomNode.vue'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue'
import { useLayout } from '../utils/useLayout'

// --- 状态管理 ---
const currentEdgeType = ref('smoothstep')
const currentSpacing = ref('normal') // 当前间距模式

// 间距配置映射表
const SPACING_OPTIONS = {
  compact: { ranksep: 40, nodesep: 30 }, // 紧凑
  normal:  { ranksep: 80, nodesep: 60 }, // 默认 (稍微加大一点，视觉更好)
  loose:   { ranksep: 120, nodesep: 150 } // 宽松
}

// ... (EDGE_COLORS, getEdgeStyle 保持不变) ...
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

// ... (初始化 nodes, edges, nodeTypes 保持不变) ...
const nodes = ref([
  { id: '1', type: 'custom', position: { x: 250, y: 50 }, data: { id: 'N-1', type: 'trigger', source: 'API', cron: '*/5 * * * *' } },
  { id: '2', type: 'custom', position: { x: 250, y: 250 }, data: { id: 'N-2', type: 'process', algorithm: 'NLP-V2', progress: 50 } },
])
const edges = ref([{ id: 'e1-2', source: '1', target: '2', sourceHandle: 'source-a', targetHandle: 'in', ...getEdgeStyle('source-a') }])
const nodeTypes = { custom: CustomNode }

const { onConnect, addEdges, removeEdges, setViewport, screenToFlowCoordinate, findNode, fitView } = useVueFlow()
const { layout } = useLayout()

// ... (onConnect 保持不变) ...
onConnect((params) => {
  const existingEdge = edges.value.find(e =>
    e.source === params.source && e.target === params.target &&
    e.sourceHandle === params.sourceHandle && e.targetHandle === params.targetHandle
  )
  if (existingEdge) removeEdges([existingEdge.id])
  else addEdges({ ...params, ...getEdgeStyle(params.sourceHandle) })
})

// ... (菜单事件 保持不变) ...
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

const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()
  switch (action) {
    case 'add':
      // ... (添加节点逻辑不变) ...
      const newNodeType = payload || 'process'
      const newId = `N-${Date.now()}`
      let defaultData = { id: newId, type: newNodeType }
      nodes.value.push({ id: String(Date.now()), type: 'custom', position: menu.value.flowPos || { x: 100, y: 100 }, data: defaultData })
      break

    // 1. 执行自动布局
    case 'layout':
      const options = SPACING_OPTIONS[currentSpacing.value] // 使用当前配置的间距
      nodes.value = layout(nodes.value, edges.value, options)
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
      break

    // 2. 更改间距设置 (并立即重新布局体验更好)
    case 'changeSpacing':
      if (payload) {
        currentSpacing.value = payload
        // 自动触发一次布局，让用户立刻看到效果
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

    case 'edit': editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data)) }; break
    case 'duplicate':
        /* 复制逻辑 */
        const copyNode = JSON.parse(JSON.stringify(data));
        copyNode.id = `${data.id}-copy`;
        copyNode.position = {x:data.position.x+50,y:data.position.y+50};
        nodes.value.push(copyNode);
        break;
    case 'delete': removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id)); nodes.value = nodes.value.filter(n => n.id !== data.id); break
    case 'reset': setViewport({ x: 0, y: 0, zoom: 1 }); break
    case 'clear': nodes.value = []; edges.value = []; break
  }
}

const handleEditorSave = (newData) => { /* ... (保持不变) ... */
  const targetNode = findNode(editor.value.nodeId)
  if (targetNode) {
    if (newData.cron) newData.type = 'trigger'
    targetNode.data = { ...newData, type: newData.type || 'process' }
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