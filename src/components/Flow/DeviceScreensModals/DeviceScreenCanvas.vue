<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { Smartphone, RefreshCw, RotateCcw } from 'lucide-vue-next'

const props = defineProps({
  imageUrl: String,
  isLoading: Boolean,
  referenceRect: Array, // [x, y, w, h]
  referenceLabel: String,
  mode: String,
  // 外部传入初始选区
  initialSelection: { type: Object, default: () => ({ x:0, y:0, w:0, h:0 }) }
})

const emit = defineEmits(['refresh', 'selection-change', 'preview-generated'])

const containerRef = ref(null)
const contentRef = ref(null)

const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

// 本地状态
const isDragging = ref(false)
const isPanning = ref(false)
const selection = reactive({ x: 0, y: 0, w: 0, h: 0 })
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
const getRectStyle = (rect) => {
  if (!rect || rect[2] <= 0 || rect[3] <= 0) return { display: 'none' }
  return {
    left: `${(rect[0] / BASE_WIDTH) * 100}%`,
    top: `${(rect[1] / BASE_HEIGHT) * 100}%`,
    width: `${(rect[2] / BASE_WIDTH) * 100}%`,
    height: `${(rect[3] / BASE_HEIGHT) * 100}%`
  }
}

const selectionStyle = computed(() => getRectStyle([selection.x, selection.y, selection.w, selection.h]))
const referenceStyle = computed(() => props.referenceRect ? getRectStyle(props.referenceRect) : { display: 'none' })

const contentStyle = computed(() => ({
  transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
  transformOrigin: 'center center',
  width: '100%',
  aspectRatio: '16/9'
}))

// 生成预览快照
const generatePreviewSnapshot = () => {
  if (!props.imageUrl || selection.w <= 0 || selection.h <= 0) {
    emit('preview-generated', '')
    return
  }

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const scaleX = img.naturalWidth / BASE_WIDTH
    const scaleY = img.naturalHeight / BASE_HEIGHT
    const destW = selection.w * scaleX
    const destH = selection.h * scaleY
    canvas.width = destW
    canvas.height = destH
    ctx.drawImage(
      img,
      selection.x * scaleX, selection.y * scaleY, destW, destH,
      0, 0, destW, destH
    )
    emit('preview-generated', canvas.toDataURL('image/png'))
  }
  img.src = props.imageUrl
}

// 视图操作
const resetView = () => {
  viewState.scale = 1
  viewState.x = 0
  viewState.y = 0
}

const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  let newScale = viewState.scale * delta
  newScale = Math.max(0.1, Math.min(newScale, 5))
  viewState.scale = newScale
}

// 坐标转换
const getLogicalPos = (clientX, clientY) => {
  if (!contentRef.value) return { x: 0, y: 0 }
  const rect = contentRef.value.getBoundingClientRect()
  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height
  let x = (clientX - rect.left) * scaleX
  let y = (clientY - rect.top) * scaleY
  x = Math.max(0, Math.min(x, BASE_WIDTH))
  y = Math.max(0, Math.min(y, BASE_HEIGHT))
  return { x, y }
}

const handleMouseDown = (e) => {
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

const handleGlobalMouseMove = (e) => {
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
  if (isDragging.value && props.mode === 'image_manager') {
    generatePreviewSnapshot()
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
defineExpose({ resetView, generatePreviewSnapshot })
</script>

<template>
  <div
      class="relative bg-slate-900 overflow-hidden select-none group flex items-center justify-center shrink-0"
      style="width: 80vh; aspect-ratio: 16/9;"
      ref="containerRef"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @contextmenu.prevent
      :class="{
      'cursor-grabbing': isPanning,
      'cursor-crosshair': !isPanning
    }"
  >
    <div
        ref="contentRef"
        class="relative transition-transform duration-75 ease-linear"
        :style="contentStyle"
    >
      <div v-if="!imageUrl" class="flex items-center justify-center w-full h-full text-slate-500 flex-col gap-3">
        <Smartphone :size="48" class="opacity-50"/>
        <span class="text-xs font-mono">{{ isLoading ? '正在获取屏幕...' : '无法获取画面(设备连接状态异常)' }}</span>
      </div>

      <img
          v-else
          :src="imageUrl"
          draggable="false"
          class="w-full h-full object-fill pointer-events-none select-none"
          @dragstart.prevent
      />

      <div v-if="props.referenceRect"
           class="absolute border-2 border-dashed border-blue-400 bg-blue-500/10 pointer-events-none z-10"
           :style="referenceStyle">
        <div
            class="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm whitespace-nowrap"
            :style="{ transform: `scale(${1/viewState.scale})`, transformOrigin: 'bottom left' }">
          {{ props.referenceLabel }}
        </div>
      </div>

      <div v-if="imageUrl && selection.w > 0" class="absolute border z-20 pointer-events-none"
           :class="props.referenceRect ? 'border-red-500 bg-red-500/20' : 'border-emerald-500 bg-emerald-500/20'"
           :style="selectionStyle">
        <div
            class="absolute -bottom-6 right-0 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm whitespace-nowrap"
            :class="props.referenceRect ? 'bg-red-500' : 'bg-emerald-500'"
            :style="{ transform: `scale(${1/viewState.scale})`, transformOrigin: 'top right' }">
          {{ Math.round(selection.w) }} x {{ Math.round(selection.h) }}
        </div>
      </div>
    </div>

    <div class="absolute top-4 right-4 flex flex-row gap-2">
      <button @click="emit('refresh')"
              class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur transition-all flex items-center justify-center shadow-sm border border-white/10"
              title="刷新屏幕">
        <RefreshCw :size="16" :class="{'animate-spin': isLoading}"/>
      </button>
      <button @click="resetView"
              class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur transition-all flex items-center justify-center shadow-sm border border-white/10"
              title="重置视图">
        <RotateCcw :size="16"/>
      </button>
    </div>

    <div
        class="absolute bottom-4 right-4 px-2 py-1 bg-black/40 text-white text-[10px] rounded backdrop-blur font-mono pointer-events-none border border-white/10">
      {{ Math.round(viewState.scale * 100) }}%
    </div>
  </div>
</template>