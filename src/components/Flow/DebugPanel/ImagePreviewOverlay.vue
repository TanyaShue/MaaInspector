<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  visible: boolean
  src: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[140] bg-black/90 flex items-center justify-center p-6"
    @click="handleClose"
  >
    <div class="relative max-w-[90vw] max-h-[90vh]">
      <button
        class="absolute -top-10 right-0 px-3 py-1 rounded bg-white/90 text-slate-700 text-sm shadow hover:bg-white flex items-center gap-1"
        @click.stop="handleClose"
      >
        <X :size="14" />
        <span>关闭</span>
      </button>
      <img
        :src="src"
        alt="full-preview"
        class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        @click.stop
      >
    </div>
  </div>
</template>
