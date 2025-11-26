<script setup>
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import {
  // 节点类型图标
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2,
  // 状态图标
  Loader2, AlertCircle, Ban, CheckCircle2,
  // UI 工具图标
  X, FileJson, Activity, Table2
} from 'lucide-vue-next'

const props = defineProps({
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

// --- 弹窗状态控制 ---
const showDetails = ref(false)       // 双击显示的节点详情 (JSON)
const showStatusDetails = ref(false) // 点击状态图标显示的识别详情 (Table)

const toggleDetails = () => { showDetails.value = !showDetails.value }
const toggleStatusDetails = () => { showStatusDetails.value = !showStatusDetails.value }

// --- 节点类型配置 (8种) ---
const nodeConfig = {
  'DirectHit':             { label: '通用匹配', icon: Target,    color: 'bg-blue-500',    text: 'text-blue-600',    border: 'border-blue-200' },
  'TemplateMatch':         { label: '模板匹配', icon: Image,     color: 'bg-indigo-500',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  'FeatureMatch':          { label: '特征匹配', icon: Sparkles,  color: 'bg-violet-500',  text: 'text-violet-600',  border: 'border-violet-200' },
  'ColorMatch':            { label: '颜色识别', icon: Palette,   color: 'bg-pink-500',    text: 'text-pink-600',    border: 'border-pink-200' },
  'OCR':                   { label: 'OCR识别',  icon: ScanText,  color: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200' },
  'NeuralNetworkClassify': { label: '模型 分类',  icon: Brain,     color: 'bg-amber-500',   text: 'text-amber-600',   border: 'border-amber-200' },
  'NeuralNetworkDetect':   { label: '模型 检测',  icon: ScanEye,   color: 'bg-orange-500',  text: 'text-orange-600',  border: 'border-orange-200' },
  'Custom':                { label: '自定义',   icon: Code2,     color: 'bg-slate-500',   text: 'text-slate-600',   border: 'border-slate-200' },
}

const config = computed(() => nodeConfig[props.data.type] || nodeConfig['DirectHit'])

// --- 状态图标配置 ---
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

// --- 容器样式 ---
const containerClass = computed(() => [
  'w-[280px] bg-white rounded-xl shadow-lg border-2 transition-all duration-200 overflow-visible group relative',
  props.selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-500' : 'border-slate-100 hover:border-slate-300'
])

// --- JSON 格式化 ---
const formattedJson = computed(() => {
  const { ...displayData } = props.data
  return JSON.stringify(displayData, null, 2)
})

// --- 表格数据计算 ---
// 优先显示 data.results (由"调试"生成)，否则显示静态模拟数据
const recognitionTable = computed(() => {
  if (props.data.results && Array.isArray(props.data.results)) {
    return props.data.results
  }

  // 默认占位数据
  switch (props.data.type) {
    case 'TemplateMatch':
    case 'FeatureMatch':
      return [
        { key: 'Score', value: props.data.confidence || '0.98' },
        { key: 'Position X', value: '124.5' },
        { key: 'Position Y', value: '88.2' },
        { key: 'Rotation', value: '0.5°' },
        { key: 'Time', value: '12ms' }
      ]
    case 'ColorMatch':
      return [
        { key: 'Found Color', value: '#EC4899' },
        { key: 'Area', value: '1200 px' },
        { key: 'Result', value: 'Pass' }
      ]
    case 'OCR':
      return [
        { key: 'Text', value: props.data.text || 'ABC-1234' },
        { key: 'Confidence', value: '99.1%' },
        { key: 'Language', value: 'ENG' }
      ]
    case 'NeuralNetworkClassify':
    case 'NeuralNetworkDetect':
      return [
        { key: 'Class', value: props.data.modelLabel || 'Defect_A' },
        { key: 'Confidence', value: (props.data.confidence || 95) + '%' },
        { key: 'Inference', value: '45ms' }
      ]
    default:
      return [
        { key: 'Status', value: props.data.status || 'Unknown' },
        { key: 'Message', value: 'No detailed results.' }
      ]
  }
})
</script>

<template>
  <div :class="containerClass" @dblclick="toggleDetails">

    <!-- ================= 弹窗 1: 节点详细信息 (JSON) ================= -->
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
              <div class="text-xs text-slate-500 mb-1">节点 ID</div>
              <div class="font-mono text-sm font-semibold text-slate-700 truncate" :title="data.id">{{ data.id }}</div>
            </div>
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div class="text-xs text-slate-500 mb-1">类型</div>
              <div class="text-sm font-semibold text-slate-700">{{ config.label }}</div>
            </div>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2 text-slate-500"><FileJson :size="14" /><span class="text-xs font-bold uppercase">Raw Data</span></div>
            <div class="bg-slate-900 rounded-lg p-3 overflow-hidden"><pre class="font-mono text-xs text-green-400 whitespace-pre-wrap break-all leading-relaxed">{{ formattedJson }}</pre></div>
          </div>
          <div class="border-t border-slate-100 pt-3 mt-auto"><div class="flex items-center gap-2 text-xs text-slate-400"><Activity :size="14" /><span>Last updated: just now</span></div></div>
        </div>
      </div>
    </transition>

    <!-- ================= 弹窗 2: 识别详情 (Table) ================= -->
    <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-2" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-2">
      <div v-if="showStatusDetails" class="absolute left-[105%] top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-[60] nodrag cursor-default flex flex-col overflow-hidden" style="min-height: 300px;" @click.stop>
        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div class="flex items-center gap-2"><Table2 class="w-5 h-5 text-slate-600" /><span class="font-bold text-slate-700">识别详情</span></div>
          <button class="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors" @click.stop="showStatusDetails = false"><X :size="18" /></button>
        </div>
        <div class="p-0 overflow-y-auto max-h-[400px]">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0"><tr><th class="px-4 py-3 font-medium border-b border-slate-100">Item</th><th class="px-4 py-3 font-medium border-b border-slate-100">Value</th></tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(row, index) in recognitionTable" :key="index" class="hover:bg-slate-50/50 transition-colors">
                <td class="px-4 py-2.5 font-medium text-slate-600">{{ row.key }}</td>
                <td class="px-4 py-2.5 font-mono text-slate-500">{{ row.value }}</td>
              </tr>
              <tr v-if="recognitionTable.length === 0"><td colspan="2" class="px-4 py-4 text-center text-slate-400 text-xs italic">暂无数据</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-auto px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
          <span>{{ recognitionTable.length }} items</span>
          <span v-if="data.status" class="uppercase font-bold" :class="statusConfig?.color">{{ data.status }}</span>
        </div>
      </div>
    </transition>

    <!-- ================= 节点本体 ================= -->

    <!-- 输入端口 -->
    <Handle id="in" type="target" :position="Position.Top" class="!w-16 !h-3 !rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200" style="top: -6px; left: 50%; transform: translate(-50%, 0);" />

    <!-- 头部区域 -->
    <div class="flex items-center justify-between px-4 py-3 bg-slate-50/50 rounded-t-xl border-b border-slate-100">
      <div class="flex items-center">
        <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.color]">
          <component :is="config.icon" :size="18" />
        </div>
        <div>
          <div class="font-bold text-slate-700 text-sm">{{ config.label }}</div>
          <div class="text-[10px] text-slate-400 font-mono">ID: {{ data.id }}</div>
        </div>
      </div>
      <!-- 右侧：状态图标 (点击展示表格) -->
      <div
        v-if="statusConfig"
        class="flex items-center cursor-pointer p-1 -mr-1 rounded-md hover:bg-slate-200/50 transition-colors active:scale-95"
        :title="'点击查看 ' + statusConfig.tooltip + ' 详情'"
        @click.stop="toggleStatusDetails"
        @dblclick.stop
      >
        <component :is="statusConfig.icon" :size="18" :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']" />
      </div>
    </div>

    <!-- 内容展示区域 -->
    <div class="p-4 bg-white min-h-[80px] flex flex-col justify-center">

      <!-- Template / Feature -->
      <div v-if="['TemplateMatch', 'FeatureMatch'].includes(data.type)" class="space-y-2">
        <div class="w-full h-16 bg-slate-100 rounded-lg border border-slate-200 border-dashed flex items-center justify-center text-slate-400 overflow-hidden relative group/img">
          <component :is="config.icon" :size="24" class="opacity-20 group-hover/img:scale-110 transition-transform" />
          <span class="text-[10px] absolute bottom-1">Image Preview</span>
        </div>
        <div class="text-xs text-center text-slate-500 truncate">{{ data.imageName || 'unknown.png' }}</div>
      </div>

      <!-- Color -->
      <div v-else-if="data.type === 'ColorMatch'" class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg shadow-sm border border-slate-100 ring-2 ring-white" :style="{ backgroundColor: data.targetColor || '#000000' }"></div>
        <div class="flex flex-col"><span class="text-xs text-slate-400">Target HEX</span><span class="font-mono text-sm font-bold text-slate-700">{{ data.targetColor || '#N/A' }}</span></div>
      </div>

      <!-- OCR -->
      <div v-else-if="data.type === 'OCR'" class="space-y-1">
        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Detected Text</div>
        <div class="bg-slate-50 p-2 rounded border border-slate-100 text-xs font-mono text-slate-700 break-all leading-relaxed">{{ data.text || 'Waiting for input...' }}</div>
      </div>

      <!-- AI / Custom -->
      <div v-else-if="['NeuralNetworkClassify', 'NeuralNetworkDetect', 'Custom'].includes(data.type)" class="text-center">
        <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
          <component :is="config.icon" :size="12" :class="config.text" />
          <span class="text-xs font-bold text-slate-600">{{ data.modelLabel || 'No Model' }}</span>
        </div>
        <div class="mt-2 text-[10px] text-slate-400">Confidence: {{ data.confidence || 0 }}%</div>
      </div>

      <!-- Default -->
      <div v-else class="text-center space-y-2">
        <div class="text-xs text-slate-500">通用匹配节点</div>
        <div class="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-blue-500 w-2/3"></div></div>
      </div>

    </div>

    <!-- 底部端口 (A: Blue, B: Amber, C: Rose) -->
    <div class="flex h-6 w-full border-t border-slate-100 divide-x divide-slate-100">
      <div class="flex-1 relative group/handle cursor-crosshair hover:bg-blue-50 transition-colors"><Handle id="source-a" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover/handle:!opacity-50 !bg-blue-400 !transition-opacity" /><div class="absolute bottom-0 w-full h-1 bg-blue-200 group-hover/handle:bg-blue-500 transition-colors rounded-bl-xl"></div></div>
      <div class="flex-1 relative group/handle cursor-crosshair hover:bg-amber-50 transition-colors"><Handle id="source-b" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover/handle:!opacity-50 !bg-amber-400 !transition-opacity" /><div class="absolute bottom-0 w-full h-1 bg-amber-200 group-hover/handle:bg-amber-500 transition-colors"></div></div>
      <div class="flex-1 relative group/handle cursor-crosshair hover:bg-rose-50 transition-colors"><Handle id="source-c" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover/handle:!opacity-50 !bg-rose-400 !transition-opacity" /><div class="absolute bottom-0 w-full h-1 bg-rose-200 group-hover/handle:bg-rose-500 transition-colors rounded-br-xl"></div></div>
    </div>

  </div>
</template>

<style>
/* 强制覆盖 Vue Flow 样式 */
.vue-flow__node-custom .vue-flow__handle { border: none; min-width: 0; min-height: 0; }
</style>