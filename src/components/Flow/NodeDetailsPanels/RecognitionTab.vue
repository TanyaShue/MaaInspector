<script setup lang="ts">
import { computed } from 'vue'
import { Pipette } from 'lucide-vue-next'
import type { NodeFormMethods } from '@/composables/useNodeForm'
import type { PickerPayload } from '@/composables/useDeviceScreenPicker'
import { isSupportedColorMethod, type ColorRangeResult } from '@/utils/colorRange'
import type { RecognitionType, SelectOption } from '@/utils/node-config'
import RecognitionCommonFields from './RecognitionCommonFields.vue'
import CompositeRecognitionEditor from './CompositeRecognitionEditor.vue'
import TemplateMatchFields from './TemplateMatchFields.vue'
import FeatureMatchFields from './FeatureMatchFields.vue'
import OcrFields from './OcrFields.vue'
import NeuralNetworkFields from './NeuralNetworkFields.vue'

const props = defineProps<{
  currentRecognition: RecognitionType | string
  recognitionConfig?: SelectOption<string>
  form: NodeFormMethods
}>()

const emit = defineEmits<{
  (e: 'open-picker', payload: string | PickerPayload, referenceField?: string | null, referenceLabel?: string): void
  (e: 'open-image-manager', payload?: { compositeKey?: 'all_of' | 'any_of'; compositeIndex?: number }): void
}>()

const { getValue, setValue, setValues, getJsonValue, setJsonValue } = props.form

const isCompositeRecognition = computed(() => ['And', 'Or'].includes(props.currentRecognition as string))

const getInputValue = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ''
const getChecked = (event: Event) => (event.target as HTMLInputElement | null)?.checked ?? false

const colorMethod = computed(() => Number(getValue('method', 4)))
const canFillColorRange = computed(() => isSupportedColorMethod(colorMethod.value))

const openColorRangePicker = () => {
  if (!canFillColorRange.value) return
  emit('open-picker', {
    field: 'color_range',
    mode: 'color_range',
    method: colorMethod.value,
    referenceField: 'roi',
    referenceLabel: 'ROI',
    onConfirm: (value) => {
      const result = value as ColorRangeResult
      if (!Array.isArray(result?.lower) || !Array.isArray(result?.upper)) return
      setValues({ lower: result.lower, upper: result.upper })
    }
  })
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <component
        :is="recognitionConfig?.icon"
        v-if="recognitionConfig?.icon"
        :size="14"
        :class="recognitionConfig?.color"
      />
      <span>{{ recognitionConfig?.label }} 属性</span>
      <span class="text-[10px] text-slate-400">({{ recognitionConfig?.value }})</span>
    </div>

    <div
      v-if="currentRecognition === 'DirectHit'"
      class="text-[12px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2"
    >
      直达模式无需额外识别配置。
    </div>
    <div
      v-else
      class="rounded-xl border border-slate-100 overflow-hidden"
    >
      <div class="p-3 space-y-2.5 border-t border-slate-100 rounded-b-xl">
        <div
          v-if="!isCompositeRecognition"
        >
          <RecognitionCommonFields
            :form="props.form"
            @open-picker="(field, refField, refLabel) => emit('open-picker', field, refField, refLabel)"
          />

          <template v-if="['TemplateMatch', 'FeatureMatch'].includes(currentRecognition)">
            <TemplateMatchFields
              :form="props.form"
              @open-image-manager="() => emit('open-image-manager')"
            />
          </template>

          <template v-if="currentRecognition === 'TemplateMatch'">
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
                <input
                  :value="getJsonValue('threshold')"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  placeholder="0.7 或 [0.7, 0.8]"
                  @input="setJsonValue('threshold', getInputValue($event))"
                >
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (1/3/5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="2"
                  :value="getValue('method', 5)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  @input="setValue('method', parseInt(getInputValue($event)) || 5)"
                >
              </div>
            </div>
          </template>

          <template v-if="currentRecognition === 'FeatureMatch'">
            <FeatureMatchFields :form="props.form" />
          </template>

          <template v-if="currentRecognition === 'ColorMatch'">
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label>
                <input
                  :value="getJsonValue('lower')"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                  placeholder="[R,G,B]"
                  @input="setJsonValue('lower', getInputValue($event))"
                >
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label>
                <input
                  :value="getJsonValue('upper')"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                  placeholder="[R,G,B]"
                  @input="setJsonValue('upper', getInputValue($event))"
                >
              </div>
              <div class="col-span-2 space-y-1">
                <button
                  class="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-pink-200 bg-pink-50 text-pink-600 text-xs font-medium hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canFillColorRange"
                  :title="canFillColorRange ? '从设备截图或本地图片统计颜色范围' : '仅支持 method 4（RGB）、40（HSV）和 6（灰度）'"
                  @click="openColorRangePicker"
                >
                  <Pipette :size="12" />
                  从截图填充
                </button>
                <p v-if="!canFillColorRange" class="text-[10px] text-amber-600">
                  当前 method 暂不支持，仅支持 4、40、6。
                </p>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label>
                <input
                  type="number"
                  :value="getValue('method', 4)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  @input="setValue('method', parseInt(getInputValue($event)) || 4)"
                >
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
                <input
                  type="number"
                  min="1"
                  :value="getValue('count', 1)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  @input="setValue('count', parseInt(getInputValue($event)) || 1)"
                >
              </div>
            </div>
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                :checked="getValue('connected', false)"
                class="w-3.5 h-3.5 rounded text-indigo-600"
                @change="setValue('connected', getChecked($event))"
              >
              <span class="text-[11px] text-slate-600">要求像素相连</span>
            </label>
          </template>

          <template v-if="currentRecognition === 'OCR'">
            <OcrFields
              :form="props.form"
              @open-picker="(field, refField, refLabel) => emit('open-picker', field, refField, refLabel)"
            />
          </template>

          <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentRecognition)">
            <NeuralNetworkFields
              :current-recognition="currentRecognition"
              :form="props.form"
            />
          </template>

          <template v-if="currentRecognition === 'Custom'">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label>
              <input
                :value="getValue('custom_recognition', '')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setValue('custom_recognition', getInputValue($event))"
              >
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
              <textarea
                :value="getJsonValue('custom_recognition_param')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono h-14 resize-none"
                placeholder="JSON"
                @input="setJsonValue('custom_recognition_param', getInputValue($event))"
              />
            </div>
          </template>
        </div>

        <template v-if="isCompositeRecognition">
          <CompositeRecognitionEditor
            :current-recognition="currentRecognition"
            :form="props.form"
            @open-picker="(payload) => emit('open-picker', payload)"
            @open-image-manager="(payload) => emit('open-image-manager', payload)"
          />
        </template>
      </div>
    </div>
  </div>
</template>
