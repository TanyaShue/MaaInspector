import { inject, reactive, ref } from 'vue'
import type { useImageManager } from '@/composables/useImageManager'
import type { TemplateImage } from '@/utils/flowTypes'
import { normalizeTemplateList } from '@/utils/templateUtils'
import type { ColorRangeResult } from '@/utils/colorRange'

export type DevicePickerMode = 'coordinate' | 'ocr' | 'image_manager' | 'color_range'

export interface ImageItem extends TemplateImage {
  _source?: string
}

export interface OcrCandidate {
  box?: number[]
  score: number
  text: string
}

export interface OcrPickResult {
  text?: string
  best?: OcrCandidate | null
  all?: OcrCandidate[]
  filtered?: OcrCandidate[]
}

export interface DevicePickResult {
  type?: string
  validPaths?: string[]
  images?: ImageItem[]
  tempImages?: ImageItem[]
  deletedImages?: ImageItem[]
  imagePath?: string
  imageBase64?: string
  closeModal?: boolean
  ocrResult?: OcrPickResult
  [key: string]: unknown
}

export interface TemplateTarget {
  compositeKey: 'all_of' | 'any_of'
  compositeIndex: number
}

export interface TemplateTargetPayload {
  compositeKey?: 'all_of' | 'any_of'
  compositeIndex?: number
}

export interface PickerPayload {
  field: string
  mode?: DevicePickerMode
  method?: number
  initialRect?: number[] | null
  referenceField?: string | null
  referenceLabel?: string | null
  referenceRect?: number[] | null
  onConfirm?: (val: DevicePickResult | number[] | OcrPickResult | ColorRangeResult) => void
}

export interface DeviceScreenConfig {
  targetField: string
  referenceField: string | null
  referenceRect: number[] | null
  initialRect: number[] | null
  referenceLabel: string
  title: string
  mode: DevicePickerMode
  colorMethod: number
  imageList: ImageItem[]
  tempImageList: ImageItem[]
  deletedImageList: ImageItem[]
  filename: string
  nodeId: string
  onConfirm?: ((val: DevicePickResult | number[] | OcrPickResult | ColorRangeResult) => void) | null
  templateTarget?: TemplateTarget | null
}

export interface UseDeviceScreenPickerOptions {
  nodeId?: string
  currentFilename?: string
  formData: Record<string, unknown>
  getValue: (key: string, fallback?: unknown) => unknown
  setValue: (key: string, value: unknown) => void
  onUpdateData: (payload: Record<string, unknown>) => void
}

