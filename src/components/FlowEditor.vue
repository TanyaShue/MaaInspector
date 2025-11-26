<script setup>
import { ref } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import CustomNode from './Flow/CustomNode.vue'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue' // 引入弹窗

// --- 颜色 & 样式配置 ---
const EDGE_COLORS = { 'source-a': '#3b82f6', 'source-b': '#f59e0b', 'source-c': '#f43f5e' }
const getEdgeStyle = (handleId) => {
  const color = EDGE_COLORS[handleId] || '#94a3b8'
  return {
    style: { stroke: color, strokeWidth: 2 },
    animated: true,
    type: 'smoothstep',
    markerEnd: MarkerType.ArrowClosed,
  }
}

// --- 初始化数据 ---
const nodes = ref([
  { id: '1', type: 'custom', position: { x: 250, y: 50 }, data: { id: 'N-1', type: 'trigger', source: 'API', cron: '*/5 * * * *' } },
  { id: '2', type: 'custom', position: { x: 250, y: 250 }, data: { id: 'N-2', type: 'process', algorithm: 'NLP-V2', progress: 50 } },
])
const edges = ref([{ id: 'e1-2', source: '1', target: '2', sourceHandle: 'source-a', targetHandle: 'in', ...getEdgeStyle('source-a') }])
const nodeTypes = { custom: CustomNode }

// --- Vue Flow Hooks ---
const { onConnect, addEdges, removeEdges, setViewport, screenToFlowCoordinate, findNode } = useVueFlow()

// 连线逻辑 (互斥开关)
onConnect((params) => {
  const existingEdge = edges.value.find(e =>
    e.source === params.source && e.target === params.target &&
    e.sourceHandle === params.sourceHandle && e.targetHandle === params.targetHandle
  )
  if (existingEdge) {
    removeEdges([existingEdge.id])
  } else {
    addEdges({ ...params, ...getEdgeStyle(params.sourceHandle) })
  }
})

// --- 状态管理 ---
const menu = ref({ visible: false, x: 0, y: 0, type: null, data: null, flowPos: { x: 0, y: 0 } }) // 增加 flowPos 存储画布坐标
const editor = ref({ visible: false, nodeId: null, nodeData: null }) // 编辑弹窗状态

// --- 工具函数 ---
const getEvent = (params) => params.event || params
const closeMenu = () => { menu.value.visible = false }

// --- 核心：自动根据属性判断节点类型 ---
const inferNodeType = (data) => {
  // 如果用户手动改了 type 字段，优先使用 type
  const validTypes = ['trigger', 'process', 'decision', 'storage', 'notify']
  if (data.type && validTypes.includes(data.type)) return data.type

  // 否则根据特征字段判断
  if ('cron' in data || 'source' in data) return 'trigger'
  if ('condition' in data) return 'decision'
  if ('dbName' in data || 'writeCount' in data) return 'storage'
  if ('recipient' in data || 'message' in data) return 'notify'
  if ('algorithm' in data || 'progress' in data) return 'process'

  return 'process' // 默认
}

// --- 事件处理 ---

// 1. 画布右键 (记录坐标)
const onPaneContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()

  // 关键：将屏幕坐标转换为画布坐标
  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })

  menu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    type: 'pane',
    data: null,
    flowPos // 存起来，添加节点时用
  }
}

// 2. 节点右键
const onNodeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    type: 'node',
    data: params.node
  }
}

// 3. 菜单动作分发
const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()

  switch (action) {
    case 'add':
      // payload 是子菜单传递的具体类型，如果没有(直接点击Add Node)则默认为 process
      const newNodeType = payload || 'process'
      const newId = `N-${Date.now()}`

      // 生成默认数据
      let defaultData = { id: newId, type: newNodeType }
      if(newNodeType === 'trigger') defaultData = { ...defaultData, source: 'Http', cron: '0 0 * * *' }
      else if(newNodeType === 'decision') defaultData = { ...defaultData, condition: 'x > 10' }
      else if(newNodeType === 'storage') defaultData = { ...defaultData, dbName: 'Redis', writeCount: 0 }
      else if(newNodeType === 'notify') defaultData = { ...defaultData, recipient: 'User', message: 'Hello' }
      else defaultData = { ...defaultData, algorithm: 'Base', progress: 0 }

      nodes.value.push({
        id: String(Date.now()),
        type: 'custom',
        // 使用之前计算好的画布坐标
        position: menu.value.flowPos || { x: 100, y: 100 },
        data: defaultData
      })
      break

    case 'edit':
      // 打开编辑弹窗
      editor.value = {
        visible: true,
        nodeId: data.id,
        nodeData: JSON.parse(JSON.stringify(data.data)) // 深拷贝防止直接修改
      }
      break

    case 'duplicate':
      const copyNode = JSON.parse(JSON.stringify(data))
      copyNode.id = `${data.id}-copy-${Date.now()}`
      copyNode.position = { x: data.position.x + 50, y: data.position.y + 50 }
      copyNode.selected = false
      copyNode.data.id = copyNode.id
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

// 4. 保存编辑
const handleEditorSave = (newData) => {
  const targetNode = findNode(editor.value.nodeId)
  if (targetNode) {
    // 自动判断类型
    const newType = inferNodeType(newData)

    // 更新数据和类型
    targetNode.data = { ...newData, type: newType }

    // 强制触发 Vue 响应式更新 (有时直接修改 data 属性不够)
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

      <!-- 右键菜单 -->
      <ContextMenu
        v-if="menu.visible"
        v-bind="menu"
        @close="closeMenu"
        @action="handleMenuAction"
      />
    </VueFlow>

    <!-- 编辑弹窗 -->
    <NodeEditorModal
      :visible="editor.visible"
      :nodeData="editor.nodeData"
      @close="editor.visible = false"
      @save="handleEditorSave"
    />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
</style>