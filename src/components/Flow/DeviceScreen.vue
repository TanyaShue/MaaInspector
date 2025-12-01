<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import {
  Smartphone, Maximize, Crop, ScanText, Copy,
  ChevronLeft, ChevronRight, RefreshCw, Eye, MousePointer2
} from 'lucide-vue-next'
import { deviceApi } from '../../services/api'

const props = defineProps({
  connected: { type: Boolean, default: false }
})

// --- 状态 ---
const isLoading = ref(false)
const imageUrl = ref('')
const isSidebarOpen = ref(true)
const mode = ref('view') // 'view' | 'select'

// --- 选区逻辑 ---
const containerRef = ref(null)
const isDragging = ref(false)
const startPos = reactive({ x: 0, y: 0 })
const currentPos = reactive({ x: 0, y: 0 })
const selection = reactive({ x: 0, y: 0, w: 0, h: 0 }) // 屏幕像素坐标 (相对于 1280x720)

// 假设标准分辨率，实际项目可根据后端返回的 size 动态调整
const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

// 计算用于显示的样式 (CSS像素)
const selectionStyle = computed(() => {
  if (!containerRef.value || selection.w === 0) return { display: 'none' }

  // 将 1280x720 的坐标映射回当前 DOM 尺寸
  const rect = containerRef.value.getBoundingClientRect()
  const scaleX = rect.width / BASE_WIDTH
  const scaleY = rect.height / BASE_HEIGHT

  return {
    left: `${selection.x * scaleX}px`,
    top: `${selection.y * scaleY}px`,
    width: `${selection.w * scaleX}px`,
    height: `${selection.h * scaleY}px`
  }
})


const fetchScreenshot = async () => {
  if (!props.connected) return
  isLoading.value = true
  try {
    const res = await deviceApi.getScreenshot()
    if (res.success && res.image) {
      imageUrl.value = res.image
    }
  } catch (e) {
    console.error("获取截图失败", e)
  } finally {
    isLoading.value = false
  }
}

// 监听连接状态，自动拉取
watch(() => props.connected, (val) => {
  if (val) fetchScreenshot()
  else imageUrl.value = ''
})

// 鼠标事件处理 (映射坐标)
const handleMouseDown = (e) => {
  if (mode.value !== 'select' || !containerRef.value) return
  isDragging.value = true

  const rect = containerRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 记录起始点 (转换为 1280 坐标系)
  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height

  startPos.x = x * scaleX
  startPos.y = y * scaleY

  // 重置选区
  selection.x = startPos.x
  selection.y = startPos.y
  selection.w = 0
  selection.h = 0
}

const handleMouseMove = (e) => {
  if (!isDragging.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height

  const currX = Math.max(0, Math.min(x * scaleX, BASE_WIDTH))
  const currY = Math.max(0, Math.min(y * scaleY, BASE_HEIGHT))

  // 计算左上角和宽高，支持任意方向拖拽
  selection.x = Math.min(startPos.x, currX)
  selection.y = Math.min(startPos.y, currY)
  selection.w = Math.abs(currX - startPos.x)
  selection.h = Math.abs(currY - startPos.y)
}

const handleMouseUp = () => {
  isDragging.value = false
}

// 功能动作
const copyCoordinates = () => {
  const coords = [
    Math.round(selection.x),
    Math.round(selection.y),
    Math.round(selection.w),
    Math.round(selection.h)
  ]
  navigator.clipboard.writeText(JSON.stringify(coords))
  alert(`坐标已复制: ${JSON.stringify(coords)}`)
}

const handleCrop = () => {
  if (selection.w === 0) return
  // TODO: 实现真实裁剪，这里仅做演示
  console.log("Request Crop:", selection)
  alert("裁剪区域已记录 (功能待实现)")
}

const handleOCR = () => {
  if (selection.w === 0) return
  // TODO: 调用后端 OCR
  console.log("Request OCR:", selection)
  alert("OCR 请求已发送 (功能待实现)")
}

onMounted(() => {
  if (props.connected) fetchScreenshot()
  window.addEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div class="flex h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-xl select-none transition-all duration-300 relative group">

    <div
      ref="containerRef"
      class="relative flex-1 bg-black flex items-center justify-center overflow-hidden cursor-crosshair"
      :class="{'cursor-default': mode === 'view', 'cursor-crosshair': mode === 'select'}"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
    >
      <div v-if="!imageUrl" class="text-slate-500 flex flex-col items-center gap-2">
        <Smartphone :size="48" class="opacity-50" />
        <span class="text-xs font-mono">{{ connected ? '等待画面...' : '设备未连接' }}</span>
      </div>

      <img
        v-else
        :src="imageUrl"
        class="w-full h-full object-contain pointer-events-none"
        alt="Device Screen"
      />

      <div
        v-if="imageUrl && selection.w > 0"
        class="absolute border-2 border-emerald-400 bg-emerald-500/20 z-10 pointer-events-none"
        :style="selectionStyle"
      >
        <div class="absolute -top-6 left-0 bg-emerald-500 text-white text-[10px] px-1 rounded font-mono whitespace-nowrap">
          {{ Math.round(selection.w) }} x {{ Math.round(selection.h) }}
        </div>
      </div>

      <button
        v-if="connected"
        @click="fetchScreenshot"
        class="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/80 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity"
        :disabled="isLoading"
      >
        <RefreshCw :size="14" :class="{'animate-spin': isLoading}" />
      </button>
    </div>

    <div
      class="bg-slate-800 border-l border-slate-700 flex flex-col transition-all duration-300 overflow-hidden"
      :class="isSidebarOpen ? 'w-12' : 'w-0 border-l-0'"
    >
      <div class="flex-1 flex flex-col items-center py-3 gap-3">

        <div class="flex flex-col gap-1 w-full px-1">
          <button
            @click="mode = 'view'"
            class="p-2 rounded-lg transition-colors flex justify-center relative"
            :class="mode === 'view' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'"
            title="浏览模式"
          >
             <Eye :size="18" />
          </button>
          <button
            @click="mode = 'select'"
            class="p-2 rounded-lg transition-colors flex justify-center relative"
            :class="mode === 'select' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'"
            title="框选模式"
          >
             <MousePointer2 :size="18" />
          </button>
        </div>

        <div class="w-6 h-px bg-slate-700 my-1"></div>

        <div class="flex flex-col gap-2 w-full px-1">
          <button
            @click="copyCoordinates"
            :disabled="mode !== 'select' || selection.w === 0"
            class="p-2 rounded-lg text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex justify-center"
            title="复制坐标 [x,y,w,h]"
          >
            <Copy :size="18" />
          </button>

          <button
            @click="handleCrop"
            :disabled="mode !== 'select' || selection.w === 0"
            class="p-2 rounded-lg text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex justify-center"
            title="裁剪区域"
          >
            <Crop :size="18" />
          </button>

          <button
            @click="handleOCR"
            :disabled="mode !== 'select' || selection.w === 0"
            class="p-2 rounded-lg text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex justify-center"
            title="识别内容 (OCR)"
          >
            <ScanText :size="18" />
          </button>
        </div>
      </div>
    </div>

    <button
      @click="isSidebarOpen = !isSidebarOpen"
      class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-slate-700 border border-slate-600 rounded-full p-0.5 text-slate-300 hover:bg-indigo-500 hover:text-white hover:border-indigo-400 transition-all z-20 shadow-lg"
      style="width: 20px; height: 40px; display: flex; align-items: center; justify-content: flex-start;"
    >
      <ChevronLeft v-if="!isSidebarOpen" :size="14" />
      <ChevronRight v-else :size="14" />
    </button>

  </div>
</template>