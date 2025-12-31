<script setup lang="ts">
import { computed, ref } from 'vue'
import { Crop, Crosshair, ChevronDown, Image as ImageIcon, ScanText, Plus, Trash2 } from 'lucide-vue-next'
import { orderByOptions, detectorOptions, recognitionTypes } from '../../../utils/nodeLogic'
import type { NodeFormMethods, RecognitionType, SelectOption } from '../../../utils/nodeLogic'

type CompositeItem = Record<string, unknown> & { recognition: string }

const props = defineProps<{
  currentRecognition: RecognitionType | string
  recognitionConfig?: SelectOption<string>
  form: NodeFormMethods
}>()

type PickerPayload = {
  field: string
  referenceField?: string | null
  referenceLabel?: string | null
  referenceRect?: number[] | null
  onConfirm?: (val: any) => void
}

const emit = defineEmits<{
  (e: 'open-picker', payload: string | PickerPayload, referenceField?: string | null, referenceLabel?: string): void
  (e: 'open-image-manager'): void
}>()

const { getValue, setValue, getJsonValue, setJsonValue } = props.form

const getInputValue = (event: Event) => (event.target as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ''
const getChecked = (event: Event) => (event.target as HTMLInputElement | null)?.checked ?? false

const isOrderByDropdownOpen = ref(false)
const isDetectorDropdownOpen = ref(false)
const compositeExpanded = ref<Record<number, boolean>>({})
const childOrderDropdown = ref<Record<number, boolean>>({})

const selectOrderBy = (val: string) => {
  setValue('order_by', val)
  isOrderByDropdownOpen.value = false
}

const selectDetector = (val: string) => {
  setValue('detector', val)
  isDetectorDropdownOpen.value = false
}

const isCompositeRecognition = computed(() => ['And', 'Or'].includes(props.currentRecognition as string))
const compositeKey = computed(() => props.currentRecognition === 'And' ? 'all_of' : 'any_of')
const childRecognitionOptions = computed(() => recognitionTypes.filter(r => !['And', 'Or', 'Anchor'].includes(r.value)))
const compositeItems = computed<CompositeItem[]>(() => {
  if (!isCompositeRecognition.value) return []
  const raw = getValue<unknown>(compositeKey.value, [])
  if (!Array.isArray(raw)) return []
  return raw.map(item => (item && typeof item === 'object') ? { ...(item as CompositeItem) } : { recognition: 'TemplateMatch' })
})

const saveCompositeItems = (items: Array<Record<string, unknown>>) => {
  if (!isCompositeRecognition.value) return
  const normalized = (items || []).map(item => {
    const obj = (item && typeof item === 'object') ? { ...item } : {}
    if (!obj.recognition) obj.recognition = 'TemplateMatch'
    return obj as CompositeItem
  })
  setValue(compositeKey.value, normalized.length ? normalized : null)
}

const addCompositeItem = () => {
  if (!isCompositeRecognition.value) return
  const next = [...compositeItems.value, { recognition: 'TemplateMatch' }]
  saveCompositeItems(next)
  compositeExpanded.value[next.length - 1] = true
}

const removeCompositeItem = (index: number) => {
  if (!isCompositeRecognition.value) return
  const next = [...compositeItems.value]
  next.splice(index, 1)
  saveCompositeItems(next)
}

const toggleCompositeItem = (index: number) => {
  compositeExpanded.value[index] = !compositeExpanded.value[index]
}

const updateCompositeRecognition = (index: number, value: string) => {
  if (!isCompositeRecognition.value) return
  const next = [...compositeItems.value]
  const item = { ...(next[index] || {}) } as CompositeItem
  item.recognition = value || 'TemplateMatch'
  next[index] = item
  saveCompositeItems(next)
}

const updateCompositeField = (index: number, key: string, value: string | null) => {
  if (!isCompositeRecognition.value) return
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

// 子识别专用的取值与设置（与主节点互不干扰）
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
const setChildJsonValue = (index: number, key: string, rawVal: string) => {
  if (!isCompositeRecognition.value) return
  if (!rawVal || !rawVal.trim()) { setChildValue(index, key, null); return }
  try {
    if (rawVal.startsWith('[') || rawVal.startsWith('{')) setChildValue(index, key, JSON.parse(rawVal))
    else {
      const num = Number(rawVal)
      setChildValue(index, key, isNaN(num) ? rawVal : num)
    }
  } catch (e) { setChildValue(index, key, rawVal) }
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

// 主节点 template 数组管理
const getTemplateList = (): string[] => {
  const val = getValue<unknown>('template', '')
  if (Array.isArray(val)) return val.map(v => String(v)).filter(Boolean)
  if (val && typeof val === 'string') return [val]
  return []
}

const setTemplateList = (list: string[]) => {
  const cleaned = list.filter(v => v && v.trim())
  if (cleaned.length === 0) {
    setValue('template', null)
  } else if (cleaned.length === 1) {
    setValue('template', cleaned[0])
  } else {
    setValue('template', cleaned)
  }
}

const addTemplate = () => {
  const current = getTemplateList()
  setTemplateList([...current, ''])
}

const removeTemplate = (index: number) => {
  const current = getTemplateList()
  current.splice(index, 1)
  setTemplateList(current)
}

const updateTemplate = (index: number, value: string) => {
  const current = getTemplateList()
  current[index] = value
  setTemplateList(current)
}

// 子项 template 数组管理
const getChildTemplateList = (item: CompositeItem): string[] => {
  const val = getChildValue<unknown>(item, 'template', '')
  if (Array.isArray(val)) return val.map(v => String(v)).filter(Boolean)
  if (val && typeof val === 'string') return [val]
  return []
}

const setChildTemplateList = (index: number, list: string[]) => {
  const cleaned = list.filter(v => v && v.trim())
  if (cleaned.length === 0) {
    setChildValue(index, 'template', null)
  } else if (cleaned.length === 1) {
    setChildValue(index, 'template', cleaned[0])
  } else {
    setChildValue(index, 'template', cleaned)
  }
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
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <component :is="recognitionConfig?.icon" v-if="recognitionConfig?.icon" :size="14" :class="recognitionConfig?.color" />
      <span>{{ recognitionConfig?.label }} 属性</span>
      <span class="text-[10px] text-slate-400">({{ recognitionConfig?.value }})</span>
    </div>

    <div v-if="currentRecognition === 'DirectHit'" class="text-[12px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
      直达模式无需额外识别配置。
    </div>
    <div v-else class="rounded-xl border border-slate-100 overflow-hidden">
      <div class="p-3 space-y-2.5 border-t border-slate-100 rounded-b-xl">
        <div v-if="!isCompositeRecognition" class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">识别区域 (ROI)</label>
            <div class="flex gap-1">
              <input
                :value="getJsonValue('roi')"
                @input="setJsonValue('roi', getInputValue($event))"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                placeholder="[x,y,w,h]"
              />
              <button
                @click="emit('open-picker', 'roi', null, 'ROI')"
                class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"
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
                @input="setJsonValue('roi_offset', getInputValue($event))"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                placeholder="[x,y,w,h]"
              />
              <button
                @click="emit('open-picker', 'roi_offset', 'roi', 'ROI区域')"
                class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"
              >
                <Crosshair :size="12" />
              </button>
            </div>
          </div>

          <div class="space-y-1 relative">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">排序方式</label>
            <button
              @click="isOrderByDropdownOpen = !isOrderByDropdownOpen"
              class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left"
            >
              <span class="truncate">
                {{ orderByOptions.find(o => o.value === getValue('order_by', 'Horizontal'))?.label || getValue('order_by') }}
              </span>
              <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': isOrderByDropdownOpen }" />
            </button>
            <div
              v-if="isOrderByDropdownOpen"
              class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar-dark z-50 flex flex-col py-1"
            >
              <button
                v-for="opt in orderByOptions"
                :key="opt.value"
                @click="selectOrderBy(opt.value)"
                class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
                :class="getValue('order_by', 'Horizontal') === opt.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">结果索引</label>
            <input
              type="number"
              :value="getValue('index', 0)"
              @input="setValue('index', parseInt(getInputValue($event)) || 0)"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <template v-if="isCompositeRecognition">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-[11px] font-semibold text-slate-600">
                {{ currentRecognition === 'And' ? '组合识别（全部满足）' : '组合识别（任意命中）' }}
              </div>
              <button
                @click="addCompositeItem"
                class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              >
                <Plus :size="12" />
                添加子识别
              </button>
            </div>

            <div v-if="currentRecognition === 'And'" class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase">box_index</label>
                <input
                  type="number"
                  :value="getValue('box_index', 0)"
                  @input="setValue('box_index', parseInt(getInputValue($event)) || 0)"
                  class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  placeholder="0"
                />
                <p class="text-[10px] text-slate-400 leading-tight">可选。输出第几个子识别的识别框。</p>
              </div>
            </div>

            <div v-if="!compositeItems.length" class="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2">
              尚未添加子识别，点击“添加子识别”开始配置。
            </div>

            <div v-for="(item, idx) in compositeItems" :key="idx" class="border border-slate-100 rounded-lg overflow-hidden">
              <div class="flex items-center justify-between px-3 py-2 bg-slate-50">
                <button class="flex items-center gap-2 text-left flex-1" @click="toggleCompositeItem(idx)">
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
                    <option v-for="opt in childRecognitionOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                  <button
                    class="p-1.5 rounded-lg border border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100"
                    @click="removeCompositeItem(idx)"
                    title="删除子识别"
                  >
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>

              <div v-show="compositeExpanded[idx] !== false" class="p-3 space-y-2">
                <div v-if="currentRecognition === 'And'" class="space-y-1">
                  <label class="text-[10px] font-semibold text-slate-500 uppercase">子识别别名 (sub_name)</label>
                  <input
                    :value="(item.sub_name as string) || ''"
                    @input="updateCompositeField(idx, 'sub_name', getInputValue($event))"
                    class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                    placeholder="可选，供后续 ROI 引用"
                  />
                </div>

                <!-- 通用区域设置 -->
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">ROI</label>
                    <div class="flex gap-1">
                      <input
                        :value="getChildJsonValue(item, 'roi')"
                        @input="setChildJsonValue(idx, 'roi', getInputValue($event))"
                        class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono"
                        placeholder="[x,y,w,h]"
                      />
                      <button
                        @click="openChildPicker(idx, item, 'roi')"
                        class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"
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
                        @input="setChildJsonValue(idx, 'roi_offset', getInputValue($event))"
                        class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono"
                        placeholder="[x,y,w,h]"
                      />
                      <button
                        @click="openChildPicker(idx, item, 'roi_offset', 'roi')"
                        class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"
                      >
                        <Crosshair :size="12" />
                      </button>
                    </div>
                  </div>
                  <div class="space-y-1 relative">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">排序方式</label>
                    <button
                      @click="toggleChildOrderDropdown(idx)"
                      class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left"
                    >
                      <span class="truncate">
                        {{ orderByOptions.find(o => o.value === getChildValue(item, 'order_by', 'Horizontal'))?.label || getChildValue(item, 'order_by', 'Horizontal') }}
                      </span>
                      <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': childOrderDropdown[idx] }" />
                    </button>
                    <div
                      v-if="childOrderDropdown[idx]"
                      class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar-dark z-40 flex flex-col py-1"
                    >
                      <button
                        v-for="opt in orderByOptions"
                        :key="opt.value"
                        @click="setChildValue(idx, 'order_by', opt.value); toggleChildOrderDropdown(idx)"
                        class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
                        :class="getChildValue(item, 'order_by', 'Horizontal') === opt.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'"
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
                      @input="setChildValue(idx, 'index', parseInt(getInputValue($event)) || 0)"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"
                      placeholder="0"
                    />
                  </div>
                </div>

                <!-- 具体算法字段 -->
                <template v-if="['TemplateMatch', 'FeatureMatch'].includes(item.recognition as string)">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label>
                    <div class="space-y-1.5">
                      <div v-for="(template, tIdx) in getChildTemplateList(item)" :key="tIdx" class="flex gap-1">
                        <input
                          :value="template"
                          @input="updateChildTemplate(idx, tIdx, getInputValue($event))"
                          class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                          placeholder="image/..."
                        />
                        <button
                          v-if="getChildTemplateList(item).length > 1"
                          @click="removeChildTemplate(idx, tIdx)"
                          class="px-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg flex items-center justify-center"
                          title="删除此模板"
                        >
                          <Trash2 :size="12" />
                        </button>
                      </div>
                      <div v-if="getChildTemplateList(item).length === 0" class="flex gap-1">
                        <input
                          value=""
                          @input="updateChildTemplate(idx, 0, getInputValue($event))"
                          class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                          placeholder="image/..."
                        />
                      </div>
                      <button
                        @click="addChildTemplate(idx)"
                        class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      >
                        <Plus :size="12" />
                        添加模板
                      </button>
                    </div>
                  </div>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="getChildValue(item, 'green_mask', false) as boolean"
                      @change="setChildValue(idx, 'green_mask', getChecked($event))"
                      class="w-3.5 h-3.5 rounded text-indigo-600"
                    />
                    <span class="text-[11px] text-slate-600">绿色掩码 (忽略绿色部分)</span>
                  </label>
                </template>

                <template v-if="item.recognition === 'TemplateMatch'">
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
                      <input
                        :value="getChildJsonValue(item, 'threshold')"
                        @input="setChildJsonValue(idx, 'threshold', getInputValue($event))"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                        placeholder="0.7 或 [0.7, 0.8]"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (1/3/5)</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        step="2"
                        :value="getChildValue(item, 'method', 5) as number"
                        @input="setChildValue(idx, 'method', parseInt(getInputValue($event)) || 5)"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      />
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
                        @input="setChildValue(idx, 'count', parseInt(getInputValue($event)) || 4)"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label>
                      <select
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"
                        :value="getChildValue(item, 'detector', 'SIFT') as string"
                        @change="setChildValue(idx, 'detector', ($event.target as HTMLSelectElement).value)"
                      >
                        <option v-for="opt in detectorOptions" :key="opt">{{ opt }}</option>
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
                        @input="setChildValue(idx, 'ratio', parseFloat(getInputValue($event)) || 0.6)"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </template>

                <template v-if="item.recognition === 'ColorMatch'">
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label>
                      <input
                        :value="getChildJsonValue(item, 'lower')"
                        @input="setChildJsonValue(idx, 'lower', getInputValue($event))"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                        placeholder="[R,G,B]"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label>
                      <input
                        :value="getChildJsonValue(item, 'upper')"
                        @input="setChildJsonValue(idx, 'upper', getInputValue($event))"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                        placeholder="[R,G,B]"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label>
                      <input
                        type="number"
                        :value="getChildValue(item, 'method', 4) as number"
                        @input="setChildValue(idx, 'method', parseInt(getInputValue($event)) || 4)"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
                      <input
                        type="number"
                        min="1"
                        :value="getChildValue(item, 'count', 1) as number"
                        @input="setChildValue(idx, 'count', parseInt(getInputValue($event)) || 1)"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="getChildValue(item, 'connected', false) as boolean"
                      @change="setChildValue(idx, 'connected', getChecked($event))"
                      class="w-3.5 h-3.5 rounded text-indigo-600"
                    />
                    <span class="text-[11px] text-slate-600">要求像素相连</span>
                  </label>
                </template>

                <template v-if="item.recognition === 'OCR'">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label>
                    <input
                      :value="getChildJsonValue(item, 'expected')"
                      @input="setChildJsonValue(idx, 'expected', getInputValue($event))"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      placeholder="期望文本或正则"
                    />
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
                        @input="setChildValue(idx, 'threshold', parseFloat(getInputValue($event)) || 0.3)"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
                      <input
                        :value="getChildValue(item, 'model', '') as string"
                        @input="setChildValue(idx, 'model', getInputValue($event))"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                        placeholder="model/ocr/"
                      />
                    </div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label>
                    <input
                      :value="getChildJsonValue(item, 'replace')"
                      @input="setChildJsonValue(idx, 'replace', getInputValue($event))"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                      placeholder='[["原","替"]]'
                    />
                  </div>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="getChildValue(item, 'only_rec', false) as boolean"
                      @change="setChildValue(idx, 'only_rec', getChecked($event))"
                      class="w-3.5 h-3.5 rounded text-indigo-600"
                    />
                    <span class="text-[11px] text-slate-600">仅识别</span>
                  </label>
                </template>

                <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(item.recognition as string)">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
                    <input
                      :value="getChildValue(item, 'model', '') as string"
                      @input="setChildValue(idx, 'model', getInputValue($event))"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                      :placeholder="item.recognition === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签 ID</label>
                      <input
                        :value="getChildJsonValue(item, 'expected')"
                        @input="setChildJsonValue(idx, 'expected', getInputValue($event))"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                        placeholder="0 或 [0,1,2]"
                      />
                    </div>
                    <div v-if="item.recognition === 'NeuralNetworkDetect'" class="space-y-1">
                      <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
                      <input
                        :value="getChildJsonValue(item, 'threshold')"
                        @input="setChildJsonValue(idx, 'threshold', getInputValue($event))"
                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                        placeholder="0.3 或 [0.5, 0.6]"
                      />
                    </div>
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表 (Labels)</label>
                    <input
                      :value="getChildJsonValue(item, 'labels')"
                      @input="setChildJsonValue(idx, 'labels', getInputValue($event))"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                      placeholder='["Cat","Dog"]'
                    />
                  </div>
                </template>

                <template v-if="item.recognition === 'Custom'">
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label>
                    <input
                      :value="getChildValue(item, 'custom_recognition', '') as string"
                      @input="setChildValue(idx, 'custom_recognition', getInputValue($event))"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
                    <textarea
                      :value="getChildJsonValue(item, 'custom_recognition_param')"
                      @input="setChildJsonValue(idx, 'custom_recognition_param', getInputValue($event))"
                      class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono h-14 resize-none"
                      placeholder="JSON"
                    ></textarea>
                  </div>
                </template>

              </div>
            </div>
          </div>
        </template>

        <template v-if="!isCompositeRecognition && ['TemplateMatch', 'FeatureMatch'].includes(currentRecognition)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label>
            <div class="space-y-1.5">
              <div v-for="(template, idx) in getTemplateList()" :key="idx" class="flex gap-1">
                <input
                  :value="template"
                  @input="updateTemplate(idx, getInputValue($event))"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                  placeholder="image/..."
                />
                <button
                  v-if="getTemplateList().length > 1"
                  @click="removeTemplate(idx)"
                  class="px-2 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg flex items-center justify-center"
                  title="删除此模板"
                >
                  <Trash2 :size="12" />
                </button>
              </div>
              <div v-if="getTemplateList().length === 0" class="flex gap-1">
                <input
                  value=""
                  @input="updateTemplate(0, getInputValue($event))"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                  placeholder="image/..."
                />
              </div>
              <div class="flex gap-1">
                <button
                  @click="addTemplate"
                  class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                >
                  <Plus :size="12" />
                  添加模板
                </button>
                <button
                  @click="emit('open-image-manager')"
                  class="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100"
                  title="管理/截取模板图片"
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
              :checked="getValue('green_mask', false)"
              @change="setValue('green_mask', getChecked($event))"
              class="w-3.5 h-3.5 rounded text-indigo-600"
            />
            <span class="text-[11px] text-slate-600">绿色掩码 (忽略绿色部分)</span>
          </label>
        </template>

        <template v-if="!isCompositeRecognition && currentRecognition === 'TemplateMatch'">
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
              <input
                :value="getJsonValue('threshold')"
              @input="setJsonValue('threshold', getInputValue($event))"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                placeholder="0.7 或 [0.7, 0.8]"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (1/3/5)</label>
              <input
                type="number"
                min="1"
                max="5"
                step="2"
                :value="getValue('method', 5)"
              @input="setValue('method', parseInt(getInputValue($event)) || 5)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        </template>

        <template v-if="!isCompositeRecognition && currentRecognition === 'FeatureMatch'">
          <div class="grid grid-cols-3 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
              <input
                type="number"
                min="1"
                :value="getValue('count', 4)"
              @input="setValue('count', parseInt(getInputValue($event)) || 4)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              />
            </div>
            <div class="space-y-1 relative">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label>
              <button
                @click="isDetectorDropdownOpen = !isDetectorDropdownOpen"
                class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left"
              >
                <span class="truncate">{{ getValue('detector', 'SIFT') }}</span>
                <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': isDetectorDropdownOpen }" />
              </button>
              <div
                v-if="isDetectorDropdownOpen"
                class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar-dark z-50 flex flex-col py-1"
              >
                <button
                  v-for="opt in detectorOptions"
                  :key="opt"
                  @click="selectDetector(opt)"
                  class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
                  :class="getValue('detector', 'SIFT') === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'"
                >
                  {{ opt }}
                </button>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">距离比</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                :value="getValue('ratio', 0.6)"
              @input="setValue('ratio', parseFloat(getInputValue($event)) || 0.6)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        </template>

        <template v-if="!isCompositeRecognition && currentRecognition === 'ColorMatch'">
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label>
              <input
                :value="getJsonValue('lower')"
                @input="setJsonValue('lower', getInputValue($event))"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="[R,G,B]"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label>
              <input
                :value="getJsonValue('upper')"
                @input="setJsonValue('upper', getInputValue($event))"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="[R,G,B]"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">算法 (4=RGB)</label>
              <input
                type="number"
                :value="getValue('method', 4)"
                @input="setValue('method', parseInt(getInputValue($event)) || 4)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label>
              <input
                type="number"
                min="1"
                :value="getValue('count', 1)"
                @input="setValue('count', parseInt(getInputValue($event)) || 1)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              :checked="getValue('connected', false)"
              @change="setValue('connected', getChecked($event))"
              class="w-3.5 h-3.5 rounded text-indigo-600"
            />
            <span class="text-[11px] text-slate-600">要求像素相连</span>
          </label>
        </template>

        <template v-if="!isCompositeRecognition && currentRecognition === 'OCR'">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label>
            <div class="flex gap-1">
              <input
                :value="getJsonValue('expected')"
                @input="setJsonValue('expected', getInputValue($event))"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                placeholder="期望文本或正则"
              />
              <button
                @click="emit('open-picker', 'expected', 'roi', 'ROI区域')"
                class="px-2 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 rounded-lg flex items-center justify-center"
                title="OCR 识别取词"
              >
                <ScanText :size="12" />
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                :value="getValue('threshold', 0.3)"
                @input="setValue('threshold', parseFloat(getInputValue($event)) || 0.3)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
              <input
                :value="getValue('model', '')"
                @input="setValue('model', getInputValue($event))"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="model/ocr/"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label>
            <input
              :value="getJsonValue('replace')"
                @input="setJsonValue('replace', getInputValue($event))"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
              placeholder='[["原","替"]]'
            />
          </div>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              :checked="getValue('only_rec', false)"
              @change="setValue('only_rec', getChecked($event))"
              class="w-3.5 h-3.5 rounded text-indigo-600"
            />
            <span class="text-[11px] text-slate-600">仅识别</span>
          </label>
        </template>

        <template v-if="!isCompositeRecognition && ['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentRecognition)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label>
            <input
              :value="getValue('model', '')"
                @input="setValue('model', getInputValue($event))"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
              :placeholder="currentRecognition === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签 ID</label>
              <input
                :value="getJsonValue('expected')"
                @input="setJsonValue('expected', getInputValue($event))"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                placeholder="0 或 [0,1,2]"
              />
            </div>
            <div v-if="currentRecognition === 'NeuralNetworkDetect'" class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label>
              <input
                :value="getJsonValue('threshold')"
                @input="setJsonValue('threshold', getInputValue($event))"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                placeholder="0.3 或 [0.5, 0.6]"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表 (Labels)</label>
            <input
              :value="getJsonValue('labels')"
                @input="setJsonValue('labels', getInputValue($event))"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
              placeholder='["Cat","Dog"]'
            />
          </div>
        </template>

        <template v-if="!isCompositeRecognition && currentRecognition === 'Custom'">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label>
            <input
              :value="getValue('custom_recognition', '')"
                @input="setValue('custom_recognition', getInputValue($event))"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label>
            <textarea
              :value="getJsonValue('custom_recognition_param')"
                @input="setJsonValue('custom_recognition_param', getInputValue($event))"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono h-14 resize-none"
              placeholder="JSON"
            ></textarea>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
