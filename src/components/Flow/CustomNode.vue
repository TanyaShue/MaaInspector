<script setup>
import {computed, ref, inject, watch} from 'vue'
import {Handle, Position} from '@vue-flow/core'
import {
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2, HelpCircle,
  Loader2, AlertCircle, Ban, CheckCircle2,
  MousePointer, ArrowRight, Keyboard, Type, Play, Square, Terminal, Wand2,
  // 新增图标引入
  Hand, Layers, Fingerprint, Move, Mouse
} from 'lucide-vue-next'
import NodeDetails from './NodeDetails.vue'

const props = defineProps({
  id: {type: String, required: true},
  data: {type: Object, required: true},
  selected: {type: Boolean, default: false}
})

const updateNode = inject('updateNode', () => console.warn('updateNode not provided'))
const closeAllDetailsSignal = inject('closeAllDetailsSignal', ref(0))

const nodeConfig = {
  'DirectHit': {
    label: '通用匹配',
    icon: Target,
    color: 'bg-blue-500',
    text: 'text-blue-600',
    border: 'border-blue-200'
  },
  'TemplateMatch': {
    label: '模板匹配',
    icon: Image,
    color: 'bg-indigo-500',
    text: 'text-indigo-600',
    border: 'border-indigo-200'
  },
  'FeatureMatch': {
    label: '特征匹配',
    icon: Sparkles,
    color: 'bg-violet-500',
    text: 'text-violet-600',
    border: 'border-violet-200'
  },
  'ColorMatch': {
    label: '颜色识别',
    icon: Palette,
    color: 'bg-pink-500',
    text: 'text-pink-600',
    border: 'border-pink-200'
  },
  'OCR': {
    label: 'OCR识别',
    icon: ScanText,
    color: 'bg-emerald-500',
    text: 'text-emerald-600',
    border: 'border-emerald-200'
  },
  'NeuralNetworkClassify': {
    label: '模型 分类',
    icon: Brain,
    color: 'bg-amber-500',
    text: 'text-amber-600',
    border: 'border-amber-200'
  },
  'NeuralNetworkDetect': {
    label: '模型 检测',
    icon: ScanEye,
    color: 'bg-orange-500',
    text: 'text-orange-600',
    border: 'border-orange-200'
  },
  'Custom': {label: '自定义', icon: Code2, color: 'bg-slate-500', text: 'text-slate-600', border: 'border-slate-200'},
  'Unknown': {
    label: '未知节点',
    icon: HelpCircle,
    color: 'bg-gray-400',
    text: 'text-gray-500',
    border: 'border-gray-300'
  }
}

const actionConfigMap = {
  'DoNothing': {icon: Square, label: '无动作', color: 'text-slate-400', bg: 'bg-slate-50'},
  'Click': {icon: MousePointer, label: '点击目标', color: 'text-blue-500', bg: 'bg-blue-50'},
  'LongPress': {icon: Hand, label: '长按目标', color: 'text-blue-600', bg: 'bg-blue-50'},
  'Swipe': {icon: ArrowRight, label: '滑动屏幕', color: 'text-indigo-500', bg: 'bg-indigo-50'},
  'MultiSwipe': {icon: Layers, label: '多指滑动', color: 'text-indigo-600', bg: 'bg-indigo-50'},
  'TouchDown': {icon: Fingerprint, label: '手指按下', color: 'text-violet-500', bg: 'bg-violet-50'},
  'TouchMove': {icon: Move, label: '手指移动', color: 'text-violet-500', bg: 'bg-violet-50'},
  'TouchUp': {icon: Hand, label: '手指抬起', color: 'text-violet-500', bg: 'bg-violet-50'},
  'Scroll': {icon: Mouse, label: '滚动滚轮', color: 'text-cyan-500', bg: 'bg-cyan-50'},
  'Key': {icon: Keyboard, label: '物理按键', color: 'text-emerald-500', bg: 'bg-emerald-50'},
  'ClickKey': {icon: Keyboard, label: '点击按键', color: 'text-emerald-500', bg: 'bg-emerald-50'},
  'LongPressKey': {icon: Keyboard, label: '长按按键', color: 'text-emerald-600', bg: 'bg-emerald-50'},
  'KeyDown': {icon: Keyboard, label: '按键按下', color: 'text-teal-500', bg: 'bg-teal-50'},
  'KeyUp': {icon: Keyboard, label: '按键抬起', color: 'text-teal-500', bg: 'bg-teal-50'},
  'InputText': {icon: Type, label: '输入文本', color: 'text-green-500', bg: 'bg-green-50'},
  'StartApp': {icon: Play, label: '启动应用', color: 'text-sky-500', bg: 'bg-sky-50'},
  'StopApp': {icon: Square, label: '停止应用', color: 'text-red-500', bg: 'bg-red-50'},
  'StopTask': {icon: Square, label: '停止任务', color: 'text-rose-500', bg: 'bg-rose-50'},
  'Command': {icon: Terminal, label: 'Shell命令', color: 'text-amber-500', bg: 'bg-amber-50'},
  'Custom': {icon: Wand2, label: '自定义动作', color: 'text-slate-500', bg: 'bg-slate-50'}
}

