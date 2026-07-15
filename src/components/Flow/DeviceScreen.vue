<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { RefreshCw, Crosshair, Check, ZoomIn, Mouse } from 'lucide-vue-next'
import { deviceApi } from '@/services/api'
import DeviceScreenCanvas from './DeviceScreensModals/DeviceScreenCanvas.vue'
import DeviceScreenSidebar from './DeviceScreensModals/DeviceScreenSidebar.vue'
import type { TemplateImage } from '@/utils/flowTypes'

type ModeType = 'coordinate' | 'ocr' | 'image_manager'

interface Selection {
  x: number
  y: number
  w: number
  h: number
}

interface ImageItem extends TemplateImage {
  _source?: 'images' | 'temp' | string
}

interface OcrCandidate {
  box?: number[]
  score: number
  text: string
}

const props = defineProps<{
  visible: boolean
  mode?: ModeType
  referenceRect?: number[] | null
  referenceLabel?: string
  initialRect?: number[] | null
  title?: string
  imageList?: ImageItem[]
  tempImageList?: ImageItem[]
  deletedImageList?: ImageItem[]
  filename?: string
  nodeId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: unknown): void
  (e: 'delete-image', path: string): void
  (e: 'save-with-deletions'): void
}>()

const handleReorderImages = (newImages: ImageItem[]) => {
  localImages.value = newImages
}

const handleBatchDelete = (paths: string[]) => {
  paths.forEach(path => {
    deleteFromImages(path)
    deleteFromTempImages(path)
  })
}

const handleBatchRestore = (paths: string[]) => {
  paths.forEach(path => restoreImage(path))
}

// 状态
const saveImagePath = ref<string>('')
const imageCounter = ref<number>(1)
const localImages = ref<ImageItem[]>([])
const localTempImages = ref<ImageItem[]>([])
const localDeletedImages = ref<ImageItem[]>([])
const originalTemplatePaths = ref<string[]>([])
const isLoading = ref(false)
const isOcrLoading = ref(false)
const imageUrl = ref<string>('')
const previewUrl = ref<string>('')
const ocrResult = ref<string>('')
const canvasRef = ref<InstanceType<typeof DeviceScreenCanvas> | null>(null)
const imageSize = ref({ width: 1280, height: 720 })
const ocrCandidates = ref<OcrCandidate[]>([])
const selectedOcrIndex = ref(0)

// 选区状态 (共享给 Sidebar 和 Canvas)
const selection = reactive<Selection>({x: 0, y: 0, w: 0, h: 0})

// --- 计算属性：相对偏移量 ---
const offsetInfo = computed(() => {
  if (!props.referenceRect || props.referenceRect.length !== 4 || selection.w <= 0) return null
  return [
    Math.round(selection.x - props.referenceRect[0]),
    Math.round(selection.y - props.referenceRect[1]),
    Math.round(selection.w - props.referenceRect[2]),
    Math.round(selection.h - props.referenceRect[3])
  ]
})

// --- 操作指南配置 ---
const guideList = computed(() => {
  const common = [
    {icon: Mouse, text: '<strong>左键</strong> 框选，<strong>右键</strong> 拖动视图。'},
    {icon: ZoomIn, text: '<strong>滚轮</strong> 缩放图片细节。'},
    {icon: RefreshCw, text: '点击 <strong>刷新</strong> 获取最新画面。'},
  ]

  if (props.mode === 'image_manager') {
    return [
      ...common,
      {icon: Crosshair, text: '松开鼠标自动生成预览。'},
      {icon: Check, text: '点击 <strong>保存区域</strong> 保存截图。'}
    ]
  } else {
    return [
      ...common,
      {icon: Check, text: '点击 <strong>确认</strong> 完成选取。'}
    ]
  }
})

// --- 路径逻辑 ---
const generateDefaultSavePath = () => {
  const baseFilename = props.filename ? props.filename.replace(/\.[^/.]+$/, '') : 'default'
  const nodeId = props.nodeId || 'node'
  const usedPaths = new Set()

  const collectPaths = (list?: ImageItem[]) => {
    if (!list) return
    list.forEach(img => {
      if (img && img.path) usedPaths.add(img.path)
    })
  }
  collectPaths(props.imageList)
  collectPaths(props.tempImageList)
  collectPaths(props.deletedImageList)
  collectPaths(localImages.value)
  collectPaths(localTempImages.value)
  collectPaths(localDeletedImages.value)

  let index = 1
  let candidatePath = ''
  while (true) {
    candidatePath = `${baseFilename}/${nodeId}_${index}.png`
    if (!usedPaths.has(candidatePath)) break
    index++
  }
  return candidatePath
}

const currentTemplatePaths = computed(() => {
  const paths: string[] = []
  localImages.value.forEach(img => paths.push(img.path))
  localTempImages.value.forEach(img => paths.push(img.path))
  return paths.sort()
})

const hasTemplateChanged = computed(() => {
  const current = [...currentTemplatePaths.value].sort().join(',')
  const original = [...originalTemplatePaths.value].sort().join(',')
  return current !== original
})

