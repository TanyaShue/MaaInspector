<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { SelectionMode, VueFlow, type NodeDragEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { FolderSearch } from 'lucide-vue-next'
import ContextMenu from './Flow/ContextMenu.vue'
import SubCanvasPanel from './Flow/SubCanvasPanel.vue'
import NodeDetailsHost from './Flow/NodeDetailsHost.vue'
import { useFlowEditorVm } from '@/composables/viewModels/useFlowEditorVm'
import { useEdgeRenderWindow } from '@/composables/flowGraph/useEdgeRenderWindow'
import { syncNodePositions } from '@/utils/editorInteraction'
import type { FlowNode } from '@/utils/flowTypes'
import type { FlowEditorStatus } from '@/composables/viewModels/types'

const NodeSearch = defineAsyncComponent(() => import('./Flow/NodeSearch.vue'))
const SaveConfirmModal = defineAsyncComponent(() => import('./Flow/Modals/SaveConfirmModal.vue'))
const DeleteImagesConfirmModal = defineAsyncComponent(() => import('./Flow/Modals/DeleteImagesConfirmModal.vue'))
const ClearCanvasConfirmModal = defineAsyncComponent(() => import('./Flow/Modals/ClearCanvasConfirmModal.vue'))

const props = defineProps<{
  tabId?: string
  debugPanelVisible?: boolean
  isActive?: boolean
  lowMemoryMode?: boolean
}>()

const emit = defineEmits<{
  'request-switch-file': [payload: { filename: string; source: string }]
  'open-debug-panel': [payload?: { nodeId?: string }]
  'close-debug-panel': []
  'status-change': [payload: FlowEditorStatus]
}>()

const {
  nodes,
  edges,
  nodeStructureVersion,
  nodeTypesObject,
  currentEdgeType,
  currentSpacing,
  currentAlgorithm,
  currentDirection,
  nodeNamePrefixEnabled,
  currentFilename,
  currentSource,
  isFileLoaded,
  onlyRenderVisibleElements,
  onValidateConnection,
  handleConnect,
  handleEdgesChange,
  handleNodeUpdate,
  createNodeObject,
  removeEdges,
  setEdgeJumpBack,
  markDataChanged,
  imageManager,
  handleDebugNode,
  handleOpenDebugPanel,
  menu,
  searchVisible,
  closeMenu,
  onPaneContextMenu,
  onNodeContextMenu,
  onEdgeContextMenu,
  handleMenuAction,
  clipboardHistory,
  showClearCanvasModal,
  handleCancelClearCanvas,
  handleConfirmClearCanvas,
  showSaveModal,
  isSavingModal,
  showDeleteImagesModal,
  unusedImages,
  usedImages,
  isProcessingImages,
  handleRequestSwitch,
  handleLocateNode,
  handleCancelSwitch,
  handleDiscardChanges,
  handleSaveAndSwitch,
  handleCancelDeleteImages,
  handleConfirmDeleteImages,
  handleSkipDeleteImages,
  subCanvas,
  closeSubCanvas,
  editorPort,
  markNodeStructureChanged,
} = useFlowEditorVm({
  tabId: props.tabId,
  isActive: () => props.isActive !== false,
  emit,
})

defineExpose(editorPort)

const replaceSubCanvasNodes = (nextNodes: FlowNode[]) => {
  nodes.value = nextNodes
  markNodeStructureChanged()
}

const editorRootRef = ref<HTMLElement | null>(null)
const {
  renderedEdges,
  setCanvasSize,
  handleMoveStart,
  handleMove,
  handleMoveEnd,
  handleNodeDragStart: handleEdgeNodeDragStart,
  handleNodeDragStop: handleEdgeNodeDragStop,
} = useEdgeRenderWindow({
  nodes,
  edges,
  nodeStructureVersion,
  lowMemoryMode: () => props.lowMemoryMode === true,
  pauseAnimations: () => subCanvas.value.visible,
})

const handleMainMoveStart = (event: Parameters<typeof handleMoveStart>[0]) => {
  closeMenu()
  handleMoveStart(event)
}

const handleMainNodeDragStop = ({ node, nodes: draggedNodes }: NodeDragEvent) => {
  const movedNodes = draggedNodes.length > 0 ? draggedNodes : [node]
  syncNodePositions(nodes.value, movedNodes)
  handleEdgeNodeDragStop()
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  const root = editorRootRef.value
  if (!root) return
  const updateSize = () => {
    const rect = root.getBoundingClientRect()
    setCanvasSize({ width: rect.width, height: rect.height })
  }
  updateSize()
  resizeObserver = new ResizeObserver(updateSize)
  resizeObserver.observe(root)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div
    ref="editorRootRef"
    class="w-full h-full min-h-[500px] bg-slate-50 relative"
  >
    <VueFlow
      class="flow-canvas-layer"
      :nodes="nodes"
      :edges="renderedEdges"
      :node-types="nodeTypesObject"
      :default-zoom="1"
      :min-zoom="0.1"
      :max-zoom="4"
      :only-render-visible-elements="onlyRenderVisibleElements"
      :is-valid-connection="onValidateConnection"
      :nodes-draggable="isFileLoaded"
      :nodes-connectable="isFileLoaded"
      :elements-selectable="isFileLoaded"
      :selection-key-code="true"
      :multi-selection-key-code="null"
      :select-nodes-on-drag="false"
      :selection-mode="SelectionMode.Partial"
      :pan-on-drag="true"
      @connect="(params) => { handleConnect(params) }"
      @edges-change="(changes) => { handleEdgesChange(changes) }"
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      @edge-context-menu="onEdgeContextMenu"
      @pane-click="closeMenu"
      @node-click="closeMenu"
      @edge-click="closeMenu"
      @move-start="handleMainMoveStart"
      @move="handleMove"
      @move-end="handleMoveEnd"
      @node-drag-stop="handleMainNodeDragStop"
      @selection-drag-stop="handleMainNodeDragStop"
      @node-drag-start="handleEdgeNodeDragStart"
      @selection-drag-start="handleEdgeNodeDragStart"
    >
      <Background
        pattern-color="#cbd5e1"
        :gap="20"
      />
      <Controls />
      <div
        v-if="!isFileLoaded"
        class="absolute inset-0 z-10 bg-slate-100/90 flex items-center justify-center pointer-events-none"
      >
        <div class="flex flex-col items-center gap-4 p-8 bg-white/80 border border-slate-200 rounded-2xl shadow-xl">
          <div class="p-4 bg-indigo-50 rounded-full">
            <FolderSearch class="w-12 h-12 text-indigo-400" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-bold text-slate-700">
              未加载资源文件
            </h3>
            <p class="text-sm text-slate-500">
              请从右上角“资源”按钮加载资源，或从当前标签切换文件
            </p>
          </div>
        </div>
      </div>
    </VueFlow>
    <ContextMenu
      v-if="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :type="menu.type"
      :data="menu.data"
      :current-edge-type="currentEdgeType"
      :current-spacing="currentSpacing"
      :current-algorithm="currentAlgorithm"
      :current-direction="currentDirection"
      :debug-panel-visible="props.debugPanelVisible"
      :search-visible="searchVisible"
      :clipboard-history="clipboardHistory"
      mode="main"
      @close="closeMenu"
      @action="handleMenuAction"
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
    <NodeDetailsHost
      :nodes="nodes"
      :node-structure-version="nodeStructureVersion"
    />
    <SaveConfirmModal
      :visible="showSaveModal"
      :filename="currentFilename"
      :is-saving="isSavingModal"
      @cancel="handleCancelSwitch"
      @discard="handleDiscardChanges"
      @save="handleSaveAndSwitch"
    />
    <ClearCanvasConfirmModal
      :visible="showClearCanvasModal"
      :node-count="nodes.length"
      :edge-count="edges.length"
      @cancel="handleCancelClearCanvas"
      @confirm="handleConfirmClearCanvas"
    />
    <DeleteImagesConfirmModal
      :visible="showDeleteImagesModal"
      :unused-images="unusedImages"
      :used-images="usedImages"
      :is-processing="isProcessingImages"
      @cancel="handleCancelDeleteImages"
      @confirm="handleConfirmDeleteImages()"
      @skip="handleSkipDeleteImages()"
    />
    <SubCanvasPanel
      :visible="subCanvas.visible"
      :root-node-id="subCanvas.nodeId"
      :initial-algorithm="subCanvas.algorithm"
      :nodes="nodes"
      :edges="edges"
      :node-types-object="nodeTypesObject"
      :current-edge-type="currentEdgeType"
      :current-spacing="currentSpacing"
      :current-algorithm="currentAlgorithm"
      :current-direction="currentDirection"
      :low-memory-mode="props.lowMemoryMode"
      :current-filename="currentFilename"
      :node-name-prefix-enabled="nodeNamePrefixEnabled"
      :is-file-loaded="isFileLoaded"
      :on-validate-connection="onValidateConnection"
      :handle-connect="handleConnect"
      :handle-edges-change="handleEdgesChange"
      :handle-node-update="handleNodeUpdate"
      :create-node-object="createNodeObject"
      :remove-edges="removeEdges"
      :set-edge-jump-back="setEdgeJumpBack"
      :mark-data-changed="markDataChanged"
      :image-manager="imageManager"
      :handle-debug-node="handleDebugNode"
      :handle-open-debug-panel="handleOpenDebugPanel"
      @close="closeSubCanvas"
      @root-renamed="(nodeId) => { subCanvas.nodeId = nodeId }"
      @replace-nodes="replaceSubCanvasNodes"
    />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
.vue-flow__panel { pointer-events: none; }
.vue-flow__selection {
  background: rgb(59 130 246 / 0.12);
  border: 1px solid rgb(37 99 235 / 0.85);
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.7) inset;
}
.vue-flow__pane.selection {
  cursor: crosshair;
}
.flow-canvas-layer {
  contain: layout paint style;
  isolation: isolate;
  transform: translateZ(0);
  backface-visibility: hidden;
}
.vue-flow__node.dragging,
.vue-flow__node.dragging .node-card {
  animation: none !important;
  transition: none !important;
}
.vue-flow__node.dragging .node-card {
  box-shadow: none !important;
}
</style>
