<script setup>
import { ref, provide, onMounted, onBeforeUnmount, computed } from 'vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { FolderSearch } from 'lucide-vue-next'
import ContextMenu from './Flow/ContextMenu.vue'
import InfoPanel from './Flow/InfoPanel.vue'
import NodeSearch from './Flow/NodeSearch.vue'
import NodeDebugPanel from './Flow/NodeDebugPanel.vue'
import SaveConfirmModal from './Flow/Modals/SaveConfirmModal.vue'
import DeleteImagesConfirmModal from './Flow/Modals/DeleteImagesConfirmModal.vue'
import { useFlowGraph } from '../utils/useFlowGraph'
import { resourceApi ,debugApi} from '../services/api'

const {
  nodes, edges, nodeTypes, currentEdgeType, currentSpacing, isDirty, currentFilename, currentSource,
  onValidateConnection,
  handleConnect, handleEdgesChange, handleNodeUpdate, loadNodes, createNodeObject, applyLayout,
  getNodesData, getImageData, clearTempImageData, clearDirty,
  setEdgeJumpBack, layoutChainFromNode // 引入新功能
} = useFlowGraph()

const { fitView, removeEdges, findNode, screenToFlowCoordinate } = useVueFlow()
const isFileLoaded = computed(() => !!currentFilename.value)

const closeAllDetailsSignal = ref(0)
provide('closeAllDetailsSignal', closeAllDetailsSignal)
provide('updateNode', handleNodeUpdate)
provide('currentFilename', currentFilename)

const isDeviceConnected = ref(false)
const menu = ref({ visible: false, x: 0, y: 0, type: null, data: null, flowPos: { x: 0, y: 0 } })
const editor = ref({ visible: false, nodeId: '', nodeData: null })
const searchVisible = ref(false)
const debugPanel = ref({ visible: false, nodeId: '' })

// Panels & Confirm Modals State
const infoPanelRef = ref(null)
const pendingFocusNodeId = ref(null)
const showSaveModal = ref(false)
const isSavingModal = ref(false)
const pendingSwitchConfig = ref(null)
const showDeleteImagesModal = ref(false)
const isProcessingImages = ref(false)
const unusedImages = ref([])
const usedImages = ref([])
const pendingSaveConfig = ref(null)

const handleRequestSwitch = (config) => {
  if (!isDirty.value) return executeSwitch(config)
  pendingSwitchConfig.value = config
  showSaveModal.value = true
}

const executeSwitch = async (config) => {
  if (!infoPanelRef.value) return
  if (config.nodeId) {
    pendingFocusNodeId.value = config.nodeId
    searchVisible.value = false
  }
  await infoPanelRef.value.executeFileSwitch(config.filename, config.source)
}

const handleDiscardChanges = () => {
  showSaveModal.value = false
  if (pendingSwitchConfig.value) {
    executeSwitch(pendingSwitchConfig.value)
    pendingSwitchConfig.value = null
  }
}

const handleSaveAndSwitch = async () => {
  if (!infoPanelRef.value) return
  isSavingModal.value = true
  try {
    await infoPanelRef.value.handleSaveNodes()
    showSaveModal.value = false
    if (pendingSwitchConfig.value) {
      executeSwitch(pendingSwitchConfig.value)
      pendingSwitchConfig.value = null
    }
  } catch (e) { console.error("Save failed in modal", e) }
  finally { isSavingModal.value = false }
}

const handleCancelSwitch = () => { showSaveModal.value = false; pendingSwitchConfig.value = null }

// --- Unload Protection ---
const handleBeforeUnload = (e) => {
  if (isDirty.value) { e.preventDefault(); e.returnValue = ''; return '' }
}
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))

