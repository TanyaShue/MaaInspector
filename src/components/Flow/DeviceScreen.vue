<script setup>
import {ref, reactive, computed, watch, onMounted, onUnmounted, nextTick} from 'vue'
import {
  Smartphone, RefreshCw, Crosshair, Check, X, MousePointer2,
  ZoomIn, RotateCcw, ScanText, Loader2, Image as ImageIcon, Trash2, Mouse,
  Maximize, ArrowLeftRight, Copy, RotateCw
} from 'lucide-vue-next'
import {deviceApi} from '../../services/api'

const props = defineProps({
  visible: Boolean,
  mode: {type: String, default: 'coordinate'},
  referenceRect: {type: Array, default: null}, // 格式: [x, y, w, h]
  referenceLabel: {type: String, default: '参考区域'},
  initialRect: {type: Array, default: null},
  title: {type: String, default: '设备屏幕选取'},
  imageList: {type: Array, default: () => []},
  tempImageList: {type: Array, default: () => []}, // 临时图片列表 (_temp_images)
  deletedImageList: {type: Array, default: () => []}, // 已删除的图片列表
  filename: {type: String, default: ''}, // 当前文件名
  nodeId: {type: String, default: ''} // 当前节点ID
})

const emit = defineEmits(['close', 'confirm', 'delete-image', 'save-with-deletions'])

// 保存图片的路径名
const saveImagePath = ref('')

// 本地图片列表（实时操作）
const localImages = ref([]) // 当前图片 (_images)
const localTempImages = ref([]) // 新增图片 (_temp_images)
const localDeletedImages = ref([]) // 已删除图片 (_del_images)，带来源标记

// 原始 template 路径（用于判断是否有变化）
const originalTemplatePaths = ref([])

const isLoading = ref(false)
const isOcrLoading = ref(false)
const imageUrl = ref('')
const previewUrl = ref('')
const containerRef = ref(null)
const contentRef = ref(null)
const isDragging = ref(false)
const isPanning = ref(false)

// OCR 结果状态
const ocrResult = ref('')

// 视图变换状态
const viewState = reactive({
  scale: 1,
  x: 0,
  y: 0
})

const BASE_WIDTH = 1280
const BASE_HEIGHT = 720

const startPos = reactive({x: 0, y: 0})
const mouseStart = reactive({x: 0, y: 0})
const viewStart = reactive({x: 0, y: 0})
const selection = reactive({x: 0, y: 0, w: 0, h: 0})

