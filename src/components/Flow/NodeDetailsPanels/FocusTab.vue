<script setup lang="ts">
import { Plus, Info, X } from 'lucide-vue-next'

type FocusRecord = Record<string, string>

const props = withDefaults(defineProps<{
  focusData: FocusRecord
  availableFocusEvents: string[]
  isDropdownOpen: boolean
}>(), {
  focusData: () => ({}),
  availableFocusEvents: () => [],
  isDropdownOpen: false
})

const emit = defineEmits<{
  (e: 'toggle-dropdown'): void
  (e: 'add-focus', type: string): void
  (e: 'remove-focus', key: string): void
  (e: 'update-focus', payload: { key: string; value: string }): void
}>()
void props
void emit

const getInputValue = (event: Event) => (event.target as HTMLInputElement | null)?.value ?? ''
</script>

<template>
  <div class="p-3 space-y-3">
    <div
      v-for="(msg, key) in focusData"
      :key="key"
      class="space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100 relative group"
    >
      <div class="flex justify-between items-center">
        <div class="text-[10px] font-bold text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded">
          {{ key }}
        </div>
        <button @click="emit('remove-focus', key)" class="text-slate-300 hover:text-red-500">
          <X :size="12" />
        </button>
      </div>
      <input
        :value="msg"
        @input="emit('update-focus', { key, value: getInputValue($event) })"
        class="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:border-pink-300 outline-none"
        placeholder="消息模板..."
      />
    </div>

    <div class="relative" v-if="availableFocusEvents.length > 0">
      <button
        @click="emit('toggle-dropdown')"
        class="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-pink-300 hover:text-pink-500 outline-none cursor-pointer transition-colors"
      >
        <Plus :size="12" />
        添加回调事件
      </button>
      <div
        v-if="isDropdownOpen"
        class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar-dark flex flex-col py-1 z-[60]"
      >
        <button
          v-for="t in availableFocusEvents"
          :key="t"
          @click="emit('add-focus', t)"
          class="px-3 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {{ t }}
        </button>
      </div>
    </div>
    <div v-else class="text-center text-[10px] text-slate-400 py-1">已添加所有可用事件</div>

    <div class="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100">
      <Info :size="12" class="text-slate-400 mt-0.5 shrink-0" />
      <div class="space-y-1">
        <div class="text-[10px] text-slate-500 font-medium">可用占位符：</div>
        <div class="text-[10px] font-mono text-slate-400 break-all leading-relaxed select-all">
          {name}, {task_id}, {reco_id}, {action_id}
        </div>
      </div>
    </div>
  </div>
</template>