// --- Context Menu Logic ---
const closeMenu = () => menu.value.visible = false
const getEvent = (params) => params.event || params
const onPaneContextMenu = (params) => {
  if (!isFileLoaded.value) return
  const event = getEvent(params)
  event.preventDefault()
  menu.value = {
    visible: true, x: event.clientX, y: event.clientY, type: 'pane', data: null,
    flowPos: screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  }
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
      const newNode = createNodeObject(newId, { id: newId, recognition: payload || 'DirectHit' })
      if (menu.value.flowPos) newNode.position = { ...menu.value.flowPos }
      nodes.value.push(newNode)
      break
    case 'debug_this_node':
      if (type === 'node') {
        handleDebugNode(data.id, 'standard')
      }
      break
    case 'debug_this_node_reco':
      if (type === 'node') {
        handleDebugNode(data.id, 'recognition_only')
      }
      break
    case 'debug_in_panel':
      if (type === 'node') {
        debugPanel.value = { visible: true, nodeId: data.id }
      }
      break
    case 'edit':
      editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data.data || { id: data.id, recognition: 'DirectHit' })) }
      break
    case 'duplicate':
      if (data) {
        const copyId = `N-${Date.now()}`, copyData = JSON.parse(JSON.stringify(data.data.data))
        copyData.id = copyId
        const copyNode = createNodeObject(copyId, copyData)
        copyNode.position = { x: data.position.x + 50, y: data.position.y + 50 }
        nodes.value.push(copyNode)
      }
      break
    case 'delete':
      if (type === 'node') { removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id)); nodes.value = nodes.value.filter(n => n.id !== data.id) }
      else if (type === 'edge') removeEdges([data.id])
      break
    case 'setJumpBack':
        if (type === 'edge') {
            setEdgeJumpBack(data.id, true)
        }
        break
    case 'setNormalLink':
        if (type === 'edge') {
            setEdgeJumpBack(data.id, false)
        }
        break
    case 'layout_chain':
      if (type === 'node') {
        layoutChainFromNode(data.id, currentSpacing.value)
      }
      break
    case 'layout': applyLayout(currentSpacing.value); break
    case 'changeSpacing': if (payload) { currentSpacing.value = payload; applyLayout(payload) }; break
    case 'changeEdgeType': if (payload) { currentEdgeType.value = payload; edges.value = edges.value.map(e => ({ ...e, type: payload })) }; break
    case 'reset': fitView({ padding: 0.2, duration: 500 }); break
    case 'clear': nodes.value = []; edges.value = []; break
    case 'search': searchVisible.value = true; break
    case 'closeSearch': searchVisible.value = false; break
    case 'openDebugPanel':
      debugPanel.value = { visible: true, nodeId: type === 'node' ? data?.id : '' }
      break
    case 'closeDebugPanel':
      debugPanel.value = { ...debugPanel.value, visible: false, nodeId: '' }
      break
    case 'closeAllDetails': closeAllDetailsSignal.value++; break
  }
}

// 3. 新增核心调试处理函数
const handleDebugNode = async (nodeId, mode = 'standard') => {
  const node = findNode(nodeId)
  if (!node) return

  // 仅重置结果缓存，状态改由后端 SSE 统一驱动
  node.data._result = null

  try {
    // 2. 触发保存
    await handleSaveNodes({
      source: currentSource.value,
      filename: currentFilename.value
    })

    // 3. 准备发送给接口的数据
    const debugPayload = {
      node: node.data.data,
      debug_mode: mode,
      context: {
        source: currentSource.value,
        filename: currentFilename.value
      }
    }

    // 4. 调用接口
    const res = await debugApi.runNode(debugPayload)

    // 5. 将完整返回结果写入 _result（状态由 SSE 更新）
    node.data._result = res

  } catch (error) {
    console.error('Debug failed:', error)
    node.data._result = {
      success: false,
      error: error.message || 'Network/Server Error'
    }
  } finally {
    nodes.value = [...nodes.value]
  }
}
const handleUpdateNodeStatus = ({ nodeId, status }) => {
  if (!nodeId || !status) return
  let changed = false
  nodes.value = nodes.value.map(n => {
    const match = n.id === nodeId || n.data?.data?.id === nodeId
    if (!match) return n
    if (n.data?.status === status) return n
    changed = true
    return { ...n, data: { ...n.data, status } }
  })
  if (changed) {
    nodes.value = [...nodes.value]
  }
}
const handleLocateNode = (nodeId) => {
  nodes.value = nodes.value.map(n => ({ ...n, selected: n.id === nodeId }))
  setTimeout(() => fitView({ nodes: [nodeId], padding: 0.5, maxZoom: 1.5, minZoom: 0.8, duration: 600 }), 50)
}

