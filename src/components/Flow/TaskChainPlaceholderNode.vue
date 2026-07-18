<script setup lang="ts">
import { computed } from 'vue'
import type { FlowNodeMeta } from '@/utils/flowTypes'

const props = defineProps<{
  id: string
  data: FlowNodeMeta
}>()

const displayId = computed(() =>
  props.data._originalId || props.data.data?.id || props.id
)
</script>

<template>
  <div
    class="task-chain-placeholder flex h-[150px] w-[280px] items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-100/80"
  >
    <div class="max-w-[230px] text-center">
      <div class="truncate font-mono text-xs font-semibold text-slate-500">
        {{ displayId }}
      </div>
      <div class="mt-1 text-[10px] text-slate-400">
        任务链外节点
      </div>
    </div>
  </div>
</template>
