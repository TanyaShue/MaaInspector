<script setup>
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import {
  // 节点类型图标
  Target,       // DirectHit
  Image as ImageIcon, // TemplateMatch
  Sparkles,     // FeatureMatch
  Palette,      // ColorMatch
  ScanText,     // OCR
  Brain,        // NeuralNetworkClassify
  ScanEye,      // NeuralNetworkDetect
  Code2,        // Custom
  // 状态图标
  Loader2, AlertCircle, Ban, CheckCircle2,
  // 通用图标
  X, FileJson, Activity
} from 'lucide-vue-next'

const props = defineProps({
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

// --- 详情弹窗逻辑 ---
const showDetails = ref(false)
const toggleDetails = () => { showDetails.value = !showDetails.value }

// --- 1. 节点类型配置 (8种) ---
const nodeConfig = {
  'DirectHit':             { label: '通用匹配', icon: Target,    color: 'bg-blue-500',    text: 'text-blue-600',    border: 'border-blue-200' },
  'TemplateMatch':         { label: '模板匹配', icon: ImageIcon, color: 'bg-indigo-500',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  'FeatureMatch':          { label: '特征匹配', icon: Sparkles,  color: 'bg-violet-500',  text: 'text-violet-600',  border: 'border-violet-200' },
  'ColorMatch':            { label: '颜色识别', icon: Palette,   color: 'bg-pink-500',    text: 'text-pink-600',    border: 'border-pink-200' },
  'OCR':                   { label: 'OCR识别',  icon: ScanText,  color: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200' },
  'NeuralNetworkClassify': { label: 'AI 分类',  icon: Brain,     color: 'bg-amber-500',   text: 'text-amber-600',   border: 'border-amber-200' },
  'NeuralNetworkDetect':   { label: 'AI 检测',  icon: ScanEye,   color: 'bg-orange-500',  text: 'text-orange-600',  border: 'border-orange-200' },
  'Custom':                { label: '自定义',   icon: Code2,     color: 'bg-slate-500',   text: 'text-slate-600',   border: 'border-slate-200' },
}

const config = computed(() => nodeConfig[props.data.type] || nodeConfig['DirectHit'])

// --- 2. 节点状态配置 ---
// data.status: 'running' | 'error' | 'ignored' | 'success' (可选) | undefined (无状态)
const statusConfig = computed(() => {
  const s = props.data.status
  switch (s) {
    case 'running': return { icon: Loader2, color: 'text-blue-500', spin: true, tooltip: '识别中...' }
    case 'error':   return { icon: AlertCircle, color: 'text-red-500', spin: false, tooltip: '识别失败' }
    case 'ignored': return { icon: Ban, color: 'text-slate-400', spin: false, tooltip: '不识别/跳过' }
    case 'success': return { icon: CheckCircle2, color: 'text-green-500', spin: false, tooltip: '识别成功' }
    default: return null
  }
})

// 容器样式
const containerClass = computed(() => [
  'w-[280px] bg-white rounded-xl shadow-lg border-2 transition-all duration-200 overflow-visible group relative',
  props.selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-500' : 'border-slate-100 hover:border-slate-300'
])

const formattedJson = computed(() => {
  const { ...displayData } = props.data
  return JSON.stringify(displayData, null, 2)
})
</script>

<template>
  <div :class="containerClass" @dblclick="toggleDetails">

    <!-- 详情弹窗 (保持不变) -->
    <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-x-[-10px]" enter-to-class="opacity-100 translate-x-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 translate-x-[-10px]">
      <div v-if="showDetails" class="absolute left-[105%] top-0 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 nodrag cursor-default flex flex-col overflow-hidden" style="min-height: 400px;" @dblclick.stop>
        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <component :is="config.icon" :class="['w-5 h-5', config.text]" />
            <span class="font-bold text-slate-700">节点详情</span>
          </div>
          <button class="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors" @click.stop="showDetails = false"><X :size="18" /></button>
        </div>
        <div class="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div class="text-xs text-slate-500 mb-1">类型</div>
              <div class="text-sm font-semibold text-slate-700">{{ config.label }}</div>
            </div>
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div class="text-xs text-slate-500 mb-1">状态</div>
              <div class="text-sm font-semibold">{{ statusConfig?.tooltip || '无状态' }}</div>
            </div>
          </div>
          <div class="flex-1"><div class="flex items-center gap-2 mb-2 text-slate-500"><FileJson :size="14" /><span class="text-xs font-bold uppercase">Raw Data</span></div><div class="bg-slate-900 rounded-lg p-3 overflow-hidden"><pre class="font-mono text-xs text-green-400 whitespace-pre-wrap break-all leading-relaxed">{{ formattedJson }}</pre></div></div>
        </div>
      </div>
    </transition>

    <!-- 输入端口 -->
    <Handle id="in" type="target" :position="Position.Top" class="!w-16 !h-3 !rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200" style="top: -6px; left: 50%; transform: translate(-50%, 0);" />

    <!-- 头部区域 -->
    <div class="flex items-center justify-between px-4 py-3 bg-slate-50/50 rounded-t-xl border-b border-slate-100">
      <!-- 左侧：图标 + 标题 -->
      <div class="flex items-center">
        <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.color]">
          <component :is="config.icon" :size="18" />
        </div>
        <div>
          <div class="font-bold text-slate-700 text-sm">{{ config.label }}</div>
          <div class="text-[10px] text-slate-400 font-mono">ID: {{ data.id }}</div>
        </div>
      </div>

      <!-- 右侧：状态图标 -->
      <div v-if="statusConfig" class="flex items-center" :title="statusConfig.tooltip">
        <component
          :is="statusConfig.icon"
          :size="18"
          :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']"
        />
      </div>
    </div>

    <!-- 内容展示区域 (根据类型展示不同内容) -->
    <div class="p-4 bg-white min-h-[80px] flex flex-col justify-center">

      <!-- 1. 图片展示区 (TemplateMatch | FeatureMatch) -->
      <div v-if="['TemplateMatch', 'FeatureMatch'].includes(data.type)" class="space-y-2">
        <div class="w-full h-16 bg-slate-100 rounded-lg border border-slate-200 border-dashed flex items-center justify-center text-slate-400 overflow-hidden relative group/img">
          <!-- 预留图片位置，暂时展示图标 -->
          <component :is="config.icon" :size="24" class="opacity-20 group-hover/img:scale-110 transition-transform" />
          <span class="text-[10px] absolute bottom-1">Image Preview</span>
        </div>
        <div class="text-xs text-center text-slate-500 truncate">{{ data.imageName || 'unknown.png' }}</div>
      </div>

      <!-- 2. 颜色展示区 (ColorMatch) -->
      <div v-else-if="data.type === 'ColorMatch'" class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg shadow-sm border border-slate-100 ring-2 ring-white"
          :style="{ backgroundColor: data.targetColor || '#000000' }"
        ></div>
        <div class="flex flex-col">
          <span class="text-xs text-slate-400">Target HEX</span>
          <span class="font-mono text-sm font-bold text-slate-700">{{ data.targetColor || '#N/A' }}</span>
        </div>
      </div>

      <!-- 3. OCR 文字展示 -->
      <div v-else-if="data.type === 'OCR'" class="space-y-1">
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Detected Text</div>
        <div class="bg-slate-50 p-2 rounded border border-slate-100 text-xs font-mono text-slate-700 break-all leading-relaxed">
          {{ data.text || 'Waiting for input...' }}
        </div>
      </div>

      <!-- 4. AI 标签展示 (Classify | Detect | Custom) -->
      <div v-else-if="['NeuralNetworkClassify', 'NeuralNetworkDetect', 'Custom'].includes(data.type)" class="text-center">
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
          <component :is="config.icon" :size="12" :class="config.text" />
          <span class="text-xs font-bold text-slate-600">{{ data.modelLabel || 'No Model' }}</span>
        </div>
        <div class="mt-2 text-[10px] text-slate-400">Confidence: {{ data.confidence || 0 }}%</div>
      </div>

      <!-- 5. 默认 DirectHit (展示简单信息) -->
      <div v-else class="text-center space-y-2">
        <div class="text-xs text-slate-500">通用匹配节点</div>
        <div class="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 w-2/3"></div>
        </div>
      </div>

    </div>

    <!-- 底部输出端口 -->
    <div class="flex h-6 w-full border-t border-slate-100 divide-x divide-slate-100">
      <div class="flex-1 relative group/handle cursor-crosshair hover:bg-blue-50 transition-colors">
        <Handle id="source-a" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover/handle:!opacity-50 !bg-blue-400 !transition-opacity" />
        <div class="absolute bottom-0 w-full h-1 bg-blue-200 group-hover/handle:bg-blue-500 transition-colors rounded-bl-xl"></div>
      </div>
      <div class="flex-1 relative group/handle cursor-crosshair hover:bg-amber-50 transition-colors">
        <Handle id="source-b" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover/handle:!opacity-50 !bg-amber-400 !transition-opacity" />
        <div class="absolute bottom-0 w-full h-1 bg-amber-200 group-hover/handle:bg-amber-500 transition-colors"></div>
      </div>
      <div class="flex-1 relative group/handle cursor-crosshair hover:bg-rose-50 transition-colors">
        <Handle id="source-c" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover/handle:!opacity-50 !bg-rose-400 !transition-opacity" />
        <div class="absolute bottom-0 w-full h-1 bg-rose-200 group-hover/handle:bg-rose-500 transition-colors rounded-br-xl"></div>
      </div>
    </div>
  </div>
</template>

<style>
.vue-flow__node-custom .vue-flow__handle { border: none; min-width: 0; min-height: 0; }
</style>