// --- 初始化与监听 ---
watch(() => props.visible, async (val: boolean) => {
  if (val) {
    if (canvasRef.value) canvasRef.value.resetView()
    ocrResult.value = ''
    ocrCandidates.value = []
    selectedOcrIndex.value = 0
    previewUrl.value = ''
    imageCounter.value = 1

    localImages.value = (props.imageList || []).map(img => ({...img}))
    localTempImages.value = (props.tempImageList || []).map(img => ({...img}))
    localDeletedImages.value = (props.deletedImageList || []).map(img => ({
      ...img,
      _source: img._source || 'images'
    }))

    saveImagePath.value = generateDefaultSavePath()
    originalTemplatePaths.value = [
      ...(props.imageList || []).map(img => img.path),
      ...(props.tempImageList || []).map(img => img.path)
    ]

    if (!imageUrl.value) {
      await fetchScreenshot()
    }

    // 初始化选区
    if (props.initialRect && props.initialRect.length === 4) {
      selection.x = props.initialRect[0]
      selection.y = props.initialRect[1]
      selection.w = props.initialRect[2]
      selection.h = props.initialRect[3]
      await nextTick(() => {
        void canvasRef.value?.generatePreviewSnapshot()
      })
    } else {
      selection.x = 0; selection.y = 0; selection.w = 0; selection.h = 0;
    }
  }
})

const fetchScreenshot = async () => {
  isLoading.value = true
  try {
    const res = await deviceApi.getScreenshot()
    const img = (res as any)?.image ?? (res as any)?.data
    const size = Array.isArray((res as any)?.size) ? (res as any).size : null
    if (img && typeof img === 'string') {
      imageUrl.value = img
      if (size && size.length >= 2 && Number(size[0]) > 0 && Number(size[1]) > 0) {
        imageSize.value = {
          width: Number(size[0]),
          height: Number(size[1])
        }
      }
      if (selection.w > 0) {
        setTimeout(() => {
          void canvasRef.value?.generatePreviewSnapshot()
        }, 100)
      }
    }
  } catch (e: unknown) {
    console.error("获取截图失败", e)
  } finally {
    isLoading.value = false
  }
}

// --- 事件处理 ---
const handleSelectionChange = (newSelection: Selection) => {
  selection.x = newSelection.x
  selection.y = newSelection.y
  selection.w = newSelection.w
  selection.h = newSelection.h
}

const handlePreviewGenerated = (base64: string) => {
  previewUrl.value = base64
}

// 处理本地上传的图片
const handleLocalImageUpload = (base64: string) => {
  imageUrl.value = base64
  // 上传新图后重置选区，因为旧选区可能不适用
  selection.x = 0
  selection.y = 0
  selection.w = 0
  selection.h = 0
  previewUrl.value = ''

  // 重置视图位置
  if (canvasRef.value) {
    canvasRef.value.resetView()
  }
}

const handleOcr = async () => {
  if (selection.w <= 0 || selection.h <= 0) return
  isOcrLoading.value = true
  try {
    const roi = [
      Math.round(selection.x),
      Math.round(selection.y),
      Math.round(selection.w),
      Math.round(selection.h)
    ]
    const res = await deviceApi.ocrText(roi)
    const payload = (res as any)?.data ?? res
    if (res && (res as any).success === false) {
      throw new Error((res as any).message || 'OCR failed')
    }

    const all = Array.isArray(payload?.all) ? payload.all : []
    const filtered = Array.isArray(payload?.filtered) ? payload.filtered : []
    const best = payload?.best ?? null
    ocrCandidates.value = (filtered.length ? filtered : all).filter((item: any) => item && typeof item.text === 'string')
    if (!ocrCandidates.value.length && best && typeof best.text === 'string') {
      ocrCandidates.value = [best]
    }
    selectedOcrIndex.value = 0

    const text = typeof payload?.text === 'string'
      ? payload.text
      : (ocrCandidates.value[0]?.text ?? '')

    ocrResult.value = text || '识别失败'
  } catch (e: unknown) {
    console.error("OCR 失败", e)
    ocrResult.value = "识别失败"
    ocrCandidates.value = []
  } finally {
    isOcrLoading.value = false
  }
}

const selectOcrCandidate = (index: number) => {
  selectedOcrIndex.value = index
  const candidate = ocrCandidates.value[index]
  if (candidate?.text) {
    ocrResult.value = candidate.text
  }
}

const handleBackgroundClick = () => {
  // 如果正在框选，不关闭弹窗
  if (canvasRef.value?.isDragging) return
  emit('close')
}