// --- 计算属性：相对偏移量 ---
const offsetInfo = computed(() => {
  if (!props.referenceRect || props.referenceRect.length !== 4 || selection.w <= 0) return null
  return [
    Math.round(selection.x - props.referenceRect[0]),
    Math.round(selection.y - props.referenceRect[1]),
    Math.round(selection.w - props.referenceRect[2]), // 宽度的差值
    Math.round(selection.h - props.referenceRect[3])  // 高度的差值
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

// --- 计算默认保存路径 (修改版：检查所有列表防止重名) ---
const generateDefaultSavePath = () => {
  // 移除文件名的扩展名（如 .json）
  const baseFilename = props.filename ? props.filename.replace(/\.[^/.]+$/, '') : 'default'
  const nodeId = props.nodeId || 'node'

  // 收集所有已经被占用的路径 (Set去重)
  const usedPaths = new Set()

  const collectPaths = (list) => {
    if (!list) return
    list.forEach(img => {
      if (img && img.path) usedPaths.add(img.path)
    })
  }

  // 检查 props 中的原始数据
  collectPaths(props.imageList)
  collectPaths(props.tempImageList)
  collectPaths(props.deletedImageList)

  // 检查本地实时数据 (因为用户可能刚刚添加或删除了图片)
  collectPaths(localImages.value)
  collectPaths(localTempImages.value)
  collectPaths(localDeletedImages.value)

  // 从 1 开始寻找可用的序号
  let index = 1
  let candidatePath = ''

  while (true) {
    candidatePath = `${baseFilename}\\${nodeId}_${index}.png`
    if (!usedPaths.has(candidatePath)) {
      break // 找到未被使用的路径
    }
    index++
  }

  return candidatePath
}

// --- 计算当前有效的 template 路径 ---
const currentTemplatePaths = computed(() => {
  const paths = []
  localImages.value.forEach(img => paths.push(img.path))
  localTempImages.value.forEach(img => paths.push(img.path))
  return paths.sort()
})

// --- 判断 template 是否有变化 ---
const hasTemplateChanged = computed(() => {
  const current = [...currentTemplatePaths.value].sort().join(',')
  const original = [...originalTemplatePaths.value].sort().join(',')
  return current !== original
})

// --- 初始化与监听 ---
watch(() => props.visible, async (val) => {
  if (val) {
    resetView()
    ocrResult.value = ''
    previewUrl.value = ''

    // 初始化本地图片列表（深拷贝）
    localImages.value = (props.imageList || []).map(img => ({...img}))
    localTempImages.value = (props.tempImageList || []).map(img => ({...img}))
    // 已删除图片保留来源标记（如果有的话，没有则默认为 images）
    localDeletedImages.value = (props.deletedImageList || []).map(img => ({
      ...img,
      _source: img._source || 'images' // 保留已有的来源标记，默认为 images
    }))

    // 初始化完成后生成路径，确保考虑到刚刚载入的所有图片
    saveImagePath.value = generateDefaultSavePath()

    // 记录原始 template 路径
    originalTemplatePaths.value = [
      ...(props.imageList || []).map(img => img.path),
      ...(props.tempImageList || []).map(img => img.path)
    ]

    await fetchScreenshot()
    if (props.initialRect && props.initialRect.length === 4) {
      selection.x = props.initialRect[0]
      selection.y = props.initialRect[1]
      selection.w = props.initialRect[2]
      selection.h = props.initialRect[3]
      nextTick(() => generatePreviewSnapshot())
    } else {
      selection.x = 0;
      selection.y = 0;
      selection.w = 0;
      selection.h = 0;
    }
  }
})

const copySelection = () => {
  if (!props.selection) return;
  const {x, y, w, h} = props.selection;
  // 格式化为数组字符串 [x, y, w, h]
  const text = `[${Math.round(x)}, ${Math.round(y)}, ${Math.round(w)}, ${Math.round(h)}]`;

  navigator.clipboard.writeText(text).then(() => {
    // 这里可以加一个简单的 Toast 提示，比如 "已复制"
    console.log('Copied:', text);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
};

const fetchScreenshot = async () => {
  isLoading.value = true
  try {
    const res = await deviceApi.getScreenshot()
    if (res.success && res.image) {
      imageUrl.value = res.image
      if (selection.w > 0) setTimeout(generatePreviewSnapshot, 100)
    }
  } catch (e) {
    console.error("获取截图失败", e)
  } finally {
    isLoading.value = false
  }
}

const generatePreviewSnapshot = () => {
  if (!imageUrl.value || selection.w <= 0 || selection.h <= 0) {
    previewUrl.value = ''
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
    previewUrl.value = canvas.toDataURL('image/png')
  }
  img.src = imageUrl.value
}

const resetView = () => {
  viewState.scale = 1
  viewState.x = 0
  viewState.y = 0
}

const getRectStyle = (rect) => {
  if (!rect || rect[2] <= 0 || rect[3] <= 0) return {display: 'none'}
  return {
    left: `${(rect[0] / BASE_WIDTH) * 100}%`,
    top: `${(rect[1] / BASE_HEIGHT) * 100}%`,
    width: `${(rect[2] / BASE_WIDTH) * 100}%`,
    height: `${(rect[3] / BASE_HEIGHT) * 100}%`
  }
}

const selectionStyle = computed(() => getRectStyle([selection.x, selection.y, selection.w, selection.h]))
const referenceStyle = computed(() => props.referenceRect ? getRectStyle(props.referenceRect) : {display: 'none'})

const contentStyle = computed(() => ({
  transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
  transformOrigin: 'center center',
  width: '100%',
  aspectRatio: '16/9'
}))

// --- 全局事件监听 ---
onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

const handleWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  let newScale = viewState.scale * delta
  newScale = Math.max(0.1, Math.min(newScale, 5))
  viewState.scale = newScale
}

const getLogicalPos = (clientX, clientY) => {
  if (!contentRef.value) return {x: 0, y: 0}
  const rect = contentRef.value.getBoundingClientRect()
  const scaleX = BASE_WIDTH / rect.width
  const scaleY = BASE_HEIGHT / rect.height
  let x = (clientX - rect.left) * scaleX
  let y = (clientY - rect.top) * scaleY
  x = Math.max(0, Math.min(x, BASE_WIDTH))
  y = Math.max(0, Math.min(y, BASE_HEIGHT))
  return {x, y}
}

const handleMouseDown = (e) => {
  if (!imageUrl.value || !contentRef.value) return
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
    previewUrl.value = ''
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
}

const handleGlobalMouseUp = () => {
  if (isDragging.value && props.mode === 'image_manager') {
    generatePreviewSnapshot()
  }
  isDragging.value = false
  isPanning.value = false
}

const handleOcr = async () => {
  if (selection.w === 0) return
  isOcrLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 800))
    ocrResult.value = "这是识别结果"
  } catch (e) {
    console.error("OCR 失败", e)
    ocrResult.value = "识别失败"
  } finally {
    isOcrLoading.value = false
  }
}

const handleConfirm = () => {
  if (props.mode === 'ocr') {
    emit('confirm', ocrResult.value)
  } else if (props.mode === 'image_manager') {
    // 如果有待删除的图片，保存删除操作
    if (pendingDeletePaths.value.size > 0) {
      const result = {
        type: 'delete_images',
        deletePaths: Array.from(pendingDeletePaths.value)
      }
      emit('confirm', result)
      emit('close')
      return
    }
    // 如果有选区，保存截图
    if (selection.w > 0) {
      const result = {
        rect: [Math.round(selection.x), Math.round(selection.y), Math.round(selection.w), Math.round(selection.h)],
        type: 'save_screenshot'
      }
      emit('confirm', result)
    }
    return
  } else {
    // 普通坐标模式，如果需要也可以把偏移量传出去，这里仅传选区
    const result = [Math.round(selection.x), Math.round(selection.y), Math.round(selection.w), Math.round(selection.h)]
    emit('confirm', result)
  }
  emit('close')
}

// 图片管理模式下的保存按钮逻辑
const handleImageManagerSave = () => {
  // 收集当前有效图片路径
  const validPaths = currentTemplatePaths.value

  // 收集所有当前状态的图片数据
  // 保留 _source 标记，以便下次恢复时能恢复到正确位置
  const result = {
    type: 'save_image_changes',
    validPaths, // 更新到 template 的路径
    images: localImages.value, // 当前 _images
    tempImages: localTempImages.value, // 当前 _temp_images
    deletedImages: localDeletedImages.value // 当前 _del_images（保留 _source 标记）
  }

  emit('confirm', result)
  emit('close')
}

// 从当前图片删除（实时移动到已删除区域）
const deleteFromImages = (path) => {
  const index = localImages.value.findIndex(img => img.path === path)
  if (index !== -1) {
    const [deletedImg] = localImages.value.splice(index, 1)
    // 标记来源为 images，以便恢复时回到正确位置
    localDeletedImages.value.push({ ...deletedImg, _source: 'images' })
  }
}

// 从新增图片删除（实时移动到已删除区域）
const deleteFromTempImages = (path) => {
  const index = localTempImages.value.findIndex(img => img.path === path)
  if (index !== -1) {
    const [deletedImg] = localTempImages.value.splice(index, 1)
    // 标记来源为 temp，以便恢复时回到正确位置
    localDeletedImages.value.push({ ...deletedImg, _source: 'temp' })
  }
}

// 恢复已删除的图片（根据来源恢复到正确位置）
const restoreImage = (path) => {
  const index = localDeletedImages.value.findIndex(img => img.path === path)
  if (index !== -1) {
    const [restoredImg] = localDeletedImages.value.splice(index, 1)
    const { _source, ...imgData } = restoredImg

    // 根据来源恢复到正确的列表
    if (_source === 'temp') {
      localTempImages.value.push(imgData)
    } else {
      localImages.value.push(imgData)
    }
  }
}

// 保存截图到 _temp_images（仅本地添加，保存时才提交）
const handleSaveTempImage = () => {
  if (!previewUrl.value || !saveImagePath.value.trim()) return

  const imagePath = saveImagePath.value.trim()
  const imageBase64 = previewUrl.value

  // 添加到本地临时图片列表
  localTempImages.value.push({
    path: imagePath,
    base64: imageBase64,
    found: true
  })

  // 生成新的默认路径 (会检测刚刚加入的图片)
  saveImagePath.value = generateDefaultSavePath()

  // 清空选区和预览
  selection.x = 0
  selection.y = 0
  selection.w = 0
  selection.h = 0
  previewUrl.value = ''
}
</script>

<template>
  <div v-if="visible"
       class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
       @click.self="$emit('close')">
    <div
        class="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
        :class="props.mode === 'image_manager' ? 'max-w-[98vw]' : 'max-w-[95vw]'"
    >
      <div
          class="relative bg-slate-900 overflow-hidden select-none group flex items-center justify-center"
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
            <span class="text-xs font-mono">{{ isLoading ? '正在获取屏幕...' : '无法获取画面' }}</span>
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
          <button @click="fetchScreenshot"
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

      <div class="w-64 bg-slate-50 border-l border-slate-200 flex flex-col"
           :class="{'border-r': props.mode === 'image_manager'}">
        <div class="px-4 py-3 border-b border-slate-200 bg-white">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <Crosshair :size="16" class="text-indigo-500"/>
            {{ title }}
          </h3>
        </div>

        <div class="flex-1 p-4 space-y-5 overflow-y-auto">

          <div v-if="props.mode === 'ocr'" class="space-y-2">
            <div class="text-xs font-semibold text-purple-500 uppercase tracking-wider flex items-center gap-1">
              <ScanText :size="12"/>
              OCR 识别
            </div>
            <div class="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-sm">
              <button @click="handleOcr" :disabled="selection.w === 0 || isOcrLoading"
                      class="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                <Loader2 v-if="isOcrLoading" :size="12" class="animate-spin"/>
                <ScanText v-else :size="12"/>
                {{ isOcrLoading ? '识别中...' : '开始识别' }}
              </button>

              <div class="space-y-1">
                <label
                    class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">识别结果(取最高评分)</label>
                <textarea
                    v-model="ocrResult"
                    rows="1"
                    class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-purple-400 transition-colors resize-none font-mono leading-relaxed overflow-hidden h-9"
                    placeholder="等待识别..."
                    spellcheck="false"
                ></textarea>
              </div>
            </div>
          </div>

          <div v-else-if="props.mode === 'image_manager'" class="space-y-3">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <ImageIcon :size="12"/>
              选区截图预览
            </div>

            <div
                class="bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shadow-inner flex items-center justify-center min-h-[120px] h-[120px] relative p-2">
              <div
                  class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]"></div>

              <img
                  v-if="previewUrl"
                  :src="previewUrl"
                  class="relative z-10 w-full h-full object-contain drop-shadow-sm"
                  alt="Selection Preview"
              />

              <div v-else class="text-[10px] text-slate-400 relative z-10 flex flex-col items-center gap-1">
                <MousePointer2 :size="16" class="opacity-50"/>
                <span>请左键框选区域</span>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">保存路径</label>
              <div class="flex gap-1">
                <input
                    v-model="saveImagePath"
                    type="text"
                    class="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700 font-mono outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
                    placeholder="文件名\\节点名.png"
                />
                <button
                    @click="handleSaveTempImage"
                    :disabled="!previewUrl || !saveImagePath.trim()"
                    class="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[11px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="保存截图到临时图片"
                >
                  保存
                </button>
              </div>
            </div>

          </div>

          <div v-else class="space-y-2">
            <div
                class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <div class="flex items-center gap-1">
                <MousePointer2 :size="12"/>
                当前选区
              </div>
              <button
                  @click="copySelection"
                  class="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100"
                  title="复制坐标 [x, y, w, h]"
              >
                <Copy :size="12"/>
              </button>
            </div>

            <div
                class="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs shadow-sm select-text flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1"><span class="text-slate-400">X:</span><span
                    class="font-bold text-slate-700">{{ Math.round(selection.x) }}</span></div>
                <div class="flex items-center gap-1"><span class="text-slate-400">Y:</span><span
                    class="font-bold text-slate-700">{{ Math.round(selection.y) }}</span></div>
                <div class="flex items-center gap-1"><span class="text-slate-400">W:</span><span
                    class="font-bold text-slate-700">{{ Math.round(selection.w) }}</span></div>
                <div class="flex items-center gap-1"><span class="text-slate-400">H:</span><span
                    class="font-bold text-slate-700">{{ Math.round(selection.h) }}</span></div>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-semibold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
              操作指南
            </div>
            <div
                class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed space-y-2">
              <div v-for="(guide, index) in guideList" :key="index" class="flex items-start gap-2">
                <component :is="guide.icon" :size="14" class="text-indigo-400 mt-0.5 shrink-0"/>
                <span v-html="guide.text"></span>
              </div>
            </div>
          </div>

          <div v-if="props.referenceRect" class="pt-2 border-t border-slate-100 space-y-2">

            <div class="w-full space-y-1">
              <div
                  class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate"
                  :title="props.referenceLabel">
                <Maximize :size="10"/>
                {{ props.referenceLabel }}
              </div>
              <div
                  class="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] text-slate-500 font-mono text-center truncate"
                  :title="'[' + props.referenceRect.join(', ') + ']'">
                [{{ props.referenceRect.join(', ') }}]
              </div>
            </div>

            <div class="w-full space-y-1">
              <div
                  class="text-[10px] font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1 truncate"
                  title="相对偏移">
                <ArrowLeftRight :size="10"/>
                相对偏移
              </div>
              <div
                  class="bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-[10px] text-blue-600 font-mono text-center truncate">
                [{{ offsetInfo ? offsetInfo.join(', ') : '0, 0, 0, 0' }}]
              </div>
            </div>
          </div>
        </div>
        <div v-if="props.mode !== 'image_manager'" class="p-4 border-t border-slate-200 bg-white space-y-2">
          <button
              @click="handleConfirm"
              :disabled="props.mode === 'ocr' ? (!ocrResult && !isOcrLoading) : selection.w === 0"
              class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check :size="16"/>
            {{ props.mode === 'ocr' ? '确认结果' : '确认选取' }}
          </button>
          <button @click="$emit('close')"
                  class="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <X :size="16"/>
            取消
          </button>
        </div>
      </div>

      <div v-if="props.mode === 'image_manager'" class="w-80 bg-slate-50 flex flex-col h-full overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <ImageIcon :size="16" class="text-pink-500"/>
            图片列表
          </h3>
        </div>

        <div class="flex-1 p-2 overflow-y-auto custom-scrollbar">
          <div v-if="localImages.length === 0 && localTempImages.length === 0 && localDeletedImages.length === 0"
               class="flex flex-col items-center justify-center h-40 text-slate-400 space-y-2">
            <ImageIcon :size="24" class="opacity-30"/>
            <span class="text-xs">暂无图片</span>
          </div>

          <div v-if="localImages.length > 0" class="space-y-2">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
              当前图片 ({{ localImages.length }})
            </div>
            <div class="grid grid-cols-3 gap-1">
              <div v-for="(item, index) in localImages" :key="'current-' + index"
                   class="group relative rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square bg-white border border-slate-200">

                <button
                    @click.stop="deleteFromImages(item.path)"
                    class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md backdrop-blur transition-all bg-black/50 hover:bg-red-500 opacity-0 group-hover:opacity-100"
                    title="删除图片"
                >
                  <Trash2 :size="12"/>
                </button>

                <div class="w-full h-full bg-slate-100 flex items-center justify-center relative">
                  <div
                      class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]"></div>
                  <img :src="item.base64" class="w-full h-full object-contain relative z-10"/>

                  <div class="absolute bottom-0 left-0 right-0 backdrop-blur-[1px] py-1 px-1 z-20 truncate bg-black/60">
                    <div class="text-[9px] text-white/90 font-mono text-center truncate select-none" :title="item.path">
                      {{ item.path }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="localTempImages.length > 0" class="space-y-2 mt-3">
            <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider px-1 flex items-center gap-1">
              <ImageIcon :size="10"/>
              新增图片 ({{ localTempImages.length }})
            </div>
            <div class="grid grid-cols-3 gap-1">
              <div v-for="(item, index) in localTempImages" :key="'temp-' + index"
                   class="group relative rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square bg-white border-2 border-emerald-400">

                <button
                    @click.stop="deleteFromTempImages(item.path)"
                    class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md backdrop-blur transition-all bg-black/50 hover:bg-red-500 opacity-0 group-hover:opacity-100"
                    title="删除图片"
                >
                  <Trash2 :size="12"/>
                </button>

                <div class="w-full h-full flex items-center justify-center relative bg-emerald-50">
                  <div
                      class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]"></div>
                  <img :src="item.base64" class="w-full h-full object-contain relative z-10"/>

                  <div class="absolute bottom-0 left-0 right-0 backdrop-blur-[1px] py-1 px-1 z-20 truncate bg-emerald-600/80">
                    <div class="text-[9px] text-white/90 font-mono text-center truncate select-none" :title="item.path">
                      {{ item.path }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="localDeletedImages.length > 0" class="space-y-2 mt-3">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1">
              <Trash2 :size="10" class="opacity-50"/>
              已删除图片 ({{ localDeletedImages.length }})
            </div>
            <div class="grid grid-cols-3 gap-1">
              <div v-for="(item, index) in localDeletedImages" :key="'deleted-' + index"
                   class="group relative rounded-md overflow-hidden shadow-sm transition-all aspect-square bg-slate-200 border border-slate-300">

                <button
                    @click.stop="restoreImage(item.path)"
                    class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md backdrop-blur transition-all bg-slate-500/70 hover:bg-emerald-500 opacity-0 group-hover:opacity-100"
                    title="恢复图片"
                >
                  <RotateCw :size="12"/>
                </button>

                <div class="w-full h-full bg-slate-200 flex items-center justify-center relative opacity-50 grayscale">
                  <div
                      class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]"></div>
                  <img :src="item.base64" class="w-full h-full object-contain relative z-10"/>

                  <div class="absolute bottom-0 left-0 right-0 bg-slate-500/80 backdrop-blur-[1px] py-1 px-1 z-20 truncate">
                    <div class="text-[9px] text-white/70 font-mono text-center truncate select-none" :title="item.path">
                      {{ item.path }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0">
          <button
              @click="handleImageManagerSave"
              :disabled="!hasTemplateChanged"
              class="w-full py-2 text-white rounded-lg text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
          >
            <Check :size="16"/>
            保存
          </button>
          <button @click="$emit('close')"
                  class="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <X :size="16"/>
            关闭
          </button>
        </div>
      </div>

    </div>
  </div>
</template>