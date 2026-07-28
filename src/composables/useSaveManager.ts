import { ref, computed } from 'vue'
import { useAppConfigStore } from '@/stores/appConfig'
import type {
  FlowBusinessData,
  SpacingKey,
  LayoutAlgorithm,
  LayoutDirection,
  UsedImageInfo,
  TemplateImage,
} from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import { isEdgeType, isSpacingKey, isLayoutAlgorithm, isLayoutDirection } from '@/utils/typeGuards'
import { resourceApi } from '@/services/api'
import { toPipelineV2Nodes } from '@/utils/pipelineTransform'
import { ElMessage } from 'element-plus'
import type { useFlowGraph } from './useFlowGraph'

type FlowGraphState = ReturnType<ReturnType<typeof useFlowGraph>['exportState']>

interface PendingSwitchConfig {
  filename: string
  source: string
  nodeId?: string
}
interface PendingSaveConfig {
  source: string
  filename: string
}

interface PendingSaveRequest {
  onSnapshotState?: () => void
  resolve: () => void
  reject: (reason: unknown) => void
}

export class SaveCancelledError extends Error {
  constructor() {
    super('Save cancelled')
    this.name = 'SaveCancelledError'
  }
}

export const isSaveCancelledError = (error: unknown): error is SaveCancelledError =>
  error instanceof Error && error.name === 'SaveCancelledError'

export interface SaveManagerDeps {
  currentEdgeType: { value: EdgeType }
  currentSpacing: { value: SpacingKey }
  currentAlgorithm: { value: LayoutAlgorithm }
  currentDirection: { value: LayoutDirection }
  currentFilename: { value: string }
  currentSource: { value: string }
  isDirty: { value: boolean }
  exportState: () => FlowGraphState
  restoreState: (snapshot?: FlowGraphState) => void
  getNodesData: () => Record<string, FlowBusinessData>
  getImageData: () => {
    delImages: { path: string }[]
    tempImages: { path: string; base64: string; nodeId?: string }[]
  }
  clearTempImageData: () => void
  clearDirty: () => void
  imageManager: {
    setNodeImages: (nodeId: string, images: TemplateImage[]) => void
    replaceLoadedImages: (imageMap: Record<string, TemplateImage[] | unknown>) => void
  }
  tabId?: string
}

