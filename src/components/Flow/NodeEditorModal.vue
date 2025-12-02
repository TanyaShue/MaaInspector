<script setup>
import {ref, computed, watch, reactive} from 'vue'
import {
  X, Save, AlertCircle, ChevronDown, ChevronRight,
  Settings, GitBranch, Clock, Zap, FileJson, Eye,
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2,
  MousePointer, ArrowRight, Keyboard, Type, Play, Square, Terminal, Wand2
} from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean,
  nodeId: String,
  nodeData: Object
})

const emit = defineEmits(['close', 'save'])

// ========== 配置定义 ==========
const recognitionTypes = [
  {value: 'DirectHit', label: '通用匹配', icon: Target, color: 'text-blue-500'},
  {value: 'TemplateMatch', label: '模板匹配', icon: Image, color: 'text-indigo-500'},
  {value: 'FeatureMatch', label: '特征匹配', icon: Sparkles, color: 'text-violet-500'},
  {value: 'ColorMatch', label: '颜色识别', icon: Palette, color: 'text-pink-500'},
  {value: 'OCR', label: 'OCR识别', icon: ScanText, color: 'text-emerald-500'},
  {value: 'NeuralNetworkClassify', label: '模型分类', icon: Brain, color: 'text-amber-500'},
  {value: 'NeuralNetworkDetect', label: '模型检测', icon: ScanEye, color: 'text-orange-500'},
  {value: 'Custom', label: '自定义', icon: Code2, color: 'text-slate-500'}
]

const actionTypes = [
  {value: 'DoNothing', label: '无动作', icon: Square, color: 'text-slate-400'},
  {value: 'Click', label: '点击', icon: MousePointer, color: 'text-blue-500'},
  {value: 'Swipe', label: '滑动', icon: ArrowRight, color: 'text-indigo-500'},
  {value: 'Key', label: '按键', icon: Keyboard, color: 'text-violet-500'},
  {value: 'InputText', label: '输入文本', icon: Type, color: 'text-emerald-500'},
  {value: 'StartApp', label: '启动应用', icon: Play, color: 'text-green-500'},
  {value: 'StopApp', label: '停止应用', icon: Square, color: 'text-red-500'},
  {value: 'StopTask', label: '停止任务', icon: Square, color: 'text-rose-500'},
  {value: 'Command', label: '执行命令', icon: Terminal, color: 'text-amber-500'},
  {value: 'Custom', label: '自定义', icon: Wand2, color: 'text-slate-500'}
]

// 默认值定义
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
  // TemplateMatch
  threshold: 0.7,
  method: 5,
  green_mask: false,
  // FeatureMatch
  count: 4,
  detector: 'SIFT',
  ratio: 0.6,
  // ColorMatch
  connected: false,
  // OCR
  only_rec: false,
  // Swipe
  duration: 200,
  // Command
  detach: false
}

// ========== 状态管理 ==========
const activeTab = ref('properties') // 'properties' | 'json'
const expandedSections = reactive({
  basic: true,
  flow: true,
  common: false,
  delay: false,
  recognition: true,
  action: true
})

const formData = ref({})
const jsonStr = ref('')
const jsonError = ref('')

// 初始化表单数据
watch(() => props.nodeData, (val) => {
  if (val) {
    formData.value = JSON.parse(JSON.stringify(val))
    updateJsonFromForm()
  }
}, {immediate: true})

// ========== 计算属性 ==========
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
  try {
    jsonStr.value = JSON.stringify(formData.value, null, 2)
    jsonError.value = ''
  } catch (e) {
    jsonError.value = '数据序列化失败'
  }
}

const updateFormFromJson = () => {
  try {
    formData.value = JSON.parse(jsonStr.value)
    jsonError.value = ''
  } catch (e) {
    jsonError.value = 'JSON 格式错误: ' + e.message
  }
}

