import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useVueFlow, type NodeTypesObject } from '@vue-flow/core'
import { ElMessage } from 'element-plus'
import { useFlowGraph } from '@/composables/useFlowGraph'
import { useEditorActions } from '@/composables/useEditorActions'
import { useSaveManager } from '@/composables/useSaveManager'
import { useDebugRunner } from '@/composables/useDebugRunner'
import { resourceApi } from '@/services/api'
import { useEditorModals } from '@/composables/useEditorModals'
import { parseFileId } from '@/utils/fileId'
import type { FlowEdge, FlowNode, LoadNodesPayload, TemplateImage } from '@/utils/flowTypes'
import { isPipelineV2Nodes, toPipelineV1Nodes } from '@/utils/pipelineTransform'
import { perfLog, perfMark, perfNow } from '@/utils/perfTrace'
import {
  normalizeKeyboardKey,
  onlyWhenEditorActive,
  type EditorActiveState,
} from '@/utils/editorInteraction'
import { provideNodeDetailsController } from '@/composables/useNodeDetailsController'
import { getEdgeStyle } from '@/composables/flowGraph/useConnectionManager'
import type { FlowEditorPort, FlowEditorStatus } from './types'
import { useAppConfigStore } from '@/stores/appConfig'

interface UseFlowEditorVmOptions {
  tabId?: string
  isActive?: EditorActiveState
  emit: {
    (e: 'request-switch-file', payload: { filename: string; source: string }): void
    (e: 'open-debug-panel', payload?: { nodeId?: string }): void
    (e: 'close-debug-panel'): void
    (e: 'status-change', payload: FlowEditorStatus): void
  }
}

