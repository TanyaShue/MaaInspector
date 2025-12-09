<script setup>
import { Crop, Crosshair } from 'lucide-vue-next'

const props = defineProps({
  currentType: String,
  form: Object
})

const emit = defineEmits(['open-picker'])
const { getValue, setValue, getJsonValue, setJsonValue, getTargetValue, setTargetValue } = props.form
</script>

<template>
  <div class="p-3 space-y-2.5 border-t border-slate-100">
    <template
        v-if="['Click', 'LongPress', 'TouchDown', 'TouchMove', 'TouchUp', 'Custom'].includes(currentType)">
      <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">目标位置
        (Target)</label>
        <div class="flex gap-1"><input :value="getTargetValue('target')"
                                       @input="setTargetValue('target', $event.target.value)"
                                       class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0"
                                       placeholder="留空默认自身, 或输入节点名/[x,y,w,h]"/>
          <button @click="$emit('open-picker', 'target', null, 'Target')"
                  class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center">
            <Crop :size="12"/>
          </button>
        </div>
      </div>
      <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">目标偏移
        (Offset)</label>
        <div class="flex gap-1"><input :value="getJsonValue('target_offset')"
                                       @input="setJsonValue('target_offset', $event.target.value)"
                                       class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0"
                                       placeholder="[x,y,w,h]"/>
          <button @click="$emit('open-picker', 'target_offset', 'target', '目标区域')"
                  class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center">
            <Crosshair :size="12"/>
          </button>
        </div>
      </div>
      <div v-if="['Click', 'LongPress', 'TouchDown', 'TouchMove', 'TouchUp'].includes(currentType)"
           class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">触点编号</label><input type="number"
                                                                                              :value="getValue('contact', 0)"
                                                                                              @input="setValue('contact', parseInt($event.target.value) || 0)"
                                                                                              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
        <div v-if="currentType.startsWith('Touch')" class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">压力值</label><input type="number"
                                                                                            :value="getValue('pressure', 0)"
                                                                                            @input="setValue('pressure', parseInt($event.target.value) || 0)"
                                                                                            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"/>
        </div>
      </div>
    </template>
    <template v-if="['Swipe', 'MultiSwipe'].includes(currentType)">
      <div v-if="currentType === 'MultiSwipe'"
           class="p-2 bg-amber-50 rounded text-[10px] text-amber-700 mb-2">MultiSwipe 请直接在 JSON 模式编辑
        `swipes` 数组。下方仅为单个 Swipe 属性参考。
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">起点</label>
          <div class="flex gap-1"><input :value="getTargetValue('begin')"
                                         @input="setTargetValue('begin', $event.target.value)"
                                         class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"/>
            <button @click="$emit('open-picker', 'begin', null, '起点')"
                    class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg">
              <Crop :size="12"/>
            </button>
          </div>
        </div>
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">起点偏移</label>
          <div class="flex gap-1"><input :value="getJsonValue('begin_offset')"
                                         @input="setJsonValue('begin_offset', $event.target.value)"
                                         class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"/>
            <button @click="$emit('open-picker', 'begin_offset', 'begin', '起点')"
                    class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg">
              <Crosshair :size="12"/>
            </button>
          </div>
        </div>
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">终点</label>
          <div class="flex gap-1"><input :value="getTargetValue('end')"
                                         @input="setTargetValue('end', $event.target.value)"
                                         class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"/>
            <button @click="$emit('open-picker', 'end', 'begin', '起点')"
                    class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg">
              <Crop :size="12"/>
            </button>
          </div>
        </div>
        <div class="space-y-1"><label
            class="text-[10px] font-semibold text-slate-500 uppercase">终点偏移</label>
          <div class="flex gap-1"><input :value="getJsonValue('end_offset')"
                                         @input="setJsonValue('end_offset', $event.target.value)"
                                         class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"/>
            <button @click="$emit('open-picker', 'end_offset', 'end', '终点')"
                    class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg">
              <Crosshair :size="12"/>
            </button>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">持续
          (ms)</label><input :value="getJsonValue('duration')"
                             @input="setJsonValue('duration', $event.target.value)"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
        </div>
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">保持
          (ms)</label><input :value="getJsonValue('end_hold')"
                             @input="setJsonValue('end_hold', $event.target.value)"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
        </div>
      </div>
      <div class="mt-2 flex gap-3"><label class="inline-flex items-center gap-1.5 cursor-pointer"><input
          type="checkbox" :checked="getValue('only_hover', false)"
          @change="setValue('only_hover', $event.target.checked)"
          class="w-3.5 h-3.5 rounded text-indigo-600"/><span class="text-[11px] text-slate-600">仅悬停 (Only Hover)</span></label>
      </div>
    </template>
    <template v-if="['ClickKey', 'LongPressKey', 'KeyDown', 'KeyUp'].includes(currentType)">
      <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">按键码
        (Key)</label><input :value="getJsonValue('key')" @input="setJsonValue('key', $event.target.value)"
                            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                            placeholder="25 或 [25, 26]"/></div>
    </template>
    <template v-if="currentType === 'Scroll'">
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">水平滚动
          (DX)</label><input type="number" :value="getValue('dx', 0)"
                             @input="setValue('dx', parseInt($event.target.value) || 0)"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
        </div>
        <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">垂直滚动
          (DY)</label><input type="number" :value="getValue('dy', 0)"
                             @input="setValue('dy', parseInt($event.target.value) || 0)"
                             class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
        </div>
      </div>
    </template>
    <template v-if="currentType === 'InputText'">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">输入文本</label><input
          :value="getValue('input_text', '')" @input="setValue('input_text', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/></div>
    </template>
    <template v-if="['StartApp', 'StopApp'].includes(currentType)">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">应用包名</label><input
          :value="getValue('package', '')" @input="setValue('package', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
          placeholder="com.example.app"/></div>
    </template>
    <template v-if="['LongPress', 'LongPressKey'].includes(currentType)">
      <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">持续时间
        (ms)</label><input type="number" :value="getValue('duration', 1000)"
                           @input="setValue('duration', parseInt($event.target.value) || 1000)"
                           class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/>
      </div>
    </template>
    <template v-if="currentType === 'Command'">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">执行程序</label><input
          :value="getValue('exec', '')" @input="setValue('exec', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"/>
      </div>
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">参数</label><input
          :value="getJsonValue('args')" @input="setJsonValue('args', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
          placeholder='["arg1"]'/></div>
      <label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox"
                                                                            :checked="getValue('detach', false)"
                                                                            @change="setValue('detach', $event.target.checked)"
                                                                            class="w-3.5 h-3.5 rounded text-indigo-600"/><span
          class="text-[11px] text-slate-600">分离进程</span></label></template>
    <template v-if="currentType === 'Custom'">
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">自定义动作名</label><input
          :value="getValue('custom_action', '')" @input="setValue('custom_action', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"/></div>
      <div class="space-y-1"><label
          class="text-[10px] font-semibold text-slate-500 uppercase">自定义参数</label><textarea
          :value="getJsonValue('custom_action_param')"
          @input="setJsonValue('custom_action_param', $event.target.value)"
          class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono h-14 resize-none"
          placeholder="JSON"></textarea></div>
    </template>
  </div>
</template>