<script setup>
import { ref, computed, watch, reactive, nextTick } from 'vue'
import {
  X, Check, ChevronDown, ChevronRight,
  Settings, GitBranch, Clock, Zap, FileJson,
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2,
  MousePointer, ArrowRight, Keyboard, Type, Play, Square, Terminal, Wand2,
  AlertCircle, Crop, Crosshair
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

// ========== 配置定义 ==========
const recognitionTypes = [
  { value: 'DirectHit', label: '通用匹配', icon: Target, color: 'text-blue-500' },
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
  { value: 'Swipe', label: '滑动', icon: ArrowRight, color: 'text-indigo-500' },
  { value: 'Key', label: '按键', icon: Keyboard, color: 'text-violet-500' },
  { value: 'InputText', label: '输入文本', icon: Type, color: 'text-emerald-500' },
  { value: 'StartApp', label: '启动应用', icon: Play, color: 'text-green-500' },
  { value: 'StopApp', label: '停止应用', icon: Square, color: 'text-red-500' },
  { value: 'StopTask', label: '停止任务', icon: Square, color: 'text-rose-500' },
  { value: 'Command', label: '执行命令', icon: Terminal, color: 'text-amber-500' },
  { value: 'Custom', label: '自定义', icon: Wand2, color: 'text-slate-500' }
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
  focus: false,
  threshold: 0.7,
  method: 5,
  green_mask: false,
  count: 4,
  detector: 'SIFT',
  ratio: 0.6,
  connected: false,
  only_rec: false,
  duration: 200,
  detach: false
}

// ========== 状态管理 ==========
const activeTab = ref('properties')
const expandedSections = reactive({
  basic: true, flow: false, common: false, recognition: true, action: false
})
const editingId = ref('')
const formData = ref({})
const jsonStr = ref('')
const jsonError = ref('')
const recSectionRef = ref(null)
const actSectionRef = ref(null)

// 设备截屏相关状态
const showDeviceScreen = ref(false)
const deviceScreenConfig = reactive({
  targetField: '',
  referenceField: '',
  referenceRect: null,
  referenceLabel: '', // 新增：用于显示参考框的名称
  title: '区域选择',
  mode: 'coordinate' // 'coordinate' | 'ocr'
})

// ========== 计算属性 ==========
const currentRecognition = computed(() => formData.value.recognition || DEFAULTS.recognition)
const currentAction = computed(() => formData.value.action || DEFAULTS.action)
const recognitionConfig = computed(() => recognitionTypes.find(r => r.value === currentRecognition.value) || recognitionTypes[0])
const actionConfig = computed(() => actionTypes.find(a => a.value === currentAction.value) || actionTypes[0])

// ========== 方法定义 ==========

// 1. 数据同步
const updateJsonFromForm = () => {
  try {
    jsonStr.value = JSON.stringify(formData.value, null, 2)
    jsonError.value = ''
  } catch (e) { /* ignore */ }
}

const emitUpdateData = () => {
  if (activeTab.value !== 'json') updateJsonFromForm()
  emit('update-data', { ...formData.value })
}

const getValue = (key, defaultVal) => {
  return formData.value[key] !== undefined ? formData.value[key] : (defaultVal ?? DEFAULTS[key])
}

const setValue = (key, value) => {
  if (value === DEFAULTS[key] || value === '' || value === null) {
    delete formData.value[key]
  } else {
    formData.value[key] = value
  }
  emitUpdateData()
}

const getArrayValue = (key) => {
  const val = formData.value[key]
  if (Array.isArray(val)) return val.join(', ')
  return val || ''
}

const setArrayValue = (key, value) => {
  if (!value || value.trim() === '') {
    delete formData.value[key]
  } else {
    formData.value[key] = value.split(',').map(s => s.trim()).filter(Boolean)
  }
  emitUpdateData()
}

// 2. 界面交互
const toggleSection = (key) => { expandedSections[key] = !expandedSections[key] }

const handleJsonInput = (event) => {
  const newVal = event.target.value
  jsonStr.value = newVal
  try {
    const parsed = JSON.parse(newVal)
    jsonError.value = ''
    formData.value = parsed
    emitUpdateData() // 实时生效
  } catch (e) {
    jsonError.value = e.message
  }
}

const confirmIdChange = () => {
  if (editingId.value && editingId.value !== props.nodeId) {
    emit('update-id', { oldId: props.nodeId, newId: editingId.value })
  }
}

const handleTypeChange = (newType) => {
  setValue('recognition', newType)
  emit('update-type', newType)
}

const jumpToSettings = (type) => {
  expandedSections[type] = true
  nextTick(() => {
    const target = type === 'recognition' ? recSectionRef.value : actSectionRef.value
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// 3. 特殊字段处理
const getExpectedDisplayValue = () => {
  const val = getValue('expected', '')
  if (typeof val === 'object') return JSON.stringify(val)
  return val
}

const setExpectedValue = (rawVal) => {
  let val = rawVal
  const recType = currentRecognition.value
  if (['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(recType)) {
    if (val === '') { setValue('expected', ''); return }
    try {
      const parsed = JSON.parse(val)
      if (typeof parsed === 'number' || Array.isArray(parsed)) { setValue('expected', parsed); return }
    } catch (e) {}
    if (typeof val === 'string' && val.includes(',')) {
      const arr = val.split(',').map(s => s.trim()).filter(s => s !== '')
      if (arr.every(s => !isNaN(Number(s))) && arr.length > 0) { setValue('expected', arr.map(Number)); return }
    }
    if (!isNaN(Number(val)) && val.trim() !== '') { setValue('expected', Number(val)); return }
  }
  setValue('expected', val)
}

// 4. 设备截屏集成
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
  deviceScreenConfig.referenceLabel = refLabel || referenceField || '参考区域' // 设置参考框标签

  // 处理标题
  if (mode === 'ocr') {
    deviceScreenConfig.title = 'OCR 区域识别'
  } else if (field.includes('offset')) {
    deviceScreenConfig.title = `设置偏移 (${field})`
  } else {
    deviceScreenConfig.title = `选取区域 (${field})`
  }

  // 处理参考框
  if (referenceField) {
    const refVal = getValue(referenceField)
    deviceScreenConfig.referenceRect = parseRect(refVal)
  }

  showDeviceScreen.value = true
}

const handleDevicePick = (result) => {
  const field = deviceScreenConfig.targetField
  const refRect = deviceScreenConfig.referenceRect
  const mode = deviceScreenConfig.mode

  if (mode === 'ocr') {
    // OCR 模式下，result 应该是字符串（识别结果）
    setValue(field, result)
  } else {
    // 坐标模式下，result 是数组 [x,y,w,h]
    if (field.includes('offset') && refRect) {
      const offsetX = result[0] - refRect[0]
      const offsetY = result[1] - refRect[1]
      const offsetW = result[2] - refRect[2]
      const offsetH = result[3] - refRect[3]
      setValue(field, [offsetX, offsetY, offsetW, offsetH])
    } else {
      setValue(field, result)
    }
  }
}

// ========== 监听器 ==========
watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = props.nodeId
    formData.value = JSON.parse(JSON.stringify(props.nodeData?.data || {}))
    updateJsonFromForm()
    jsonError.value = ''
  }
}, { immediate: true })

watch(() => props.nodeData?.data, (newData) => {
  if (props.visible && newData) {
    if (activeTab.value !== 'json' || !jsonError.value) {
      formData.value = JSON.parse(JSON.stringify(newData))
      updateJsonFromForm()
    }
  }
}, { deep: true })
</script>

<template>
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
      class="absolute left-[105%] top-0 w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 nodrag cursor-default flex flex-col overflow-hidden max-h-[600px]"
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
        <button @click.stop="$emit('close')" class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X :size="16" /></button>
      </div>

      <div class="flex border-b border-slate-100 bg-slate-50/30 shrink-0">
        <button @click="activeTab = 'properties'" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all" :class="activeTab === 'properties' ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' : 'text-slate-500 hover:text-slate-700'"><Settings :size="12" /> 属性</button>
        <button @click="activeTab = 'json'; updateJsonFromForm()" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all" :class="activeTab === 'json' ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' : 'text-slate-500 hover:text-slate-700'"><FileJson :size="12" /> JSON</button>
      </div>

      <div class="flex-1 min-h-0 grid grid-cols-1 grid-rows-1 relative">
        <div class="col-start-1 row-start-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5" :class="{ 'invisible': activeTab === 'json' }">

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button @click="toggleSection('basic')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors">
              <div class="flex items-center gap-1.5"><Settings :size="12" class="text-slate-500" /><span class="font-semibold text-slate-700 text-xs">基本属性</span></div>
              <component :is="expandedSections.basic ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            <div v-show="expandedSections.basic" class="p-3 space-y-3 border-t border-slate-100">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">节点 ID</label>
                <div class="flex gap-1.5"><input v-model="editingId" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all font-mono" /><button v-if="editingId !== nodeId" @click="confirmIdChange" class="px-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-0.5"><Check :size="10" /> 应用</button></div>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">识别算法</label>
                <div class="flex gap-2"><div class="relative flex-1"><select :value="currentRecognition" @change="handleTypeChange($event.target.value)" class="w-full appearance-none px-2.5 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all cursor-pointer"><option v-for="type in recognitionTypes" :key="type.value" :value="type.value">{{ type.label }} ({{ type.value }})</option></select><ChevronDown :size="12" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div><button @click="jumpToSettings('recognition')" :disabled="currentRecognition === 'DirectHit'" class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"><Settings :size="14" /></button></div>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">执行动作</label>
                <div class="flex gap-2"><div class="relative flex-1"><select :value="currentAction" @change="setValue('action', $event.target.value)" class="w-full appearance-none px-2.5 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all cursor-pointer"><option v-for="type in actionTypes" :key="type.value" :value="type.value">{{ type.label }} ({{ type.value }})</option></select><ChevronDown :size="12" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div><button @click="jumpToSettings('action')" :disabled="['DoNothing', 'StopTask'].includes(currentAction)" class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"><Settings :size="14" /></button></div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button @click="toggleSection('flow')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"><div class="flex items-center gap-1.5"><GitBranch :size="12" class="text-blue-500" /><span class="font-semibold text-slate-700 text-xs">流程控制</span></div><component :is="expandedSections.flow ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" /></button>
            <div v-show="expandedSections.flow" class="p-3 space-y-2.5 border-t border-slate-100">
               <div class="space-y-1"><label class="text-[10px] font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> 后继节点 (Next)</label><input :value="getArrayValue('next')" @input="setArrayValue('next', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all" placeholder="用逗号分隔" /></div>
               <div class="space-y-1"><label class="text-[10px] font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 中断节点 (Interrupt)</label><input :value="getArrayValue('interrupt')" @input="setArrayValue('interrupt', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-all" placeholder="用逗号分隔" /></div>
               <div class="space-y-1"><label class="text-[10px] font-semibold text-rose-600 uppercase tracking-wide flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div> 错误节点 (OnError)</label><input :value="getArrayValue('on_error')" @input="setArrayValue('on_error', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100 transition-all" placeholder="用逗号分隔" /></div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button @click="toggleSection('common')" class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"><div class="flex items-center gap-1.5"><Zap :size="12" class="text-emerald-500" /><span class="font-semibold text-slate-700 text-xs">通用属性</span></div><component :is="expandedSections.common ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" /></button>
            <div v-show="expandedSections.common" class="p-3 space-y-2.5 border-t border-slate-100">
               <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">速率 (ms)</label><input type="number" :value="getValue('rate_limit', 1000)" @input="setValue('rate_limit', parseInt($event.target.value) || 1000)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">超时 (ms)</label><input type="number" :value="getValue('timeout', 20000)" @input="setValue('timeout', parseInt($event.target.value) || 20000)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
               <div class="flex flex-wrap gap-3 pt-1"><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('is_sub', false)" @change="setValue('is_sub', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">子节点</span></label><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('inverse', false)" @change="setValue('inverse', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">反转结果</span></label><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('enabled', true)" @change="setValue('enabled', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">启用</span></label><label class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox" :checked="getValue('focus', false)" @change="setValue('focus', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">关注</span></label></div>
               <div class="h-px bg-slate-100 my-1 w-full"></div>
               <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Clock :size="10" class="text-violet-500"/> 前延迟 (ms)</label><input type="number" :value="getValue('pre_delay', 200)" @input="setValue('pre_delay', parseInt($event.target.value) || 200)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1"><Clock :size="10" class="text-violet-500"/> 后延迟 (ms)</label><input type="number" :value="getValue('post_delay', 200)" @input="setValue('post_delay', parseInt($event.target.value) || 200)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">前等待冻结</label><input type="number" :value="getValue('pre_wait_freezes', 0)" @input="setValue('pre_wait_freezes', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">后等待冻结</label><input type="number" :value="getValue('post_wait_freezes', 0)" @input="setValue('post_wait_freezes', parseInt($event.target.value) || 0)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
            </div>
          </div>

          <div v-if="currentRecognition !== 'DirectHit'" ref="recSectionRef" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button @click="toggleSection('recognition')" class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 hover:from-indigo-100 hover:to-violet-100 transition-colors">
              <div class="flex items-center gap-1.5"><component :is="recognitionConfig.icon" :size="12" :class="recognitionConfig.color" /><span class="font-semibold text-slate-700 text-xs">{{ recognitionConfig.label }} 属性</span></div>
              <component :is="expandedSections.recognition ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            <div v-show="expandedSections.recognition" class="p-3 space-y-2.5 border-t border-slate-100">

              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">识别区域 (ROI)</label>
                  <div class="flex gap-1">
                    <input :value="getValue('roi', '')" @input="setValue('roi', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="[x,y,w,h]" />
                    <button @click="openDevicePicker('roi', null, 'coordinate', 'ROI')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center" title="框选区域"><Crop :size="12" /></button>
                  </div>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">区域偏移</label>
                  <div class="flex gap-1">
                    <input :value="getValue('roi_offset', '')" @input="setValue('roi_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="[x,y,w,h]" />
                    <button @click="openDevicePicker('roi_offset', 'roi', 'coordinate', 'ROI区域')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center" title="设置偏移"><Crosshair :size="12" /></button>
                  </div>
                </div>
              </div>

              <template v-if="currentRecognition === 'TemplateMatch'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label><input :value="getValue('template', '')" @input="setValue('template', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="image/..." /></div>
                <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.7)" @input="setValue('threshold', parseFloat($event.target.value) || 0.7)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配算法</label><input type="number" min="1" max="5" :value="getValue('method', 5)" @input="setValue('method', parseInt($event.target.value) || 5)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('green_mask', false)" @change="setValue('green_mask', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">绿色掩码</span></label>
              </template>

              <template v-if="currentRecognition === 'FeatureMatch'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label><input :value="getValue('template', '')" @input="setValue('template', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="image/..." /></div>
                <div class="grid grid-cols-3 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label><input type="number" min="1" :value="getValue('count', 4)" @input="setValue('count', parseInt($event.target.value) || 4)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label><select :value="getValue('detector', 'SIFT')" @change="setValue('detector', $event.target.value)" class="w-full appearance-none px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"><option>SIFT</option><option>KAZE</option><option>AKAZE</option><option>BRISK</option><option>ORB</option></select></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">距离比</label><input type="number" step="0.1" min="0" max="1" :value="getValue('ratio', 0.6)" @input="setValue('ratio', parseFloat($event.target.value) || 0.6)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('green_mask', false)" @change="setValue('green_mask', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">绿色掩码</span></label>
              </template>

              <template v-if="currentRecognition === 'ColorMatch'">
                <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label><input :value="getValue('lower', '')" @input="setValue('lower', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="[R,G,B]" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label><input :value="getValue('upper', '')" @input="setValue('upper', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="[R,G,B]" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label><input type="number" :value="getValue('method', 4)" @input="setValue('method', parseInt($event.target.value) || 4)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label><input type="number" min="1" :value="getValue('count', 1)" @input="setValue('count', parseInt($event.target.value) || 1)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('connected', false)" @change="setValue('connected', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">要求像素相连</span></label>
              </template>

              <template v-if="currentRecognition === 'OCR'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label>
                  <div class="flex gap-1">
                    <input :value="getValue('expected', '')" @input="setValue('expected', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" placeholder="期望文本或正则" />
                    <button @click="openDevicePicker('expected', 'roi', 'ocr', 'ROI区域')" class="px-2 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 rounded-lg flex items-center justify-center" title="OCR 识别取词"><ScanText :size="12" /></button>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.3)" @input="setValue('threshold', parseFloat($event.target.value) || 0.3)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label><input :value="getValue('model', '')" @input="setValue('model', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="model/ocr/" /></div></div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label><input :value="getValue('replace', '')" @input="setValue('replace', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder='["原","替"]' /></div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('only_rec', false)" @change="setValue('only_rec', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">仅识别</span></label>
              </template>

              <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentRecognition)">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label><input :value="getValue('model', '')" @input="setValue('model', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" :placeholder="currentRecognition === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'" /></div>
                <div class="grid grid-cols-2 gap-2"><div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签</label><input :value="getExpectedDisplayValue()" @input="setExpectedValue($event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder="0 或 [0,1,2]" /></div><div v-if="currentRecognition === 'NeuralNetworkDetect'" class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.3)" @input="setValue('threshold', parseFloat($event.target.value) || 0.3)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div></div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表</label><input :value="getValue('labels', '')" @input="setValue('labels', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono" placeholder='["猫","狗"]' /></div>
              </template>

              <template v-if="currentRecognition === 'Custom'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label><input :value="getValue('custom_recognition', '')" @input="setValue('custom_recognition', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400" /></div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label><textarea :value="getValue('custom_recognition_param', '')" @input="setValue('custom_recognition_param', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono h-14 resize-none" placeholder="JSON"></textarea></div>
              </template>
            </div>
          </div>

          <div v-if="!['DoNothing', 'StopTask'].includes(currentAction)" ref="actSectionRef" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button @click="toggleSection('action')" class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 hover:from-emerald-100 hover:to-teal-100 transition-colors">
              <div class="flex items-center gap-1.5"><component :is="actionConfig.icon" :size="12" :class="actionConfig.color" /><span class="font-semibold text-slate-700 text-xs">{{ actionConfig.label }} 属性</span></div>
              <component :is="expandedSections.action ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            <div v-show="expandedSections.action" class="p-3 space-y-2.5 border-t border-slate-100">

              <template v-if="currentAction === 'Click'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">点击目标</label>
                  <div class="flex gap-1">
                    <input :value="getValue('target', '')" @input="setValue('target', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="节点名或 [x,y,w,h]" />
                    <button @click="openDevicePicker('target', null, 'coordinate', 'Target')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"><Crop :size="12" /></button>
                  </div>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">目标偏移</label>
                  <div class="flex gap-1">
                    <input :value="getValue('target_offset', '')" @input="setValue('target_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0" placeholder="[x,y,w,h]" />
                    <button @click="openDevicePicker('target_offset', 'target', 'coordinate', '目标区域')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"><Crosshair :size="12" /></button>
                  </div>
                </div>
              </template>

              <template v-if="currentAction === 'Swipe'">
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">起点</label>
                    <div class="flex gap-1"><input :value="getValue('begin', '')" @input="setValue('begin', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('begin', null, 'coordinate', '起点')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg"><Crop :size="12" /></button></div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">起点偏移</label>
                    <div class="flex gap-1"><input :value="getValue('begin_offset', '')" @input="setValue('begin_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('begin_offset', 'begin', 'coordinate', '起点')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"><Crosshair :size="12" /></button></div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">终点</label>
                    <div class="flex gap-1"><input :value="getValue('end', '')" @input="setValue('end', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('end', 'begin', 'coordinate', '起点')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg"><Crop :size="12" /></button></div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">终点偏移</label>
                    <div class="flex gap-1"><input :value="getValue('end_offset', '')" @input="setValue('end_offset', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" placeholder="[x,y,w,h]" /><button @click="openDevicePicker('end_offset', 'end', 'coordinate', '终点')" class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"><Crosshair :size="12" /></button></div>
                  </div>
                </div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">持续时间 (ms)</label><input type="number" :value="getValue('duration', 200)" @input="setValue('duration', parseInt($event.target.value) || 200)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div>
              </template>

              <template v-if="currentAction === 'Key'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">按键码</label><input :value="getValue('key', '')" @input="setValue('key', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" placeholder="25 或 [25,26]" /></div>
              </template>

              <template v-if="currentAction === 'InputText'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">输入文本</label><input :value="getValue('input_text', '')" @input="setValue('input_text', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div>
              </template>

              <template v-if="['StartApp', 'StopApp'].includes(currentAction)">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">应用包名</label><input :value="getValue('package', '')" @input="setValue('package', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" placeholder="com.example.app" /></div>
              </template>

              <template v-if="currentAction === 'Command'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">执行程序</label><input :value="getValue('exec', '')" @input="setValue('exec', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" /></div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">参数</label><input :value="getValue('args', '')" @input="setValue('args', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono" placeholder='["arg1"]' /></div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" :checked="getValue('detach', false)" @change="setValue('detach', $event.target.checked)" class="w-3.5 h-3.5 rounded text-indigo-600" /><span class="text-[11px] text-slate-600">分离进程</span></label>
              </template>

              <template v-if="currentAction === 'Custom'">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义动作名</label><input :value="getValue('custom_action', '')" @input="setValue('custom_action', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" /></div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label><textarea :value="getValue('custom_action_param', '')" @input="setValue('custom_action_param', $event.target.value)" class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono h-14 resize-none" placeholder="JSON"></textarea></div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">点击目标</label>
                  <div class="flex gap-1">
                    <input :value="getValue('target', '')" @input="setValue('target', $event.target.value)" class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0" placeholder="节点名或 [x,y,w,h]" />
                    <button @click="openDevicePicker('target', null, 'coordinate', 'Target')" class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"><Crop :size="12" /></button>
                  </div>
                </div>
              </template>
            </div>
          </div>

        </div>

        <div v-if="activeTab === 'json'" class="col-start-1 row-start-1 z-10 w-full h-full p-3 flex flex-col bg-white overflow-hidden">
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