<script setup lang="ts">
import { Crop, Crosshair } from 'lucide-vue-next'
import type { NodeFormMethods } from '@/composables/useNodeForm'
import type { ActionType, SelectOption } from '@/utils/node-config'
import CustomCompletionEditor from './CustomCompletionEditor.vue'

const emit = defineEmits<{
  (e: 'open-picker', field: string, referenceField: string | null, referenceLabel?: string): void
}>()

const props = defineProps<{
  currentAction: ActionType | string
  actionConfig?: SelectOption<string>
  form: NodeFormMethods
}>()

const { getValue, setValue, getJsonValue, setJsonValue, getTargetValue, setTargetValue } =
  props.form

const getInputValue = (event: Event) =>
  (event.target as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ''
const getChecked = (event: Event) => (event.target as HTMLInputElement | null)?.checked ?? false
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <component
        :is="actionConfig?.icon"
        v-if="actionConfig?.icon"
        :size="14"
        :class="actionConfig?.color"
      />
      <span>{{ actionConfig?.label }} 属性</span>
      <span class="text-[10px] text-slate-400">({{ actionConfig?.value }})</span>
    </div>

    <div
      v-if="['DoNothing', 'StopTask'].includes(currentAction)"
      class="text-[12px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2"
    >
      当前动作无需额外配置。
    </div>
    <div v-else class="rounded-xl border border-slate-100 overflow-hidden">
      <div class="p-3 space-y-2.5 border-t border-slate-100">
        <template
          v-if="
            ['Click', 'LongPress', 'TouchDown', 'TouchMove', 'TouchUp', 'Custom'].includes(
              currentAction
            )
          "
        >
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase"
              >目标位置 (Target)</label
            >
            <div class="flex gap-1">
              <input
                :value="getTargetValue('target')"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0"
                placeholder="留空默认自身, 或输入节点名/[x,y,w,h]"
                @input="setTargetValue('target', getInputValue($event))"
              />
              <button
                class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"
                @click="emit('open-picker', 'target', null, 'Target')"
              >
                <Crop :size="12" />
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase"
              >目标偏移 (Offset)</label
            >
            <div class="flex gap-1">
              <input
                :value="getJsonValue('target_offset')"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0"
                placeholder="[x,y,w,h]"
                @input="setJsonValue('target_offset', getInputValue($event))"
              />
              <button
                class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"
                @click="emit('open-picker', 'target_offset', 'target', '目标区域')"
              >
                <Crosshair :size="12" />
              </button>
            </div>
          </div>
          <div
            v-if="
              ['Click', 'LongPress', 'TouchDown', 'TouchMove', 'TouchUp'].includes(currentAction)
            "
            class="grid grid-cols-2 gap-2"
          >
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">触点编号</label>
              <input
                type="number"
                :value="getValue('contact', 0)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setValue('contact', parseInt(getInputValue($event)) || 0)"
              />
            </div>
            <div v-if="currentAction.startsWith('Touch')" class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">压力值</label>
              <input
                type="number"
                :value="getValue('pressure', 0)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                @input="setValue('pressure', parseInt(getInputValue($event)) || 0)"
              />
            </div>
          </div>
        </template>

        <template v-if="['Swipe', 'MultiSwipe'].includes(currentAction)">
          <div
            v-if="currentAction === 'MultiSwipe'"
            class="p-2 bg-amber-50 rounded text-[10px] text-amber-700 mb-2"
          >
            MultiSwipe 请直接在 JSON 模式编辑 `swipes` 数组。下方仅为单个 Swipe 属性参考。
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">起点</label>
              <div class="flex gap-1">
                <input
                  :value="getTargetValue('begin')"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"
                  @input="setTargetValue('begin', getInputValue($event))"
                />
                <button
                  class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg"
                  @click="emit('open-picker', 'begin', null, '起点')"
                >
                  <Crop :size="12" />
                </button>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">起点偏移</label>
              <div class="flex gap-1">
                <input
                  :value="getJsonValue('begin_offset')"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"
                  @input="setJsonValue('begin_offset', getInputValue($event))"
                />
                <button
                  class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"
                  @click="emit('open-picker', 'begin_offset', 'begin', '起点')"
                >
                  <Crosshair :size="12" />
                </button>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">终点</label>
              <div class="flex gap-1">
                <input
                  :value="getTargetValue('end')"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"
                  @input="setTargetValue('end', getInputValue($event))"
                />
                <button
                  class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg"
                  @click="emit('open-picker', 'end', 'begin', '起点')"
                >
                  <Crop :size="12" />
                </button>
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">终点偏移</label>
              <div class="flex gap-1">
                <input
                  :value="getJsonValue('end_offset')"
                  class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono min-w-0"
                  @input="setJsonValue('end_offset', getInputValue($event))"
                />
                <button
                  class="px-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg"
                  @click="emit('open-picker', 'end_offset', 'end', '终点')"
                >
                  <Crosshair :size="12" />
                </button>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">持续 (ms)</label>
              <input
                :value="getJsonValue('duration')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                @input="setJsonValue('duration', getInputValue($event))"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase">保持 (ms)</label>
              <input
                :value="getJsonValue('end_hold')"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                @input="setJsonValue('end_hold', getInputValue($event))"
              />
            </div>
          </div>
          <div class="mt-2 flex gap-3">
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                :checked="getValue('only_hover', false)"
                class="w-3.5 h-3.5 rounded text-indigo-600"
                @change="setValue('only_hover', getChecked($event))"
              />
              <span class="text-[11px] text-slate-600">仅悬停 (Only Hover)</span>
            </label>
          </div>
        </template>

        <template v-if="['ClickKey', 'LongPressKey', 'KeyDown', 'KeyUp'].includes(currentAction)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">按键码 (Key)</label>
            <input
              :value="getJsonValue('key')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              placeholder="25 或 [25, 26]"
              @input="setJsonValue('key', getInputValue($event))"
            />
          </div>
        </template>

        <template v-if="currentAction === 'Scroll'">
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase"
                >水平滚动 (DX)</label
              >
              <input
                type="number"
                :value="getValue('dx', 0)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                @input="setValue('dx', parseInt(getInputValue($event)) || 0)"
              />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-500 uppercase"
                >垂直滚动 (DY)</label
              >
              <input
                type="number"
                :value="getValue('dy', 0)"
                class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                @input="setValue('dy', parseInt(getInputValue($event)) || 0)"
              />
            </div>
          </div>
        </template>

        <template v-if="currentAction === 'InputText'">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">输入文本</label>
            <input
              :value="getValue('input_text', '')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              @input="setValue('input_text', getInputValue($event))"
            />
          </div>
        </template>

        <template v-if="['StartApp', 'StopApp'].includes(currentAction)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">应用包名</label>
            <input
              :value="getValue('package', '')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              placeholder="com.example.app"
              @input="setValue('package', getInputValue($event))"
            />
          </div>
        </template>

        <template v-if="['LongPress', 'LongPressKey'].includes(currentAction)">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">持续时间 (ms)</label>
            <input
              type="number"
              :value="getValue('duration', 1000)"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              @input="setValue('duration', parseInt(getInputValue($event)) || 1000)"
            />
          </div>
        </template>

        <template v-if="currentAction === 'Command'">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">执行程序</label>
            <input
              :value="getValue('exec', '')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              @input="setValue('exec', getInputValue($event))"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">参数</label>
            <input
              :value="getJsonValue('args')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              placeholder='["arg1"]'
              @input="setJsonValue('args', getInputValue($event))"
            />
          </div>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              :checked="getValue('detach', false)"
              class="w-3.5 h-3.5 rounded text-indigo-600"
              @change="setValue('detach', getChecked($event))"
            />
            <span class="text-[11px] text-slate-600">分离进程</span>
          </label>
        </template>

        <template v-if="currentAction === 'Shell'">
          <div
            class="p-2 bg-slate-50 border border-dashed border-slate-200 rounded text-[11px] text-slate-600 mb-2"
          >
            仅对 ADB 控制器生效。命令输出可在动作详情中查看。
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase">命令 (cmd)</label>
            <input
              :value="getValue('cmd', '')"
              class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
              placeholder="getprop ro.build.version.sdk"
              @input="setValue('cmd', getInputValue($event))"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase"
              >目标位置 (Target)</label
            >
            <div class="flex gap-1">
              <input
                :value="getTargetValue('target')"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0"
                placeholder="true / 节点名 / [x,y,w,h]"
                @input="setTargetValue('target', getInputValue($event))"
              />
              <button
                class="px-2 bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center justify-center"
                @click="emit('open-picker', 'target', null, 'Target')"
              >
                <Crop :size="12" />
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-slate-500 uppercase"
              >目标偏移 (Offset)</label
            >
            <div class="flex gap-1">
              <input
                :value="getJsonValue('target_offset')"
                class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 font-mono min-w-0"
                placeholder="[x,y,w,h]"
                @input="setJsonValue('target_offset', getInputValue($event))"
              />
              <button
                class="px-2 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center justify-center"
                @click="emit('open-picker', 'target_offset', 'target', '目标区域')"
              >
                <Crosshair :size="12" />
              </button>
            </div>
          </div>
        </template>

        <template v-if="currentAction === 'Custom'">
          <CustomCompletionEditor
            kind="action"
            :model-value="getValue('custom_action', '')"
            :param-value="getValue('custom_action_param', undefined)"
            @update:model-value="setValue('custom_action', $event)"
            @update:param-value="setValue('custom_action_param', $event)"
          />
        </template>
      </div>
    </div>
  </div>
</template>
