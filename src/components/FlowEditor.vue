<script setup>
import {ref, provide, onMounted, onBeforeUnmount, computed} from 'vue'
import {VueFlow, useVueFlow, Panel} from '@vue-flow/core'
import {Background} from '@vue-flow/background'
import {Controls} from '@vue-flow/controls'
import {FolderSearch} from 'lucide-vue-next'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue'
import InfoPanel from './Flow/InfoPanel.vue'
import NodeSearch from './Flow/NodeSearch.vue'
import SaveConfirmModal from './Flow/Modals/SaveConfirmModal.vue'
import DeleteImagesConfirmModal from './Flow/Modals/DeleteImagesConfirmModal.vue'
import {useFlowGraph} from '../utils/useFlowGraph.js'
import {resourceApi} from '../services/api.js'

const {
  nodes, edges, nodeTypes, currentEdgeType, currentSpacing,
  isDirty, currentFilename, currentSource,
  onValidateConnection: originalValidateConnection,
  handleConnect, handleEdgesChange, handleNodeUpdate,
  loadNodes, createNodeObject, applyLayout, getNodesData, getImageData, clearTempImageData, clearDirty
} = useFlowGraph()

const {fitView, removeEdges, findNode, screenToFlowCoordinate} = useVueFlow()

// 计算属性：判断文件是否已加载
const isFileLoaded = computed(() => !!currentFilename.value)

const onValidateConnection = (connection) => {
  // 禁止节点连接自己
  if (connection.source === connection.target) return false

  // 核心修复：禁止从输入端口(id="in")发起连线
  // 这样就彻底阻止了 "输入端口 -> 输入端口" 的情况
  if (connection.sourceHandle === 'in') {
    return false
  }

  if (connection.targetHandle !== 'in') {
    return false
  }

  // 执行 useFlowGraph 中可能存在的原有校验逻辑
  if (originalValidateConnection) {
    return originalValidateConnection(connection)
  }

  return true
}

const closeAllDetailsSignal = ref(0)
provide('closeAllDetailsSignal', closeAllDetailsSignal)
provide('updateNode', handleNodeUpdate)
provide('currentFilename', currentFilename)

const isDeviceConnected = ref(false)
const menu = ref({visible: false, x: 0, y: 0, type: null, data: null, flowPos: {x: 0, y: 0}})
const editor = ref({visible: false, nodeId: '', nodeData: null})
const searchVisible = ref(false)

// InfoPanel 引用
const infoPanelRef = ref(null)
const pendingFocusNodeId = ref(null)

// --- 未保存确认逻辑 ---
const showSaveModal = ref(false)
const isSavingModal = ref(false)
const pendingSwitchConfig = ref(null)

// --- 图片删除确认逻辑 ---
const showDeleteImagesModal = ref(false)
const isProcessingImages = ref(false)
const unusedImages = ref([])
const usedImages = ref([])
const pendingSaveConfig = ref(null) // 待保存的配置 {source, filename}

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
  } catch (e) {
    console.error("Save failed in modal", e)
  } finally {
    isSavingModal.value = false
  }
}

const handleCancelSwitch = () => {
  showSaveModal.value = false
  pendingSwitchConfig.value = null
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

const closeMenu = () => {
  menu.value.visible = false
}
const getEvent = (params) => params.event || params
const onPaneContextMenu = (params) => {
  // 依然保持右键菜单拦截，防止未加载文件时添加节点
  if (!isFileLoaded.value) return

  const event = getEvent(params);
  event.preventDefault();
  menu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    type: 'pane',
    data: null,
    flowPos: screenToFlowCoordinate({x: event.clientX, y: event.clientY})
  }
}
const onNodeContextMenu = (params) => {
  const event = getEvent(params);
  event.preventDefault();
  menu.value = {visible: true, x: event.clientX, y: event.clientY, type: 'node', data: params.node}
}
const onEdgeContextMenu = (params) => {
  const event = getEvent(params);
  event.preventDefault();
  menu.value = {visible: true, x: event.clientX, y: event.clientY, type: 'edge', data: params.edge}
}

