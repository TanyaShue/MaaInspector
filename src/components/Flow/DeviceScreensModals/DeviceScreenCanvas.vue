<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { Smartphone, RefreshCw, RotateCcw, Upload } from 'lucide-vue-next'
import { calculateColorRange, calculateSelectionPixelBounds, type ColorRangeResult } from '@/utils/colorRange'
import type { DevicePickerMode } from '@/composables/useDeviceScreenPicker'

interface Selection { x: number; y: number; w: number; h: number }

const props = defineProps<{
  imageUrl?: string
  isLoading?: boolean
  referenceRect?: number[] | null
  referenceLabel?: string
  mode?: DevicePickerMode
  initialSelection?: Selection
  imageSize?: { width: number; height: number }
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'selection-change', payload: Selection): void
  (e: 'preview-generated', payload: string): void
  (e: 'image-uploaded', payload: string): void
}>()

const contentRef = ref<HTMLDivElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const screenImageRef = ref<HTMLImageElement | null>(null)

const fallbackImageSize = { width: 1280, height: 720 }
const logicalImageSize = computed(() => ({
  width: props.imageSize?.width && props.imageSize.width > 0 ? props.imageSize.width : fallbackImageSize.width,
  height: props.imageSize?.height && props.imageSize.height > 0 ? props.imageSize.height : fallbackImageSize.height
}))

// 本地状态
const isDragging = ref(false)
const isPanning = ref(false)
const selection = reactive<Selection>({ x: 0, y: 0, w: 0, h: 0 })
const viewState = reactive({ scale: 1, x: 0, y: 0 })
const startPos = reactive({ x: 0, y: 0 })
const mouseStart = reactive({ x: 0, y: 0 })
const viewStart = reactive({ x: 0, y: 0 })

// 同步初始选区
watch(() => props.initialSelection, (val) => {
  if (val) {
    selection.x = val.x
    selection.y = val.y
    selection.w = val.w
    selection.h = val.h
  }
}, { deep: true, immediate: true })

// 样式计算
const getRectStyle = (rect: number[]) => {
  if (!rect || rect[2] <= 0 || rect[3] <= 0) return { display: 'none' }
  const { width, height } = logicalImageSize.value
  return {
    left: `${(rect[0] / width) * 100}%`,
    top: `${(rect[1] / height) * 100}%`,
    width: `${(rect[2] / width) * 100}%`,
    height: `${(rect[3] / height) * 100}%`
  }
}

const selectionStyle = computed(() => getRectStyle([selection.x, selection.y, selection.w, selection.h]))
const referenceStyle = computed(() => props.referenceRect ? getRectStyle(props.referenceRect) : { display: 'none' })

const contentStyle = computed(() => ({
  transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
  transformOrigin: 'center center',
  width: '100%',
  aspectRatio: `${logicalImageSize.value.width}/${logicalImageSize.value.height}`
}))

// 生成预览快照
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('Image load failed'))
  img.src = src
})

const getCurrentImage = async () => {
  const current = screenImageRef.value
  if (
    current?.complete &&
    current.naturalWidth > 0 &&
    current.getAttribute('src') === props.imageUrl
  ) return current
  return loadImage(props.imageUrl || '')
}

const generatePreviewSnapshot = async (): Promise<string> => {
  if (!props.imageUrl || selection.w <= 0 || selection.h <= 0) {
    emit('preview-generated', '')
    return ''
  }

  try {
    const img = await getCurrentImage()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      emit('preview-generated', '')
      return ''
    }
    const { width, height } = logicalImageSize.value
    const source = calculateSelectionPixelBounds(selection, { width, height }, {
      width: img.naturalWidth,
      height: img.naturalHeight
    })
    if (!source) {
      emit('preview-generated', '')
      return ''
    }
    canvas.width = source.w
    canvas.height = source.h
    ctx.drawImage(
      img,
      source.x, source.y, source.w, source.h,
      0, 0, source.w, source.h
    )
    const preview = canvas.toDataURL('image/png')
    emit('preview-generated', preview)
    return preview
  } catch (error) {
    console.error('[DeviceScreenCanvas] 生成预览失败:', error)
    emit('preview-generated', '')
    return ''
  }
}

const calculateSelectionColorRange = async (
  method: number,
  previewImageUrl?: string
): Promise<ColorRangeResult | null> => {
  if (!previewImageUrl && (!props.imageUrl || selection.w <= 0 || selection.h <= 0)) return null

  const img = previewImageUrl ? await loadImage(previewImageUrl) : await getCurrentImage()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  if (previewImageUrl) {
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    ctx.drawImage(img, 0, 0)
  } else {
    const source = calculateSelectionPixelBounds(selection, logicalImageSize.value, {
      width: img.naturalWidth,
      height: img.naturalHeight
    })
    if (!source) return null
    canvas.width = source.w
    canvas.height = source.h
    ctx.drawImage(img, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h)
  }
  return calculateColorRange(ctx.getImageData(0, 0, canvas.width, canvas.height).data, method)
}

// 处理本地图片上传并缩放
const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const { width, height } = logicalImageSize.value
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          emit('image-uploaded', canvas.toDataURL('image/png'))
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
  // 清空 input 以允许重复上传同一文件
  input.value = ''
}

// 视图操作
const resetView = () => {
  viewState.scale = 1
  viewState.x = 0
  viewState.y = 0
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  let newScale = viewState.scale * delta
  newScale = Math.max(0.1, Math.min(newScale, 5))
  viewState.scale = newScale
}

