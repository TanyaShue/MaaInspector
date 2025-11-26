<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Cpu, Database, Mail, PlayCircle, GitBranch } from 'lucide-vue-next'

const props = defineProps({
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

// 节点主体颜色配置 (保持原样，用于头部和内容)
const nodeConfig = {
  'trigger':  { color: 'bg-blue-500', text: 'text-blue-600', icon: PlayCircle, label: '触发器' },
  'process':  { color: 'bg-indigo-500', text: 'text-indigo-600', icon: Cpu, label: '数据处理' },
  'decision': { color: 'bg-amber-500', text: 'text-amber-600', icon: GitBranch, label: '逻辑判断' },
  'storage':  { color: 'bg-emerald-500', text: 'text-emerald-600', icon: Database, label: '数据存储' },
  'notify':   { color: 'bg-rose-500', text: 'text-rose-600', icon: Mail, label: '消息通知' },
}

const config = computed(() => nodeConfig[props.data.type] || nodeConfig['process'])

const containerClass = computed(() => [
  'w-[280px] bg-white rounded-xl shadow-lg border-2 transition-all duration-200 overflow-visible group',
  props.selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-500' : 'border-slate-100 hover:border-slate-300'
])
</script>

<template>
  <div :class="containerClass">

    <!-- 输入端口 (顶部) -->
    <Handle
      id="in"
      type="target"
      :position="Position.Top"
      class="!w-12 !h-3 !rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200"
      style="top: -6px; left: 50%; transform: translate(-50%, 0);"
    />

    <!-- 节点头部 -->
    <div class="flex items-center px-4 py-3 bg-slate-50/50 rounded-t-xl border-b border-slate-100">
      <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.color]">
        <component :is="config.icon" :size="18" />
      </div>
      <div>
        <div class="font-bold text-slate-700 text-sm">{{ config.label }}</div>
        <div class="text-[10px] text-slate-400 font-mono">ID: {{ data.id }}</div>
      </div>
    </div>

    <!-- 节点内容 (简化展示，重点在端口) -->
    <div class="p-4 bg-white min-h-[60px] text-xs text-slate-500">
      <div v-if="data.type === 'trigger'">🕒 {{ data.cron }}</div>
      <div v-else-if="data.type === 'process'">进度: {{ data.progress }}%</div>
      <div v-else-if="data.type === 'decision'">IF: {{ data.condition }}</div>
      <div v-else>{{ data.label || '暂无详细数据' }}</div>
    </div>

    <!--
      底部输出端口区域
      A: 蓝色 (Primary)
      B: 橙色 (Warning)
      C: 红色 (Danger)
    -->
    <div class="flex h-8 w-full border-t border-slate-100 divide-x divide-slate-100 rounded-b-xl overflow-hidden">

      <!-- 端口 A (蓝色) -->
      <div class="flex-1 relative group/handle hover:bg-blue-50 transition-colors">
        <span class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold pointer-events-none group-hover/handle:text-blue-600">A</span>
        <Handle
          id="source-a"
          type="source"
          :position="Position.Bottom"
          class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 !bg-blue-500 transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-blue-200 group-hover/handle:bg-blue-500 transition-colors"></div>
      </div>

      <!-- 端口 B (橙色) -->
      <div class="flex-1 relative group/handle hover:bg-amber-50 transition-colors">
        <span class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold pointer-events-none group-hover/handle:text-amber-600">B</span>
        <Handle
          id="source-b"
          type="source"
          :position="Position.Bottom"
          class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 !bg-amber-500 transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-amber-200 group-hover/handle:bg-amber-500 transition-colors"></div>
      </div>

      <!-- 端口 C (红色) -->
      <div class="flex-1 relative group/handle hover:bg-rose-50 transition-colors">
        <span class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold pointer-events-none group-hover/handle:text-rose-600">C</span>
        <Handle
          id="source-c"
          type="source"
          :position="Position.Bottom"
          class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 !bg-rose-500 transition-opacity"
        />
        <div class="absolute bottom-0 w-full h-1 bg-rose-200 group-hover/handle:bg-rose-500 transition-colors"></div>
      </div>

    </div>
  </div>
</template>

<style>
/* 必须保留，用于覆盖 Vue Flow 默认样式 */
.vue-flow__node-custom .vue-flow__handle {
  border: none;
  min-width: 0;
  min-height: 0;
}
</style>