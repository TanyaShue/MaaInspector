<script setup lang="ts">
import { computed, ref } from 'vue'
import { Crop, Crosshair, ChevronDown, Plus, Trash2, ImageIcon, Pipette } from 'lucide-vue-next'
import { orderByOptions, detectorOptions, recognitionTypes } from '@/utils/node-config'
import type { NodeFormMethods } from '@/composables/useNodeForm'
import type { PickerPayload } from '@/composables/useDeviceScreenPicker'
import { isSupportedColorMethod, type ColorRangeResult } from '@/utils/colorRange'

type CompositeItem = Record<string, unknown> & { recognition: string }

const props = defineProps<{
  currentRecognition: string
  form: NodeFormMethods
}>()

const emit = defineEmits<{
  (e: 'open-picker', payload: PickerPayload): void
  (e: 'open-image-manager', payload: { compositeKey: 'all_of' | 'any_of', compositeIndex: number }): void
}>()

const { getValue, setValue } = props.form

const getInputValue = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ''
const getChecked = (event: Event) => (event.target as HTMLInputElement | null)?.checked ?? false

const compositeExpanded = ref<Record<number, boolean>>({})
const childOrderDropdown = ref<Record<number, boolean>>({})

const compositeKey = computed(() => props.currentRecognition === 'And' ? 'all_of' : 'any_of')
const childRecognitionOptions = computed(() => recognitionTypes.filter(r => !['And', 'Or', 'Anchor'].includes(r.value)))

const compositeItems = computed<CompositeItem[]>(() => {
  const raw = getValue<unknown>(compositeKey.value, [])
  if (!Array.isArray(raw)) return []
  return raw.map(item => (item && typeof item === 'object') ? { ...(item as CompositeItem) } : { recognition: 'TemplateMatch' })
})

const saveCompositeItems = (items: Array<Record<string, unknown>>) => {
  const normalized = (items || []).map(item => {
    const obj = (item && typeof item === 'object') ? { ...item } : {}
    if (!obj.recognition) obj.recognition = 'TemplateMatch'
    return obj as CompositeItem
  })
  setValue(compositeKey.value, normalized.length ? normalized : null)
}

const addCompositeItem = () => {
  const next = [...compositeItems.value, { recognition: 'TemplateMatch' }]
  saveCompositeItems(next)
  compositeExpanded.value[next.length - 1] = true
}

const removeCompositeItem = (index: number) => {
  const next = [...compositeItems.value]
  next.splice(index, 1)
  saveCompositeItems(next)
}

const toggleCompositeItem = (index: number) => {
  compositeExpanded.value[index] = !compositeExpanded.value[index]
}

const updateCompositeRecognition = (index: number, value: string) => {
  const next = [...compositeItems.value]
  const item = { ...(next[index] || {}) } as CompositeItem
  item.recognition = value || 'TemplateMatch'
  next[index] = item
  saveCompositeItems(next)
}

const openCompositeImageManager = (index: number) => {
  emit('open-image-manager', { compositeKey: compositeKey.value, compositeIndex: index })
}

const updateCompositeField = (index: number, key: string, value: string | null) => {
  const next = [...compositeItems.value]
  const item = { ...(next[index] || {}) } as CompositeItem
  if (value === null || value === '') delete item[key]
  else item[key] = value
  if (!item.recognition) item.recognition = 'TemplateMatch'
  next[index] = item
  saveCompositeItems(next)
}

const getRecognitionLabel = (value: string) =>
  recognitionTypes.find(r => r.value === value)?.label || value

const getChildValue = <T = unknown>(item: CompositeItem, key: string, def?: T): T => {
  const val = (item as Record<string, unknown>)[key]
  return (val !== undefined ? val : def) as T
}

const setChildValue = (index: number, key: string, value: unknown) => {
  const next = [...compositeItems.value]
  const item = { ...(next[index] || {}) } as CompositeItem
  if (value === '' || value === null || value === undefined) {
    delete (item as Record<string, unknown>)[key]
  } else {
    (item as Record<string, unknown>)[key] = value as unknown
  }
  next[index] = item
  saveCompositeItems(next)
}

