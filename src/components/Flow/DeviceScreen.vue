<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Smartphone, RefreshCw, Crosshair, Check, X, Maximize, MousePointer2,
  ZoomIn, Move, RotateCcw
} from 'lucide-vue-next'
import { deviceApi } from '../../services/api'

const props = defineProps({
  visible: Boolean,
  mode: { type: String, default: 'select' },
  referenceRect: { type: Array, default: null },
  initialRect: { type: Array, default: null },
  title: { type: String, default: '设备屏幕选取' }
})

const emit = defineEmits(['close', 'confirm'])

// --- 状态 ---
const isLoading = ref(false)
const imageUrl = ref('')
const containerRef = ref(null)
const contentRef = ref(null)
const isDragging = ref(false)
const isPanning = ref(false)
const isCtrlPressed = ref(false)

// 视图变换状态
const viewState = reactive({
  scale: 1,
  x: 0,
  y: 0
})

// 坐标系基准 (强制逻辑分辨率)
const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

// 选区状态
const startPos = reactive({ x: 0, y: 0 })
const mouseStart = reactive({ x: 0, y: 0 })
const viewStart = reactive({ x: 0, y: 0 })
const selection = reactive({ x: 0, y: 0, w: 0, h: 0 })

// --- 初始化与监听 ---
watch(() => props.visible, async (val) => {
  if (val) {
    resetView()
    await fetchScreenshot()
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

const resetView = () => {
  viewState.scale = 1
  viewState.x = 0
  viewState.y = 0
}

// --- 样式计算 ---
// 将逻辑坐标转换为百分比，确保在父容器缩放时位置正确
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
  // 强制宽高比，确保坐标计算基准一致
  width: '100%',
  aspectRatio: '16/9'
}))

// --- 全局事件监听 (解决拖动黏连的关键) ---
const handleKeyDown = (e) => { if (e.key === 'Control') isCtrlPressed.value = true }
const handleKeyUp = (e) => { if (e.key === 'Control') isCtrlPressed.value = false }

