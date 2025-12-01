--- START OF FILE NodeDetails.vue ---

<script setup>
import { ref, computed, watch, reactive, nextTick } from 'vue'
import {
  X, Check, ChevronDown, ChevronRight,
  Settings, GitBranch, Clock, Zap, FileJson,
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2,
  MousePointer, ArrowRight, Keyboard, Type, Play, Square, Terminal, Wand2,
  AlertCircle, Crop, Crosshair, MessageSquare, Hand, Move, Mouse, Layers, Fingerprint,
  Info, Plus
} from 'lucide-vue-next'
import DeviceScreen from './DeviceScreen.vue'

const props = defineProps({
  visible: Boolean,
  nodeId: String,
  nodeData: Object,
  nodeType: String,
  availableTypes: Array,
  typeConfig: Object
})

const emit = defineEmits(['close', 'update-id', 'update-type', 'update-data'])

// ========== 配置定义 (保持不变) ==========
const recognitionTypes = [
  { value: 'DirectHit', label: '直接命中', icon: Target, color: 'text-blue-500' },
  { value: 'TemplateMatch', label: '模板匹配', icon: Image, color: 'text-indigo-500' },
  { value: 'FeatureMatch', label: '特征匹配', icon: Sparkles, color: 'text-violet-500' },
  { value: 'ColorMatch', label: '颜色识别', icon: Palette, color: 'text-pink-500' },
  { value: 'OCR', label: 'OCR识别', icon: ScanText, color: 'text-emerald-500' },
  { value: 'NeuralNetworkClassify', label: '模型分类', icon: Brain, color: 'text-amber-500' },
  { value: 'NeuralNetworkDetect', label: '模型检测', icon: ScanEye, color: 'text-orange-500' },
  { value: 'Custom', label: '自定义', icon: Code2, color: 'text-slate-500' }
]

const actionTypes = [
  { value: 'DoNothing', label: '无动作', icon: Square, color: 'text-slate-400' },
  { value: 'Click', label: '点击', icon: MousePointer, color: 'text-blue-500' },
  { value: 'LongPress', label: '长按', icon: Hand, color: 'text-blue-600' },
  { value: 'Swipe', label: '滑动', icon: ArrowRight, color: 'text-indigo-500' },
  { value: 'MultiSwipe', label: '多指滑动', icon: Layers, color: 'text-indigo-600' },
  { value: 'TouchDown', label: '按下', icon: Fingerprint, color: 'text-violet-500' },
  { value: 'TouchMove', label: '移动', icon: Move, color: 'text-violet-500' },
  { value: 'TouchUp', label: '抬起', icon: Hand, color: 'text-violet-500' },
  { value: 'Scroll', label: '滚轮', icon: Mouse, color: 'text-cyan-500' },
  { value: 'ClickKey', label: '按键', icon: Keyboard, color: 'text-emerald-500' },
  { value: 'LongPressKey', label: '长按键', icon: Keyboard, color: 'text-emerald-600' },
  { value: 'KeyDown', label: '键按下', icon: Keyboard, color: 'text-teal-500' },
  { value: 'KeyUp', label: '键抬起', icon: Keyboard, color: 'text-teal-500' },
  { value: 'InputText', label: '输入文本', icon: Type, color: 'text-green-500' },
  { value: 'StartApp', label: '启动应用', icon: Play, color: 'text-sky-500' },
  { value: 'StopApp', label: '停止应用', icon: Square, color: 'text-red-500' },
  { value: 'StopTask', label: '停止任务', icon: Square, color: 'text-rose-500' },
  { value: 'Command', label: '执行命令', icon: Terminal, color: 'text-amber-500' },
  { value: 'Custom', label: '自定义', icon: Wand2, color: 'text-slate-500' }
]

const orderByOptions = [
  { value: 'Horizontal', label: '水平 (Horizontal)' },
  { value: 'Vertical', label: '垂直 (Vertical)' },
  { value: 'Score', label: '分数 (Score)' },
  { value: 'Area', label: '面积 (Area)' },
  { value: 'Length', label: '长度 (Length)' },
  { value: 'Random', label: '随机 (Random)' },
  { value: 'Expected', label: '期望 (Expected)' },
]

const detectorOptions = ['SIFT', 'KAZE', 'AKAZE', 'BRISK', 'ORB']

const focusEventTypes = [
  'Node.Recognition.Starting',
  'Node.Recognition.Succeeded',
  'Node.Recognition.Failed',
  'Node.Action.Starting',
  'Node.Action.Succeeded',
  'Node.Action.Failed'
]

