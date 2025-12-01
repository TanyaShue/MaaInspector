<script setup>
import { computed, ref, inject, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import {
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2, HelpCircle,
  Loader2, AlertCircle, Ban, CheckCircle2
} from 'lucide-vue-next'
import NodeDetails from './NodeDetails.vue'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const updateNode = inject('updateNode', () => console.warn('updateNode not provided'))
const closeAllDetailsSignal = inject('closeAllDetailsSignal', ref(0))

// --- Config ---
const nodeConfig = {
  'DirectHit':             { label: '通用匹配', icon: Target,    color: 'bg-blue-500',    text: 'text-blue-600',    border: 'border-blue-200' },
  'TemplateMatch':         { label: '模板匹配', icon: Image,     color: 'bg-indigo-500',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  'FeatureMatch':          { label: '特征匹配', icon: Sparkles,  color: 'bg-violet-500',  text: 'text-violet-600',  border: 'border-violet-200' },
  'ColorMatch':            { label: '颜色识别', icon: Palette,   color: 'bg-pink-500',    text: 'text-pink-600',    border: 'border-pink-200' },
  'OCR':                   { label: 'OCR识别',  icon: ScanText,  color: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200' },
  'NeuralNetworkClassify': { label: '模型 分类',  icon: Brain,     color: 'bg-amber-500',   text: 'text-amber-600',   border: 'border-amber-200' },
  'NeuralNetworkDetect':   { label: '模型 检测',  icon: ScanEye,   color: 'bg-orange-500',  text: 'text-orange-600',  border: 'border-orange-200' },
  'Custom':                { label: '自定义',   icon: Code2,     color: 'bg-slate-500',   text: 'text-slate-600',   border: 'border-slate-200' },
  'Unknown':               { label: '未知节点', icon: HelpCircle, color: 'bg-gray-400',    text: 'text-gray-500',    border: 'border-gray-300' }
}

const config = computed(() => nodeConfig[props.data.type] || nodeConfig['DirectHit'])
const availableTypes = Object.keys(nodeConfig).filter(t => t !== 'Unknown')
const businessData = computed(() => props.data.data || {})

const showDetails = ref(false)
const toggleDetails = () => { showDetails.value = !showDetails.value }

// 监听关闭所有节点详情的信号
watch(closeAllDetailsSignal, () => {
  showDetails.value = false
})

// --- Event Handlers ---
const handleUpdateId = ({ oldId, newId }) => {
  updateNode({ oldId, newId, newType: props.data.type })
}
const handleUpdateType = (newType) => {
  updateNode({ oldId: props.id, newId: props.id, newType })
}
const handleUpdateData = (newData) => {
  updateNode({ oldId: props.id, newId: props.id, newType: newData.recognition || props.data.type, newData })
}

// --- Status Styling ---
const statusConfig = computed(() => {
  if (props.data._isMissing) return { icon: AlertCircle, color: 'text-gray-400', spin: false }
  switch (props.data.status) {
    case 'running': return { icon: Loader2, color: 'text-blue-500', spin: true }
    case 'error':   return { icon: AlertCircle, color: 'text-red-500', spin: false }
    case 'success': return { icon: CheckCircle2, color: 'text-green-500', spin: false }
    case 'ignored': return { icon: Ban, color: 'text-slate-400', spin: false }
    default: return null
  }
})

const headerStyle = computed(() => {
  switch (props.data.status) {
    case 'running': return 'bg-blue-100 border-blue-200'
    case 'success': return 'bg-green-100 border-green-200'
    case 'error':   return 'bg-red-100 border-red-200'
    case 'ignored': return 'bg-slate-100 border-slate-200'
    default:        return 'bg-slate-50/50 border-slate-100'
  }
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

    <Handle id="in" type="target" :position="Position.Top" class="!w-16 !h-3 !rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200" style="top: -6px; left: 50%; transform: translate(-50%, 0);" />

    <div class="flex items-center justify-between px-4 py-3 rounded-t-xl border-b transition-colors duration-300" :class="headerStyle">
      <div class="flex items-center">
        <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.color]">
          <component :is="config.icon" :size="18" />
        </div>
        <div>
          <div class="font-bold text-slate-700 text-sm truncate max-w-[150px]" :title="data.id">{{ data.id }}</div>
          <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1">{{ config.label }}</div>
        </div>
      </div>
      <div v-if="statusConfig" class="flex items-center p-1 -mr-1 rounded-md">
        <component :is="statusConfig.icon" :size="18" :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']" />
      </div>
    </div>

    <div class="p-4 bg-white min-h-[80px] flex flex-col justify-center">
      <div v-if="data._isMissing" class="text-center text-slate-400 text-xs italic bg-slate-50 p-2 rounded border border-dashed border-slate-200">节点引用缺失<br><span class="text-[10px] opacity-70">Target node not found</span></div>

      <div v-else-if="data.type === 'Unknown'" class="text-center text-slate-400 text-xs italic">
        未知逻辑节点<br><span class="text-[10px] opacity-70">Placeholder</span>
      </div>

      <div v-else-if="['TemplateMatch', 'FeatureMatch'].includes(data.type)" class="space-y-2">
        <div class="w-full h-16 bg-slate-100 rounded-lg border border-slate-200 border-dashed flex items-center justify-center text-slate-400 overflow-hidden relative group/img">
          <component :is="config.icon" :size="24" class="opacity-20 group-hover/img:scale-110 transition-transform" />
          <span class="text-[10px] absolute bottom-1">Image Preview</span>
        </div>
        <div class="text-xs text-center text-slate-500 truncate">{{ businessData.imageName || 'unknown.png' }}</div>
      </div>
      <div v-else-if="data.type === 'ColorMatch'" class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg shadow-sm border border-slate-100 ring-2 ring-white" :style="{ backgroundColor: businessData.targetColor || '#000000' }"></div>
        <div class="flex flex-col"><span class="text-xs text-slate-400">Target HEX</span><span class="font-mono text-sm font-bold text-slate-700">{{ businessData.targetColor || '#N/A' }}</span></div>
      </div>
      <div v-else-if="data.type === 'OCR'" class="space-y-1">
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Detected Text</div>
        <div class="bg-slate-50 p-2 rounded border border-slate-100 text-xs font-mono text-slate-700 break-all leading-relaxed">{{ businessData.text || 'Waiting for input...' }}</div>
      </div>
      <div v-else-if="['NeuralNetworkClassify', 'NeuralNetworkDetect', 'Custom'].includes(data.type)" class="text-center">
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
          <component :is="config.icon" :size="12" :class="config.text" />
          <span class="text-xs font-bold text-slate-600">{{ businessData.modelLabel || 'No Model' }}</span>
        </div>
        <div class="mt-2 text-[10px] text-slate-400">Confidence: {{ businessData.confidence || 0 }}%</div>
      </div>
      <div v-else class="text-center space-y-2">
        <div class="text-xs text-slate-500">{{ businessData.description || '通用流程节点' }}</div>
        <div class="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-blue-500 w-2/3"></div></div>
      </div>
    </div>

    <div
      v-if="!data._isMissing && data.type !== 'Unknown'"
      class="flex h-6 w-full border-t border-slate-100 divide-x divide-slate-100"
    >
      <!-- Next 输出端口 -->
      <div class="flex-1 relative group hover:bg-blue-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span class="text-[10px] font-bold text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity">Next</span>
        <Handle
          id="source-a"
          type="source"
          :position="Position.Bottom"
          class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-blue-400 !transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-blue-200 group-hover:bg-blue-500 transition-colors rounded-bl-xl"></div>
      </div>

      <!-- Interrupt 输出端口 -->
      <div class="flex-1 relative group hover:bg-amber-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span class="text-[10px] font-bold text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity">Int.</span>
        <Handle
          id="source-b"
          type="source"
          :position="Position.Bottom"
          class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-amber-400 !transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-amber-200 group-hover:bg-amber-500 transition-colors"></div>
      </div>

      <!-- Error 输出端口 -->
      <div class="flex-1 relative group hover:bg-rose-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span class="text-[10px] font-bold text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity">Err.</span>
        <Handle
          id="source-c"
          type="source"
          :position="Position.Bottom"
          class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-rose-400 !transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-rose-200 group-hover:bg-rose-500 transition-colors rounded-br-xl"></div>
      </div>
    </div>
  </div>
</template>

<style>
.vue-flow__node-custom .vue-flow__handle { border: none; min-width: 0; min-height: 0; }
</style>