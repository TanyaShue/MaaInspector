<script setup lang="ts">
import { ref } from 'vue'
import { Crop, Crosshair, ChevronDown } from 'lucide-vue-next'
import { orderByOptions } from '@/utils/node-config'
import type { NodeFormMethods } from '@/composables/useNodeForm'
import FloatingDropdownMenu from '@/components/Flow/Common/FloatingDropdownMenu.vue'

const props = defineProps<{
  form: NodeFormMethods
}>()

const emit = defineEmits<{
  (e: 'open-picker', field: string, referenceField: string | null, referenceLabel: string): void
}>()

const { getValue, setValue, getJsonValue, setJsonValue } = props.form

const getInputValue = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ''

const isOrderByDropdownOpen = ref(false)
const orderByAnchor = ref<HTMLElement | null>(null)

const selectOrderBy = (val: string) => {
  setValue('order_by', val)
  isOrderByDropdownOpen.value = false
}
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <div class="space-y-1">
      <label class="text-[10px] font-semibold text-slate-500 uppercase">识别区域 (ROI)</label>
      <div class="flex gap-1">
        <input
          :value="getJsonValue('roi')"
          class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
          placeholder="[x,y,w,h]"
          @input="setJsonValue('roi', getInputValue($event))"
        >
        <button
          class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"
          @click="emit('open-picker', 'roi', null, 'ROI')"
        >
          <Crop :size="12" />
        </button>
      </div>
    </div>
    <div class="space-y-1">
      <label class="text-[10px] font-semibold text-slate-500 uppercase">区域偏移</label>
      <div class="flex gap-1">
        <input
          :value="getJsonValue('roi_offset')"
          class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
          placeholder="[x,y,w,h]"
          @input="setJsonValue('roi_offset', getInputValue($event))"
        >
        <button
          class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"
          @click="emit('open-picker', 'roi_offset', 'roi', 'ROI区域')"
        >
          <Crosshair :size="12" />
        </button>
      </div>
    </div>

    <div class="space-y-1 relative">
      <label class="text-[10px] font-semibold text-slate-500 uppercase">排序方式</label>
      <button
        ref="orderByAnchor"
        class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left"
        @click="isOrderByDropdownOpen = !isOrderByDropdownOpen"
      >
        <span class="truncate">
          {{ orderByOptions.find(o => o.value === getValue('order_by', 'Horizontal'))?.label || getValue('order_by') }}
        </span>
        <ChevronDown
          :size="12"
          class="text-slate-400"
          :class="{ 'rotate-180': isOrderByDropdownOpen }"
        />
      </button>
      <FloatingDropdownMenu
        :open="isOrderByDropdownOpen"
        :anchor="orderByAnchor"
        :max-height="200"
      >
        <div class="flex flex-col py-1">
          <button
            v-for="opt in orderByOptions"
            :key="opt.value"
            class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
            :class="getValue('order_by', 'Horizontal') === opt.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'"
            @click="selectOrderBy(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </FloatingDropdownMenu>
    </div>
    <div class="space-y-1">
      <label class="text-[10px] font-semibold text-slate-500 uppercase">结果索引</label>
      <input
        type="number"
        :value="getValue('index', 0)"
        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"
        @input="setValue('index', parseInt(getInputValue($event)) || 0)"
      >
    </div>
  </div>
</template>