const DEFAULTS = {
  recognition: 'DirectHit',
  action: 'DoNothing',
  next: [],
  interrupt: [],
  on_error: [],
  is_sub: false,
  rate_limit: 1000,
  timeout: 20000,
  inverse: false,
  enabled: true,
  pre_delay: 200,
  post_delay: 200,
  pre_wait_freezes: 0,
  post_wait_freezes: 0,
  roi: [0, 0, 0, 0],
  roi_offset: [0, 0, 0, 0],
  index: 0,
  order_by: 'Horizontal',
  threshold: 0.7,
  method: 5,
  count: 4,
  detector: 'SIFT',
  ratio: 0.6,
  connected: false,
  only_rec: false,
  green_mask: false,
  target: true,
  duration: 200,
  contact: 0
}

// ========== 状态管理 ==========
const activeTab = ref('properties')
const expandedSections = reactive({
  basic: true, flow: false, common: false, recognition: true, action: true, focus: false
})
const editingId = ref('')
const formData = ref({})
const jsonStr = ref('')
const jsonError = ref('')
const recSectionRef = ref(null)
const actSectionRef = ref(null)

const isRecognitionDropdownOpen = ref(false)
const isActionDropdownOpen = ref(false)
const isOrderByDropdownOpen = ref(false)
const isDetectorDropdownOpen = ref(false)
const isFocusDropdownOpen = ref(false)

const anyDropdownOpen = computed(() =>
  isRecognitionDropdownOpen.value ||
  isActionDropdownOpen.value ||
  isOrderByDropdownOpen.value ||
  isDetectorDropdownOpen.value ||
  isFocusDropdownOpen.value
)

const closeAllDropdowns = () => {
  isRecognitionDropdownOpen.value = false
  isActionDropdownOpen.value = false
  isOrderByDropdownOpen.value = false
  isDetectorDropdownOpen.value = false
  isFocusDropdownOpen.value = false
}

// 关键修复：切换 Tab 时强制关闭，并依赖 v-show 彻底移除 DOM
watch(activeTab, () => {
  closeAllDropdowns()
})

const showDeviceScreen = ref(false)
const deviceScreenConfig = reactive({
  targetField: '',
  referenceField: '',
  referenceRect: null,
  referenceLabel: '',
  title: '区域选择',
  mode: 'coordinate'
})

// ========== 计算属性 (保持不变) ==========
const currentRecognition = computed(() => formData.value.recognition || DEFAULTS.recognition)
const currentAction = computed(() => formData.value.action || DEFAULTS.action)
const recognitionConfig = computed(() => recognitionTypes.find(r => r.value === currentRecognition.value) || recognitionTypes[0])
const actionConfig = computed(() => actionTypes.find(a => a.value === currentAction.value) || actionTypes[0])

const focusData = computed(() => {
  if (typeof formData.value.focus === 'object' && formData.value.focus !== null) return formData.value.focus
  return {}
})

const availableFocusEvents = computed(() => {
  const currentKeys = Object.keys(focusData.value)
  return focusEventTypes.filter(type => !currentKeys.includes(type))
})

// ========== 方法定义 (保持不变) ==========
const updateJsonFromForm = () => {
  try {
    jsonStr.value = JSON.stringify(formData.value, null, 2)
    jsonError.value = ''
  } catch (e) {}
}

const emitUpdateData = () => {
  if (activeTab.value !== 'json') updateJsonFromForm()
  emit('update-data', { ...formData.value })
}

const getValue = (key, defaultVal) => formData.value[key] !== undefined ? formData.value[key] : (defaultVal ?? DEFAULTS[key])

const setValue = (key, value) => {
  if (key === 'target' && value === true) {
    delete formData.value[key]
    emitUpdateData()
    return
  }
  if (value === DEFAULTS[key] || value === '' || value === null) {
    delete formData.value[key]
  } else {
    formData.value[key] = value
  }
  emitUpdateData()
}

const getArrayValue = (key) => {
  const val = formData.value[key]
  return Array.isArray(val) ? val.join(', ') : (val || '')
}

const setArrayValue = (key, value) => {
  if (!value || value.trim() === '') delete formData.value[key]
  else formData.value[key] = value.split(',').map(s => s.trim()).filter(Boolean)
  emitUpdateData()
}

const addFocusParam = (type) => {
  if (!formData.value.focus || typeof formData.value.focus !== 'object') formData.value.focus = {}
  formData.value.focus[type] = ''
  emitUpdateData()
  isFocusDropdownOpen.value = false
}

const removeFocusParam = (key) => {
  if (formData.value.focus) {
    delete formData.value.focus[key]
    if (Object.keys(formData.value.focus).length === 0) delete formData.value.focus
    emitUpdateData()
  }
}

const updateFocusParam = (key, value) => {
  if (!formData.value.focus) formData.value.focus = {}
  formData.value.focus[key] = value
  emitUpdateData()
}

const toggleSection = (key) => { expandedSections[key] = !expandedSections[key] }

