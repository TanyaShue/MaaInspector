<script setup lang="ts">
import { toRefs } from 'vue'
import { AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  jsonStr?: string
  jsonError?: string
}>()

const { jsonStr, jsonError } = toRefs(props)

const emit = defineEmits<{
  (e: 'input', value: string): void
}>()
</script>

<template>
  <div class="absolute inset-0 z-10 w-full h-full p-3 flex flex-col bg-white overflow-hidden">
    <div class="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex flex-col relative">
      <textarea
        class="w-full h-full bg-transparent text-[10px] font-mono text-green-400 p-3 outline-none resize-none custom-scrollbar-dark"
        :value="jsonStr"
        @input="emit('input', ( $event.target as HTMLTextAreaElement | null)?.value ?? '' )"
        spellcheck="false"
      ></textarea>
      <div
        v-if="jsonError"
        class="absolute bottom-3 left-3 right-3 bg-red-500/90 text-white px-3 py-2 rounded-lg backdrop-blur-sm shadow-lg flex items-start gap-2 z-10"
      >
        <AlertCircle :size="16" class="shrink-0 mt-0.5" />
        <div class="text-[10px] font-mono break-all leading-tight">{{ jsonError }}</div>
      </div>
    </div>
    <div class="mt-2 text-[10px] text-slate-400 text-center shrink-0">编辑后自动保存，格式错误将不会生效</div>
  </div>
</template>
