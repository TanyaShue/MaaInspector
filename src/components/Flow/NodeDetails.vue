<script setup>
import { ref, computed, watch, reactive } from 'vue'
import {
  X, Check, ChevronDown, ChevronRight,
  Settings, GitBranch, Clock, Zap, FileJson,
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2,
  MousePointer, ArrowRight, Keyboard, Type, Play, Square, Terminal, Wand2
} from 'lucide-vue-next'

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

// 默认值
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
const activeTab = ref('properties') // 'properties' | 'json'
const expandedSections = reactive({
  basic: true,
  flow: false,
  common: false,
  delay: false,
  recognition: true,
  action: false
})

const editingId = ref('')
const formData = ref({})
const jsonStr = ref('')

// 初始化 - 监听 visible 和 nodeData 变化
watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = props.nodeId
    formData.value = JSON.parse(JSON.stringify(props.nodeData?.data || {}))
    updateJsonFromForm()
  }
}, { immediate: true })

// 监听节点数据变化（外部更新时同步）
watch(() => props.nodeData?.data, (newData) => {
  if (props.visible && newData) {
    formData.value = JSON.parse(JSON.stringify(newData))
    updateJsonFromForm()
  }
}, { deep: true })

// ========== 计算属性 ==========
const businessData = computed(() => props.nodeData?.data || {})
const currentRecognition = computed(() => formData.value.recognition || DEFAULTS.recognition)
const currentAction = computed(() => formData.value.action || DEFAULTS.action)

const recognitionConfig = computed(() => 
  recognitionTypes.find(r => r.value === currentRecognition.value) || recognitionTypes[0]
)

const actionConfig = computed(() => 
  actionTypes.find(a => a.value === currentAction.value) || actionTypes[0]
)

// ========== 方法 ==========
const toggleSection = (key) => {
  expandedSections[key] = !expandedSections[key]
}

const updateJsonFromForm = () => {
  jsonStr.value = JSON.stringify(formData.value, null, 2)
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
  // 实时同步更新
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
  // 实时同步更新
  emitUpdateData()
}