export function useDeviceScreenPicker(options: UseDeviceScreenPickerOptions) {
  const { nodeId, currentFilename, formData, getValue, setValue, onUpdateData } = options

  const imageManager = inject<ReturnType<typeof useImageManager>>('imageManager')!

  const showDeviceScreen = ref(false)

  const deviceScreenConfig = reactive<DeviceScreenConfig>({
    targetField: '',
    referenceField: '',
    referenceRect: null,
    initialRect: null,
    referenceLabel: '',
    title: '区域选择',
    mode: 'coordinate',
    colorMethod: 4,
    imageList: [],
    tempImageList: [],
    deletedImageList: [],
    filename: '',
    nodeId: '',
    onConfirm: null,
    templateTarget: null
  })

  const toImageItems = (val: unknown): ImageItem[] => {
    if (!Array.isArray(val)) return []
    return val
      .map(item => (item && typeof item === 'object' ? item as ImageItem : null))
      .filter((item): item is ImageItem => !!item && typeof item.path === 'string')
  }

  const parseRect = (val: unknown): number[] | null => {
    if (Array.isArray(val) && val.length === 4) return val as number[]
    if (typeof val === 'string') {
      try {
        const arr = JSON.parse(val)
        if (Array.isArray(arr) && arr.length === 4) return arr as number[]
      } catch {
        const parts = val.split(',').map(Number)
        if (parts.length === 4 && !parts.some(isNaN)) return parts as number[]
      }
    }
    return null
  }

  const normalizePickerPayload = (
    payload: string | PickerPayload,
    refField?: string | null,
    refLabel?: string | null
  ): PickerPayload => {
    if (typeof payload === 'string') {
      return { field: payload, referenceField: refField, referenceLabel: refLabel || null }
    }
    return payload
  }

  const getTargetTemplatePaths = (target?: TemplateTarget | null): string[] => {
    if (!target) return normalizeTemplateList(getValue('template', null))
    const list = formData[target.compositeKey]
    if (!Array.isArray(list)) return []
    const item = list[target.compositeIndex]
    if (!item || typeof item !== 'object') return []
    const templateVal = (item as Record<string, unknown>).template
    return normalizeTemplateList(templateVal)
  }

  const filterImagesByPaths = (images: ImageItem[], paths: string[]): ImageItem[] => {
    if (!paths.length) return images
    const pathSet = new Set(paths)
    return images.filter(img => img.path && pathSet.has(img.path))
  }

  const normalizeTemplateTarget = (payload?: TemplateTargetPayload): TemplateTarget | null => {
    if (!payload) return null
    if (!payload.compositeKey) return null
    if (payload.compositeIndex === undefined || payload.compositeIndex === null) return null
    return { compositeKey: payload.compositeKey, compositeIndex: payload.compositeIndex }
  }

  const openDevicePicker = (
    fieldParam: string | PickerPayload,
    referenceField: string | null = null,
    refLabel: string | null = null
  ) => {
    const payload = normalizePickerPayload(fieldParam, referenceField, refLabel)
    const {
      field,
      mode,
      method = 4,
      initialRect,
      referenceField: refField = null,
      referenceLabel: refLabelFinal = null,
      referenceRect: refRectOverride = null,
      onConfirm
    } = payload

    const finalMode: DevicePickerMode = mode ?? (
      field === 'expected' || field === 'replace'
        ? 'ocr'
        : field === 'template'
          ? 'image_manager'
          : 'coordinate')

    const currentRect = parseRect(getValue(field))
    const roiRect = parseRect(getValue('roi'))

    let refRect = refRectOverride
      ?? (refField ? parseRect(getValue(refField)) : (finalMode === 'image_manager' || finalMode === 'ocr' ? roiRect : null))

    if (field.includes('offset') && !refRect && roiRect) {
      refRect = roiRect
    }

    deviceScreenConfig.initialRect = (() => {
      if (initialRect !== undefined) return parseRect(initialRect)
      if (field.includes('offset') && refRect && currentRect) {
        return [
          refRect[0] + currentRect[0],
          refRect[1] + currentRect[1],
          refRect[2] + currentRect[2],
          refRect[3] + currentRect[3]
        ]
      }
      if (currentRect) return currentRect
      if (refRect && finalMode !== 'image_manager') return refRect
      return null
    })()

    deviceScreenConfig.targetField = field
    deviceScreenConfig.referenceField = refField
    deviceScreenConfig.referenceRect = refRect
    deviceScreenConfig.mode = finalMode
    deviceScreenConfig.colorMethod = method
    deviceScreenConfig.referenceLabel = refLabelFinal || refField || '参考区域'
    deviceScreenConfig.title =
      finalMode === 'ocr'
        ? 'OCR 区域识别'
        : finalMode === 'image_manager'
          ? '模板图片管理'
          : finalMode === 'color_range'
            ? '选取颜色范围'
          : (field.includes('offset') ? `设置偏移 (${field})` : `选取区域 (${field})`)
    deviceScreenConfig.imageList = []
    deviceScreenConfig.onConfirm = onConfirm || null
    showDeviceScreen.value = true
  }

  const openImageManager = (payload?: TemplateTargetPayload) => {
    const templateTarget = normalizeTemplateTarget(payload)
    const targetPaths = getTargetTemplatePaths(templateTarget)
    const currentNodeId = nodeId || ''

    const images = toImageItems(imageManager.getNodeSavedImages(currentNodeId))
    const tempImages = toImageItems(imageManager.getNodeTempImages(currentNodeId))
    const deletedImages = toImageItems(imageManager.getNodeDeletedImages(currentNodeId))

    deviceScreenConfig.mode = 'image_manager'
    deviceScreenConfig.title = '模板图片管理'
    deviceScreenConfig.targetField = 'template'
    deviceScreenConfig.referenceRect = parseRect(getValue('roi'))
    deviceScreenConfig.initialRect = deviceScreenConfig.referenceRect
    deviceScreenConfig.referenceLabel = 'roi'
    deviceScreenConfig.imageList = filterImagesByPaths(images, targetPaths)
    deviceScreenConfig.tempImageList = filterImagesByPaths(tempImages, targetPaths)
    deviceScreenConfig.deletedImageList = filterImagesByPaths(deletedImages, targetPaths)
    deviceScreenConfig.filename = currentFilename || ''
    deviceScreenConfig.nodeId = currentNodeId
    deviceScreenConfig.templateTarget = templateTarget
    showDeviceScreen.value = true
  }

  const handleDevicePick = (result: unknown) => {
    if (deviceScreenConfig.onConfirm) {
      deviceScreenConfig.onConfirm(result as DevicePickResult | number[] | OcrPickResult | ColorRangeResult)
      showDeviceScreen.value = false
      return
    }

    if (deviceScreenConfig.mode === 'image_manager' && typeof result === 'object' && result !== null && 'type' in result) {
      const imgResult = result as DevicePickResult
      if (imgResult.type === 'save_image_changes') {
        onUpdateData({
          _action: 'save_image_changes',
          validPaths: imgResult.validPaths,
          images: imgResult.images,
          tempImages: imgResult.tempImages,
          deletedImages: imgResult.deletedImages,
          templateTarget: deviceScreenConfig.templateTarget
        })
      } else if (imgResult.type === 'add_temp_image') {
        onUpdateData({
          _action: 'add_temp_image',
          imagePath: imgResult.imagePath,
          imageBase64: imgResult.imageBase64,
          templateTarget: deviceScreenConfig.templateTarget
        })
      } else if (imgResult.type === 'restore_image') {
        onUpdateData({
          _action: 'restore_image',
          imagePath: imgResult.imagePath,
          templateTarget: deviceScreenConfig.templateTarget
        })
      }
      if (imgResult.closeModal !== false) {
        showDeviceScreen.value = false
      }
    } else if (Array.isArray(result)) {
      const coords = result as number[]
      const field = deviceScreenConfig.targetField
      const refRect = deviceScreenConfig.referenceRect
      if (deviceScreenConfig.mode !== 'ocr' && field.includes('offset') && refRect) {
        setValue(field, [coords[0] - refRect[0], coords[1] - refRect[1], coords[2] - refRect[2], coords[3] - refRect[3]])
      } else {
        setValue(field, coords)
      }
    } else if (deviceScreenConfig.mode === 'ocr' && result && typeof result === 'object') {
      const ocrResult = result as OcrPickResult
      const value = typeof ocrResult.text === 'string' ? ocrResult.text : ''
      if (deviceScreenConfig.targetField && value) {
        setValue(deviceScreenConfig.targetField, value)
      }
    }
  }

  const handleImageDelete = (imageName: string) => {
    onUpdateData({ _action: 'delete_image', name: imageName })
  }

  const closeDeviceScreen = () => {
    showDeviceScreen.value = false
  }

  return {
    showDeviceScreen,
    deviceScreenConfig,
    openDevicePicker,
    openImageManager,
    handleDevicePick,
    handleImageDelete,
    closeDeviceScreen
  }
}