// 坐标转换
const getLogicalPos = (clientX: number, clientY: number) => {
  if (!contentRef.value) return { x: 0, y: 0 }
  const rect = contentRef.value.getBoundingClientRect()
  const { width, height } = logicalImageSize.value
  const scaleX = width / rect.width
  const scaleY = height / rect.height
  let x = (clientX - rect.left) * scaleX
  let y = (clientY - rect.top) * scaleY
  x = Math.max(0, Math.min(x, width))
  y = Math.max(0, Math.min(y, height))
  return { x, y }
}

const handleMouseDown = (e: MouseEvent) => {
  if (!props.imageUrl || !contentRef.value) return
  if (e.button === 2) {
    isPanning.value = true
    mouseStart.x = e.clientX
    mouseStart.y = e.clientY
    viewStart.x = viewState.x
    viewStart.y = viewState.y
    return
  }
  if (e.button === 0) {
    isDragging.value = true
    const pos = getLogicalPos(e.clientX, e.clientY)
    startPos.x = pos.x
    startPos.y = pos.y
    selection.x = pos.x
    selection.y = pos.y
    selection.w = 0
    selection.h = 0
    emit('preview-generated', '') // 清空预览
    emit('selection-change', { ...selection })
  }
}

const handleGlobalMouseMove = (e: MouseEvent) => {
  if (isPanning.value) {
    const dx = e.clientX - mouseStart.x
    const dy = e.clientY - mouseStart.y
    viewState.x = viewStart.x + dx
    viewState.y = viewStart.y + dy
    return
  }
  if (!isDragging.value) return
  const currPos = getLogicalPos(e.clientX, e.clientY)
  const minX = Math.min(startPos.x, currPos.x)
  const minY = Math.min(startPos.y, currPos.y)
  const width = Math.abs(currPos.x - startPos.x)
  const height = Math.abs(currPos.y - startPos.y)

  selection.x = minX
  selection.y = minY
  selection.w = width
  selection.h = height

  emit('selection-change', { ...selection })
}

const handleGlobalMouseUp = () => {
  if (isDragging.value && selection.w > 0 && selection.h > 0) {
    void generatePreviewSnapshot()
  }
  isDragging.value = false
  isPanning.value = false
}

onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

// 暴露 resetView 给父组件
defineExpose({ resetView, generatePreviewSnapshot, calculateSelectionColorRange, isDragging })
</script>

<template>
  <div
    ref="containerRef"
    class="relative bg-slate-900 overflow-hidden select-none group flex items-center justify-center shrink-0"
    style="width: 80vh; aspect-ratio: 16/9;"
    :class="{
      'cursor-grabbing': isPanning,
      'cursor-crosshair': !isPanning
    }"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @contextmenu.prevent
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    >

    <div
      ref="contentRef"
      class="relative transition-transform duration-75 ease-linear"
      :style="contentStyle"
    >
      <div
        v-if="!imageUrl"
        class="flex items-center justify-center w-full h-full text-slate-500 flex-col gap-3"
      >
        <Smartphone
          :size="48"
          class="opacity-50"
        />
        <span class="text-xs font-mono">{{ isLoading ? '正在获取屏幕...' : '无法获取画面(设备连接状态异常)' }}</span>
      </div>

      <img
        v-else
        ref="screenImageRef"
        :src="imageUrl"
        draggable="false"
        class="w-full h-full object-fill pointer-events-none select-none"
        @dragstart.prevent
      >

      <div
        v-if="props.referenceRect"
        class="absolute border-2 border-dashed border-blue-400 bg-blue-500/10 pointer-events-none z-10"
        :style="referenceStyle"
      >
        <div
          class="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm whitespace-nowrap"
          :style="{ transform: `scale(${1/viewState.scale})`, transformOrigin: 'bottom left' }"
        >
          {{ props.referenceLabel }}
        </div>
      </div>

      <div
        v-if="imageUrl && selection.w > 0"
        class="absolute border z-20 pointer-events-none"
        :class="props.referenceRect ? 'border-red-500 bg-red-500/20' : 'border-emerald-500 bg-emerald-500/20'"
        :style="selectionStyle"
      >
        <div
          class="absolute -bottom-6 right-0 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm whitespace-nowrap"
          :class="props.referenceRect ? 'bg-red-500' : 'bg-emerald-500'"
          :style="{ transform: `scale(${1/viewState.scale})`, transformOrigin: 'top right' }"
        >
          {{ Math.round(selection.w) }} x {{ Math.round(selection.h) }}
        </div>
      </div>
    </div>

    <div class="absolute top-4 right-4 flex flex-row gap-2">
      <button
        class="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors flex items-center justify-center shadow-sm border border-white/10"
        title="刷新屏幕"
        @click="emit('refresh')"
      >
        <RefreshCw
          :size="16"
          :class="{'animate-spin': isLoading}"
        />
      </button>

      <button
        class="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors flex items-center justify-center shadow-sm border border-white/10"
        title="上传本地图片(自动缩放至当前截图尺寸)"
        @click="triggerFileUpload"
      >
        <Upload :size="16" />
      </button>

      <button
        class="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors flex items-center justify-center shadow-sm border border-white/10"
        title="重置视图"
        @click="resetView"
      >
        <RotateCcw :size="16" />
      </button>
    </div>

    <div
      class="absolute bottom-4 right-4 px-2 py-1 bg-black/60 text-white text-[10px] rounded font-mono pointer-events-none border border-white/10"
    >
      {{ Math.round(viewState.scale * 100) }}%
    </div>
  </div>
</template>
