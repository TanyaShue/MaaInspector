<script setup>
import NodeRecognition from '../NodeDetailsModals/NodeRecognition.vue'

const props = defineProps({
  currentRecognition: String,
  recognitionConfig: Object,
  form: Object,
})

const emit = defineEmits(['open-picker', 'open-image-manager'])
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <component :is="recognitionConfig?.icon" v-if="recognitionConfig?.icon" :size="14" :class="recognitionConfig?.color" />
      <span>{{ recognitionConfig?.label }} 属性</span>
      <span class="text-[10px] text-slate-400">({{ recognitionConfig?.value }})</span>
    </div>

    <div v-if="currentRecognition === 'DirectHit'" class="text-[12px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
      直达模式无需额外识别配置。
    </div>
    <div v-else class="rounded-xl border border-slate-100 overflow-hidden">
      <NodeRecognition
        :currentType="currentRecognition"
        :form="form"
        @open-picker="emit('open-picker', $event)"
        @open-image-manager="emit('open-image-manager')"
      />
    </div>
  </div>
</template>