const handleMenuAction = ({action, type, data, payload}) => {
  closeMenu()
  switch (action) {
    case 'add':
      const newId = `N-${Date.now()}`
      nodes.value.push(createNodeObject(newId, {id: newId, recognition: payload || 'DirectHit'}))
      if (menu.value.flowPos) nodes.value[nodes.value.length - 1].position = {...menu.value.flowPos}
      break
    case 'debug':
      if (type === 'node') {
        const node = findNode(data.id)
        if (node) {
          node.data.status = 'running';
          setTimeout(() => {
            node.data.status = 'success'
          }, 1500)
        }
      }
      break
    case 'edit':
      editor.value = {
        visible: true,
        nodeId: data.id,
        nodeData: JSON.parse(JSON.stringify(data.data.data || {id: data.id, recognition: 'DirectHit'}))
      }
      break
    case 'duplicate':
      if (data) {
        const copyId = `N-${Date.now()}`;
        const copyData = JSON.parse(JSON.stringify(data.data.data));
        copyData.id = copyId;
        const copyNode = createNodeObject(copyId, copyData);
        copyNode.position = {x: data.position.x + 50, y: data.position.y + 50};
        nodes.value.push(copyNode)
      }
      break
    case 'delete':
      if (type === 'node') {
        removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id));
        nodes.value = nodes.value.filter(n => n.id !== data.id)
      } else if (type === 'edge') removeEdges([data.id])
      break
    case 'layout':
      applyLayout(currentSpacing.value);
      break
    case 'changeSpacing':
      if (payload) {
        currentSpacing.value = payload;
        applyLayout(payload)
      }
      ;
      break
    case 'changeEdgeType':
      if (payload) {
        currentEdgeType.value = payload;
        edges.value = edges.value.map(edge => ({...edge, type: payload}))
      }
      ;
      break
    case 'reset':
      fitView({padding: 0.2, duration: 500});
      break
    case 'clear':
      nodes.value = [];
      edges.value = [];
      break
    case 'search':
      searchVisible.value = true;
      break
    case 'closeAllDetails':
      closeAllDetailsSignal.value++;
      break
  }
}

const handleLocateNode = (nodeId) => {
  nodes.value = nodes.value.map(n => ({...n, selected: n.id === nodeId}))
  setTimeout(() => {
    fitView({nodes: [nodeId], padding: 0.5, maxZoom: 1.5, minZoom: 0.8, duration: 600})
  }, 50)
}

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
    targetNode.data.data = {...newBusinessData}
    if (newBusinessData.id && newBusinessData.id !== targetNode.id) {
      targetNode.id = newBusinessData.id;
      targetNode.data.id = newBusinessData.id
    }
    if (newBusinessData.recognition) targetNode.data.type = newBusinessData.recognition
    nodes.value = [...nodes.value]
  }
  editor.value.visible = false
}

const handleLoadImages = (imageDataMap) => {
  if (!imageDataMap) return
  nodes.value = nodes.value.map(node => {
    if (imageDataMap[node.id]) {
      return {...node, data: {...node.data, _images: imageDataMap[node.id]}}
    }
    return node
  })
}

// 处理画布配置更新（从配置文件加载）
const handleUpdateCanvasConfig = ({edgeType, spacing}) => {
  if (edgeType && edgeType !== currentEdgeType.value) {
    currentEdgeType.value = edgeType
    // 更新现有连线类型
    edges.value = edges.value.map(edge => ({...edge, type: edgeType}))
  }
  if (spacing && spacing !== currentSpacing.value) {
    currentSpacing.value = spacing
  }
}

const handleSaveNodes = async ({source, filename}) => {
  try {
    // 获取图片数据
    const { delImages, tempImages } = getImageData()

    // 如果有待删除或待保存的图片，需要先检查和处理
    if (delImages.length > 0 || tempImages.length > 0) {
      pendingSaveConfig.value = { source, filename }

      // 检查待删除图片是否被其他文件引用
      if (delImages.length > 0) {
        const checkRes = await resourceApi.checkUnusedImages(source, filename, delImages)
        unusedImages.value = checkRes.unused_images || []
        usedImages.value = checkRes.used_images || []

        // 如果有未被引用的图片，显示确认弹窗
        if (unusedImages.value.length > 0) {
          showDeleteImagesModal.value = true
          return // 等待用户确认
        }
      }

      // 没有需要确认删除的图片，直接处理临时图片并保存
      await processImagesAndSave(source, filename, [], tempImages)
    } else {
      // 没有图片需要处理，直接保存节点数据
      await saveNodesOnly(source, filename)
    }
  } catch (e) {
    console.error('[FlowEditor] 保存失败:', e);
    throw e
  }
}