const handleConfirm = () => {
  if (props.mode === 'ocr') {
    emit('confirm', {
      text: ocrResult.value,
      best: ocrCandidates.value[selectedOcrIndex.value] ?? null,
      all: ocrCandidates.value,
      filtered: ocrCandidates.value
    })
    emit('close')
  } else if (props.mode === 'image_manager') {
    // 逻辑在 handleImageManagerSave 中，这里只处理普通确认
    if (selection.w > 0) {
      const result = {
        rect: [Math.round(selection.x), Math.round(selection.y), Math.round(selection.w), Math.round(selection.h)],
        type: 'save_screenshot'
      }
      emit('confirm', result)
    }
    return
  } else {
    const result = [Math.round(selection.x), Math.round(selection.y), Math.round(selection.w), Math.round(selection.h)]
    emit('confirm', result)
    emit('close')
  }
}

const handleImageManagerSave = () => {
  const validPaths = currentTemplatePaths.value
  const result = {
    type: 'save_image_changes',
    validPaths,
    images: localImages.value,
    tempImages: localTempImages.value,
    deletedImages: localDeletedImages.value
  }
  emit('confirm', result)
  emit('close')
}

const handlePreviewEdit = (editedBase64: string) => {
  if (!editedBase64) return
  previewUrl.value = editedBase64
}

// --- 图片管理逻辑 ---
const deleteFromImages = (path: string) => {
  const index = localImages.value.findIndex(img => img.path === path)
  if (index !== -1) {
    const [deletedImg] = localImages.value.splice(index, 1)
    localDeletedImages.value.push({ ...deletedImg, _source: 'images' })
    saveImagePath.value = generateDefaultSavePath()
  }
}

const deleteFromTempImages = (path: string) => {
  const index = localTempImages.value.findIndex(img => img.path === path)
  if (index !== -1) {
    const [deletedImg] = localTempImages.value.splice(index, 1)
    localDeletedImages.value.push({ ...deletedImg, _source: 'temp' })
    saveImagePath.value = generateDefaultSavePath()
  }
}

const restoreImage = (path: string) => {
  const index = localDeletedImages.value.findIndex(img => img.path === path)
  if (index !== -1) {
    const [restoredImg] = localDeletedImages.value.splice(index, 1)
    const { _source, ...imgData } = restoredImg
    if (_source === 'temp') {
      localTempImages.value.push(imgData)
    } else {
      localImages.value.push(imgData)
    }
    saveImagePath.value = generateDefaultSavePath()
  }
}

const handleSaveTempImage = async () => {
  if (!saveImagePath.value.trim()) return
  let imageBase64 = previewUrl.value
  if (!imageBase64 && selection.w > 0 && selection.h > 0) {
    imageBase64 = await canvasRef.value?.generatePreviewSnapshot() || ''
  }
  if (!imageBase64) return
  const imagePath = saveImagePath.value.trim()

  localTempImages.value.push({
    path: imagePath,
    base64: imageBase64,
    url: imageBase64,
    found: true
  })

saveImagePath.value = generateDefaultSavePath()
  selection.x = 0; selection.y = 0; selection.w = 0; selection.h = 0;
  previewUrl.value = ''

  if(canvasRef.value && canvasRef.value.resetView) {
      canvasRef.value.resetView()
  }

}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 animate-in fade-in duration-200"
    @mousedown.self="handleBackgroundClick"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
      :class="props.mode === 'image_manager' ? 'max-w-[98vw]' : 'max-w-[95vw]'"
    >
      <DeviceScreenCanvas
        ref="canvasRef"
        :image-url="imageUrl"
        :is-loading="isLoading"
        :reference-rect="referenceRect"
        :reference-label="referenceLabel"
        :mode="mode"
        :initial-selection="selection"
        :image-size="imageSize"
        @refresh="fetchScreenshot"
        @selection-change="handleSelectionChange"
        @preview-generated="handlePreviewGenerated"
        @image-uploaded="handleLocalImageUpload"
      />

      <DeviceScreenSidebar
        :mode="mode"
        :title="title"
        :selection="selection"
        :ocr-result="ocrResult"
        :ocr-candidates="ocrCandidates"
        :selected-ocr-index="selectedOcrIndex"
        :is-ocr-loading="isOcrLoading"
        :preview-url="previewUrl"
        :save-image-path="saveImagePath"
        :guide-list="guideList"
        :offset-info="offsetInfo"
        :reference-rect="referenceRect"
        :reference-label="referenceLabel"
        :has-template-changed="hasTemplateChanged"
        :local-images="localImages"
        :local-temp-images="localTempImages"
        :local-deleted-images="localDeletedImages"
        @close="$emit('close')"
        @confirm="handleConfirm"
        @ocr-start="handleOcr"
        @update:ocr-result="ocrResult = $event"
        @select-ocr-candidate="selectOcrCandidate"
        @update:save-image-path="saveImagePath = $event"
        @save-temp-image="handleSaveTempImage"
        @apply-preview-edit="handlePreviewEdit"
        @save-image-changes="handleImageManagerSave"
        @delete-image="deleteFromImages"
        @delete-temp="deleteFromTempImages"
        @restore-image="restoreImage"
        @reorder="handleReorderImages"
        @batch-delete="handleBatchDelete"
        @batch-restore="handleBatchRestore"
      />
    </div>
  </div>
</template>
