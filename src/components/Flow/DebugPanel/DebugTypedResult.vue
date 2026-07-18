<script setup lang="ts">
  import { computed } from 'vue'
  import { Box, Copy, Hash, ScanText, Sparkles } from 'lucide-vue-next'
  import {
    actionResultFieldOrder,
    recognitionResultKind,
    resultFieldLabel,
  } from '@/utils/debugResultAdapter'
  import { formatDebugRect } from '@/utils/debugDetailPresentation'
  import DebugStructuredValue from './DebugStructuredValue.vue'

  const props = defineProps<{
    mode: 'recognition' | 'action'
    type: string
    value: unknown
    label: string
  }>()
  const emit = defineEmits<{ (event: 'copy', text: string): void }>()

  const objectValue = computed<Record<string, unknown>>(() =>
    typeof props.value === 'object' && props.value !== null && !Array.isArray(props.value)
      ? (props.value as Record<string, unknown>)
      : {}
  )
  const recognitionKind = computed(() => recognitionResultKind(props.type))
  const actionOrder = computed(() => actionResultFieldOrder[props.type] || [])
  const emphasizedKeys = computed(() => {
    if (props.mode === 'action') return actionOrder.value
    if (recognitionKind.value === 'ocr') return ['text', 'score', 'box']
    if (recognitionKind.value === 'score') return ['score', 'box']
    if (recognitionKind.value === 'count') return ['count', 'box']
    if (recognitionKind.value === 'neural') return ['label', 'cls_index', 'score', 'box']
    if (recognitionKind.value === 'composite') return ['algorithm', 'hit', 'box']
    if (recognitionKind.value === 'custom') return ['box', 'detail']
    return ['box']
  })
  const prominentEntries = computed(() =>
    emphasizedKeys.value
      .filter((key) => objectValue.value[key] !== undefined)
      .map((key) => [key, objectValue.value[key]] as const)
  )
  const remainingValue = computed(() => {
    if (!Object.keys(objectValue.value).length) return props.value
    const emphasized = new Set(emphasizedKeys.value)
    return Object.fromEntries(
      Object.entries(objectValue.value).filter(([key]) => !emphasized.has(key))
    )
  })
  const hasRemaining = computed(() => {
    if (
      typeof remainingValue.value === 'object' &&
      remainingValue.value !== null &&
      !Array.isArray(remainingValue.value)
    ) {
      return Object.keys(remainingValue.value as Record<string, unknown>).length > 0
    }
    return remainingValue.value !== undefined && remainingValue.value !== null
  })
  const stringify = (value: unknown) => {
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  const displayValue = (key: string, value: unknown) => {
    if (key === 'box' || key === 'point' || key === 'begin') return formatDebugRect(value)
    if (key === 'score' && typeof value === 'number') return `${(value * 100).toFixed(2)}%`
    if (key === 'duration' || key === 'shell_timeout' || key === 'starting')
      return `${String(value)} ms`
    if (typeof value === 'boolean') return value ? '是' : '否'
    return stringify(value)
  }
  const accentClass = computed(() => {
    if (props.mode === 'action') return 'border-violet-200 bg-violet-50/50'
    if (recognitionKind.value === 'ocr') return 'border-cyan-200 bg-cyan-50/60'
    if (recognitionKind.value === 'neural') return 'border-fuchsia-200 bg-fuchsia-50/50'
    if (recognitionKind.value === 'count') return 'border-orange-200 bg-orange-50/50'
    if (recognitionKind.value === 'composite') return 'border-indigo-200 bg-indigo-50/50'
    return 'border-blue-200 bg-blue-50/40'
  })
  const fieldGridClass = (key: string) => {
    if (['text', 'output', 'end', 'swipes', 'detail'].includes(key)) return 'col-span-12'
    if (key === 'score') return 'col-span-3'
    if (key === 'box') return 'col-span-9'
    return 'col-span-6'
  }
</script>

<template>
  <article class="overflow-hidden rounded-lg border" :class="accentClass">
    <div class="flex items-center gap-1.5 border-b border-white/80 px-2.5 py-2">
      <ScanText v-if="recognitionKind === 'ocr'" :size="12" class="text-cyan-600" />
      <Sparkles v-else-if="recognitionKind === 'neural'" :size="12" class="text-fuchsia-600" />
      <Box v-else :size="12" class="text-slate-500" />
      <span class="text-[10px] font-semibold text-slate-700">{{ label }}</span>
      <span class="ml-auto rounded bg-white/80 px-1.5 py-0.5 font-mono text-[8px] text-slate-400">
        {{ type }}
      </span>
      <button
        class="copy-result"
        title="复制完整结果"
        @click="emit('copy', stringify(value))"
      >
        <Copy :size="10" />
      </button>
    </div>

    <div v-if="prominentEntries.length" class="grid grid-cols-12 gap-1.5 p-2">
      <div
        v-for="[key, fieldValue] in prominentEntries"
        :key="key"
        class="group relative min-w-0 rounded-md border border-white bg-white/75 px-2 py-1.5"
        :class="fieldGridClass(key)"
      >
        <div class="flex items-center gap-1 text-[8px] font-medium text-slate-400">
          <Hash :size="8" />{{ resultFieldLabel(key) }}
          <button
            class="copy-result ml-auto opacity-0 group-hover:opacity-100"
            :title="`复制 ${key}`"
            @click="emit('copy', stringify(fieldValue))"
          >
            <Copy :size="9" />
          </button>
        </div>
        <div
          class="mt-0.5 whitespace-pre-wrap break-all font-mono text-[10px] text-slate-700"
          :class="{ 'text-sm font-semibold text-cyan-700': key === 'text' }"
        >
          {{ displayValue(key, fieldValue) }}
        </div>
      </div>
    </div>

    <div v-if="hasRemaining" class="border-t border-white/80 p-2">
      <DebugStructuredValue
        label="其他字段"
        :value="remainingValue"
        :default-open="false"
        @copy="emit('copy', $event)"
      />
    </div>
    <div
      v-if="!prominentEntries.length && !hasRemaining"
      class="px-3 py-4 text-center text-[10px] text-slate-400"
    >
      此类型没有额外返回字段
    </div>
  </article>
</template>

<style scoped>
  .copy-result {
    @apply flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-white hover:text-indigo-600;
  }
</style>