export function useSaveManager(deps: SaveManagerDeps) {
  const {
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    isDirty,
    getNodesData,
    getImageData,
    clearTempImageData,
    clearDirty,
    imageManager,
  } = deps

  const store = useAppConfigStore()

  const loadedFileVersion = ref<'V1' | 'V2' | ''>('')
  const isDeviceConnected = ref(false)

  const isFormatDirty = computed(
    () => !!loadedFileVersion.value && store.canvas.pipelineVersion !== loadedFileVersion.value
  )
  const isDirtyCombined = computed(() => isDirty.value || isFormatDirty.value)

  const showSaveModal = ref(false)
  const isSavingModal = ref(false)
  const pendingSwitchConfig = ref<PendingSwitchConfig | null>(null)
  const showDeleteImagesModal = ref(false)
  const isProcessingImages = ref(false)
  const unusedImages = ref<string[]>([])
  const usedImages = ref<UsedImageInfo[]>([])
  const pendingSaveConfig = ref<PendingSaveConfig | null>(null)
  let pendingSaveRequest: PendingSaveRequest | null = null

  const applyDefaultSettings = () => {
    currentEdgeType.value = store.canvas.edgeType
    currentSpacing.value = store.canvas.spacing
    currentAlgorithm.value = store.canvas.layoutAlgorithm
    currentDirection.value = store.canvas.layoutDirection
    loadedFileVersion.value = ''
  }

  const isTemplateImageArray = (value: unknown): value is TemplateImage[] =>
    Array.isArray(value) &&
    value.every((item) => typeof item === 'object' && !!item && 'path' in item)

  const isUsedImageInfoArray = (value: unknown): value is UsedImageInfo[] =>
    Array.isArray(value) &&
    value.every((item) => typeof item === 'object' && !!item && 'path' in item && 'used_by' in item)

  const handleLoadImages = (imageDataMap: Record<string, unknown>, _basePath?: string) => {
    if (!imageDataMap) return
    try {
      const normalized: Record<string, TemplateImage[]> = {}
      for (const [nodeId, images] of Object.entries(imageDataMap)) {
        if (isTemplateImageArray(images)) normalized[nodeId] = images
      }
      imageManager.replaceLoadedImages(normalized)
    } catch (e) {
      console.warn('Failed to load images:', e)
    }
  }

  const saveNodesOnly = async (source: string, filename: string, onSnapshotState?: () => void) => {
    const rawNodes = getNodesData()
    const payload = store.canvas.pipelineVersion === 'V2' ? toPipelineV2Nodes(rawNodes) : rawNodes
    const res = await resourceApi.saveFileNodes(source, filename, payload)
    if (res.success) {
      clearDirty()
      loadedFileVersion.value = store.canvas.pipelineVersion
      onSnapshotState?.()
    }
  }

  const processImagesAndSave = async (
    source: string,
    filename: string,
    deletePaths: string[],
    tempImages: { path: string; base64: string; nodeId?: string }[],
    onSnapshotState?: () => void
  ) => {
    try {
      if (deletePaths.length > 0 || tempImages.length > 0) {
        await resourceApi.processImages(source, deletePaths, tempImages)
      }
      await saveNodesOnly(source, filename, onSnapshotState)
      clearTempImageData()
    } catch (e: unknown) {
      console.error('[FlowEditor] 图片处理失败:', e)
      throw e
    }
  }

  const handleSaveNodes = async (
    { source, filename }: { source: string; filename: string },
    onSnapshotState?: () => void
  ) => {
    try {
      const { delImages, tempImages } = getImageData()
      if (delImages.length > 0 || tempImages.length > 0) {
        pendingSaveConfig.value = { source, filename }
        if (delImages.length > 0) {
          const checkRes = await resourceApi.checkUnusedImages(source, filename, delImages)
          unusedImages.value = checkRes.unused_images || []
          usedImages.value = isUsedImageInfoArray(checkRes.used_images) ? checkRes.used_images : []
          if (unusedImages.value.length > 0) {
            showDeleteImagesModal.value = true
            return await new Promise<void>((resolve, reject) => {
              pendingSaveRequest = { onSnapshotState, resolve, reject }
            })
          }
        }
        await processImagesAndSave(source, filename, [], tempImages, onSnapshotState)
      } else {
        await saveNodesOnly(source, filename, onSnapshotState)
      }
    } catch (e: unknown) {
      console.error('[FlowEditor] 保存失败:', e)
      throw e
    }
  }

  const settlePendingSave = (error?: unknown) => {
    const request = pendingSaveRequest
    pendingSaveRequest = null
    if (!request) return
    if (error) request.reject(error)
    else request.resolve()
  }

  const handleConfirmDeleteImages = async (onSnapshotState?: () => void) => {
    if (!pendingSaveConfig.value) return
    isProcessingImages.value = true
    try {
      const snapshot = pendingSaveRequest?.onSnapshotState ?? onSnapshotState
      await processImagesAndSave(
        pendingSaveConfig.value.source,
        pendingSaveConfig.value.filename,
        unusedImages.value,
        getImageData().tempImages,
        snapshot
      )
      showDeleteImagesModal.value = false
      pendingSaveConfig.value = null
      settlePendingSave()
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error('保存失败: ' + (err?.message || '未知错误'))
      settlePendingSave(e)
    } finally {
      isProcessingImages.value = false
    }
  }

  const handleSkipDeleteImages = async (onSnapshotState?: () => void) => {
    if (!pendingSaveConfig.value) return
    isProcessingImages.value = true
    try {
      const snapshot = pendingSaveRequest?.onSnapshotState ?? onSnapshotState
      await processImagesAndSave(
        pendingSaveConfig.value.source,
        pendingSaveConfig.value.filename,
        [],
        getImageData().tempImages,
        snapshot
      )
      showDeleteImagesModal.value = false
      pendingSaveConfig.value = null
      settlePendingSave()
    } catch (e: unknown) {
      const err = e as { message?: string }
      ElMessage.error('保存失败: ' + (err?.message || '未知错误'))
      settlePendingSave(e)
    } finally {
      isProcessingImages.value = false
    }
  }

  const handleCancelDeleteImages = () => {
    showDeleteImagesModal.value = false
    pendingSaveConfig.value = null
    settlePendingSave(new SaveCancelledError())
  }

  const handleUpdateCanvasConfig = (
    {
      edgeType,
      spacing,
      layoutAlgorithm,
      layoutDirection,
    }: {
      edgeType?: string
      spacing?: string
      layoutAlgorithm?: string
      layoutDirection?: string
    },
    onSnapshotState?: () => void
  ) => {
    const nextEdgeType = isEdgeType(edgeType) ? edgeType : undefined
    const nextSpacing = isSpacingKey(spacing) ? spacing : undefined
    const nextAlgorithm = isLayoutAlgorithm(layoutAlgorithm) ? layoutAlgorithm : undefined
    const nextDirection = isLayoutDirection(layoutDirection) ? layoutDirection : undefined
    if (nextEdgeType && nextEdgeType !== currentEdgeType.value) {
      currentEdgeType.value = nextEdgeType
    }
    if (nextSpacing && nextSpacing !== currentSpacing.value) currentSpacing.value = nextSpacing
    if (nextAlgorithm && nextAlgorithm !== currentAlgorithm.value)
      currentAlgorithm.value = nextAlgorithm
    if (nextDirection && nextDirection !== currentDirection.value)
      currentDirection.value = nextDirection
    onSnapshotState?.()
  }

  const handleUpdatePipelineVersion = (val: 'V1' | 'V2', onSnapshotState?: () => void) => {
    store.updateCanvasSettings({ pipelineVersion: val })
    onSnapshotState?.()
  }

  const handleDeviceConnected = (val: boolean, onSnapshotState?: () => void) => {
    isDeviceConnected.value = val
    onSnapshotState?.()
  }

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirtyCombined.value) {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    return undefined
  }

  return {
    loadedFileVersion,
    isDeviceConnected,
    isFormatDirty,
    isDirtyCombined,
    showSaveModal,
    isSavingModal,
    pendingSwitchConfig,
    showDeleteImagesModal,
    isProcessingImages,
    unusedImages,
    usedImages,
    pendingSaveConfig,
    applyDefaultSettings,
    handleLoadImages,
    handleSaveNodes,
    handleConfirmDeleteImages,
    handleSkipDeleteImages,
    handleCancelDeleteImages,
    handleUpdateCanvasConfig,
    handleUpdatePipelineVersion,
    handleDeviceConnected,
    handleBeforeUnload,
  }
}
