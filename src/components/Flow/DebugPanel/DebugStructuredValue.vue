<script setup lang="ts">
  import { computed } from 'vue'
  import { ChevronRight, Copy } from 'lucide-vue-next'

  defineOptions({ name: 'DebugStructuredValue' })

  const props = withDefaults(
    defineProps<{
      label: string
      value: unknown
      depth?: number
      defaultOpen?: boolean
    }>(),
    {
      depth: 0,
      defaultOpen: false,
    }
  )

  const emit = defineEmits<{
    (e: 'copy', text: string): void
  }>()

  const isObject = computed(() => Boolean(props.value && typeof props.value === 'object'))
  const entries = computed(() => {
    if (Array.isArray(props.value)) {
      return props.value.map((value, index) => [`#${index + 1}`, value] as const)
    }
    if (isObject.value) return Object.entries(props.value as Record<string, unknown>)
    return []
  })
  const formattedValue = computed(() => {
    if (typeof props.value === 'string') return props.value
    if (props.value === undefined) return 'undefined'
    if (props.value === null) return 'null'
    if (typeof props.value === 'object') return JSON.stringify(props.value, null, 2)
    return String(props.value)
  })
  const typeLabel = computed(() => {
    if (Array.isArray(props.value)) return `数组 · ${props.value.length}`
    if (isObject.value) return `对象 · ${entries.value.length}`
    if (typeof props.value === 'boolean') return props.value ? 'true' : 'false'
    return typeof props.value
  })
</script>

<template>
  <details
    v-if="isObject"
    class="structured-card group/structure"
    :open="defaultOpen"
  >
    <summary class="structured-header">
      <ChevronRight
        :size="12"
        class="shrink-0 text-slate-400 transition-transform group-open/structure:rotate-90"
      />
      <span class="min-w-0 flex-1 truncate font-medium text-slate-700">{{ label }}</span>
      <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-400">
        {{ typeLabel }}
      </span>
      <button
        type="button"
        class="copy-button"
        title="复制此结构"
        @click.prevent.stop="emit('copy', formattedValue)"
      >
        <Copy :size="10" />
      </button>
    </summary>
    <div class="space-y-1.5 border-t border-slate-100 p-2" :class="depth > 0 ? 'bg-slate-50/60' : ''">
      <DebugStructuredValue
        v-for="[key, childValue] in entries"
        :key="key"
        :label="key"
        :value="childValue"
        :depth="depth + 1"
        :default-open="depth < 1"
        @copy="emit('copy', $event)"
      />
      <div v-if="entries.length === 0" class="py-2 text-center text-[10px] text-slate-400">
        空结构
      </div>
    </div>
  </details>

  <div v-else class="structured-leaf">
    <span class="min-w-0 shrink-0 text-slate-500">{{ label }}</span>
    <code
      class="min-w-0 flex-1 whitespace-pre-wrap break-all text-right"
      :class="typeof value === 'boolean'
        ? value ? 'text-emerald-600' : 'text-rose-500'
        : 'text-slate-700'"
    >{{ formattedValue }}</code>
    <button
      type="button"
      class="copy-button shrink-0"
      :title="`复制 ${label}`"
      @click="emit('copy', formattedValue)"
    >
      <Copy :size="10" />
    </button>
  </div>
</template>

<style scoped>
  .structured-card {
    @apply overflow-hidden rounded-lg border border-slate-200 bg-white;
  }

  .structured-header {
    @apply flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-2 text-[10px] transition-colors hover:bg-slate-50;
  }

  .structured-header::-webkit-details-marker {
    display: none;
  }

  .structured-leaf {
    @apply flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-[10px];
  }

  .copy-button {
    @apply flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600;
  }
</style>
