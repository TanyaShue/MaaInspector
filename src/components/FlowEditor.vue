<script setup>
import { ref, provide, onMounted, onBeforeUnmount } from 'vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue'
import InfoPanel from './Flow/InfoPanel.vue'
import NodeSearch from './Flow/NodeSearch.vue'
import SaveConfirmModal from './Flow/Modals/SaveConfirmModal.vue' // [新增]
import { useFlowGraph } from '../utils/useFlowGraph.js'
import { resourceApi } from '../services/api.js'

// --- 引入逻辑 Hook ---
const {
  nodes, edges, nodeTypes, currentEdgeType, currentSpacing,
  isDirty, currentFilename,
  onValidateConnection, handleConnect, handleEdgesChange, handleNodeUpdate,
  loadNodes, createNodeObject, applyLayout, getNodesData, clearDirty
} = useFlowGraph()

const { fitView, removeEdges, findNode, screenToFlowCoordinate } = useVueFlow()

// --- 信号与状态 ---
const closeAllDetailsSignal = ref(0)
provide('closeAllDetailsSignal', closeAllDetailsSignal)
provide('updateNode', handleNodeUpdate)

const isDeviceConnected = ref(false)
const menu = ref({ visible: false, x: 0, y: 0, type: null, data: null, flowPos: { x: 0, y: 0 } })
const editor = ref({ visible: false, nodeId: '', nodeData: null })
const searchVisible = ref(false)

// InfoPanel 引用与聚焦
const infoPanelRef = ref(null)
const pendingFocusNodeId = ref(null)

// --- [新增] 未保存确认逻辑 ---
const showSaveModal = ref(false)
const isSavingModal = ref(false)
const pendingSwitchConfig = ref(null) // { filename, source, nodeId? }

const handleRequestSwitch = (config) => {

  if (!isDirty.value) {
    executeSwitch(config)
    return
  }

  pendingSwitchConfig.value = config
  showSaveModal.value = true
}

const executeSwitch = async (config) => {
  if (!infoPanelRef.value) return
  
  if (config.nodeId) {
    pendingFocusNodeId.value = config.nodeId
    searchVisible.value = false // 既然要跳转了，关闭搜索框
  }
  
  await infoPanelRef.value.executeFileSwitch(config.filename, config.source)
}

// 弹窗 Action: 不保存
const handleDiscardChanges = () => {
  showSaveModal.value = false
  if (pendingSwitchConfig.value) {
    executeSwitch(pendingSwitchConfig.value)
    pendingSwitchConfig.value = null
  }
}

// 弹窗 Action: 保存并切换
const handleSaveAndSwitch = async () => {
  if (!infoPanelRef.value) return
  isSavingModal.value = true
  try {
    // 调用 InfoPanel 的保存逻辑
    await infoPanelRef.value.handleSaveNodes()
    // 保存成功后，继续切换
    showSaveModal.value = false
    if (pendingSwitchConfig.value) {
      executeSwitch(pendingSwitchConfig.value)
      pendingSwitchConfig.value = null
    }
  } catch (e) {
    // 保存失败停留，不切换
    console.error("Save failed in modal", e)
  } finally {
    isSavingModal.value = false
  }
}

const handleCancelSwitch = () => {
  showSaveModal.value = false
  pendingSwitchConfig.value = null
  // InfoPanel 的下拉框 UI 会因为 reactivity 自动恢复原状 (因为 selectedResourceFile 没变)
}

const handleBeforeUnload = (e) => {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
}

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))

const closeMenu = () => { menu.value.visible = false }
const getEvent = (params) => params.event || params
const onPaneContextMenu = (params) => {
  const event = getEvent(params); event.preventDefault();
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'pane', data: null, flowPos: screenToFlowCoordinate({ x: event.clientX, y: event.clientY }) }
}
const onNodeContextMenu = (params) => {
  const event = getEvent(params); event.preventDefault();
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'node', data: params.node }
}
const onEdgeContextMenu = (params) => {
  const event = getEvent(params); event.preventDefault();
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'edge', data: params.edge }
}

