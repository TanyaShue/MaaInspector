<script setup>
import NodeAction from '../NodeDetailsModals/NodeAction.vue'

const props = defineProps({
  currentAction: String,
  actionConfig: Object,
  form: Object,
})

const emit = defineEmits(['open-picker'])
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <component :is="actionConfig?.icon" v-if="actionConfig?.icon" :size="14" :class="actionConfig?.color" />
      <span>{{ actionConfig?.label }} 属性</span>
      <span class="text-[10px] text-slate-400">({{ actionConfig?.value }})</span>
    </div>

    <div
      v-if="['DoNothing', 'StopTask'].includes(currentAction)"
      class="text-[12px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2"
    >
      当前动作无需额外配置。
    </div>
    <div v-else class="rounded-xl border border-slate-100 overflow-hidden">
      <NodeAction
        :currentType="currentAction"
        :form="form"
        @open-picker="(...args) => emit('open-picker', ...args)"
      />
    </div>
  </div>
</template>