// 实时更新数据到节点
const emitUpdateData = () => {
  emit('update-data', { ...formData.value })
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
      <!-- 头部 -->
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
            <component :is="recognitionConfig.icon" :size="16" :class="recognitionConfig.color" />
          </div>
          <div>
            <span class="font-bold text-slate-700 text-sm">节点属性</span>
            <div class="text-[10px] text-slate-400 font-mono">#{{ nodeId }}</div>
          </div>
        </div>
        <button 
          @click.stop="$emit('close')" 
          class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- 标签页 -->
      <div class="flex border-b border-slate-100 bg-slate-50/30">
        <button
          @click="activeTab = 'properties'"
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
          :class="activeTab === 'properties' 
            ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' 
            : 'text-slate-500 hover:text-slate-700'"
        >
          <Settings :size="12" />
          属性
        </button>
        <button
          @click="activeTab = 'json'; updateJsonFromForm()"
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
          :class="activeTab === 'json' 
            ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' 
            : 'text-slate-500 hover:text-slate-700'"
        >
          <FileJson :size="12" />
          JSON
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto custom-scrollbar">
        
        <!-- 属性编辑 -->
        <div v-show="activeTab === 'properties'" class="p-3 space-y-2.5">
          
          <!-- 基本属性 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button 
              @click="toggleSection('basic')"
              class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <Settings :size="12" class="text-slate-500" />
                <span class="font-semibold text-slate-700 text-xs">基本属性</span>
              </div>
              <component :is="expandedSections.basic ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            
            <div v-show="expandedSections.basic" class="p-3 space-y-3 border-t border-slate-100">
              <!-- 节点ID -->
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">节点 ID</label>
                <div class="flex gap-1.5">
                  <input 
                    v-model="editingId"
                    class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all font-mono"
                  />
                  <button
                    v-if="editingId !== nodeId"
                    @click="confirmIdChange"
                    class="px-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-0.5"
                  >
                    <Check :size="10" /> 应用
                  </button>
                </div>
              </div>

              <!-- 识别算法 -->
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">识别算法</label>
                <div class="relative">
                  <select 
                    :value="currentRecognition"
                    @change="handleTypeChange($event.target.value)"
                    class="w-full appearance-none px-2.5 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all cursor-pointer"
                  >
                    <option v-for="type in recognitionTypes" :key="type.value" :value="type.value">
                      {{ type.label }} ({{ type.value }})
                    </option>
                  </select>
                  <ChevronDown :size="12" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <!-- 执行动作 -->
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">执行动作</label>
                <div class="relative">
                  <select 
                    :value="currentAction"
                    @change="setValue('action', $event.target.value)"
                    class="w-full appearance-none px-2.5 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all cursor-pointer"
                  >
                    <option v-for="type in actionTypes" :key="type.value" :value="type.value">
                      {{ type.label }} ({{ type.value }})
                    </option>
                  </select>
                  <ChevronDown :size="12" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <!-- 流程控制 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button 
              @click="toggleSection('flow')"
              class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <GitBranch :size="12" class="text-blue-500" />
                <span class="font-semibold text-slate-700 text-xs">流程控制</span>
              </div>
              <component :is="expandedSections.flow ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            
            <div v-show="expandedSections.flow" class="p-3 space-y-2.5 border-t border-slate-100">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  后继节点 (Next)
                </label>
                <input 
                  :value="getArrayValue('next')"
                  @input="setArrayValue('next', $event.target.value)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                  placeholder="用逗号分隔"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  中断节点 (Interrupt)
                </label>
                <input 
                  :value="getArrayValue('interrupt')"
                  @input="setArrayValue('interrupt', $event.target.value)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 transition-all"
                  placeholder="用逗号分隔"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-rose-600 uppercase tracking-wide flex items-center gap-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  错误节点 (OnError)
                </label>
                <input 
                  :value="getArrayValue('on_error')"
                  @input="setArrayValue('on_error', $event.target.value)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100 transition-all"
                  placeholder="用逗号分隔"
                />
              </div>
            </div>
          </div>

          <!-- 通用属性 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button 
              @click="toggleSection('common')"
              class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <Zap :size="12" class="text-emerald-500" />
                <span class="font-semibold text-slate-700 text-xs">通用属性</span>
              </div>
              <component :is="expandedSections.common ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            
            <div v-show="expandedSections.common" class="p-3 space-y-2.5 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">识别速率 (ms)</label>
                  <input 
                    type="number"
                    :value="getValue('rate_limit', 1000)"
                    @input="setValue('rate_limit', parseInt($event.target.value) || 1000)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">超时 (ms)</label>
                  <input 
                    type="number"
                    :value="getValue('timeout', 20000)"
                    @input="setValue('timeout', parseInt($event.target.value) || 20000)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
              </div>
              
              <div class="flex flex-wrap gap-3 pt-1">
                <label class="inline-flex items-center gap-1.5 cursor-pointer group">
                  <input type="checkbox" :checked="getValue('is_sub', false)" @change="setValue('is_sub', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-[11px] text-slate-600">子节点</span>
                </label>
                <label class="inline-flex items-center gap-1.5 cursor-pointer group">
                  <input type="checkbox" :checked="getValue('inverse', false)" @change="setValue('inverse', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-[11px] text-slate-600">反转结果</span>
                </label>
                <label class="inline-flex items-center gap-1.5 cursor-pointer group">
                  <input type="checkbox" :checked="getValue('enabled', true)" @change="setValue('enabled', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-[11px] text-slate-600">启用</span>
                </label>
                <label class="inline-flex items-center gap-1.5 cursor-pointer group">
                  <input type="checkbox" :checked="getValue('focus', false)" @change="setValue('focus', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-[11px] text-slate-600">关注</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 延迟设置 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button 
              @click="toggleSection('delay')"
              class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <Clock :size="12" class="text-violet-500" />
                <span class="font-semibold text-slate-700 text-xs">延迟设置</span>
              </div>
              <component :is="expandedSections.delay ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            
            <div v-show="expandedSections.delay" class="p-3 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">前延迟 (ms)</label>
                  <input type="number" :value="getValue('pre_delay', 200)" @input="setValue('pre_delay', parseInt($event.target.value) || 200)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">后延迟 (ms)</label>
                  <input type="number" :value="getValue('post_delay', 200)" @input="setValue('post_delay', parseInt($event.target.value) || 200)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">前等待冻结</label>
                  <input type="number" :value="getValue('pre_wait_freezes', 0)" @input="setValue('pre_wait_freezes', parseInt($event.target.value) || 0)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">后等待冻结</label>
                  <input type="number" :value="getValue('post_wait_freezes', 0)" @input="setValue('post_wait_freezes', parseInt($event.target.value) || 0)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
              </div>
            </div>
          </div>

          <!-- 识别算法特有属性 -->
          <div v-if="currentRecognition !== 'DirectHit'" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button 
              @click="toggleSection('recognition')"
              class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 hover:from-indigo-100 hover:to-violet-100 transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <component :is="recognitionConfig.icon" :size="12" :class="recognitionConfig.color" />
                <span class="font-semibold text-slate-700 text-xs">{{ recognitionConfig.label }} 属性</span>
              </div>
              <component :is="expandedSections.recognition ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            
            <div v-show="expandedSections.recognition" class="p-3 space-y-2.5 border-t border-slate-100">
              <!-- ROI -->
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">识别区域 (ROI)</label>
                  <input :value="getValue('roi', '')" @input="setValue('roi', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="[x,y,w,h]" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">区域偏移</label>
                  <input :value="getValue('roi_offset', '')" @input="setValue('roi_offset', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="[x,y,w,h]" />
                </div>
              </div>

              <!-- TemplateMatch -->
              <template v-if="currentRecognition === 'TemplateMatch'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label>
                  <input :value="getValue('template', '')" @input="setValue('template', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="image/ 下的路径" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
                    <input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.7)" @input="setValue('threshold', parseFloat($event.target.value) || 0.7)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配算法</label>
                    <input type="number" min="1" max="5" :value="getValue('method', 5)" @input="setValue('method', parseInt($event.target.value) || 5)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :checked="getValue('green_mask', false)" @change="setValue('green_mask', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <span class="text-[11px] text-slate-600">绿色掩码</span>
                </label>
              </template>

              <!-- FeatureMatch -->
              <template v-if="currentRecognition === 'FeatureMatch'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label>
                  <input :value="getValue('template', '')" @input="setValue('template', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="image/ 下的路径" />
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
                    <input type="number" min="1" :value="getValue('count', 4)" @input="setValue('count', parseInt($event.target.value) || 4)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label>
                    <select :value="getValue('detector', 'SIFT')" @change="setValue('detector', $event.target.value)"
                      class="w-full appearance-none px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all">
                      <option>SIFT</option><option>KAZE</option><option>AKAZE</option><option>BRISK</option><option>ORB</option>
                    </select>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">距离比</label>
                    <input type="number" step="0.1" min="0" max="1" :value="getValue('ratio', 0.6)" @input="setValue('ratio', parseFloat($event.target.value) || 0.6)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :checked="getValue('green_mask', false)" @change="setValue('green_mask', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <span class="text-[11px] text-slate-600">绿色掩码</span>
                </label>
              </template>

              <!-- ColorMatch -->
              <template v-if="currentRecognition === 'ColorMatch'">
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label>
                    <input :value="getValue('lower', '')" @input="setValue('lower', $event.target.value)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                      placeholder="[R,G,B]" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label>
                    <input :value="getValue('upper', '')" @input="setValue('upper', $event.target.value)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                      placeholder="[R,G,B]" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label>
                    <input type="number" :value="getValue('method', 4)" @input="setValue('method', parseInt($event.target.value) || 4)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
                    <input type="number" min="1" :value="getValue('count', 1)" @input="setValue('count', parseInt($event.target.value) || 1)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :checked="getValue('connected', false)" @change="setValue('connected', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <span class="text-[11px] text-slate-600">要求像素相连</span>
                </label>
              </template>

              <!-- OCR -->
              <template v-if="currentRecognition === 'OCR'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label>
                  <input :value="getValue('expected', '')" @input="setValue('expected', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all"
                    placeholder="期望文本或正则" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
                    <input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.3)" @input="setValue('threshold', parseFloat($event.target.value) || 0.3)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
                    <input :value="getValue('model', '')" @input="setValue('model', $event.target.value)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                      placeholder="model/ocr/" />
                  </div>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label>
                  <input :value="getValue('replace', '')" @input="setValue('replace', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder='["原","替"]' />
                </div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :checked="getValue('only_rec', false)" @change="setValue('only_rec', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <span class="text-[11px] text-slate-600">仅识别</span>
                </label>
              </template>

              <!-- NeuralNetwork -->
              <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentRecognition)">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
                  <input :value="getValue('model', '')" @input="setValue('model', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    :placeholder="currentRecognition === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签</label>
                    <input :value="getValue('expected', '')" @input="setValue('expected', $event.target.value)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                      placeholder="0 或 [0,1,2]" />
                  </div>
                  <div v-if="currentRecognition === 'NeuralNetworkDetect'" class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
                    <input type="number" step="0.1" min="0" max="1" :value="getValue('threshold', 0.3)" @input="setValue('threshold', parseFloat($event.target.value) || 0.3)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表</label>
                  <input :value="getValue('labels', '')" @input="setValue('labels', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder='["猫","狗"]' />
                </div>
              </template>

              <!-- Custom Recognition -->
              <template v-if="currentRecognition === 'Custom'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label>
                  <input :value="getValue('custom_recognition', '')" @input="setValue('custom_recognition', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
                  <textarea :value="getValue('custom_recognition_param', '')" @input="setValue('custom_recognition_param', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono h-14 resize-none"
                    placeholder="JSON"></textarea>
                </div>
              </template>
            </div>
          </div>

          <!-- 动作特有属性 -->
          <div v-if="!['DoNothing', 'StopTask'].includes(currentAction)" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button 
              @click="toggleSection('action')"
              class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 hover:from-emerald-100 hover:to-teal-100 transition-colors"
            >
              <div class="flex items-center gap-1.5">
                <component :is="actionConfig.icon" :size="12" :class="actionConfig.color" />
                <span class="font-semibold text-slate-700 text-xs">{{ actionConfig.label }} 属性</span>
              </div>
              <component :is="expandedSections.action ? ChevronDown : ChevronRight" :size="14" class="text-slate-400" />
            </button>
            
            <div v-show="expandedSections.action" class="p-3 space-y-2.5 border-t border-slate-100">
              <!-- Click -->
              <template v-if="currentAction === 'Click'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">点击目标</label>
                  <input :value="getValue('target', '')" @input="setValue('target', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="节点名或 [x,y,w,h]" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">目标偏移</label>
                  <input :value="getValue('target_offset', '')" @input="setValue('target_offset', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="[x,y,w,h]" />
                </div>
              </template>

              <!-- Swipe -->
              <template v-if="currentAction === 'Swipe'">
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">起点</label>
                    <input :value="getValue('begin', '')" @input="setValue('begin', $event.target.value)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                      placeholder="[x,y,w,h]" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">终点</label>
                    <input :value="getValue('end', '')" @input="setValue('end', $event.target.value)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                      placeholder="[x,y,w,h]" />
                  </div>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">持续时间 (ms)</label>
                  <input type="number" min="50" :value="getValue('duration', 200)" @input="setValue('duration', parseInt($event.target.value) || 200)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
              </template>

              <!-- Key -->
              <template v-if="currentAction === 'Key'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">按键码</label>
                  <input :value="getValue('key', '')" @input="setValue('key', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="25 或 [25,26]" />
                </div>
              </template>

              <!-- InputText -->
              <template v-if="currentAction === 'InputText'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">输入文本</label>
                  <input :value="getValue('input_text', '')" @input="setValue('input_text', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
              </template>

              <!-- StartApp / StopApp -->
              <template v-if="['StartApp', 'StopApp'].includes(currentAction)">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">应用包名</label>
                  <input :value="getValue('package', '')" @input="setValue('package', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder="com.example.app" />
                </div>
              </template>

              <!-- Command -->
              <template v-if="currentAction === 'Command'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">执行程序</label>
                  <input :value="getValue('exec', '')" @input="setValue('exec', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">参数</label>
                  <input :value="getValue('args', '')" @input="setValue('args', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono"
                    placeholder='["arg1"]' />
                </div>
                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :checked="getValue('detach', false)" @change="setValue('detach', $event.target.checked)"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
                  <span class="text-[11px] text-slate-600">分离进程</span>
                </label>
              </template>

              <!-- Custom Action -->
              <template v-if="currentAction === 'Custom'">
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义动作名</label>
                  <input :value="getValue('custom_action', '')" @input="setValue('custom_action', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
                  <textarea :value="getValue('custom_action_param', '')" @input="setValue('custom_action_param', $event.target.value)"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 transition-all font-mono h-14 resize-none"
                    placeholder="JSON"></textarea>
                </div>
              </template>
            </div>
          </div>

        </div>

        <!-- JSON 视图 -->
        <div v-show="activeTab === 'json'" class="p-3">
          <div class="bg-slate-900 rounded-xl p-3 overflow-hidden">
            <pre class="font-mono text-[10px] text-green-400 whitespace-pre-wrap break-all leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">{{ jsonStr }}</pre>
          </div>
        </div>
      </div>

    </div>
  </transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #475569;
  border-radius: 4px;
}
</style>