const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()
  switch (action) {
    case 'add':
      const newId = `N-${Date.now()}`
      nodes.value.push(createNodeObject(newId, { id: newId, recognition: payload || 'DirectHit' }))
      if (menu.value.flowPos) nodes.value[nodes.value.length - 1].position = { ...menu.value.flowPos }
      break
    case 'debug':
      if (type === 'node') {
        const node = findNode(data.id)
        if (node) { node.data.status = 'running'; setTimeout(() => { node.data.status = 'success' }, 1500) }
      }
      break
    case 'edit':
      editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data.data || { id: data.id, recognition: 'DirectHit' })) }
      break
    case 'duplicate':
      if (data) {
        const copyId = `N-${Date.now()}`; const copyData = JSON.parse(JSON.stringify(data.data.data)); copyData.id = copyId;
        const copyNode = createNodeObject(copyId, copyData); copyNode.position = { x: data.position.x + 50, y: data.position.y + 50 }; nodes.value.push(copyNode)
      }
      break
    case 'delete':
      if (type === 'node') { removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id)); nodes.value = nodes.value.filter(n => n.id !== data.id) }
      else if (type === 'edge') removeEdges([data.id])
      break
    case 'layout': applyLayout(currentSpacing.value); break
    case 'changeSpacing': if (payload) { currentSpacing.value = payload; applyLayout(payload) }; break
    case 'changeEdgeType': if (payload) { currentEdgeType.value = payload; edges.value = edges.value.map(edge => ({ ...edge, type: payload })) }; break
    case 'reset': fitView({ padding: 0.2, duration: 500 }); break
    case 'clear': nodes.value = []; edges.value = []; break
    case 'search': searchVisible.value = true; break
    case 'closeAllDetails': closeAllDetailsSignal.value++; break
  }
}

const handleLocateNode = (nodeId) => {
  nodes.value = nodes.value.map(n => ({ ...n, selected: n.id === nodeId }))
  setTimeout(() => { fitView({ nodes: [nodeId], padding: 0.5, maxZoom: 1.5, minZoom: 0.8, duration: 600 }) }, 50)
}

// 加载节点后的回调，用于处理跳转聚焦
const handleLoadNodesWrapper = (payload) => {
  loadNodes(payload)
  if (pendingFocusNodeId.value) {
    const targetId = pendingFocusNodeId.value
    setTimeout(() => {
      handleLocateNode(targetId)
      pendingFocusNodeId.value = null
    }, 300)
  }
}

const handleEditorSave = (newBusinessData) => {
  const targetNode = findNode(editor.value.nodeId)
  if (targetNode) {
    targetNode.data.data = { ...newBusinessData }
    if (newBusinessData.id && newBusinessData.id !== targetNode.id) { targetNode.id = newBusinessData.id; targetNode.data.id = newBusinessData.id }
    if (newBusinessData.recognition) targetNode.data.type = newBusinessData.recognition
    nodes.value = [...nodes.value]
  }
  editor.value.visible = false
}

const handleLoadImages = (imageDataMap) => {
  if (!imageDataMap) return
  nodes.value = nodes.value.map(node => {
    if (imageDataMap[node.id]) { return { ...node, data: { ...node.data, _images: imageDataMap[node.id] } } }
    return node
  })
}

const handleSaveNodes = async ({ source, filename }) => {
  try {
    const nodesData = getNodesData()
    const res = await resourceApi.saveFileNodes(source, filename, nodesData)
    if (res.success) { clearDirty(); console.log('[FlowEditor] 保存成功:', filename) }
  } catch (e) { console.error('[FlowEditor] 保存失败:', e); throw e }
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
      @connect="handleConnect"
      @edges-change="handleEdgesChange"
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

      <Panel position="top-right" class="m-4 pointer-events-none">
        <InfoPanel
          ref="infoPanelRef" 
          :node-count="nodes.length"
          :edge-count="edges.length"
          :is-dirty="isDirty"
          :current-filename="currentFilename"
          @load-nodes="handleLoadNodesWrapper"
          @load-images="handleLoadImages"
          @save-nodes="handleSaveNodes"
          @device-connected="(val) => isDeviceConnected = val"
          @request-switch-file="handleRequestSwitch"
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
    <NodeEditorModal
      :visible="editor.visible"
      :nodeId="editor.nodeId"
      :nodeData="editor.nodeData"
      @close="editor.visible = false"
      @save="handleEditorSave"
    />
    <NodeSearch
      :visible="searchVisible"
      :nodes="nodes"
      :current-filename="currentFilename"
      @close="searchVisible = false"
      @locate-node="handleLocateNode"
      @switch-file="handleRequestSwitch"
    />

    <SaveConfirmModal 
      :visible="showSaveModal"
      :filename="currentFilename"
      :is-saving="isSavingModal"
      @cancel="handleCancelSwitch"
      @discard="handleDiscardChanges"
      @save="handleSaveAndSwitch"
    />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
.vue-flow__panel { pointer-events: none; }
</style>