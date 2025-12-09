<script setup>
import {ref} from 'vue'
import {
  Crop, Crosshair, ChevronDown, Image as ImageIcon, ScanText
} from 'lucide-vue-next'
import { orderByOptions, detectorOptions } from '../../../utils/nodeLogic'

const props = defineProps({
  currentType: String,
  form: Object // 传入 nodeLogic 返回的整个对象
})

const emit = defineEmits(['open-picker', 'open-image-manager'])

// 解构 form 方法以便模板中使用
const { getValue, setValue, getJsonValue, setJsonValue } = props.form

const isOrderByDropdownOpen = ref(false)
const isDetectorDropdownOpen = ref(false)

const selectOrderBy = (val) => {
  setValue('order_by', val)
  isOrderByDropdownOpen.value = false
}

const selectDetector = (val) => {
  setValue('detector', val)
  isDetectorDropdownOpen.value = false
}
</script>

<template>
  <div class="p-3 space-y-2.5 border-t border-slate-100 rounded-b-xl">
    <div class="grid grid-cols-2 gap-2">
      <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">识别区域
        (ROI)</label>
        <div class="flex gap-1"><input :value="getJsonValue('roi')"
                                       @input="setJsonValue('roi', $event.target.value)"
                                       class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                                       placeholder="[x,y,w,h]"/>
          <button @click="$emit('open-picker', 'roi', null, 'ROI')"
                  class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center">
            <Crop :size="12"/>
          </button>
        </div>
      </div>
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">区域偏移</label>
        <div class="flex gap-1"><input :value="getJsonValue('roi_offset')"
                                       @input="setJsonValue('roi_offset', $event.target.value)"
                                       class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                                       placeholder="[x,y,w,h]"/>
          <button @click="$emit('open-picker', 'roi_offset', 'roi', 'ROI区域')"
                  class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center">
            <Crosshair :size="12"/>
          </button>
        </div>
      </div>

      <div class="space-y-1 relative">
        <label class="text-[10px] font-semibold text-slate-500 uppercase">排序方式</label>
        <button @click="isOrderByDropdownOpen = !isOrderByDropdownOpen"
                class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left">
                    <span class="truncate">{{
                        orderByOptions.find(o => o.value === getValue('order_by', 'Horizontal'))?.label || getValue('order_by')
                      }}</span>
          <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': isOrderByDropdownOpen }"/>
        </button>
        <div v-if="isOrderByDropdownOpen"
             class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar-dark z-50 flex flex-col py-1">
          <button v-for="opt in orderByOptions" :key="opt.value" @click="selectOrderBy(opt.value)"
                  class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
                  :class="getValue('order_by', 'Horizontal') === opt.value ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'">
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">结果索引</label><input type="number"
                                                                                            :value="getValue('index', 0)"
                                                                                            @input="setValue('index', parseInt($event.target.value) || 0)"
                                                                                            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
      </div>
    </div>
    <template v-if="['TemplateMatch', 'FeatureMatch'].includes(currentType)">
      <div class="space-y-1">
        <label class="text-[10px] font-semibold text-slate-500 uppercase">模板图片</label>
        <div class="flex gap-1">
          <input :value="getValue('template', '')" @input="setValue('template', $event.target.value)"
                 class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 font-mono min-w-0"
                 placeholder="image/..."/>
          <button @click="$emit('open-image-manager')"
                  class="px-2 bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100 rounded-lg flex items-center justify-center"
                  title="管理/截取模板图片">
            <ImageIcon :size="12"/>
          </button>
        </div>
      </div>
      <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox"
                                                                            :checked="getValue('green_mask', false)"
                                                                            @change="setValue('green_mask', $event.target.checked)"
                                                                            class="w-3.5 h-3.5 rounded text-indigo-600"/><span
          class="text-[11px] text-slate-600">绿色掩码 (忽略绿色部分)</span></label>
    </template>
    <template v-if="currentType === 'TemplateMatch'">
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input
            :value="getJsonValue('threshold')" @input="setJsonValue('threshold', $event.target.value)"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
            placeholder="0.7 或 [0.7, 0.8]"/></div>
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">算法
          (1/3/5)</label><input type="number" min="1" max="5" step="2" :value="getValue('method', 5)"
                                @input="setValue('method', parseInt($event.target.value) || 5)"
                                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
      </div>
    </template>

    <template v-if="currentType === 'FeatureMatch'">
      <div class="grid grid-cols-3 gap-2">
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label><input type="number"
                                                                                              min="1"
                                                                                              :value="getValue('count', 4)"
                                                                                              @input="setValue('count', parseInt($event.target.value) || 4)"
                                                                                              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
        <div class="space-y-1 relative">
          <label class="text-[10px] font-semibold text-slate-500 uppercase">检测器</label>
          <button @click="isDetectorDropdownOpen = !isDetectorDropdownOpen"
                  class="w-full flex items-center justify-between px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 text-left">
            <span class="truncate">{{ getValue('detector', 'SIFT') }}</span>
            <ChevronDown :size="12" class="text-slate-400" :class="{ 'rotate-180': isDetectorDropdownOpen }"/>
          </button>
          <div v-if="isDetectorDropdownOpen"
              class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[160px] overflow-y-auto custom-scrollbar-dark z-50 flex flex-col py-1">
            <button v-for="opt in detectorOptions" :key="opt" @click="selectDetector(opt)"
                    class="px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors"
                    :class="getValue('detector', 'SIFT') === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'">
              {{ opt }}
            </button>
          </div>
        </div>
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">距离比</label><input type="number"
                                                                                            step="0.1" min="0"
                                                                                            max="1"
                                                                                            :value="getValue('ratio', 0.6)"
                                                                                            @input="setValue('ratio', parseFloat($event.target.value) || 0.6)"
                                                                                            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
      </div>
    </template>

    <template v-if="currentType === 'ColorMatch'">
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">颜色下限</label><input
            :value="getJsonValue('lower')" @input="setJsonValue('lower', $event.target.value)"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
            placeholder="[R,G,B]"/></div>
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">颜色上限</label><input
            :value="getJsonValue('upper')" @input="setJsonValue('upper', $event.target.value)"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
            placeholder="[R,G,B]"/></div>
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">算法
          (4=RGB)</label><input type="number" :value="getValue('method', 4)"
                                @input="setValue('method', parseInt($event.target.value) || 4)"
                                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">特征点数</label><input type="number"
                                                                                              min="1"
                                                                                              :value="getValue('count', 1)"
                                                                                              @input="setValue('count', parseInt($event.target.value) || 1)"
                                                                                              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
      </div>
      <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox"
                                                                            :checked="getValue('connected', false)"
                                                                            @change="setValue('connected', $event.target.checked)"
                                                                            class="w-3.5 h-3.5 rounded text-indigo-600"/><span
          class="text-[11px] text-slate-600">要求像素相连</span></label></template>
    <template v-if="currentType === 'OCR'">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">期望文本</label>
        <div class="flex gap-1"><input :value="getJsonValue('expected')"
                                       @input="setJsonValue('expected', $event.target.value)"
                                       class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                                       placeholder="期望文本或正则"/>
          <button @click="$emit('open-picker', 'expected', 'roi', 'ROI区域')"
                  class="px-2 bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 rounded-lg flex items-center justify-center"
                  title="OCR 识别取词">
            <ScanText :size="12"/>
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input type="number"
                                                                                              step="0.1"
                                                                                              min="0" max="1"
                                                                                              :value="getValue('threshold', 0.3)"
                                                                                              @input="setValue('threshold', parseFloat($event.target.value) || 0.3)"
                                                                                              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label><input
            :value="getValue('model', '')" @input="setValue('model', $event.target.value)"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
            placeholder="model/ocr/"/></div>
      </div>
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">文本替换</label><input
          :value="getJsonValue('replace')" @input="setJsonValue('replace', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
          placeholder='[["原","替"]]'/></div>
      <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox"
                                                                            :checked="getValue('only_rec', false)"
                                                                            @change="setValue('only_rec', $event.target.checked)"
                                                                            class="w-3.5 h-3.5 rounded text-indigo-600"/><span
          class="text-[11px] text-slate-600">仅识别</span></label></template>
    <template v-if="['NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(currentType)">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">模型路径</label><input
          :value="getValue('model', '')" @input="setValue('model', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
          :placeholder="currentType === 'NeuralNetworkClassify' ? 'model/classify/' : 'model/detect/'"/>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">期望标签
          ID</label><input :value="getJsonValue('expected')"
                           @input="setJsonValue('expected', $event.target.value)"
                           class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                           placeholder="0 或 [0,1,2]"/></div>
        <div v-if="currentType === 'NeuralNetworkDetect'" class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">匹配阈值</label><input
            :value="getJsonValue('threshold')" @input="setJsonValue('threshold', $event.target.value)"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
            placeholder="0.3 或 [0.5, 0.6]"/></div>
      </div>
      <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">标签列表
        (Labels)</label><input :value="getJsonValue('labels')"
                               @input="setJsonValue('labels', $event.target.value)"
                               class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono"
                               placeholder='["Cat","Dog"]'/></div>
    </template>
    <template v-if="currentType === 'Custom'">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">自定义识别名</label><input
          :value="getValue('custom_recognition', '')"
          @input="setValue('custom_recognition', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
      </div>
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label><textarea
          :value="getJsonValue('custom_recognition_param')"
          @input="setJsonValue('custom_recognition_param', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono h-14 resize-none"
          placeholder="JSON"></textarea></div>
    </template>
  </div>
</template>