const getChildJsonValue = (item: CompositeItem, key: string) => {
  const val = getChildValue<unknown>(item, key, null)
  return (val === null || val === undefined) ? '' : (typeof val === 'object' ? JSON.stringify(val) : String(val))
}

const setChildJsonValue = (index: number, key: string, rawVal: string, forceString = false) => {
  if (!rawVal || !rawVal.trim()) { setChildValue(index, key, null); return }
  try {
    if (rawVal.startsWith('[') || rawVal.startsWith('{')) setChildValue(index, key, JSON.parse(rawVal))
    else {
      if (forceString) { setChildValue(index, key, rawVal); return }
      const num = Number(rawVal)
      setChildValue(index, key, isNaN(num) ? rawVal : num)
    }
  } catch (_e) { setChildValue(index, key, rawVal) }
}

const getChildTemplateList = (item: CompositeItem): string[] => {
  const val = getChildValue<unknown>(item, 'template', '')
  if (Array.isArray(val)) return val.map(v => (v === null || v === undefined) ? '' : String(v))
  if (val && typeof val === 'string') return [val]
  if (val === '' || val === null) return ['']
  return []
}

const setChildTemplateList = (index: number, list: string[]) => {
  const normalized = (list || []).map(v => (v === null || v === undefined) ? '' : String(v))
  if (normalized.length === 0) {
    setChildValue(index, 'template', null)
    return
  }
  if (normalized.length === 1) {
    const single = normalized[0]
    if (!single || !single.trim()) {
      setChildValue(index, 'template', null)
    } else {
      setChildValue(index, 'template', single.trim())
    }
    return
  }
  setChildValue(index, 'template', normalized.map(v => v.trim()))
}

const addChildTemplate = (index: number) => {
  const item = compositeItems.value[index]
  const current = getChildTemplateList(item)
  setChildTemplateList(index, [...current, ''])
}

const removeChildTemplate = (itemIndex: number, templateIndex: number) => {
  const item = compositeItems.value[itemIndex]
  const current = getChildTemplateList(item)
  current.splice(templateIndex, 1)
  setChildTemplateList(itemIndex, current)
}

const updateChildTemplate = (itemIndex: number, templateIndex: number, value: string) => {
  const item = compositeItems.value[itemIndex]
  const current = getChildTemplateList(item)
  current[templateIndex] = value
  setChildTemplateList(itemIndex, current)
}

const toggleChildOrderDropdown = (idx: number) => {
  childOrderDropdown.value[idx] = !childOrderDropdown.value[idx]
}

const openChildPicker = (idx: number, item: CompositeItem, key: 'roi' | 'roi_offset', refKey?: string) => {
  const refRectVal = refKey ? (getChildValue(item, refKey, null) as number[] | null) : null
  emit('open-picker', {
    field: key,
    referenceField: refKey || null,
    referenceLabel: refKey || null,
    referenceRect: refRectVal,
    onConfirm: (val: any) => {
      if (Array.isArray(val) && val.length === 4) {
        if (key.includes('offset') && refKey) {
          const refRect = getChildValue(item, refKey, null) as number[] | null
          if (refRect) {
            setChildValue(idx, key, [val[0] - refRect[0], val[1] - refRect[1], val[2] - refRect[2], val[3] - refRect[3]])
            return
          }
        }
        setChildValue(idx, key, val)
      }
    }
  })
}