const config = computed(() => nodeConfig[props.data.type] || nodeConfig['DirectHit'])
const availableTypes = Object.keys(nodeConfig).filter(t => t !== 'Unknown')
const businessData = computed(() => props.data.data || {})
const currentActionConfig = computed(() => {
  const action = businessData.value.action
  if (!action || action === 'DoNothing') return null
  return actionConfigMap[action] || actionConfigMap['Custom']
})

const showDetails = ref(false)
const toggleDetails = () => {
  showDetails.value = !showDetails.value
}
const getFileName = (path) => {
  if (!path || typeof path !== 'string') return '未选择图片'
  return path.split('/').pop()
}

watch(closeAllDetailsSignal, () => {
  showDetails.value = false
})

const handleUpdateId = ({oldId, newId}) => updateNode({oldId, newId, newType: props.data.type})
const handleUpdateType = (newType) => updateNode({oldId: props.id, newId: props.id, newType})
const handleUpdateData = (newData) => updateNode({
  oldId: props.id,
  newId: props.id,
  newType: newData.recognition || props.data.type,
  newData
})

const statusConfig = computed(() => {
  if (props.data._isMissing) return {icon: AlertCircle, color: 'text-gray-400', spin: false}
  switch (props.data.status) {
    case 'running':
      return {icon: Loader2, color: 'text-blue-500', spin: true}
    case 'error':
      return {icon: AlertCircle, color: 'text-red-500', spin: false}
    case 'success':
      return {icon: CheckCircle2, color: 'text-green-500', spin: false}
    case 'ignored':
      return {icon: Ban, color: 'text-slate-400', spin: false}
    default:
      return null
  }
})

const headerStyle = computed(() => {
  switch (props.data.status) {
    case 'running':
      return 'bg-blue-100 border-blue-200'
    case 'success':
      return 'bg-green-100 border-green-200'
    case 'error':
      return 'bg-red-100 border-red-200'
    case 'ignored':
      return 'bg-slate-100 border-slate-200'
    default:
      return 'bg-slate-50/50 border-slate-100'
  }
})

const isImageNode = computed(() => ['TemplateMatch', 'FeatureMatch'].includes(props.data.type))

const nodeImages = computed(() => {
  const images = props.data._images || []
  return images.filter(img => img.found && img.base64).slice(0, 16)
})

const gridClass = computed(() => {
  const count = nodeImages.value.length
  if (count <= 1) return 'grid-cols-1 grid-rows-1'
  if (count === 2) return 'grid-cols-2 grid-rows-1'
  if (count <= 4) return 'grid-cols-2 grid-rows-2'
  if (count <= 6) return 'grid-cols-3 grid-rows-2'
  if (count <= 9) return 'grid-cols-3 grid-rows-3'
  if (count <= 12) return 'grid-cols-4 grid-rows-3'
  return 'grid-cols-4 grid-rows-4'
})

// 3. 计算 Grid 列数，用于控制边框
const gridCols = computed(() => {
  const cls = gridClass.value
  if (cls.includes('grid-cols-4')) return 4
  if (cls.includes('grid-cols-3')) return 3
  if (cls.includes('grid-cols-2')) return 2
  return 1
})

const contentHeightClass = computed(() => {
  if (isImageNode.value) {
    const count = nodeImages.value.length
    if (count === 0) return 'h-12'
    if (count <= 2) return 'h-24'
    if (count <= 6) return 'h-32'
    if (count <= 9) return 'h-40'
    return 'h-48'
  }
  return 'h-12'
})
</script>