const handleJsonInput = (event) => {
  const newVal = event.target.value
  jsonStr.value = newVal
  try {
    const parsed = JSON.parse(newVal)
    jsonError.value = ''
    formData.value = parsed
    emitUpdateData()
  } catch (e) {
    jsonError.value = e.message
  }
}

const confirmIdChange = () => {
  if (editingId.value && editingId.value !== props.nodeId) {
    emit('update-id', { oldId: props.nodeId, newId: editingId.value })
  }
}

const selectRecognitionType = (newType) => {
  setValue('recognition', newType)
  emit('update-type', newType)
  isRecognitionDropdownOpen.value = false
}

const selectActionType = (newAction) => {
  setValue('action', newAction)
  isActionDropdownOpen.value = false
}

const selectOrderBy = (val) => {
  setValue('order_by', val)
  isOrderByDropdownOpen.value = false
}

const selectDetector = (val) => {
  setValue('detector', val)
  isDetectorDropdownOpen.value = false
}

const jumpToSettings = (type) => {
  expandedSections[type] = true
  nextTick(() => {
    const target = type === 'recognition' ? recSectionRef.value : actSectionRef.value
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const getJsonValue = (key) => {
  const val = getValue(key, null)
  return (val === null || val === undefined) ? '' : (typeof val === 'object' ? JSON.stringify(val) : val)
}

const setJsonValue = (key, rawVal) => {
  if (!rawVal.trim()) { setValue(key, null); return }
  try {
    if (rawVal.startsWith('[') || rawVal.startsWith('{')) setValue(key, JSON.parse(rawVal))
    else { const num = Number(rawVal); setValue(key, isNaN(num) ? rawVal : num) }
  } catch (e) { setValue(key, rawVal) }
}

const getTargetValue = (key) => {
  const val = formData.value[key]
  return (val === true || val === undefined) ? '' : (Array.isArray(val) ? JSON.stringify(val) : val)
}

const setTargetValue = (key, rawVal) => {
  if (rawVal === '' || rawVal.toLowerCase() === 'true') { setValue(key, true); return }
  try {
    const parsed = JSON.parse(rawVal)
    if (Array.isArray(parsed)) { setValue(key, parsed); return }
  } catch (e) {}
  setValue(key, rawVal)
}

const parseRect = (val) => {
  if (Array.isArray(val) && val.length === 4) return val
  if (typeof val === 'string') {
    try {
      const arr = JSON.parse(val)
      if (Array.isArray(arr) && arr.length === 4) return arr
    } catch (e) {
      const parts = val.split(',').map(Number)
      if (parts.length === 4 && !parts.some(isNaN)) return parts
    }
  }
  return null
}

const openDevicePicker = (field, referenceField = null, mode = 'coordinate', refLabel = null) => {
  deviceScreenConfig.targetField = field
  deviceScreenConfig.referenceField = referenceField
  deviceScreenConfig.referenceRect = null
  deviceScreenConfig.mode = mode
  deviceScreenConfig.referenceLabel = refLabel || referenceField || '参考区域'
  deviceScreenConfig.title = mode === 'ocr' ? 'OCR 区域识别' : (field.includes('offset') ? `设置偏移 (${field})` : `选取区域 (${field})`)
  if (referenceField) deviceScreenConfig.referenceRect = parseRect(getValue(referenceField))
  showDeviceScreen.value = true
}

const handleDevicePick = (result) => {
  const field = deviceScreenConfig.targetField
  const refRect = deviceScreenConfig.referenceRect
  if (deviceScreenConfig.mode !== 'ocr' && field.includes('offset') && refRect) {
    setValue(field, [result[0] - refRect[0], result[1] - refRect[1], result[2] - refRect[2], result[3] - refRect[3]])
  } else {
    setValue(field, result)
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = props.nodeId
    formData.value = JSON.parse(JSON.stringify(props.nodeData?.data || {}))
    updateJsonFromForm()
    jsonError.value = ''
    closeAllDropdowns()
  }
}, { immediate: true })

watch(() => props.nodeData?.data, (newData) => {
  if (props.visible && newData && (activeTab.value !== 'json' || !jsonError.value)) {
    formData.value = JSON.parse(JSON.stringify(newData))
    updateJsonFromForm()
  }
}, { deep: true })
</script>

<template>
  <!-- 遮罩层：确保下拉框打开时点击外部能关闭 -->
  <div v-if="anyDropdownOpen" class="fixed inset-0 z-[60] bg-transparent" @click="closeAllDropdowns"></div>

  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0 translate-x-[-10px] scale-95"
    enter-to-class="opacity-100 translate-x-0 scale-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-x-0 scale-100"
    leave-to-class="opacity-0 translate-x-[-10px] scale-95"
  >
    <div
      v-if="visible"
      class="absolute left-[105%] top-0 w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 nodrag cursor-default flex flex-col overflow-hidden max-h-[750px] h-[85vh]"
      @dblclick.stop
      @wheel.stop
    >
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
            <component :is="recognitionConfig.icon" :size="16" :class="recognitionConfig.color" />
          </div>
          <div><span class="font-bold text-slate-700 text-sm">节点属性</span><div class="text-[10px] text-slate-400 font-mono">#{{ nodeId }}</div></div>
        </div>
        <button @click.stop="$emit('close'); closeAllDropdowns()" class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X :size="16" /></button>
      </div>

      <div class="flex border-b border-slate-100 bg-slate-50/30 shrink-0">
        <button @click="activeTab = 'properties'" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all" :class="activeTab === 'properties' ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' : 'text-slate-500 hover:text-slate-700'"><Settings :size="12" /> 属性</button>
        <button @click="activeTab = 'json'; updateJsonFromForm()" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all" :class="activeTab === 'json' ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' : 'text-slate-500 hover:text-slate-700'"><FileJson :size="12" /> JSON</button>
      </div>

      <div class="flex-1 min-h-0 relative">
        <!-- 修复点：使用 v-show 替代 invisible class，确保切换 Tab 时 DOM 被隐藏，消除残留 -->
        <div v-show="activeTab === 'properties'" class="absolute inset-0 overflow-y-auto custom-scrollbar p-3 space-y-2.5">

          <div class="bg-white rounded-xl border border-slate-200 overflow-visible relative z-50">
            <button @click="toggleSection('basic')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors rounded-t-xl">
              <div class="flex items-center gap-1.5"><Settings :size="12" class="text-slate-500" /><span class="font-semibold text-slate-700 text-xs">基本属性</span></div>
              <component :is="expandedSections.basic ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            <div v-show="expandedSections.basic" class="p-3 space-y-3 border-t border-slate-100 rounded-b-xl">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">节点 ID</label>
                <!-- 修复点：移除输入框多余的 transition-all 防止渲染滞后 -->
                <div class="flex gap-1.5"><input v-model="editingId" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 font-mono" /><button v-if="editingId !== nodeId" @click="confirmIdChange" class="px-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-0.5"><Check :size="10" /> 应用</button></div>
              </div>

              <div class="space-y-1 relative z-[80]">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">识别算法</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <button @click="isRecognitionDropdownOpen = !isRecognitionDropdownOpen; isActionDropdownOpen = false" class="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 cursor-pointer text-left">
                      <div class="flex items-center gap-2 overflow-hidden">
                        <component :is="recognitionConfig.icon" :size="14" :class="recognitionConfig.color" class="shrink-0" />
                        <span class="truncate">{{ recognitionConfig.label }} <span class="text-slate-400 text-[10px] ml-0.5">({{ recognitionConfig.value }})</span></span>
                      </div>
                      <ChevronDown :size="12" class="text-slate-400 shrink-0 ml-1" :class="{ 'rotate-180': isRecognitionDropdownOpen }" />
                    </button>

                    <div v-if="isRecognitionDropdownOpen" class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col py-1">
                      <button v-for="type in recognitionTypes" :key="type.value" @click="selectRecognitionType(type.value)" class="flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors shrink-0" :class="{ 'bg-indigo-50/60 text-indigo-600': currentRecognition === type.value, 'text-slate-700': currentRecognition !== type.value }">
                         <component :is="type.icon" :size="14" :class="type.color" class="shrink-0" />
                         <span class="truncate">{{ type.label }}</span>
                         <span class="ml-auto text-[10px] font-mono text-slate-400">{{ type.value }}</span>
                         <Check v-if="currentRecognition === type.value" :size="12" class="text-indigo-600 ml-2" />
                      </button>
                    </div>
                  </div>
                  <button @click="jumpToSettings('recognition')" :disabled="currentRecognition === 'DirectHit'" class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"><Settings :size="14" /></button>
                </div>
              </div>

              <div class="space-y-1 relative z-[70]">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">执行动作</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <button @click="isActionDropdownOpen = !isActionDropdownOpen; isRecognitionDropdownOpen = false" class="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 cursor-pointer text-left">
                      <div class="flex items-center gap-2 overflow-hidden">
                        <component :is="actionConfig.icon" :size="14" :class="actionConfig.color" class="shrink-0" />
                        <span class="truncate">{{ actionConfig.label }} <span class="text-slate-400 text-[10px] ml-0.5">({{ actionConfig.value }})</span></span>
                      </div>
                      <ChevronDown :size="12" class="text-slate-400 shrink-0 ml-1" :class="{ 'rotate-180': isActionDropdownOpen }" />
                    </button>

                    <div v-if="isActionDropdownOpen" class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col py-1">
                      <button v-for="type in actionTypes" :key="type.value" @click="selectActionType(type.value)" class="flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors shrink-0" :class="{ 'bg-indigo-50/60 text-indigo-600': currentAction === type.value, 'text-slate-700': currentAction !== type.value }">
                         <component :is="type.icon" :size="14" :class="type.color" class="shrink-0" />
                         <span class="truncate">{{ type.label }}</span>
                         <span class="ml-auto text-[10px] font-mono text-slate-400">{{ type.value }}</span>
                         <Check v-if="currentAction === type.value" :size="12" class="text-indigo-600 ml-2" />
                      </button>
                    </div>
                  </div>
                  <button @click="jumpToSettings('action')" :disabled="['DoNothing', 'StopTask'].includes(currentAction)" class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"><Settings :size="14" /></button>
                </div>
              </div>

            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden relative z-40">
            <button @click="toggleSection('flow')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"><div class="flex items-center gap-1.5"><GitBranch :size="12" class="text-blue-500" /><span class="font-semibold text-slate-700 text-xs">流程控制</span></div><component :is="expandedSections.flow ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" /></button>
            <div v-show="expandedSections.flow" class="p-3 space-y-2.5 border-t border-slate-100">
               <div class="space-y-1"><label class="text-[10px] font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 后继节点 (Next)</label><input :value="getArrayValue('next')" @input="setArrayValue('next', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" placeholder="用逗号分隔" /></div>
               <div class="space-y-1"><label class="text-[10px] font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 中断节点 (Interrupt)</label><input :value="getArrayValue('interrupt')" @input="setArrayValue('interrupt', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100" placeholder="用逗号分隔" /></div>
               <div class="space-y-1"><label class="text-[10px] font-semibold text-rose-600 uppercase tracking-wide flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div> 错误节点 (OnError)</label><input :value="getArrayValue('on_error')" @input="setArrayValue('on_error', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100" placeholder="用逗号分隔" /></div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden relative z-30">
            <button @click="toggleSection('common')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"><div class="flex items-center gap-1.5"><Zap :size="12" class="text-emerald-500" /><span class="font-semibold text-slate-700 text-xs">通用属性</span></div><component :is="expandedSections.common ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" /></button>
            <div v-show="expandedSections.common" class="p-3 space-y-2.5 border-t border-slate-100">
               <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">速率 (ms)</label><input type="number" :value="getValue('rate_limit', 1000)" @input="setValue('rate_limit', parseInt($event.target.value) || 1000)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">超时 (ms)</label><input type="number" :value="getValue('timeout', 20000)" @input="setValue('timeout', parseInt($event.target.value) || 20000)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
               <div class="flex flex-wrap gap-3 pt-1"><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('is_sub', false)" @change="setValue('is_sub', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">子节点</span></label><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('inverse', false)" @change="setValue('inverse', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">反转结果</span></label><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('enabled', true)" @change="setValue('enabled', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">启用</span></label></div>
               <div class="h-px bg-slate-100 my-1 w-full"></div>
               <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Clock :size="10" class="text-violet-500"/> 前延迟 (ms)</label><input type="number" :value="getValue('pre_delay', 200)" @input="setValue('pre_delay', parseInt($event.target.value) || 200)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Clock :size="10" class="text-violet-500"/> 后延迟 (ms)</label><input type="number" :value="getValue('post_delay', 200)" @input="setValue('post_delay', parseInt($event.target.value) || 200)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">前等待冻结</label><input type="number" :value="getValue('pre_wait_freezes', 0)" @input="setValue('pre_wait_freezes', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">后等待冻结</label><input type="number" :value="getValue('post_wait_freezes', 0)" @input="setValue('post_wait_freezes', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-visible relative z-20">
            <button @click="toggleSection('focus')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors rounded-t-xl"><div class="flex items-center gap-1.5"><MessageSquare :size="12" class="text-pink-500" /><span class="font-semibold text-slate-700 text-xs">消息回调</span></div><component :is="expandedSections.focus ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" /></button>
            <div v-show="expandedSections.focus" class="p-3 space-y-3 border-t border-slate-100 rounded-b-xl">
               <div v-for="(msg, key) in focusData" :key="key" class="space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100 relative group">
                 <div class="flex justify-between items-center">
                   <div class="text-[10px] font-bold text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded">{{ key }}</div>
                   <button @click="removeFocusParam(key)" class="text-slate-300 hover:text-red-500"><X :size="12" /></button>
                 </div>
                 <input :value="msg" @input="updateFocusParam(key, $event.target.value)" class="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:border-pink-300 outline-none" placeholder="消息模板..." />
               </div>

               <div class="relative" v-if="availableFocusEvents.length > 0">
                 <button @click="isFocusDropdownOpen = !isFocusDropdownOpen" class="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-pink-300 hover:text-pink-500 outline-none cursor-pointer transition-colors">
                   <Plus :size="12" /> 添加回调事件
                 </button>
                 <div v-if="isFocusDropdownOpen" class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col py-1 z-[60]">
                   <button v-for="t in availableFocusEvents" :key="t" @click="addFocusParam(t)" class="px-3 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors">{{ t }}</button>
                 </div>
               </div>
               <div v-else class="text-center text-[10px] text-slate-400 py-1">已添加所有可用事件</div>
               <div class="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                 <Info :size="12" class="text-slate-400 mt-0.5 shrink-0" />
                 <div class="space-y-1"><div class="text-[10px] text-slate-500 font-medium">可用占位符：</div><div class="text-[10px] font-mono text-slate-400 break-all leading-relaxed select-all">{name}, {task_id}, {reco_id}, {action_id}</div></div>
               </div>
            </div>
          </div>

          <div v-if="currentRecognition !== 'DirectHit'" ref="recSectionRef" class="bg-white rounded-xl border border-slate-200 overflow-visible relative z-10">
            <button @click="toggleSection('recognition')" class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 hover:from-indigo-100 hover:to-violet-100 transition-colors rounded-t-xl">
              <div class="flex items-center gap-1.5"><component :is="recognitionConfig.icon" :size="12" :class="recognitionConfig.color" /><span class="font-semibold text-slate-700 text-xs">{{ recognitionConfig.label }} 属性</span></div>
              <component :is="expandedSections.recognition ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            <div v-show="expandedSections.recognition" class="p-3 space-y-2.5 border-t border-slate-100 rounded-b-xl">
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">识别区域 (ROI)</label><div class="flex gap-1"><input :value="getJsonValue('roi')" @input="setJsonValue('roi', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('roi', null, 'coordinate', 'ROI')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"><Crop :size="12" /></button></div></div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">区域偏移</label><div class="flex gap-1"><input :value="getJsonValue('roi_offset')" @input="setJsonValue('roi_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('roi_offset', 'roi', 'coordinate', 'ROI区域')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"><Crosshair :size="12" /></button></div></div>

                <div class="space-y-1 relative">
                   <label class="text-[10px] font-semibold text-slate-500 uppercase">排序方式</label>
                   <button @click="isOrderByDropdownOpen = !isOrderByDropdownOpen" class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left">
                     <span class="truncate">{{ orderByOptions.find(o => o.value === getValue('order_by', 'Horizontal'))?.label || getValue('order_by') }}</span>
                     <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': isOrderByDropdownOpen }" />
                   </button>
                   <div v-if="isOrderByDropdownOpen" class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar z-50 flex flex-col py-1">
                     <button v-for="opt in orderByOptions" :key="opt.value" @click="selectOrderBy(opt.value)" class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors" :class="getValue('order_by', 'Horizontal') === opt.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'">{{ opt.label }}</button>
                   </div>
                </div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">结果索引</label><input type="number" :value="getValue('index', 0)" @input="setValue('index', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div>
              </div>
              <template v-if="['TemplateMatch', 'FeatureMatch'].includes(currentRecognition)"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label><input :value="getValue('template', '')" @input="setValue('template', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="image/..." /></div><label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('green_mask', false)" @change="setValue('green_mask', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">绿色掩码 (忽略绿色部分)</span></label></template>
              <template v-if="currentRecognition === 'TemplateMatch'"><div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input :value="getJsonValue('threshold')" @input="setJsonValue('threshold', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" placeholder="0.7 或 [0.7, 0.8]" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (1/3/5)</label><input type="number" min="1" max="5" step="2" :value="getValue('method', 5)" @input="setValue('method', parseInt($event.target.value) || 5)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div></div></template>

              <template v-if="currentRecognition === 'FeatureMatch'">
                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label><input type="number" min="1" :value="getValue('count', 4)" @input="setValue('count', parseInt($event.target.value) || 4)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div>
                  <div class="space-y-1 relative">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label>
                    <button @click="isDetectorDropdownOpen = !isDetectorDropdownOpen" class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left">
                      <span class="truncate">{{ getValue('detector', 'SIFT') }}</span>
                      <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': isDetectorDropdownOpen }" />
                    </button>
                    <div v-if="isDetectorDropdownOpen" class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar z-50 flex flex-col py-1">
                      <button v-for="opt in detectorOptions" :key="opt" @click="selectDetector(opt)" class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors" :class="getValue('detector', 'SIFT') === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'">{{ opt }}</button>
                    </div>
                  </div>
                  <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">距离比</label><input type="number" step="0.1" min="0" max="1" :value="getValue('ratio', 0.6)" @input="setValue('ratio', parseFloat($event.target.value) || 0.6)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div>
                </div>
              </template>

              <template v-if="currentRecognition === 'ColorMatch'"><div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label><input :value="getJsonValue('lower')" @input="setJsonValue('lower', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" placeholder="[R,G,B]" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label><input :value="getJsonValue('upper')" @input="setJsonValue('upper', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" placeholder="[R,G,B]" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label><input type="number" :value="getValue('method', 4)" @input="setValue('method', parseInt($event.target.value) || 4)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label><input type="number" min="1" :value="getValue('count', 1)" @input="setValue('count', parseInt($event.target.value) || 1)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div></div><label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('connected', false)" @change="setValue('connected', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">要求像素相连</span></label></template>
              <template v-if="currentRecognition === 'OCR'"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label><div class="flex gap-1"><input :value="getJsonValue('expected')" @input="setJsonValue('expected', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" placeholder="期望文本或正则" /><button @click="openDevicePicker('expected', 'roi', 'ocr', 'ROI区域')" class="px-2 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 rounded-lg flex items-center justify-center" title="OCR 识别取词"><ScanText :size="12" /></button></div></div><div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.3)" @input="setValue('threshold', parseFloat($event.target.value) || 0.3)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label><input :value="getValue('model', '')" @input="setValue('model', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" placeholder="model/ocr/" /></div></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label><input :value="getJsonValue('replace')" @input="setJsonValue('replace', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" placeholder='[["原","替"]]' /></div><label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('only_rec', false)" @change="setValue('only_rec', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">仅识别</span></label></template>
              <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentRecognition)"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label><input :value="getValue('model', '')" @input="setValue('model', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" :placeholder="currentRecognition === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'" /></div><div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签 ID</label><input :value="getJsonValue('expected')" @input="setJsonValue('expected', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" placeholder="0 或 [0,1,2]" /></div><div v-if="currentRecognition === 'NeuralNetworkDetect'" class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input :value="getJsonValue('threshold')" @input="setJsonValue('threshold', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" placeholder="0.3 或 [0.5, 0.6]" /></div></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表 (Labels)</label><input :value="getJsonValue('labels')" @input="setJsonValue('labels', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono" placeholder='["Cat","Dog"]' /></div></template>
              <template v-if="currentRecognition === 'Custom'"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label><input :value="getValue('custom_recognition', '')" @input="setValue('custom_recognition', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label><textarea :value="getJsonValue('custom_recognition_param')" @input="setJsonValue('custom_recognition_param', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono h-14 resize-none" placeholder="JSON"></textarea></div></template>
            </div>
          </div>

          <div v-if="!['DoNothing', 'StopTask'].includes(currentAction)" ref="actSectionRef" class="bg-white rounded-xl border border-slate-200 overflow-hidden relative z-0">
            <button @click="toggleSection('action')" class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 hover:from-emerald-100 hover:to-teal-100 transition-colors"><div class="flex items-center gap-1.5"><component :is="actionConfig.icon" :size="12" :class="actionConfig.color" /><span class="font-semibold text-slate-700 text-xs">{{ actionConfig.label }} 属性</span></div><component :is="expandedSections.action ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" /></button>
            <div v-show="expandedSections.action" class="p-3 space-y-2.5 border-t border-slate-100">
              <template v-if="['Click', 'LongPress', 'TouchDown', 'TouchMove', 'TouchUp', 'Custom'].includes(currentAction)"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">目标位置 (Target)</label><div class="flex gap-1"><input :value="getTargetValue('target')" @input="setTargetValue('target', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="留空默认自身, 或输入节点名/[x,y,w,h]" /><button @click="openDevicePicker('target', null, 'coordinate', 'Target')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"><Crop :size="12" /></button></div></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">目标偏移 (Offset)</label><div class="flex gap-1"><input :value="getJsonValue('target_offset')" @input="setJsonValue('target_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('target_offset', 'target', 'coordinate', '目标区域')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"><Crosshair :size="12" /></button></div></div><div v-if="['Click', 'LongPress', 'TouchDown', 'TouchMove', 'TouchUp'].includes(currentAction)" class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">触点编号</label><input type="number" :value="getValue('contact', 0)" @input="setValue('contact', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div><div v-if="currentAction.startsWith('Touch')" class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">压力值</label><input type="number" :value="getValue('pressure', 0)" @input="setValue('pressure', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" /></div></div></template>
              <template v-if="['Swipe', 'MultiSwipe'].includes(currentAction)"><div v-if="currentAction === 'MultiSwipe'" class="p-2 bg-amber-50 rounded text-[10px] text-amber-700 mb-2">MultiSwipe 请直接在 JSON 模式编辑 `swipes` 数组。下方仅为单个 Swipe 属性参考。</div><div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">起点</label><div class="flex gap-1"><input :value="getTargetValue('begin')" @input="setTargetValue('begin', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" /><button @click="openDevicePicker('begin', null, 'coordinate', '起点')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg"><Crop :size="12" /></button></div></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">起点偏移</label><div class="flex gap-1"><input :value="getJsonValue('begin_offset')" @input="setJsonValue('begin_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" /><button @click="openDevicePicker('begin_offset', 'begin', 'coordinate', '起点')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"><Crosshair :size="12" /></button></div></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">终点</label><div class="flex gap-1"><input :value="getTargetValue('end')" @input="setTargetValue('end', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" /><button @click="openDevicePicker('end', 'begin', 'coordinate', '起点')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg"><Crop :size="12" /></button></div></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">终点偏移</label><div class="flex gap-1"><input :value="getJsonValue('end_offset')" @input="setJsonValue('end_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" /><button @click="openDevicePicker('end_offset', 'end', 'coordinate', '终点')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"><Crosshair :size="12" /></button></div></div></div><div class="grid grid-cols-2 gap-2 mt-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">持续 (ms)</label><input :value="getJsonValue('duration')" @input="setJsonValue('duration', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">保持 (ms)</label><input :value="getJsonValue('end_hold')" @input="setJsonValue('end_hold', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div></div><div class="mt-2 flex gap-3"><label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('only_hover', false)" @change="setValue('only_hover', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">仅悬停 (Only Hover)</span></label></div></template>
              <template v-if="['ClickKey', 'LongPressKey', 'KeyDown', 'KeyUp'].includes(currentAction)"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">按键码 (Key)</label><input :value="getJsonValue('key')" @input="setJsonValue('key', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" placeholder="25 或 [25, 26]" /></div></template>
              <template v-if="currentAction === 'Scroll'"><div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">水平滚动 (DX)</label><input type="number" :value="getValue('dx', 0)" @input="setValue('dx', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">垂直滚动 (DY)</label><input type="number" :value="getValue('dy', 0)" @input="setValue('dy', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div></div></template>
              <template v-if="currentAction === 'InputText'"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">输入文本</label><input :value="getValue('input_text', '')" @input="setValue('input_text', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div></template>
              <template v-if="['StartApp', 'StopApp'].includes(currentAction)"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">应用包名</label><input :value="getValue('package', '')" @input="setValue('package', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" placeholder="com.example.app" /></div></template>
              <template v-if="['LongPress', 'LongPressKey'].includes(currentAction)"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">持续时间 (ms)</label><input type="number" :value="getValue('duration', 1000)" @input="setValue('duration', parseInt($event.target.value) || 1000)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div></template>
              <template v-if="currentAction === 'Command'"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">执行程序</label><input :value="getValue('exec', '')" @input="setValue('exec', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">参数</label><input :value="getJsonValue('args')" @input="setJsonValue('args', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" placeholder='["arg1"]' /></div><label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('detach', false)" @change="setValue('detach', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">分离进程</span></label></template>
              <template v-if="currentAction === 'Custom'"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义动作名</label><input :value="getValue('custom_action', '')" @input="setValue('custom_action', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label><textarea :value="getJsonValue('custom_action_param')" @input="setJsonValue('custom_action_param', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono h-14 resize-none" placeholder="JSON"></textarea></div></template>
            </div>
          </div>

        </div>

        <!-- 修复点：JSON 面板也使用 v-show 互斥显示 -->
        <div v-show="activeTab === 'json'" class="absolute inset-0 z-10 w-full h-full p-3 flex flex-col bg-white overflow-hidden">
          <div class="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex flex-col relative">
            <textarea class="w-full h-full bg-transparent text-[10px] font-mono text-green-400 p-3 outline-none resize-none custom-scrollbar" :value="jsonStr" @input="handleJsonInput" spellcheck="false"></textarea>
            <div v-if="jsonError" class="absolute bottom-3 left-3 right-3 bg-red-500/90 text-white px-3 py-2 rounded-lg backdrop-blur-sm shadow-lg flex items-start gap-2 z-10">
              <AlertCircle :size="16" class="shrink-0 mt-0.5" /><div class="text-[10px] font-mono break-all leading-tight">{{ jsonError }}</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-400 text-center shrink-0">编辑后自动保存，格式错误将不会生效</div>
        </div>
      </div>
    </div>
  </transition>

  <Teleport to="body">
    <DeviceScreen
      :visible="showDeviceScreen"
      :title="deviceScreenConfig.title"
      :reference-rect="deviceScreenConfig.referenceRect"
      :reference-label="deviceScreenConfig.referenceLabel"
      :mode="deviceScreenConfig.mode"
      @confirm="handleDevicePick"
      @close="showDeviceScreen = false"
    />
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 4px; }
</style>