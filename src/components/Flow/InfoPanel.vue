<script setup>
import { computed } from 'vue'
import { Layers, Network, Activity, MousePointer2 } from 'lucide-vue-next'
import { useVueFlow } from '@vue-flow/core'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] }
})

// 获取 Vue Flow 的实例信息（例如缩放比例）
const { viewport } = useVueFlow()

// 计算缩放百分比
const zoomPercentage = computed(() => {
  return Math.round((viewport.value.zoom || 1) * 100) + '%'
})
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 w-48 flex flex-col gap-2 select-none pointer-events-auto">

    <div class="flex items-center gap-2 pb-2 border-b border-slate-100 mb-1">
      <Activity class="w-4 h-4 text-blue-500" />
      <span class="font-bold text-slate-700 text-xs">画布概览</span>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-slate-500">
          <Layers :size="14" />
          <span>节点数量</span>
        </div>
        <span class="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{{ nodes.length }}</span>
      </div>

      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-slate-500">
          <Network :size="14" />
          <span>连线数量</span>
        </div>
        <span class="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{{ edges.length }}</span>
      </div>

      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2 text-slate-500">
          <MousePointer2 :size="14" />
          <span>当前缩放</span>
        </div>
        <span class="font-mono font-bold text-blue-600">{{ zoomPercentage }}</span>
      </div>
    </div>
  </div>
</template>