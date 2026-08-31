<script setup lang="ts">
import { computed } from 'vue'
import { Crop, Crosshair, ImageIcon, Pipette, ScanText } from 'lucide-vue-next'
import type { NodeFormMethods } from '@/composables/useNodeForm'
import type {
  NodeDetailsFieldAction,
  ResolvedNodeDetailsField
} from '@/utils/nodeDetailsUi'

const props = defineProps<{
  columns: number
  fields: ResolvedNodeDetailsField[]
  form: NodeFormMethods
}>()

const emit = defineEmits<{
  (e: 'field-action', payload: { field: ResolvedNodeDetailsField; action: NodeDetailsFieldAction }): void
}>()

const { getValue, setValue, setJsonValue, getTargetValue, setTargetValue } = props.form

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`
}))

const fieldStyle = (field: ResolvedNodeDetailsField) => ({
  gridColumn: `span ${Math.min(field.span, props.columns)} / span ${Math.min(field.span, props.columns)}`,
  gridRow: field.rowSpan && field.rowSpan > 1 ? `span ${field.rowSpan} / span ${field.rowSpan}` : undefined
})

const inputClass = 'w-full min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100'
const getInputValue = (event: Event) =>
  (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? ''
const getChecked = (event: Event) => (event.target as HTMLInputElement | null)?.checked ?? false

const numberValue = (field: ResolvedNodeDetailsField) => getValue(field.key, field.defaultValue ?? '')
const textValue = (field: ResolvedNodeDetailsField) => {
  const value = getValue<unknown>(field.key, field.defaultValue)
  return value === undefined || value === null ? '' : String(value)
}
const checkedValue = (field: ResolvedNodeDetailsField) =>
  Boolean(getValue(field.key, field.defaultValue ?? false))
const jsonValue = (field: ResolvedNodeDetailsField) => {
  const raw = getValue<unknown>(field.key, field.defaultValue)
  if (raw === undefined || raw === null) return ''
  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
}
const updateNumber = (field: ResolvedNodeDetailsField, raw: string) => {
  if (!raw.trim()) {
    setValue(field.key, null)
    return
  }
  const value = Number(raw)
  if (!Number.isNaN(value)) setValue(field.key, value)
}

const optionValue = (value: unknown) => JSON.stringify(value)
const selectValue = (field: ResolvedNodeDetailsField) => optionValue(getValue(field.key, field.defaultValue))
const updateSelect = (field: ResolvedNodeDetailsField, raw: string) => {
  try {
    setValue(field.key, JSON.parse(raw))
  } catch {
    setValue(field.key, raw)
  }
}

const actionIcon = (action: NodeDetailsFieldAction) => {
  if (action.type === 'ocr') return ScanText
  if (action.type === 'image-manager') return ImageIcon
  if (action.type === 'color-range') return Pipette
  return action.referenceField ? Crosshair : Crop
}

const actionClass = (action: NodeDetailsFieldAction) => {
  if (action.type === 'ocr') return 'border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100'
  if (action.type === 'image-manager') return 'border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100'
  if (action.type === 'color-range') return 'border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100'
  if (action.referenceField) return 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
  return 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
}
</script>

<template>
  <div class="grid gap-2.5" :style="gridStyle">
    <div
      v-for="field in fields"
      :key="field.key"
      class="min-w-0 space-y-1"
      :style="fieldStyle(field)"
    >
      <label
        v-if="field.control !== 'checkbox' && field.control !== 'action'"
        class="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide"
        :title="field.description"
      >
        <span>{{ field.label }}</span>
        <span v-if="field.required" class="text-rose-400">*</span>
      </label>

      <label v-if="field.control === 'checkbox'" class="inline-flex min-h-8 items-center gap-1.5 cursor-pointer" :title="field.description">
        <input
          type="checkbox"
          :checked="checkedValue(field)"
          class="w-3.5 h-3.5 rounded text-indigo-600"
          @change="setValue(field.key, getChecked($event))"
        >
        <span class="text-[11px] text-slate-600">{{ field.label }}</span>
      </label>

      <div v-else-if="field.control === 'action'" class="pt-1">
        <button
          v-for="action in field.actions || []"
          :key="`${field.key}-${action.type}`"
          class="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium"
          :class="actionClass(action)"
          @click="emit('field-action', { field, action })"
        >
          <component :is="actionIcon(action)" :size="12" />
          {{ action.label }}
        </button>
      </div>

      <div v-else class="flex min-w-0 gap-1">
        <textarea
          v-if="field.control === 'textarea'"
          :value="textValue(field)"
          :class="[inputClass, 'min-h-[62px] resize-y font-mono']"
          @input="setValue(field.key, getInputValue($event))"
        />
        <textarea
          v-else-if="field.control === 'textarea-json'"
          :value="jsonValue(field)"
          :class="[inputClass, 'min-h-[62px] resize-y font-mono']"
          @input="setJsonValue(field.key, getInputValue($event), field.forceString)"
        />
        <select
          v-else-if="field.control === 'select' && field.options.length"
          :value="selectValue(field)"
          :class="inputClass"
          @change="updateSelect(field, getInputValue($event))"
        >
          <option v-for="option in field.options" :key="optionValue(option.value)" :value="optionValue(option.value)">
            {{ option.label }}
          </option>
        </select>
        <input
          v-else-if="field.control === 'number'"
          type="number"
          :value="numberValue(field)"
          :min="field.min ?? field.schema.minimum"
          :max="field.max ?? field.schema.maximum"
          :step="field.step"
          :class="inputClass"
          @input="updateNumber(field, getInputValue($event))"
        >
        <input
          v-else-if="field.control === 'target'"
          :value="getTargetValue(field.key)"
          :placeholder="field.required ? '请输入节点名或坐标' : '留空默认使用自身'"
          :class="[inputClass, 'font-mono']"
          @input="setTargetValue(field.key, getInputValue($event))"
        >
        <input
          v-else-if="field.control === 'json' || (field.control === 'select' && !field.options.length)"
          :value="jsonValue(field)"
          :placeholder="field.required ? '必填；支持 JSON 值' : '支持 JSON 值'"
          :class="[inputClass, 'font-mono']"
          @input="setJsonValue(field.key, getInputValue($event), field.forceString)"
        >
        <input
          v-else
          :value="textValue(field)"
          :class="inputClass"
          @input="setValue(field.key, getInputValue($event))"
        >

        <button
          v-for="action in field.actions || []"
          :key="`${field.key}-${action.type}`"
          class="shrink-0 px-2 border rounded-lg flex items-center justify-center"
          :class="actionClass(action)"
          :title="action.label"
          @click="emit('field-action', { field, action })"
        >
          <component :is="actionIcon(action)" :size="12" />
        </button>
      </div>
      <p v-if="field.description && field.control !== 'checkbox'" class="truncate text-[9px] text-slate-400" :title="field.description">
        {{ field.description }}
      </p>
    </div>
  </div>
</template>
