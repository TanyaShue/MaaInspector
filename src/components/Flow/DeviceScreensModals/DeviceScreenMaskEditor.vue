<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { X, Undo2, RotateCcw, Brush } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  preview?: string
  initialBrushSize?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', val: string): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)
const isDrawing = ref(false)
const isPanning = ref(false)
const brushSize = ref(props.initialBrushSize ?? 18)
const viewState = reactive({ scale: 1, x: 0, y: 0 })
const startPos = reactive({ x: 0, y: 0 })
const mouseStart = reactive({ x: 0, y: 0 })
const viewStart = reactive({ x: 0, y: 0 })
const minZoom = 0.25
const maxZoom = 4
const lastPreview = ref(props.preview ?? '')
const naturalSize = reactive({ w: 0, h: 0 })

const maskColor = 'rgba(0,255,120,0.9)' // 更亮的绿色遮罩

const viewStyle = computed(() => ({
  transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
  transformOrigin: 'center center',
  width: naturalSize.w ? `${naturalSize.w}px` : '100%',
  height: naturalSize.h ? `${naturalSize.h}px` : 'auto'
}))

watch(() => props.preview, async (val) => {
  lastPreview.value = val ?? ''
  if (props.visible && val) {
    await nextTick()
    await loadImage(val)
  }
})

watch(() => props.visible, async (val) => {
  if (val && lastPreview.value) {
    await nextTick()
    await loadImage(lastPreview.value)
  } else {
    isDrawing.value = false
    isPanning.value = false
  }
})

const clampZoom = (v: number) => Math.max(minZoom, Math.min(maxZoom, v))

const changeZoom = (delta: number) => {
  viewState.scale = clampZoom(viewState.scale + delta)
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  changeZoom(delta)
}

const resetView = () => {
  viewState.scale = 1
  viewState.x = 0
  viewState.y = 0
}

const loadImage = async (src: string) => {
  if (!canvasRef.value || !src) return
  const img = new Image()
  img.onload = () => {
    if (!canvasRef.value) return
    const canvas = canvasRef.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    naturalSize.w = img.naturalWidth
    naturalSize.h = img.naturalHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  img.src = src
}

const getLogicalPos = (clientX: number, clientY: number) => {
  const canvas = canvasRef.value
  const content = contentRef.value
  if (!canvas || !content) return { x: 0, y: 0 }
  const rect = content.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (clientX - rect.left) * scaleX
  const y = (clientY - rect.top) * scaleY
  const clampX = Math.max(0, Math.min(x, canvas.width))
  const clampY = Math.max(0, Math.min(y, canvas.height))
  return { x: clampX, y: clampY }
}

const paint = (e: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const pos = getLogicalPos(e.clientX, e.clientY)
  ctx.fillStyle = maskColor
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, brushSize.value, 0, Math.PI * 2)
  ctx.fill()
}

const handleMouseDown = (e: MouseEvent) => {
  if (!canvasRef.value || !contentRef.value) return
  if (e.button === 2) {
    isPanning.value = true
    mouseStart.x = e.clientX
    mouseStart.y = e.clientY
    viewStart.x = viewState.x
    viewStart.y = viewState.y
    return
  }
  if (e.button === 0) {
    isDrawing.value = true
    startPos.x = e.clientX
    startPos.y = e.clientY
    paint(e)
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (isPanning.value) {
    const dx = e.clientX - mouseStart.x
    const dy = e.clientY - mouseStart.y
    viewState.x = viewStart.x + dx
    viewState.y = viewStart.y + dy
    return
  }
  if (!isDrawing.value) return
  paint(e)
}

const handleMouseUp = () => {
  isDrawing.value = false
  isPanning.value = false
}

const resetMask = () => {
  if (!lastPreview.value) return
  loadImage(lastPreview.value)
}

const applyMask = () => {
  if (!canvasRef.value) return
  const edited = canvasRef.value.toDataURL('image/png')
  emit('apply', edited)
  emit('close')
}
</script>

<template>
  <teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" @contextmenu.prevent>
      <div class="bg-white rounded-2xl shadow-2xl w-[min(92vw,1024px)] flex flex-col gap-3 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-slate-700">
            <Brush :size="16" class="text-emerald-500"/>
            <div class="space-y-0.5">
              <div class="text-sm font-bold">重新编辑截图</div>
              <div class="text-[11px] text-slate-500">左键涂绿，右键拖动，滚轮缩放。</div>
            </div>
          </div>
          <button @click="emit('close')" class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200">
            <X :size="16"/>
          </button>
        </div>

        <div class="flex items-center gap-3 text-[11px] text-slate-600">
          <div class="flex items-center gap-2 font-semibold text-emerald-600">
            <div class="w-3 h-3 rounded-full bg-emerald-400"></div>
            涂绿画笔
          </div>
          <input type="range" min="6" max="72" step="2" v-model.number="brushSize" class="flex-1 accent-emerald-500">
          <div class="w-16 text-right font-mono text-slate-700">{{ brushSize }}px</div>

          <button @click="applyMask" class="px-3 py-1.5 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow">
            应用
          </button>
        </div>

        <div class="flex gap-3 items-start">
          <div class="relative bg-slate-900 overflow-hidden select-none group flex items-center justify-center rounded-xl border border-slate-800" style="width: 80vh; aspect-ratio: 16/9;">
            <div
              ref="contentRef"
              class="relative transition-transform duration-75 ease-linear"
              :style="viewStyle"
              @wheel="handleWheel"
              @mousedown="handleMouseDown"
              @mousemove="handleMouseMove"
              @mouseup="handleMouseUp"
              @mouseleave="handleMouseUp"
            >
              <canvas
                ref="canvasRef"
                class="w-full h-full bg-slate-900"
              ></canvas>
            </div>

            <div class="absolute top-4 right-4 flex flex-row gap-2">
              <button @click="resetMask"
                      class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur transition-all flex items-center justify-center shadow-sm border border-white/10"
                      title="重置遮罩">
                <Undo2 :size="16"/>
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

          <div class="w-56 bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed shadow-sm">
            <div class="font-semibold text-slate-700 flex items-center gap-1 mb-2">
              <Brush :size="14" class="text-emerald-500"/> 操作提示
            </div>
            <ul class="space-y-1.5 list-disc list-inside">
              <li><span class="font-semibold text-slate-800">左键</span> 按住拖动进行涂绿遮罩。</li>
              <li><span class="font-semibold text-slate-800">右键</span> 按住拖动画布平移视图。</li>
              <li><span class="font-semibold text-slate-800">滚轮</span> 缩放查看细节。</li>
              <li>右上按钮：重置遮罩 / 重置视图。</li>
              <li>下方按钮：应用将更新预览与保存内容。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

