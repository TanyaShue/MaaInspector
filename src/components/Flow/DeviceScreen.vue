<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Smartphone, RefreshCw, Crosshair, Check, X, Maximize, MousePointer2
} from 'lucide-vue-next'
import { deviceApi } from '../../services/api'

const props = defineProps({
  visible: Boolean,
  mode: { type: String, default: 'select' },
  referenceRect: { type: Array, default: null }, // [x,y,w,h] 用于 offset 模式下的参考框
  initialRect: { type: Array, default: null },   // [x,y,w,h] 初始回显
  title: { type: String, default: '设备屏幕选取' }
})

const emit = defineEmits(['close', 'confirm'])

// --- 状态 ---
const isLoading = ref(false)
const imageUrl = ref('')
const containerRef = ref(null)
const isDragging = ref(false)

// 坐标系基准 (建议根据实际设备调整)
const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

// 选区状态
const startPos = reactive({ x: 0, y: 0 })
const selection = reactive({ x: 0, y: 0, w: 0, h: 0 })

// --- 初始化与监听 ---
watch(() => props.visible, async (val) => {
  if (val) {
    await fetchScreenshot()
    // 初始化选区
    if (props.initialRect && props.initialRect.length === 4) {
      selection.x = props.initialRect[0]
      selection.y = props.initialRect[1]
      selection.w = props.initialRect[2]
      selection.h = props.initialRect[3]
    } else {
      selection.x = 0; selection.y = 0; selection.w = 0; selection.h = 0;
    }
  }
})

const fetchScreenshot = async () => {
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

// --- 样式计算 ---
const getRectStyle = (rect) => {
  if (!containerRef.value || !rect || rect[2] === 0) return { display: 'none' }
  const domRect = containerRef.value.getBoundingClientRect()
  const scaleX = domRect.width / BASE_WIDTH
  const scaleY = domRect.height / BASE_HEIGHT
  return {
    left: `${rect[0] * scaleX}px`,
    top: `${rect[1] * scaleY}px`,
    width: `${rect[2] * scaleX}px`,
    height: `${rect[3] * scaleY}px`
  }
}

const selectionStyle = computed(() => getRectStyle([selection.x, selection.y, selection.w, selection.h]))
const referenceStyle = computed(() => props.referenceRect ? getRectStyle(props.referenceRect) : { display: 'none' })

// --- 鼠标交互 ---
const handleMouseDown = (e) => {
  if (!imageUrl.value || !containerRef.value) return
  isDragging.value = true
  const rect = containerRef.value.getBoundingClientRect()
  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY

  startPos.x = x
  startPos.y = y
  selection.x = x; selection.y = y; selection.w = 0; selection.h = 0
}

const handleMouseMove = (e) => {
  if (!isDragging.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height

  let currX = (e.clientX - rect.left) * scaleX
  let currY = (e.clientY - rect.top) * scaleY

  // 边界限制
  currX = Math.max(0, Math.min(currX, BASE_WIDTH))
  currY = Math.max(0, Math.min(currY, BASE_HEIGHT))

  selection.x = Math.min(startPos.x, currX)
  selection.y = Math.min(startPos.y, currY)
  selection.w = Math.abs(currX - startPos.x)
  selection.h = Math.abs(currY - startPos.y)
}

const handleMouseUp = () => { isDragging.value = false }

onMounted(() => window.addEventListener('mouseup', handleMouseUp))
onUnmounted(() => window.removeEventListener('mouseup', handleMouseUp))

// --- 确认逻辑 ---
const handleConfirm = () => {
  const result = [Math.round(selection.x), Math.round(selection.y), Math.round(selection.w), Math.round(selection.h)]
  emit('confirm', result)
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row max-w-[95vw] max-h-[90vh]">

      <div
        class="relative bg-slate-900 flex items-center justify-center overflow-hidden select-none cursor-crosshair group"
        style="width: 80vh; aspect-ratio: 16/9;"
        ref="containerRef"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
      >
        <div v-if="!imageUrl" class="text-slate-500 flex flex-col items-center gap-3">
          <Smartphone :size="48" class="opacity-50" />
          <span class="text-xs font-mono">{{ isLoading ? '正在获取屏幕...' : '无法获取画面' }}</span>
        </div>

        <img v-else :src="imageUrl" class="w-full h-full object-contain pointer-events-none" />

        <div v-if="props.referenceRect" class="absolute border-2 border-dashed border-blue-400 bg-blue-500/10 pointer-events-none z-10" :style="referenceStyle">
          <div class="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm">Ref</div>
        </div>

        <div v-if="imageUrl && selection.w > 0" class="absolute border-2 z-20 pointer-events-none" :class="props.referenceRect ? 'border-red-500 bg-red-500/20' : 'border-emerald-500 bg-emerald-500/20'" :style="selectionStyle">
          <div class="absolute -bottom-6 right-0 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm whitespace-nowrap" :class="props.referenceRect ? 'bg-red-500' : 'bg-emerald-500'">
            {{ Math.round(selection.w) }} x {{ Math.round(selection.h) }}
          </div>
        </div>

        <button @click="fetchScreenshot" class="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur transition-all opacity-0 group-hover:opacity-100">
          <RefreshCw :size="16" :class="{'animate-spin': isLoading}" />
        </button>
      </div>

      <div class="w-64 bg-slate-50 border-l border-slate-200 flex flex-col">
        <div class="px-4 py-3 border-b border-slate-200 bg-white">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2"><Crosshair :size="16" class="text-indigo-500" /> {{ title }}</h3>
        </div>

        <div class="flex-1 p-4 space-y-6 overflow-y-auto">
          <div class="space-y-2">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><MousePointer2 :size="12" /> 当前选区</div>
            <div class="bg-white border border-slate-200 rounded-lg p-3 space-y-2 font-mono text-xs shadow-sm">
              <div class="flex justify-between"><span class="text-slate-400">X:</span><span class="font-bold text-slate-700">{{ Math.round(selection.x) }}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Y:</span><span class="font-bold text-slate-700">{{ Math.round(selection.y) }}</span></div>
              <div class="flex justify-between border-t border-slate-100 pt-1 mt-1"><span class="text-slate-400">W:</span><span class="font-bold text-slate-700">{{ Math.round(selection.w) }}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">H:</span><span class="font-bold text-slate-700">{{ Math.round(selection.h) }}</span></div>
            </div>
          </div>

          <div v-if="props.referenceRect" class="space-y-2">
            <div class="text-xs font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1"><Maximize :size="12" /> 参考区域</div>
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-2 text-[10px] text-blue-700 font-mono break-all">[{{ props.referenceRect.join(', ') }}]</div>
            <div class="text-[10px] text-slate-400 leading-tight">红色选区将作为相对于蓝色参考区的偏移量计算。</div>
          </div>
          <div v-else class="text-[10px] text-slate-400 leading-tight bg-slate-100 p-2 rounded">拖拽框选目标区域，确认后自动填入。</div>
        </div>

        <div class="p-4 border-t border-slate-200 bg-white space-y-2">
          <button @click="handleConfirm" :disabled="selection.w === 0" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Check :size="16" /> 确认选取</button>
          <button @click="$emit('close')" class="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"><X :size="16" /> 取消</button>
        </div>
      </div>
    </div>
  </div>
</template>