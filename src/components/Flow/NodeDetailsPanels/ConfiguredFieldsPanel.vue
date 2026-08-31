<script setup lang="ts">
import { computed } from 'vue'
import { isSupportedColorMethod, type ColorRangeResult } from '@/utils/colorRange'
import type { NodeFormMethods } from '@/composables/useNodeForm'
import type { PickerPayload } from '@/composables/useDeviceScreenPicker'
import type {
  NodeDetailsFieldAction,
  NodeDetailsLayoutConfig,
  NodeDetailsUiConfig,
  PipelineSchemaDocument,
  ResolvedNodeDetailsField
} from '@/utils/nodeDetailsUi'
import { resolveLayoutFields } from '@/utils/nodeDetailsUi'
import SchemaFieldGrid from './SchemaFieldGrid.vue'

const props = defineProps<{
  title?: string
  subtitle?: string
  columns: number
  layout: NodeDetailsLayoutConfig
  uiConfig: NodeDetailsUiConfig
  pipelineSchema: PipelineSchemaDocument
  form: NodeFormMethods
}>()

const emit = defineEmits<{
  (
    e: 'open-picker',
    payload: string | PickerPayload,
    referenceField?: string | null,
    referenceLabel?: string
  ): void
  (e: 'open-image-manager'): void
}>()

const fields = computed(() => resolveLayoutFields(props.pipelineSchema, props.uiConfig, props.layout))

const handleFieldAction = ({
  field,
  action
}: {
  field: ResolvedNodeDetailsField
  action: NodeDetailsFieldAction
}) => {
  if (action.type === 'image-manager') {
    emit('open-image-manager')
    return
  }
  if (action.type === 'color-range') {
    const method = Number(props.form.getValue('method', 4))
    if (!isSupportedColorMethod(method)) return
    emit('open-picker', {
      field: 'color_range',
      mode: 'color_range',
      method,
      referenceField: 'roi',
      referenceLabel: 'ROI',
      onConfirm: value => {
        const result = value as ColorRangeResult
        if (!Array.isArray(result?.lower) || !Array.isArray(result?.upper)) return
        props.form.setValues({ lower: result.lower, upper: result.upper })
      }
    })
    return
  }
  emit('open-picker', {
    field: field.key,
    mode: action.type === 'ocr' ? 'ocr' : 'coordinate',
    referenceField: action.referenceField ?? null,
    referenceLabel: action.referenceField ? `${action.referenceField} 区域` : field.label
  })
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div v-if="title" class="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <span>{{ title }}</span>
      <span v-if="subtitle" class="text-[10px] font-mono text-slate-400">({{ subtitle }})</span>
    </div>
    <div
      v-if="layout.emptyText && fields.length === 0"
      class="text-[12px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2"
    >
      {{ layout.emptyText }}
    </div>
    <div v-else class="rounded-xl border border-slate-100 p-3">
      <SchemaFieldGrid
        :columns="columns"
        :fields="fields"
        :form="form"
        @field-action="handleFieldAction"
      />
    </div>
  </div>
</template>