const handleLoadNodesWrapper = (payload) => {
  loadNodes(payload)
  if (pendingFocusNodeId.value) {
    const targetId = pendingFocusNodeId.value
    setTimeout(() => { handleLocateNode(targetId); pendingFocusNodeId.value = null }, 300)
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
  nodes.value = nodes.value.map(node => imageDataMap[node.id] ? { ...node, data: { ...node.data, _images: imageDataMap[node.id] } } : node)
}

const handleUpdateCanvasConfig = ({ edgeType, spacing }) => {
  if (edgeType && edgeType !== currentEdgeType.value) {
    currentEdgeType.value = edgeType
    edges.value = edges.value.map(edge => ({ ...edge, type: edgeType }))
  }
  if (spacing && spacing !== currentSpacing.value) currentSpacing.value = spacing
}

// --- Save & Image Handling ---
const handleSaveNodes = async ({ source, filename }) => {
  try {
    const { delImages, tempImages } = getImageData()
    if (delImages.length > 0 || tempImages.length > 0) {
      pendingSaveConfig.value = { source, filename }
      if (delImages.length > 0) {
        const checkRes = await resourceApi.checkUnusedImages(source, filename, delImages)
        unusedImages.value = checkRes.unused_images || []
        usedImages.value = checkRes.used_images || []
        if (unusedImages.value.length > 0) { showDeleteImagesModal.value = true; return }
      }
      await processImagesAndSave(source, filename, [], tempImages)
    } else {
      await saveNodesOnly(source, filename)
    }
  } catch (e) { console.error('[FlowEditor] 保存失败:', e); throw e }
}

const processImagesAndSave = async (source, filename, deletePaths, tempImages) => {
  try {
    if (deletePaths.length > 0 || tempImages.length > 0) {
      await resourceApi.processImages(source, deletePaths, tempImages)
    }
    clearTempImageData()
    await saveNodesOnly(source, filename)
  } catch (e) { console.error('[FlowEditor] 图片处理失败:', e); throw e }
}

const saveNodesOnly = async (source, filename) => {
  const res = await resourceApi.saveFileNodes(source, filename, getNodesData())
  if (res.success) { clearDirty(); console.log('[FlowEditor] 保存成功:', filename) }
}

const handleConfirmDeleteImages = async () => {
  if (!pendingSaveConfig.value) return
  isProcessingImages.value = true
  try {
    await processImagesAndSave(pendingSaveConfig.value.source, pendingSaveConfig.value.filename, unusedImages.value, getImageData().tempImages)
    showDeleteImagesModal.value = false; pendingSaveConfig.value = null
  } catch (e) { alert('保存失败: ' + (e.message || '未知错误')) }
  finally { isProcessingImages.value = false }
}

const handleSkipDeleteImages = async () => {
  if (!pendingSaveConfig.value) return
  isProcessingImages.value = true
  try {
    await processImagesAndSave(pendingSaveConfig.value.source, pendingSaveConfig.value.filename, [], getImageData().tempImages)
    showDeleteImagesModal.value = false; pendingSaveConfig.value = null
  } catch (e) { alert('保存失败: ' + (e.message || '未知错误')) }
  finally { isProcessingImages.value = false }
}

const handleCancelDeleteImages = () => { showDeleteImagesModal.value = false; pendingSaveConfig.value = null }
</script>

<template>
  <div class="w-full h-full min-h-[500px] bg-slate-50 relative">
    <VueFlow
        v-model:nodes="nodes" v-model:edges="edges" :node-types="nodeTypes"
        :default-zoom="1" :min-zoom="0.1" :max-zoom="4" fit-view-on-init
        :is-valid-connection="onValidateConnection"
        :nodes-draggable="isFileLoaded" :nodes-connectable="isFileLoaded" :elements-selectable="isFileLoaded"
        @connect="handleConnect" @edges-change="handleEdgesChange"
        @pane-context-menu="onPaneContextMenu" @node-context-menu="onNodeContextMenu" @edge-context-menu="onEdgeContextMenu"
        @pane-click="closeMenu" @node-click="closeMenu" @edge-click="closeMenu" @move-start="closeMenu"
    >
      <Background pattern-color="#cbd5e1" :gap="20"/>
      <Controls/>

      <Panel position="top-right" class="m-4 pointer-events-none !z-20">
        <InfoPanel
            ref="infoPanelRef" :node-count="nodes.length" :edge-count="edges.length" :is-dirty="isDirty"
            :current-filename="currentFilename" :edge-type="currentEdgeType" :spacing="currentSpacing"
            @load-nodes="handleLoadNodesWrapper" @load-images="handleLoadImages" @save-nodes="handleSaveNodes"
            @device-connected="(val) => isDeviceConnected = val" @request-switch-file="handleRequestSwitch"
            @update-canvas-config="handleUpdateCanvasConfig"
        />
      </Panel>

      <div v-if="!isFileLoaded" class="absolute inset-0 z-10 bg-slate-100/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none transition-all">
        <div class="flex flex-col items-center gap-4 p-8 bg-white/80 border border-slate-200 rounded-2xl shadow-xl">
          <div class="p-4 bg-indigo-50 rounded-full"><FolderSearch class="w-12 h-12 text-indigo-400" /></div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold text-slate-700">未加载资源文件</h3>
            <p class="text-sm text-slate-500">请在右上角控制台选择并加载资源文件以开始编辑</p>
          </div>
        </div>
      </div>

      <ContextMenu
          v-if="menu.visible"
          v-bind="menu"
          :currentEdgeType="currentEdgeType"
          :currentSpacing="currentSpacing"
          :debug-panel-visible="debugPanel.visible"
          :search-visible="searchVisible"
          @close="closeMenu"
          @action="handleMenuAction"
      />
    </VueFlow>
    <NodeSearch :visible="searchVisible" :nodes="nodes" :current-filename="currentFilename" :current-source="currentSource" @close="searchVisible = false" @locate-node="handleLocateNode" @switch-file="handleRequestSwitch"/>
    <NodeDebugPanel
      :visible="debugPanel.visible"
      :nodes="nodes"
      :current-filename="currentFilename"
      :current-source="currentSource"
      :initial-node-id="debugPanel.nodeId"
      @close="debugPanel.visible = false"
      @locate-node="handleLocateNode"
      @debug-node="(nodeId) => handleDebugNode(nodeId, 'standard')"
      @update-node-status="handleUpdateNodeStatus"
    />
    <SaveConfirmModal :visible="showSaveModal" :filename="currentFilename" :is-saving="isSavingModal" @cancel="handleCancelSwitch" @discard="handleDiscardChanges" @save="handleSaveAndSwitch"/>
    <DeleteImagesConfirmModal :visible="showDeleteImagesModal" :unused-images="unusedImages" :used-images="usedImages" :is-processing="isProcessingImages" @cancel="handleCancelDeleteImages" @confirm="handleConfirmDeleteImages" @skip="handleSkipDeleteImages"/>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
.vue-flow__panel { pointer-events: none; }
</style>