<template>
  <div
      class="w-[280px] bg-white rounded-xl shadow-lg border-2 transition-all duration-200 overflow-visible group relative"
      :class="[selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-500' : 'border-slate-100 hover:border-slate-300', data._isMissing ? 'opacity-80' : '']"
      @dblclick.stop="toggleDetails"
  >
    <NodeDetails
        :visible="showDetails"
        :nodeId="id"
        :nodeData="data"
        :nodeType="data.type"
        :availableTypes="availableTypes"
        :typeConfig="nodeConfig"
        @close="showDetails = false"
        @update-id="handleUpdateId"
        @update-type="handleUpdateType"
        @update-data="handleUpdateData"
    />

    <Handle id="in" type="target" :position="Position.Top"
            class="!w-16 !h-3 !rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200"
            style="top: -6px; left: 50%; transform: translate(-50%, 0);"/>

    <div class="flex items-center justify-between px-4 py-3 rounded-t-xl border-b transition-colors duration-300"
         :class="headerStyle">
      <div class="flex items-center">
        <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.color]">
          <component :is="config.icon" :size="18"/>
        </div>
        <div>
          <div class="font-bold text-slate-700 text-sm truncate max-w-[150px]" :title="data.id">{{ data.id }}</div>
          <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1">{{ config.label }}</div>
        </div>
      </div>
      <div v-if="statusConfig" class="flex items-center p-1 -mr-1 rounded-md">
        <component :is="statusConfig.icon" :size="18"
                   :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']"/>
      </div>
    </div>

    <div class="p-4 bg-white min-h-[80px] flex items-center gap-3">

      <div class="flex-1 min-w-0">
        <div v-if="data._isMissing"
             class="text-center text-slate-400 text-xs italic bg-slate-50 p-2 rounded border border-dashed border-slate-200">
          引用缺失
        </div>

        <div v-else-if="data.type === 'Unknown'" class="text-center text-slate-400 text-xs italic">
          未知节点
        </div>

        <div v-else-if="isImageNode" class="space-y-1">
          <div
              class="w-full bg-slate-50 rounded-lg border border-slate-200 border-dashed overflow-hidden relative transition-all duration-300"
              :class="contentHeightClass"
          >
            <div v-if="nodeImages.length > 0" class="grid w-full h-full" :class="gridClass">
              <div
                  v-for="(img, idx) in nodeImages"
                  :key="idx"
                  class="relative overflow-hidden border-white/50 group/img"
                  :class="{
                  'border-r': (idx + 1) % gridCols !== 0,
                  'border-b': idx < nodeImages.length - gridCols
                }"
              >
                <img :src="img.base64"
                     class="w-full h-full object-fill transform hover:scale-110 transition-transform duration-300"/>

                <div
                    class="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-center p-1 pointer-events-none">
                  <span class="text-[9px] text-white font-mono truncate w-full text-center leading-tight">
                    {{ getFileName(img.path) }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1">
              <component :is="config.icon" :size="24" class="text-slate-300"/>
              <span class="text-[9px] text-slate-400">No Image</span>
            </div>
          </div>
        </div>

        <div v-else-if="data.type === 'ColorMatch'" class="flex items-center gap-2">
          <div class="w-8 h-8 rounded shadow-sm border border-slate-100 ring-1 ring-slate-200"
               :style="{ backgroundColor: businessData.targetColor || '#000000' }"></div>
          <div class="flex flex-col overflow-hidden">
            <span class="text-[10px] text-slate-400 uppercase">Target</span>
            <span class="font-mono text-xs font-bold text-slate-700 truncate">{{
                businessData.targetColor || '#N/A'
              }}</span>
          </div>
        </div>

        <div v-else-if="['OCR', 'NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(data.type)" class="space-y-1">
          <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
            Expected / Target
          </div>
          <div
              class="bg-slate-50 px-2 py-1.5 rounded border border-slate-100 text-xs font-mono text-slate-700 break-all leading-tight min-h-[1.5em]">
            {{ businessData.expected || (data.type === 'OCR' ? 'Any Text' : 'Any Class') }}
          </div>
        </div>

        <div v-else class="text-center">
          <div class="text-xs text-slate-500 line-clamp-2">{{ businessData.description || '通用逻辑处理' }}</div>
        </div>
      </div>

      <div v-if="currentActionConfig" class="shrink-0 flex flex-col items-center justify-center">
        <div
            class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-help hover:scale-105 shadow-sm border border-slate-100"
            :class="currentActionConfig.bg"
            :title="`执行动作: ${currentActionConfig.label}`"
        >
          <component :is="currentActionConfig.icon" :size="18" :class="currentActionConfig.color"/>
        </div>
      </div>

    </div>

    <div
        v-if="!data._isMissing && data.type !== 'Unknown'"
        class="flex h-6 w-full border-t border-slate-100 divide-x divide-slate-100"
    >
      <div
          class="flex-1 relative group hover:bg-blue-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span
            class="text-[10px] font-bold text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity">Next</span>
        <Handle
            id="source-a"
            type="source"
            :position="Position.Bottom"
            class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-blue-400 !transition-opacity"
        />
        <div
            class="absolute bottom-0 w-full h-1 bg-blue-200 group-hover:bg-blue-500 transition-colors rounded-bl-xl"></div>
      </div>

      <div
          class="flex-1 relative group hover:bg-amber-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span
            class="text-[10px] font-bold text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity">Int.</span>
        <Handle
            id="source-b"
            type="source"
            :position="Position.Bottom"
            class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-amber-400 !transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-amber-200 group-hover:bg-amber-500 transition-colors"></div>
      </div>

      <div
          class="flex-1 relative group hover:bg-rose-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span
            class="text-[10px] font-bold text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity">Err.</span>
        <Handle
            id="source-c"
            type="source"
            :position="Position.Bottom"
            class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-rose-400 !transition-opacity"
        />
        <div
            class="absolute bottom-0 w-full h-1 bg-rose-200 group-hover:bg-rose-500 transition-colors rounded-br-xl"></div>
      </div>
    </div>
  </div>
</template>

<style>
.vue-flow__node-custom .vue-flow__handle {
  border: none;
  min-width: 0;
  min-height: 0;
}
</style>