const openChildColorRangePicker = (idx: number, item: CompositeItem) => {
  const method = Number(getChildValue(item, 'method', 4))
  if (!isSupportedColorMethod(method)) return
  const roi = getChildValue(item, 'roi', null) as number[] | null
  emit('open-picker', {
    field: 'color_range',
    mode: 'color_range',
    method,
    referenceField: 'roi',
    referenceLabel: '子识别 ROI',
    referenceRect: roi,
    initialRect: roi,
    onConfirm: (value) => {
      const result = value as ColorRangeResult
      if (!Array.isArray(result?.lower) || !Array.isArray(result?.upper)) return
      const next = [...compositeItems.value]
      const latestItem = { ...(next[idx] || {}) } as CompositeItem
      latestItem.lower = result.lower
      latestItem.upper = result.upper
      next[idx] = latestItem
      saveCompositeItems(next)
    }
  })
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="text-[11px] font-semibold text-slate-600">
        {{ currentRecognition === 'And' ? '组合识别（全部满足）' : '组合识别（任意命中）' }}
      </div>
      <button
        class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        @click="addCompositeItem"
      >
        <Plus :size="12" />
        添加子识别
      </button>
    </div>

    <div
      v-if="currentRecognition === 'And'"
      class="grid grid-cols-2 gap-2"
    >
      <div class="space-y-1">
        <label class="text-[10px] font-semibold text-slate-500 uppercase">box_index</label>
        <input
          type="number"
          :value="getValue('box_index', 0)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
          placeholder="0"
          @input="setValue('box_index', parseInt(getInputValue($event)) || 0)"
        >
        <p class="text-[10px] text-slate-400 leading-tight">
          可选。输出第几个子识别的识别框。
        </p>
      </div>
    </div>

    <div
      v-if="!compositeItems.length"
      class="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2"
    >
      尚未添加子识别，点击"添加子识别"开始配置。
    </div>

    <div
      v-for="(item, idx) in compositeItems"
      :key="idx"
      class="border border-slate-100 rounded-lg overflow-hidden"
    >
      <div class="flex items-center justify-between px-3 py-2 bg-slate-50">
        <button
          class="flex items-center gap-2 text-left flex-1"
          @click="toggleCompositeItem(idx)"
        >
          <ChevronDown
            :size="12"
            class="text-slate-400 transition-transform"
            :class="{ 'rotate-180': compositeExpanded[idx] }"
          />
          <div class="flex flex-col">
            <span class="text-[11px] font-semibold text-slate-700">子识别 #{{ idx + 1 }}</span>
            <span class="text-[10px] text-slate-500 font-mono">{{ getRecognitionLabel((item.recognition as string) || 'TemplateMatch') }}</span>
          </div>
        </button>
        <div class="flex items-center gap-2">
          <select
            class="text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400"
            :value="(item.recognition as string) || 'TemplateMatch'"
            @change="updateCompositeRecognition(idx, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="opt in childRecognitionOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <button
            class="p-1.5 rounded-lg border border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100"
            title="删除子识别"
            @click="removeCompositeItem(idx)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </div>

      <div
        v-show="compositeExpanded[idx] !== false"
        class="p-3 space-y-2"
      >
        <div
          v-if="currentRecognition === 'And'"
          class="space-y-1"
        >
          <label class="text-[10px] font-semibold text-slate-500 uppercase">子识别别名 (sub_name)</label>
          <input
            :value="(item.sub_name as string) || ''"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
            placeholder="可选，供后续 ROI 引用"
            @input="updateCompositeField(idx, 'sub_name', getInputValue($event))"
          >
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">ROI</label>
            <div class="flex gap-1">
              <input
                :value="getChildJsonValue(item, 'roi')"
                class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono"
                placeholder="[x,y,w,h]"
                @input="setChildJsonValue(idx, 'roi', getInputValue($event))"
              >
              <button
                class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"
                @click="openChildPicker(idx, item, 'roi')"
              >
                <Crop :size="12" />
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">区域偏移</label>
            <div class="flex gap-1">
              <input
                :value="getChildJsonValue(item, 'roi_offset')"
                class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono"
                placeholder="[x,y,w,h]"
                @input="setChildJsonValue(idx, 'roi_offset', getInputValue($event))"
              >
              <button
                class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"
                @click="openChildPicker(idx, item, 'roi_offset', 'roi')"
              >
                <Crosshair :size="12" />
              </button>
            </div>
          </div>
          <div class="space-y-1 relative">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">排序方式</label>
            <button
              class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left"
              @click="toggleChildOrderDropdown(idx)"
            >
              <span class="truncate">
                {{ orderByOptions.find(o => o.value === getChildValue(item, 'order_by', 'Horizontal'))?.label || getChildValue(item, 'order_by', 'Horizontal') }}
              </span>
              <ChevronDown
                :size="12"
                class="text-slate-400"
                :class="{ 'rotate-180': childOrderDropdown[idx] }"
              />
            </button>
            <div
              v-if="childOrderDropdown[idx]"
              class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar-dark z-40 flex flex-col py-1"
            >
              <button
                v-for="opt in orderByOptions"
                :key="opt.value"
                class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
                :class="getChildValue(item, 'order_by', 'Horizontal') === opt.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'"
                @click="setChildValue(idx, 'order_by', opt.value); toggleChildOrderDropdown(idx)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">结果索引</label>
            <input
              type="number"
              :value="getChildValue(item, 'index', 0)"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"
              placeholder="0"
              @input="setChildValue(idx, 'index', parseInt(getInputValue($event)) || 0)"
            >
          </div>
        </div>

        <template v-if="['TemplateMatch', 'FeatureMatch'].includes(item.recognition as string)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label>
            <div class="space-y-1.5">
              <div
                v-for="(template, tIdx) in getChildTemplateList(item)"
                :key="tIdx"
                class="flex gap-1"
              >
                <input
                  :value="template"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                  placeholder="image/..."
                  @input="updateChildTemplate(idx, tIdx, getInputValue($event))"
                >
                <button
                  v-if="getChildTemplateList(item).length > 1"
                  class="px-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg flex items-center justify-center"
                  title="删除此模板"
                  @click="removeChildTemplate(idx, tIdx)"
                >
                  <Trash2 :size="12" />
                </button>
              </div>
              <div
                v-if="getChildTemplateList(item).length === 0"
                class="flex gap-1"
              >
                <input
                  value=""
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                  placeholder="image/..."
                  @input="updateChildTemplate(idx, 0, getInputValue($event))"
                >
              </div>
              <div class="flex gap-1">
                <button
                  class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                  @click="addChildTemplate(idx)"
                >
                  <Plus :size="12" />
                  添加模板
                </button>
                <button
                  class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100"
                  title="管理/截取模板图片"
                  @click="openCompositeImageManager(idx)"
                >
                  <ImageIcon :size="12" />
                  管理图片
                </button>
              </div>
            </div>
          </div>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              :checked="getChildValue(item, 'green_mask', false) as boolean"
              class="w-3.5 h-3.5 rounded text-indigo-600"
              @change="setChildValue(idx, 'green_mask', getChecked($event))"
            >
            <span class="text-[11px] text-slate-600">绿色掩码 (忽略绿色部分)</span>
          </label>
        </template>

        <template v-if="item.recognition === 'TemplateMatch'">
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
              <input
                :value="getChildJsonValue(item, 'threshold')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                placeholder="0.7 或 [0.7, 0.8]"
                @input="setChildJsonValue(idx, 'threshold', getInputValue($event))"
              >
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (1/3/5)</label>
              <input
                type="number"
                min="1"
                max="5"
                step="2"
                :value="getChildValue(item, 'method', 5) as number"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setChildValue(idx, 'method', parseInt(getInputValue($event)) || 5)"
              >
            </div>
          </div>
        </template>

        <template v-if="item.recognition === 'FeatureMatch'">
          <div class="grid grid-cols-3 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
              <input
                type="number"
                min="1"
                :value="getChildValue(item, 'count', 4) as number"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setChildValue(idx, 'count', parseInt(getInputValue($event)) || 4)"
              >
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label>
              <select
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"
                :value="getChildValue(item, 'detector', 'SIFT') as string"
                @change="setChildValue(idx, 'detector', ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="opt in detectorOptions"
                  :key="opt"
                >
                  {{ opt }}
                </option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">距离比</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                :value="getChildValue(item, 'ratio', 0.6) as number"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setChildValue(idx, 'ratio', parseFloat(getInputValue($event)) || 0.6)"
              >
            </div>
          </div>
        </template>

        <template v-if="item.recognition === 'ColorMatch'">
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label>
              <input
                :value="getChildJsonValue(item, 'lower')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="[R,G,B]"
                @input="setChildJsonValue(idx, 'lower', getInputValue($event))"
              >
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label>
              <input
                :value="getChildJsonValue(item, 'upper')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="[R,G,B]"
                @input="setChildJsonValue(idx, 'upper', getInputValue($event))"
              >
            </div>
            <div class="col-span-2 space-y-1">
              <button
                class="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-pink-200 bg-pink-50 text-pink-600 text-xs font-medium hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!isSupportedColorMethod(Number(getChildValue(item, 'method', 4)))"
                :title="isSupportedColorMethod(Number(getChildValue(item, 'method', 4))) ? '从设备截图或本地图片统计颜色范围' : '仅支持 method 4（RGB）、40（HSV）和 6（灰度）'"
                @click="openChildColorRangePicker(idx, item)"
              >
                <Pipette :size="12" />
                从截图填充
              </button>
              <p
                v-if="!isSupportedColorMethod(Number(getChildValue(item, 'method', 4)))"
                class="text-[10px] text-amber-600"
              >
                当前 method 暂不支持，仅支持 4、40、6。
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label>
              <input
                type="number"
                :value="getChildValue(item, 'method', 4) as number"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setChildValue(idx, 'method', parseInt(getInputValue($event)) || 4)"
              >
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
              <input
                type="number"
                min="1"
                :value="getChildValue(item, 'count', 1) as number"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setChildValue(idx, 'count', parseInt(getInputValue($event)) || 1)"
              >
            </div>
          </div>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              :checked="getChildValue(item, 'connected', false) as boolean"
              class="w-3.5 h-3.5 rounded text-indigo-600"
              @change="setChildValue(idx, 'connected', getChecked($event))"
            >
            <span class="text-[11px] text-slate-600">要求像素相连</span>
          </label>
        </template>

        <template v-if="item.recognition === 'OCR'">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label>
            <input
              :value="getChildJsonValue(item, 'expected')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              placeholder="期望文本或正则"
              @input="setChildJsonValue(idx, 'expected', getInputValue($event), true)"
            >
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                :value="getChildValue(item, 'threshold', 0.3) as number"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setChildValue(idx, 'threshold', parseFloat(getInputValue($event)) || 0.3)"
              >
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
              <input
                :value="getChildValue(item, 'model', '') as string"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="model/ocr/"
                @input="setChildValue(idx, 'model', getInputValue($event))"
              >
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label>
            <input
              :value="getChildJsonValue(item, 'replace')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
              placeholder="[[&quot;原&quot;,&quot;替&quot;]]"
              @input="setChildJsonValue(idx, 'replace', getInputValue($event))"
            >
          </div>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              :checked="getChildValue(item, 'only_rec', false) as boolean"
              class="w-3.5 h-3.5 rounded text-indigo-600"
              @change="setChildValue(idx, 'only_rec', getChecked($event))"
            >
            <span class="text-[11px] text-slate-600">仅识别</span>
          </label>
        </template>

        <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(item.recognition as string)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
            <input
              :value="getChildValue(item, 'model', '') as string"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
              :placeholder="item.recognition === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'"
              @input="setChildValue(idx, 'model', getInputValue($event))"
            >
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签 ID</label>
              <input
                :value="getChildJsonValue(item, 'expected')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="0 或 [0,1,2]"
                @input="setChildJsonValue(idx, 'expected', getInputValue($event), true)"
              >
            </div>
            <div
              v-if="item.recognition === 'NeuralNetworkDetect'"
              class="space-y-1"
            >
              <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
              <input
                :value="getChildJsonValue(item, 'threshold')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                placeholder="0.3 或 [0.5, 0.6]"
                @input="setChildJsonValue(idx, 'threshold', getInputValue($event))"
              >
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表 (Labels)</label>
            <input
              :value="getChildJsonValue(item, 'labels')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
              placeholder="[&quot;Cat&quot;,&quot;Dog&quot;]"
              @input="setChildJsonValue(idx, 'labels', getInputValue($event))"
            >
          </div>
        </template>

        <template v-if="item.recognition === 'Custom'">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label>
            <input
              :value="getChildValue(item, 'custom_recognition', '') as string"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              @input="setChildValue(idx, 'custom_recognition', getInputValue($event))"
            >
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
            <textarea
              :value="getChildJsonValue(item, 'custom_recognition_param')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono h-14 resize-none"
              placeholder="JSON"
              @input="setChildJsonValue(idx, 'custom_recognition_param', getInputValue($event))"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