onMounted(() => {
  // 将 move 和 up 绑定到 window，防止鼠标移出 div 时事件丢失
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

// --- 交互逻辑 ---
const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  let newScale = viewState.scale * delta
  newScale = Math.max(0.1, Math.min(newScale, 5))
  viewState.scale = newScale
}

const getLogicalPos = (clientX, clientY) => {
  if (!contentRef.value) return { x: 0, y: 0 }
  const rect = contentRef.value.getBoundingClientRect()

  // 核心公式：(鼠标当前屏幕位置 - 图片左上角屏幕位置) * (逻辑宽度 / 图片实际显示宽度)
  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height

  let x = (clientX - rect.left) * scaleX
  let y = (clientY - rect.top) * scaleY

  // 严格钳位：不允许出现负数或超出 1280x720
  x = Math.max(0, Math.min(x, BASE_WIDTH))
  y = Math.max(0, Math.min(y, BASE_HEIGHT))

  return { x, y }
}

const handleMouseDown = (e) => {
  if (!imageUrl.value || !contentRef.value) return

  // 1. 平移模式
  if (e.ctrlKey || e.button === 1) {
    isPanning.value = true
    mouseStart.x = e.clientX
    mouseStart.y = e.clientY
    viewStart.x = viewState.x
    viewStart.y = viewState.y
    return
  }

  // 2. 框选模式
  isDragging.value = true
  const pos = getLogicalPos(e.clientX, e.clientY)

  startPos.x = pos.x
  startPos.y = pos.y

  selection.x = pos.x
  selection.y = pos.y
  selection.w = 0
  selection.h = 0
}

const handleGlobalMouseMove = (e) => {
  // 处理平移
  if (isPanning.value) {
    const dx = e.clientX - mouseStart.x
    const dy = e.clientY - mouseStart.y
    viewState.x = viewStart.x + dx
    viewState.y = viewStart.y + dy
    return
  }

  // 处理框选
  if (!isDragging.value) return

  const currPos = getLogicalPos(e.clientX, e.clientY)

  // 计算新的矩形，确保不出现负宽高
  const minX = Math.min(startPos.x, currPos.x)
  const minY = Math.min(startPos.y, currPos.y)
  const width = Math.abs(currPos.x - startPos.x)
  const height = Math.abs(currPos.y - startPos.y)

  selection.x = minX
  selection.y = minY
  selection.w = width
  selection.h = height
}

const handleGlobalMouseUp = () => {
  isDragging.value = false
  isPanning.value = false
}

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
        class="relative bg-slate-900 overflow-hidden select-none group flex items-center justify-center"
        style="width: 80vh; aspect-ratio: 16/9;"
        ref="containerRef"
        @wheel="handleWheel"
        @mousedown="handleMouseDown"
        @contextmenu.prevent
        :class="{
          'cursor-grab': isCtrlPressed && !isPanning,
          'cursor-grabbing': isPanning,
          'cursor-crosshair': !isCtrlPressed && !isPanning
        }"
      >
        <div
          ref="contentRef"
          class="relative transition-transform duration-75 ease-linear"
          :style="contentStyle"
        >
          <div v-if="!imageUrl" class="flex items-center justify-center w-full h-full text-slate-500 flex-col gap-3">
            <Smartphone :size="48" class="opacity-50" />
            <span class="text-xs font-mono">{{ isLoading ? '正在获取屏幕...' : '无法获取画面' }}</span>
          </div>

          <img
            v-else
            :src="imageUrl"
            draggable="false"
            class="w-full h-full object-fill pointer-events-none select-none"
            @dragstart.prevent
          />

          <div v-if="props.referenceRect" class="absolute border-2 border-dashed border-blue-400 bg-blue-500/10 pointer-events-none z-10" :style="referenceStyle">
            <div class="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm"
                 :style="{ transform: `scale(${1/viewState.scale})`, transformOrigin: 'bottom left' }">
               Ref
            </div>
          </div>

          <div v-if="imageUrl && selection.w > 0" class="absolute border-2 z-20 pointer-events-none" :class="props.referenceRect ? 'border-red-500 bg-red-500/20' : 'border-emerald-500 bg-emerald-500/20'" :style="selectionStyle">
            <div class="absolute -bottom-6 right-0 text-white text-[10px] px-1.5 py-0.5 rounded font-mono shadow-sm whitespace-nowrap"
                 :class="props.referenceRect ? 'bg-red-500' : 'bg-emerald-500'"
                 :style="{ transform: `scale(${1/viewState.scale})`, transformOrigin: 'top right' }">
              {{ Math.round(selection.w) }} x {{ Math.round(selection.h) }}
            </div>
          </div>
        </div>

        <div class="absolute top-4 right-4 flex flex-row gap-2">
           <button @click="fetchScreenshot" class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur transition-all flex items-center justify-center shadow-sm border border-white/10" title="刷新屏幕">
             <RefreshCw :size="16" :class="{'animate-spin': isLoading}" />
           </button>
           <button @click="resetView" class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur transition-all flex items-center justify-center shadow-sm border border-white/10" title="重置视图">
             <RotateCcw :size="16" />
           </button>
        </div>

        <div class="absolute bottom-4 right-4 px-2 py-1 bg-black/40 text-white text-[10px] rounded backdrop-blur font-mono pointer-events-none border border-white/10">
          {{ Math.round(viewState.scale * 100) }}%
        </div>
      </div>

      <div class="w-64 bg-slate-50 border-l border-slate-200 flex flex-col">
        <div class="px-4 py-3 border-b border-slate-200 bg-white">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2"><Crosshair :size="16" class="text-indigo-500" /> {{ title }}</h3>
        </div>

        <div class="flex-1 p-4 space-y-6 overflow-y-auto">
          <div class="space-y-2">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><MousePointer2 :size="12" /> 当前选区</div>
            <div class="bg-white border border-slate-200 rounded-lg p-3 space-y-2 font-mono text-xs shadow-sm select-text">
              <div class="flex justify-between"><span class="text-slate-400">X:</span><span class="font-bold text-slate-700">{{ Math.round(selection.x) }}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">Y:</span><span class="font-bold text-slate-700">{{ Math.round(selection.y) }}</span></div>
              <div class="flex justify-between border-t border-slate-100 pt-1 mt-1"><span class="text-slate-400">W:</span><span class="font-bold text-slate-700">{{ Math.round(selection.w) }}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">H:</span><span class="font-bold text-slate-700">{{ Math.round(selection.h) }}</span></div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-semibold text-indigo-500 uppercase tracking-wider flex items-center gap-1">操作指南</div>
            <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed space-y-2">
               <div class="flex items-start gap-2">
                 <ZoomIn :size="14" class="text-indigo-400 mt-0.5 shrink-0"/>
                 <span><strong>滚轮</strong> 缩放图片细节。</span>
               </div>
               <div class="flex items-start gap-2">
                 <Move :size="14" class="text-indigo-400 mt-0.5 shrink-0"/>
                 <span>按住 <strong>Ctrl</strong> + 拖动 平移视图。</span>
               </div>
               <div class="flex items-start gap-2">
                  <RefreshCw :size="14" class="text-indigo-400 mt-0.5 shrink-0"/>
                  <span> <strong>刷新</strong> 获取最新画面。</span>
               </div>
               <div class="flex items-start gap-2">
                  <RotateCcw :size="14" class="text-indigo-400 mt-0.5 shrink-0"/>
                  <span> <strong>重置</strong> 重置图片位置。</span>
               </div>
            </div>
          </div>

          <div v-if="props.referenceRect" class="space-y-2">
             <div class="text-xs font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1"><Maximize :size="12" /> 参考区域</div>
             <div class="bg-blue-50 border border-blue-100 rounded-lg p-2 text-[10px] text-blue-700 font-mono break-all">[{{ props.referenceRect.join(', ') }}]</div>
          </div>
        </div>

        <div class="p-4 border-t border-slate-200 bg-white space-y-2">
          <button @click="handleConfirm" :disabled="selection.w === 0" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Check :size="16" /> 确认选取</button>
          <button @click="$emit('close')" class="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"><X :size="16" /> 取消</button>
        </div>
      </div>
    </div>
  </div>
</template>