export function useFlowEditorVm(options: UseFlowEditorVmOptions) {
  const appConfig = useAppConfigStore()
  const nodeNamePrefixEnabled = computed(() => appConfig.canvas.nodeNamePrefixEnabled)
  const {
    nodes,
    edges,
    nodeStructureVersion,
    nodeTypes,
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    isDirty,
    currentFilename,
    currentSource,
    onlyRenderVisibleElements,
    onValidateConnection,
    handleConnect,
    handleEdgesChange,
    removeEdges,
    handleNodeUpdate,
    loadNodes,
    createNodeObject,
    applyLayout,
    getNodesData,
    getImageData,
    clearTempImageData,
    clearDirty,
    markDataChanged,
    setNodeStatus,
    selectNodeById,
    setEdgeJumpBack,
    layoutChainFromNode,
    imageManager,
    exportState,
    restoreState,
    markNodeStructureChanged,
    refreshNodeInternals,
  } = useFlowGraph()
  const nodeTypesObject = nodeTypes as unknown as NodeTypesObject
  const {
    fitView,
    findNode,
    screenToFlowCoordinate,
    getSelectedNodes,
    getSelectedEdges,
    getViewport,
    setViewport,
    updateNodeInternals,
  } = useVueFlow()
  const isFileLoaded = computed<boolean>(() => !!currentFilename.value)

  const nodeDetailsController = provideNodeDetailsController()
  const initialLayoutPending = ref(false)
  let initialLayoutPromise: Promise<void> | null = null
  const pendingFocusNodeId = ref<string | null>(null)
  const lastPointerPosition = ref<{ x: number; y: number } | null>(null)
  const { showClearCanvasModal, subCanvas, openClearCanvasModal, openSubCanvas, closeSubCanvas } =
    useEditorModals()

  provide('currentFilename', currentFilename)
  provide('currentDirection', currentDirection)
  provide('imageManager', imageManager)

  const saveManager = useSaveManager({
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    currentFilename,
    currentSource,
    isDirty,
    exportState,
    restoreState,
    getNodesData,
    getImageData,
    clearTempImageData,
    clearDirty,
    imageManager: imageManager as unknown as {
      setNodeImages: (nodeId: string, images: TemplateImage[]) => void
      replaceLoadedImages: (imageMap: Record<string, TemplateImage[] | unknown>) => void
    },
    tabId: options.tabId,
  })

  provide('pipelineVersion', saveManager.loadedFileVersion)

  const debugRunner = useDebugRunner({
    findNode,
    nodes,
    currentSource,
    currentFilename,
    onSaveNodes: saveManager.handleSaveNodes,

    setNodeStatus,
  })

  const editorActions = useEditorActions({
    nodes,
    edges,
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    isFileLoaded,
    currentFilename,
    nodeNamePrefixEnabled,
    createNodeObject,
    applyLayout,
    removeEdges,
    setEdgeJumpBack,
    layoutChainFromNode,
    markDataChanged,
    markNodeStructureChanged,
    fitView,
    screenToFlowCoordinate,
    getViewport,
    setViewport,
    updateNodeInternals,
    getSelectedNodes,
    imageManager,
    requestClearCanvas: openClearCanvasModal,
    onDebugNode: debugRunner.handleDebugNode,
    onOpenDebugPanel: (payload) => options.emit('open-debug-panel', payload),
    onOpenSubCanvas: (payload) => openSubCanvas(payload.nodeId, payload.algorithm),
    onCloseDebugPanel: () => options.emit('close-debug-panel'),
    onIncrementCloseAllDetails: () => {
      nodeDetailsController.close()
    },
  })

  const {
    menu,
    searchVisible,
    closeMenu,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    handleMenuAction,
    copyNodesToClipboard,
    pasteNodesFromClipboard,
    clipboardHistory,
  } = editorActions
  const {
    loadedFileVersion,
    isDirtyCombined,
    showSaveModal,
    isSavingModal,
    pendingSwitchConfig,
    showDeleteImagesModal,
    isProcessingImages,
    unusedImages,
    usedImages,
    handleLoadImages: applyLoadedImages,
    handleSaveNodes,
    handleConfirmDeleteImages,
    handleSkipDeleteImages,
    handleCancelDeleteImages,
    handleUpdateCanvasConfig: updateCanvasConfigRefs,
    handleUpdatePipelineVersion,
    handleDeviceConnected,
    handleBeforeUnload,
  } = saveManager
  const { handleDebugNodeFromPanel, handleUpdateNodeStatus } = debugRunner

  const handleUpdateCanvasConfig: FlowEditorPort['handleUpdateCanvasConfig'] = async (
    config,
    options = {}
  ) => {
    const previousEdgeType = currentEdgeType.value
    const previousSpacing = currentSpacing.value
    const previousAlgorithm = currentAlgorithm.value
    const previousDirection = currentDirection.value

    updateCanvasConfigRefs(config)

    if (currentEdgeType.value !== previousEdgeType) {
      edges.value = edges.value.map(edge => {
        const edgeStyle = getEdgeStyle(
          edge.sourceHandle || '',
          Boolean(edge.data?.isJumpBack),
          currentEdgeType.value
        )
        return {
          ...edge,
          ...edgeStyle,
          data: { ...edge.data, ...edgeStyle.data }
        }
      })
    }

    const layoutChanged = currentSpacing.value !== previousSpacing ||
      currentAlgorithm.value !== previousAlgorithm ||
      currentDirection.value !== previousDirection
    if (layoutChanged && options.applyLayout !== false && nodes.value.length > 0) {
      if (initialLayoutPending.value) await finalizeInitialLayout()
      else await applyLayout()
    }
  }

  const handleNodeUpdateAndSnapshot = (payload: Parameters<typeof handleNodeUpdate>[0]) => {
    handleNodeUpdate(payload)
  }

  provide('updateNode', handleNodeUpdateAndSnapshot)

  const refreshCurrentNodeInternals = async () => {
    await refreshNodeInternals(nodes.value.map((node) => node.id))
  }

  const finalizeInitialLayout = async () => {
    if (!initialLayoutPending.value) return
    if (initialLayoutPromise) return initialLayoutPromise

    initialLayoutPromise = (async () => {
      await nextTick()
      await nextTick()
      await refreshCurrentNodeInternals()
      await applyLayout()
      initialLayoutPending.value = false
    })()

    try {
      await initialLayoutPromise
    } finally {
      initialLayoutPromise = null
    }
  }

  const handleLoadImages = async (
    imageDataMap: Record<string, unknown>,
    basePath?: string,
    options: { finalizeLayout?: boolean } = {}
  ) => {
    applyLoadedImages(imageDataMap, basePath)
    if (options.finalizeLayout !== false) {
      await finalizeInitialLayout()
    }
  }

  const executeSwitch = async (config: { filename: string; source: string; nodeId?: string }) => {
    if (config.nodeId) {
      pendingFocusNodeId.value = config.nodeId
      searchVisible.value = false
    }
    options.emit('request-switch-file', { filename: config.filename, source: config.source })
  }

  const handleRequestSwitch = (config: { filename: string; source: string; nodeId?: string }) => {
    if (!isDirtyCombined.value) {
      options.emit('request-switch-file', { filename: config.filename, source: config.source })
      return
    }
    pendingSwitchConfig.value = config
    showSaveModal.value = true
  }

  const handleDiscardChanges = () => {
    showSaveModal.value = false
    if (pendingSwitchConfig.value) {
      void executeSwitch(pendingSwitchConfig.value)
      pendingSwitchConfig.value = null
    }
  }

  const handleSaveAndSwitch = async () => {
    isSavingModal.value = true
    try {
      await handleSaveNodes({ source: currentSource.value, filename: currentFilename.value })
      showSaveModal.value = false
      if (pendingSwitchConfig.value) {
        await executeSwitch(pendingSwitchConfig.value)
        pendingSwitchConfig.value = null
      }
    } catch (e) {
      console.error('Save failed in modal', e)
    } finally {
      isSavingModal.value = false
    }
  }

  const handleCancelSwitch = () => {
    showSaveModal.value = false
    pendingSwitchConfig.value = null
  }

  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    return (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )
  }

  const updatePointerPosition = (e: PointerEvent) => {
    lastPointerPosition.value = { x: e.clientX, y: e.clientY }
  }

  const processKeyDown = (e: KeyboardEvent) => {
    if (subCanvas.value.visible) return

    const isMod = e.ctrlKey || e.metaKey
    const key = normalizeKeyboardKey(e)

    if (isMod && key === 's') {
      e.preventDefault()
      if (isFileLoaded.value && currentFilename.value) {
        handleSaveNodes({ source: currentSource.value, filename: currentFilename.value })
          .then(() => ElMessage.success('保存成功'))
          .catch(() => ElMessage.error('保存失败'))
      }
      return
    }

    if (isMod && key === 'c') {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      const count = copyNodesToClipboard()
      if (count > 0) {
        ElMessage.success(`已复制 ${count} 个节点`)
      } else {
        ElMessage.info('请先选择要复制的节点')
      }
      return
    }

    if (isMod && key === 'v') {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      const position = lastPointerPosition.value
        ? screenToFlowCoordinate(lastPointerPosition.value)
        : null
      const pastedNodes = pasteNodesFromClipboard(position)
      if (pastedNodes.length > 0) {
        ElMessage.success(`已粘贴 ${pastedNodes.length} 个节点`)
      } else {
        ElMessage.info('没有可粘贴的节点')
      }
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!isEditableTarget(e.target)) {
        e.preventDefault()
        const selectedNodes = getSelectedNodes.value
        const selectedEdges = getSelectedEdges.value
        if (selectedNodes.length > 0) {
          selectedNodes.forEach((node: FlowNode) => {
            const edgeIds = edges.value
              .filter((edge: FlowEdge) => edge.source === node.id || edge.target === node.id)
              .map((edge: FlowEdge) => edge.id)
            removeEdges(edgeIds)
            imageManager.removeNodeState(node.id)
          })
          nodes.value = nodes.value.filter(
            (node: FlowNode) =>
              !selectedNodes.find((selectedNode: FlowNode) => selectedNode.id === node.id)
          )
          markNodeStructureChanged()
          markDataChanged()
        } else if (selectedEdges.length > 0) {
          removeEdges(selectedEdges.map((edge: FlowEdge) => edge.id))
          markDataChanged()
        }
      }
      return
    }

    if (isMod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      ElMessage.info('撤销功能暂不支持')
      return
    }

    if ((isMod && e.key === 'y') || (isMod && e.shiftKey && e.key === 'z')) {
      e.preventDefault()
      ElMessage.info('重做功能暂不支持')
      return
    }

    if (e.key === 'Escape') {
      searchVisible.value = false
      showSaveModal.value = false
      showDeleteImagesModal.value = false
      closeMenu()
    }
  }

  const handlePointerMove = onlyWhenEditorActive(options.isActive, updatePointerPosition)
  const handleKeyDown = onlyWhenEditorActive(options.isActive, processKeyDown)

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointermove', handlePointerMove)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('pointermove', handlePointerMove)
  })

  const handleLocateNode = (nodeId: string) => {
    selectNodeById(nodeId)
    setTimeout(
      () => fitView({ nodes: [nodeId], padding: 0.5, maxZoom: 1.5, minZoom: 0.8, duration: 600 }),
      50
    )
  }

  const handleCancelClearCanvas = () => {
    showClearCanvasModal.value = false
  }

  const handleConfirmClearCanvas = () => {
    nodes.value = []
    edges.value = []
    markNodeStructureChanged()
    markDataChanged()
    showClearCanvasModal.value = false
  }

  const handleLoadNodesWrapper = async (payload: LoadNodesPayload) => {
    const start = perfNow()
    perfMark('FlowEditor.handleLoadNodesWrapper.start', {
      tabId: options.tabId,
      filename: payload.filename,
      nodeCount: Object.keys(payload.nodes).length,
    })
    try {
      initialLayoutPending.value = true
      await loadNodes(payload, { applyInitialLayout: false })
      perfLog('FlowEditor.loadNodes', start, { tabId: options.tabId, filename: payload.filename })
      loadedFileVersion.value = payload.fileVersion ?? 'V1'
      if (pendingFocusNodeId.value) {
        const targetId = pendingFocusNodeId.value
        setTimeout(() => {
          handleLocateNode(targetId)
          pendingFocusNodeId.value = null
        }, 300)
      }
    } catch (error) {
      initialLayoutPending.value = false
      throw error
    }
    perfLog('FlowEditor.handleLoadNodesWrapper.total', start, {
      tabId: options.tabId,
      filename: payload.filename,
    })
  }

  const loadResourceFile = async (
    fileId: string,
    options: { deferLayout?: boolean } = {}
  ) => {
    const { source, filename } = parseFileId(fileId)
    if (!source || !filename) {
      ElMessage.error('无效的资源文件标识')
      return
    }

    try {
      const res = await resourceApi.getFileNodes(source, filename)
      const nodesRes = res?.nodes
      if (nodesRes) {
        const rawNodes = nodesRes as Record<string, import('@/utils/flowTypes').FlowBusinessData>
        const fileVersion = isPipelineV2Nodes(rawNodes) ? 'V2' : 'V1'
        const processedNodes = fileVersion === 'V2' ? toPipelineV1Nodes(rawNodes) : rawNodes

        await handleLoadNodesWrapper({
          filename,
          source,
          nodes: processedNodes,
          fileVersion,
        })

        const imgRes = await resourceApi.getTemplateImages(source, filename).catch((error) => {
          console.warn('Failed to load template images:', error)
          return null
        })
        await handleLoadImages(
          (imgRes?.results as Record<string, unknown> | undefined) ?? {},
          undefined,
          { finalizeLayout: !options.deferLayout }
        )
      }
    } catch (e) {
      console.error('Failed to load resource file:', e)
      throw e
    }
  }

  const editorPort: FlowEditorPort = {
    getEditorStatus: () => ({
      isDirty: isDirtyCombined.value,
      nodeCount: nodes.value.length,
      edgeCount: edges.value.length,
    }),
    loadResourceFile,
    handleLoadNodesWrapper,
    handleLoadImages,
    handleSaveNodes: (config: { source: string; filename: string }) => handleSaveNodes(config),
    handleDeviceConnected: (val: boolean) => handleDeviceConnected(val),
    handleUpdateCanvasConfig,
    handleUpdatePipelineVersion: (val: 'V1' | 'V2') => handleUpdatePipelineVersion(val),
    handleApplyLayout: async () => {
      if (initialLayoutPending.value) {
        await finalizeInitialLayout()
        return
      }
      await applyLayout()
    },
    handleLocateNode,
    handleDebugNodeFromPanel,
    handleUpdateNodeStatus,
  }

  watch(
    [
      isDirtyCombined,
      () => nodes.value.length,
      () => edges.value.length,
    ],
    ([dirty, nodeCount, edgeCount]) => {
      options.emit('status-change', {
        isDirty: Boolean(dirty),
        nodeCount: Number(nodeCount),
        edgeCount: Number(edgeCount),
      })
    },
    { immediate: true }
  )

  return {
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
    handleNodeUpdate: handleNodeUpdateAndSnapshot,
    createNodeObject,
    removeEdges,
    setEdgeJumpBack,
    markDataChanged,
    imageManager,
    handleDebugNode: debugRunner.handleDebugNode,
    handleOpenDebugPanel: (payload?: { nodeId?: string }) =>
      options.emit('open-debug-panel', payload),
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
  }
}
