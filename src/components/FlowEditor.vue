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
      const newNodeType = payload || 'DirectHit'
      const newId = `N-${Date.now()}`

      // 生成适配新类型的默认数据
      let defaultData = { id: newId, type: newNodeType, status: 'idle' } // status: idle | running | error | ignored

      switch (newNodeType) {
        case 'TemplateMatch':
        case 'FeatureMatch':
          defaultData = { ...defaultData, imageName: 'sample_template_01.png', threshold: 0.8 }
          break
        case 'ColorMatch':
          defaultData = { ...defaultData, targetColor: '#ec4899', tolerance: 10 }
          break
        case 'OCR':
          defaultData = { ...defaultData, text: 'ABC-1234', language: 'eng' }
          break
        case 'NeuralNetworkClassify':
        case 'NeuralNetworkDetect':
          defaultData = { ...defaultData, modelLabel: 'Defect_Type_A', confidence: 95.5 }
          break
        case 'Custom':
          defaultData = { ...defaultData, script: 'return true;', modelLabel: 'MyScript' }
          break
        default: // DirectHit
          defaultData = { ...defaultData, description: 'Standard Match' }
      }

      nodes.value.push({
        id: String(Date.now()),
        type: 'custom',
        position: menu.value.flowPos || { x: 100, y: 100 },
        data: defaultData
      })
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

    case 'debug':
      const targetNode = findNode(data.id)
      if (targetNode) {
        // 1. 先设置为 "运行中" (触发蓝色旋转 Loading)
        console.log(`[Debug] 节点 ${data.id} 开始运行...`)
        targetNode.data = { ...targetNode.data, status: 'running' }

        // 2. 模拟 1~2秒 的异步处理时间
        const delay = 1000 + Math.random() * 1000

        setTimeout(() => {
          // 3. 随机生成一个结果状态
          const possibleStatuses = ['success', 'error', 'ignored', 'idle']
          // 增加 success 的概率 (权宜之计，为了演示效果更好)
          const weightedStatuses = [
            'success', 'success', 'success',
            'error',
            'ignored',
            'idle'
          ]
          const randomStatus = weightedStatuses[Math.floor(Math.random() * weightedStatuses.length)]

          console.log(`[Debug] 节点 ${data.id} 运行结束: ${randomStatus}`)

          // 4. 更新节点数据
          // 注意：必须创建一个新对象赋值给 data，才能触发 Vue 的响应式更新
          targetNode.data = {
            ...targetNode.data,
            status: randomStatus,
            // 如果是 AI 节点，顺便模拟一下置信度变化
            confidence: randomStatus === 'success' ? (80 + Math.random() * 20).toFixed(1) : 0
          }

        }, delay)
      }
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