// 处理图片并保存节点
const processImagesAndSave = async (source, filename, deletePaths, tempImages) => {
  try {
    // 处理图片（删除和保存）
    if (deletePaths.length > 0 || tempImages.length > 0) {
      const processRes = await resourceApi.processImages(source, deletePaths, tempImages)
      console.log('[FlowEditor] 图片处理结果:', processRes)
    }

    // 清理节点的临时图片数据
    clearTempImageData()

    // 保存节点数据
    await saveNodesOnly(source, filename)
  } catch (e) {
    console.error('[FlowEditor] 图片处理失败:', e)
    throw e
  }
}

// 仅保存节点数据
const saveNodesOnly = async (source, filename) => {
  const nodesData = getNodesData()
  const res = await resourceApi.saveFileNodes(source, filename, nodesData)
  if (res.success) {
    clearDirty()
    console.log('[FlowEditor] 保存成功:', filename)
  }
}

// 用户确认删除图片
const handleConfirmDeleteImages = async () => {
  if (!pendingSaveConfig.value) return
  isProcessingImages.value = true

  try {
    const { source, filename } = pendingSaveConfig.value
    const { tempImages } = getImageData()

    // 删除未被引用的图片，保存临时图片
    await processImagesAndSave(source, filename, unusedImages.value, tempImages)

    showDeleteImagesModal.value = false
    pendingSaveConfig.value = null
    unusedImages.value = []
    usedImages.value = []
  } catch (e) {
    console.error('[FlowEditor] 处理失败:', e)
    alert('保存失败: ' + (e.message || '未知错误'))
  } finally {
    isProcessingImages.value = false
  }
}

// 用户选择跳过删除（保留所有图片）
const handleSkipDeleteImages = async () => {
  if (!pendingSaveConfig.value) return
  isProcessingImages.value = true

  try {
    const { source, filename } = pendingSaveConfig.value
    const { tempImages } = getImageData()

    // 不删除任何图片，只保存临时图片
    await processImagesAndSave(source, filename, [], tempImages)

    showDeleteImagesModal.value = false
    pendingSaveConfig.value = null
    unusedImages.value = []
    usedImages.value = []
  } catch (e) {
    console.error('[FlowEditor] 处理失败:', e)
    alert('保存失败: ' + (e.message || '未知错误'))
  } finally {
    isProcessingImages.value = false
  }
}

// 用户取消删除确认
const handleCancelDeleteImages = () => {
  showDeleteImagesModal.value = false
  pendingSaveConfig.value = null
  unusedImages.value = []
  usedImages.value = []
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
        :nodes-draggable="isFileLoaded"
        :nodes-connectable="isFileLoaded"
        :elements-selectable="isFileLoaded"
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
      <Background pattern-color="#cbd5e1" :gap="20"/>
      <Controls/>

      <Panel position="top-right" class="m-4 pointer-events-none !z-20">
        <InfoPanel
            ref="infoPanelRef"
            :node-count="nodes.length"
            :edge-count="edges.length"
            :is-dirty="isDirty"
            :current-filename="currentFilename"
            :edge-type="currentEdgeType"
            :spacing="currentSpacing"
            @load-nodes="handleLoadNodesWrapper"
            @load-images="handleLoadImages"
            @save-nodes="handleSaveNodes"
            @device-connected="(val) => isDeviceConnected = val"
            @request-switch-file="handleRequestSwitch"
            @update-canvas-config="handleUpdateCanvasConfig"
        />
      </Panel>

      <div
        v-if="!isFileLoaded"
        class="absolute inset-0 z-10 bg-slate-100/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none transition-all"
      >
        <div class="flex flex-col items-center gap-4 p-8 bg-white/80 border border-slate-200 rounded-2xl shadow-xl">
          <div class="p-4 bg-indigo-50 rounded-full">
            <FolderSearch class="w-12 h-12 text-indigo-400" />
          </div>
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
        :current-source="currentSource"
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

    <DeleteImagesConfirmModal
        :visible="showDeleteImagesModal"
        :unused-images="unusedImages"
        :used-images="usedImages"
        :is-processing="isProcessingImages"
        @cancel="handleCancelDeleteImages"
        @confirm="handleConfirmDeleteImages"
        @skip="handleSkipDeleteImages"
    />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';

.vue-flow__panel {
  pointer-events: none;
}
</style>