const handleTabChange = (tab) => {
  if (tab === 'json') {
    updateJsonFromForm()
  }
  activeTab.value = tab
}

const getValue = (key, defaultVal) => {
  return formData.value[key] !== undefined ? formData.value[key] : (defaultVal ?? DEFAULTS[key])
}

const setValue = (key, value) => {
  // 如果值等于默认值，删除该属性
  if (value === DEFAULTS[key] || value === '' || value === null) {
    delete formData.value[key]
  } else {
    formData.value[key] = value
  }
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
}

const handleSave = () => {
  if (activeTab.value === 'json') {
    try {
      formData.value = JSON.parse(jsonStr.value)
      jsonError.value = ''
    } catch (e) {
      jsonError.value = 'JSON 格式错误，请修正后重试'
      return
    }
  }
  emit('save', formData.value)
}
</script>

<template>
  <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
      @click.self="$emit('close')"
  >
    <div
        class="bg-white w-[720px] max-w-[95vw] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">

      <!-- 头部 -->
      <div
          class="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-white shadow-sm border border-slate-100">
            <component :is="recognitionConfig.icon" :size="20" :class="recognitionConfig.color"/>
          </div>
          <div>
            <h3 class="font-bold text-slate-800 text-lg">节点属性编辑器</h3>
            <div class="text-xs text-slate-500 font-mono mt-0.5">#{{ nodeId }}</div>
          </div>
        </div>
        <button
            @click="$emit('close')"
            class="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-slate-600"
        >
          <X :size="20"/>
        </button>
      </div>

      <!-- 标签页切换 -->
      <div class="flex border-b border-slate-100 bg-slate-50/50">
        <button
            @click="handleTabChange('properties')"
            class="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative"
            :class="activeTab === 'properties'
            ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' 
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'"
        >
          <Settings :size="16"/>
          属性编辑
        </button>
        <button
            @click="handleTabChange('json')"
            class="flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative"
            :class="activeTab === 'json'
            ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' 
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'"
        >
          <FileJson :size="16"/>
          JSON 编辑
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto custom-scrollbar">

        <!-- 属性编辑面板 -->
        <div v-show="activeTab === 'properties'" class="p-5 space-y-4">

          <!-- 基本属性 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                @click="toggleSection('basic')"
                class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-2">
                <Settings :size="16" class="text-slate-500"/>
                <span class="font-semibold text-slate-700 text-sm">基本属性</span>
              </div>
              <component :is="expandedSections.basic ? ChevronDown : ChevronRight" :size="16" class="text-slate-400"/>
            </button>

            <div v-show="expandedSections.basic" class="p-4 space-y-4 border-t border-slate-100">
              <!-- 节点名称 -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">节点名称 (ID)</label>
                <input
                    :value="getValue('id')"
                    @input="setValue('id', $event.target.value)"
                    class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                    placeholder="输入节点名称"
                />
              </div>

              <!-- 识别算法 -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">识别算法</label>
                <div class="relative">
                  <select
                      :value="currentRecognition"
                      @change="setValue('recognition', $event.target.value)"
                      class="w-full appearance-none px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                  >
                    <option v-for="type in recognitionTypes" :key="type.value" :value="type.value">
                      {{ type.label }} ({{ type.value }})
                    </option>
                  </select>
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown :size="16" class="text-slate-400"/>
                  </div>
                </div>
              </div>

              <!-- 执行动作 -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">执行动作</label>
                <div class="relative">
                  <select
                      :value="currentAction"
                      @change="setValue('action', $event.target.value)"
                      class="w-full appearance-none px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                  >
                    <option v-for="type in actionTypes" :key="type.value" :value="type.value">
                      {{ type.label }} ({{ type.value }})
                    </option>
                  </select>
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown :size="16" class="text-slate-400"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 流程控制 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                @click="toggleSection('flow')"
                class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-2">
                <GitBranch :size="16" class="text-blue-500"/>
                <span class="font-semibold text-slate-700 text-sm">流程控制</span>
              </div>
              <component :is="expandedSections.flow ? ChevronDown : ChevronRight" :size="16" class="text-slate-400"/>
            </button>

            <div v-show="expandedSections.flow" class="p-4 space-y-4 border-t border-slate-100">
              <div class="grid grid-cols-1 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                    后继节点 (Next)
                  </label>
                  <input
                      :value="getArrayValue('next')"
                      @input="setArrayValue('next', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      placeholder="节点名称，用逗号分隔"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                    中断节点 (Interrupt)
                  </label>
                  <input
                      :value="getArrayValue('interrupt')"
                      @input="setArrayValue('interrupt', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                      placeholder="节点名称，用逗号分隔"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-rose-600 uppercase tracking-wide flex items-center gap-1">
                    <div class="w-2 h-2 rounded-full bg-rose-500"></div>
                    错误节点 (OnError)
                  </label>
                  <input
                      :value="getArrayValue('on_error')"
                      @input="setArrayValue('on_error', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
                      placeholder="节点名称，用逗号分隔"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 通用属性 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                @click="toggleSection('common')"
                class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-2">
                <Zap :size="16" class="text-emerald-500"/>
                <span class="font-semibold text-slate-700 text-sm">通用属性</span>
              </div>
              <component :is="expandedSections.common ? ChevronDown : ChevronRight" :size="16" class="text-slate-400"/>
            </button>

            <div v-show="expandedSections.common" class="p-4 space-y-4 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">识别速率 (ms)</label>
                  <input
                      type="number"
                      :value="getValue('rate_limit', 1000)"
                      @input="setValue('rate_limit', parseInt($event.target.value) || 1000)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">超时时间 (ms)</label>
                  <input
                      type="number"
                      :value="getValue('timeout', 20000)"
                      @input="setValue('timeout', parseInt($event.target.value) || 20000)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>

              <div class="flex flex-wrap gap-4 pt-2">
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('is_sub', false)"
                      @change="setValue('is_sub', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">子节点</span>
                </label>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('inverse', false)"
                      @change="setValue('inverse', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">反转结果</span>
                </label>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('enabled', true)"
                      @change="setValue('enabled', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">启用</span>
                </label>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('focus', false)"
                      @change="setValue('focus', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">关注节点</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 延迟属性 -->
          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                @click="toggleSection('delay')"
                class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div class="flex items-center gap-2">
                <Clock :size="16" class="text-violet-500"/>
                <span class="font-semibold text-slate-700 text-sm">延迟设置</span>
              </div>
              <component :is="expandedSections.delay ? ChevronDown : ChevronRight" :size="16" class="text-slate-400"/>
            </button>

            <div v-show="expandedSections.delay" class="p-4 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">动作前延迟 (ms)</label>
                  <input
                      type="number"
                      :value="getValue('pre_delay', 200)"
                      @input="setValue('pre_delay', parseInt($event.target.value) || 200)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">动作后延迟 (ms)</label>
                  <input
                      type="number"
                      :value="getValue('post_delay', 200)"
                      @input="setValue('post_delay', parseInt($event.target.value) || 200)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">前等待冻结 (ms)</label>
                  <input
                      type="number"
                      :value="getValue('pre_wait_freezes', 0)"
                      @input="setValue('pre_wait_freezes', parseInt($event.target.value) || 0)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">后等待冻结 (ms)</label>
                  <input
                      type="number"
                      :value="getValue('post_wait_freezes', 0)"
                      @input="setValue('post_wait_freezes', parseInt($event.target.value) || 0)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 识别算法特有属性 -->
          <div v-if="currentRecognition !== 'DirectHit'"
               class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                @click="toggleSection('recognition')"
                class="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 transition-colors"
            >
              <div class="flex items-center gap-2">
                <component :is="recognitionConfig.icon" :size="16" :class="recognitionConfig.color"/>
                <span class="font-semibold text-slate-700 text-sm">{{ recognitionConfig.label }} 属性</span>
              </div>
              <component :is="expandedSections.recognition ? ChevronDown : ChevronRight" :size="16"
                         class="text-slate-400"/>
            </button>

            <div v-show="expandedSections.recognition" class="p-4 space-y-4 border-t border-slate-100">
              <!-- 通用识别属性 ROI -->
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">识别区域 (ROI)</label>
                  <input
                      :value="getValue('roi', '')"
                      @input="setValue('roi', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="[x,y,w,h] 或节点名"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">区域偏移</label>
                  <input
                      :value="getValue('roi_offset', '')"
                      @input="setValue('roi_offset', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="[x,y,w,h]"
                  />
                </div>
              </div>

              <!-- TemplateMatch 特有属性 -->
              <template v-if="currentRecognition === 'TemplateMatch'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">模板图片路径</label>
                  <input
                      :value="getValue('template', '')"
                      @input="setValue('template', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="相对于 image 文件夹的路径"
                  />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">匹配阈值</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        :value="getValue('threshold', 0.7)"
                        @input="setValue('threshold', parseFloat($event.target.value) || 0.7)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">匹配算法</label>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        :value="getValue('method', 5)"
                        @input="setValue('method', parseInt($event.target.value) || 5)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('green_mask', false)"
                      @change="setValue('green_mask', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">绿色掩码 (忽略图片中的绿色部分)</span>
                </label>
              </template>

              <!-- FeatureMatch 特有属性 -->
              <template v-if="currentRecognition === 'FeatureMatch'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">模板图片路径</label>
                  <input
                      :value="getValue('template', '')"
                      @input="setValue('template', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="相对于 image 文件夹的路径"
                  />
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">特征点数量</label>
                    <input
                        type="number"
                        min="1"
                        :value="getValue('count', 4)"
                        @input="setValue('count', parseInt($event.target.value) || 4)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">检测器</label>
                    <select
                        :value="getValue('detector', 'SIFT')"
                        @change="setValue('detector', $event.target.value)"
                        class="w-full appearance-none px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                    >
                      <option>SIFT</option>
                      <option>KAZE</option>
                      <option>AKAZE</option>
                      <option>BRISK</option>
                      <option>ORB</option>
                    </select>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">距离比值</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        :value="getValue('ratio', 0.6)"
                        @input="setValue('ratio', parseFloat($event.target.value) || 0.6)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('green_mask', false)"
                      @change="setValue('green_mask', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">绿色掩码</span>
                </label>
              </template>

              <!-- ColorMatch 特有属性 -->
              <template v-if="currentRecognition === 'ColorMatch'">
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">颜色下限</label>
                    <input
                        :value="getValue('lower', '')"
                        @input="setValue('lower', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="[R,G,B]"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">颜色上限</label>
                    <input
                        :value="getValue('upper', '')"
                        @input="setValue('upper', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="[R,G,B]"
                    />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">匹配算法</label>
                    <input
                        type="number"
                        :value="getValue('method', 4)"
                        @input="setValue('method', parseInt($event.target.value) || 4)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                        placeholder="4=RGB, 40=HSV, 6=灰度"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">特征点数量</label>
                    <input
                        type="number"
                        min="1"
                        :value="getValue('count', 1)"
                        @input="setValue('count', parseInt($event.target.value) || 1)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('connected', false)"
                      @change="setValue('connected', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">要求像素相连</span>
                </label>
              </template>

              <!-- OCR 特有属性 -->
              <template v-if="currentRecognition === 'OCR'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">期望文本</label>
                  <input
                      :value="getValue('expected', '')"
                      @input="setValue('expected', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                      placeholder="期望文本或正则表达式"
                  />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">匹配阈值</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        :value="getValue('threshold', 0.3)"
                        @input="setValue('threshold', parseFloat($event.target.value) || 0.3)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">模型路径</label>
                    <input
                        :value="getValue('model', '')"
                        @input="setValue('model', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="model/ocr 下的路径"
                    />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">文本替换</label>
                  <input
                      :value="getValue('replace', '')"
                      @input="setValue('replace', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder='["原文本", "替换文本"]'
                  />
                </div>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('only_rec', false)"
                      @change="setValue('only_rec', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">仅识别 (不进行文本检测)</span>
                </label>
              </template>

              <!-- NeuralNetworkClassify / NeuralNetworkDetect 特有属性 -->
              <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentRecognition)">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">模型路径</label>
                  <input
                      :value="getValue('model', '')"
                      @input="setValue('model', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      :placeholder="currentRecognition === 'NeuralNetworkClassify' ? 'model/classify 下的路径' : 'model/detect 下的路径'"
                  />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">期望标签</label>
                    <input
                        :value="getValue('expected', '')"
                        @input="setValue('expected', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="0 或 [0, 1, 2]"
                    />
                  </div>
                  <div v-if="currentRecognition === 'NeuralNetworkDetect'" class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">匹配阈值</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        :value="getValue('threshold', 0.3)"
                        @input="setValue('threshold', parseFloat($event.target.value) || 0.3)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">标签列表</label>
                  <input
                      :value="getValue('labels', '')"
                      @input="setValue('labels', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder='["猫", "狗", "鼠"]'
                  />
                </div>
              </template>

              <!-- Custom 识别特有属性 -->
              <template v-if="currentRecognition === 'Custom'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">自定义识别名</label>
                  <input
                      :value="getValue('custom_recognition', '')"
                      @input="setValue('custom_recognition', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                      placeholder="注册的自定义识别器名称"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">自定义识别参数</label>
                  <textarea
                      :value="getValue('custom_recognition_param', '')"
                      @input="setValue('custom_recognition_param', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono h-20 resize-none"
                      placeholder="JSON 格式参数"
                  ></textarea>
                </div>
              </template>
            </div>
          </div>

          <!-- 动作特有属性 -->
          <div v-if="!['DoNothing', 'StopTask'].includes(currentAction)"
               class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
                @click="toggleSection('action')"
                class="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-colors"
            >
              <div class="flex items-center gap-2">
                <component :is="actionConfig.icon" :size="16" :class="actionConfig.color"/>
                <span class="font-semibold text-slate-700 text-sm">{{ actionConfig.label }} 属性</span>
              </div>
              <component :is="expandedSections.action ? ChevronDown : ChevronRight" :size="16" class="text-slate-400"/>
            </button>

            <div v-show="expandedSections.action" class="p-4 space-y-4 border-t border-slate-100">
              <!-- Click 动作属性 -->
              <template v-if="currentAction === 'Click'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">点击目标</label>
                  <input
                      :value="getValue('target', '')"
                      @input="setValue('target', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="节点名或坐标 [x,y,w,h]，不填为识别目标"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">目标偏移</label>
                  <input
                      :value="getValue('target_offset', '')"
                      @input="setValue('target_offset', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="[x,y,w,h]"
                  />
                </div>
              </template>

              <!-- Swipe 动作属性 -->
              <template v-if="currentAction === 'Swipe'">
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">起点</label>
                    <input
                        :value="getValue('begin', '')"
                        @input="setValue('begin', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="节点名或 [x,y,w,h]"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">起点偏移</label>
                    <input
                        :value="getValue('begin_offset', '')"
                        @input="setValue('begin_offset', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="[x,y,w,h]"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">终点</label>
                    <input
                        :value="getValue('end', '')"
                        @input="setValue('end', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="节点名或 [x,y,w,h]"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">终点偏移</label>
                    <input
                        :value="getValue('end_offset', '')"
                        @input="setValue('end_offset', $event.target.value)"
                        class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                        placeholder="[x,y,w,h]"
                    />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">持续时间 (ms)</label>
                  <input
                      type="number"
                      min="50"
                      :value="getValue('duration', 200)"
                      @input="setValue('duration', parseInt($event.target.value) || 200)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </template>

              <!-- Key 动作属性 -->
              <template v-if="currentAction === 'Key'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">按键码</label>
                  <input
                      :value="getValue('key', '')"
                      @input="setValue('key', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="25 或 [25, 26, 27]"
                  />
                </div>
              </template>

              <!-- InputText 动作属性 -->
              <template v-if="currentAction === 'InputText'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">输入文本</label>
                  <input
                      :value="getValue('input_text', '')"
                      @input="setValue('input_text', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                      placeholder="要输入的文本内容"
                  />
                </div>
              </template>

              <!-- StartApp / StopApp 动作属性 -->
              <template v-if="['StartApp', 'StopApp'].includes(currentAction)">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">应用包名</label>
                  <input
                      :value="getValue('package', '')"
                      @input="setValue('package', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="如 com.example.app"
                  />
                </div>
              </template>

              <!-- Command 动作属性 -->
              <template v-if="currentAction === 'Command'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">执行程序</label>
                  <input
                      :value="getValue('exec', '')"
                      @input="setValue('exec', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="执行程序路径"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">执行参数</label>
                  <textarea
                      :value="getValue('args', '')"
                      @input="setValue('args', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono h-16 resize-none"
                      placeholder='["arg1", "arg2", "{NODE}", "{BOX}"]'
                  ></textarea>
                </div>
                <label class="inline-flex items-center gap-2 cursor-pointer group">
                  <input
                      type="checkbox"
                      :checked="getValue('detach', false)"
                      @change="setValue('detach', $event.target.checked)"
                      class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-slate-600 group-hover:text-slate-800">分离进程 (不等待完成)</span>
                </label>
              </template>

              <!-- Custom 动作属性 -->
              <template v-if="currentAction === 'Custom'">
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">自定义动作名</label>
                  <input
                      :value="getValue('custom_action', '')"
                      @input="setValue('custom_action', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                      placeholder="注册的自定义动作名称"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">自定义动作参数</label>
                  <textarea
                      :value="getValue('custom_action_param', '')"
                      @input="setValue('custom_action_param', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono h-20 resize-none"
                      placeholder="JSON 格式参数"
                  ></textarea>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">点击目标</label>
                  <input
                      :value="getValue('target', '')"
                      @input="setValue('target', $event.target.value)"
                      class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                      placeholder="节点名或坐标 [x,y,w,h]"
                  />
                </div>
              </template>
            </div>
          </div>

        </div>

        <!-- JSON 编辑面板 -->
        <div v-show="activeTab === 'json'" class="p-5 flex flex-col h-full">
          <div class="text-xs text-slate-500 mb-3 flex items-center gap-2">
            <Eye :size="14"/>
            直接编辑节点的原始 JSON 数据，保存后将自动同步到属性面板
          </div>

          <!-- 错误提示 -->
          <div v-if="jsonError"
               class="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200 mb-3">
            <AlertCircle :size="16"/>
            <span>{{ jsonError }}</span>
          </div>

          <textarea
              v-model="jsonStr"
              @input="jsonError = ''"
              class="flex-1 w-full p-4 font-mono text-sm bg-slate-900 text-green-400 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[300px]"
              spellcheck="false"
          ></textarea>

          <button
              @click="updateFormFromJson"
              class="mt-3 self-end px-4 py-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            应用 JSON 到属性面板 →
          </button>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="px-5 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/80">
        <div class="text-xs text-slate-400">
          提示：修改后点击保存按钮应用更改
        </div>
        <div class="flex gap-2">
          <button
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg transition-all"
          >
            取消
          </button>
          <button
              @click="handleSave"
              class="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-200 rounded-lg flex items-center gap-2 transition-all"
          >
            <Save :size="16"/>
            保存更改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}
</style>
