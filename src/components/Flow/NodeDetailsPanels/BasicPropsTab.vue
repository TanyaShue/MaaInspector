<script setup>
import { ChevronDown, Check, Settings } from 'lucide-vue-next'

const props = defineProps({
  nodeId: String,
  editingId: String,
  recognitionConfig: Object,
  recognitionTypes: Array,
  currentRecognition: String,
  isRecognitionDropdownOpen: Boolean,
  actionConfig: Object,
  actionTypes: Array,
  currentAction: String,
  isActionDropdownOpen: Boolean,
})

const emit = defineEmits([
  'update:editingId',
  'confirm-id-change',
  'toggle-dropdown',
  'select-recognition',
  'select-action',
  'jump-to-settings',
])

const toggleDropdown = (key) => {
  emit('toggle-dropdown', key)
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="space-y-1">
      <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">节点 ID</label>
      <div class="flex gap-1.5">
        <input
          :value="editingId"
          @input="emit('update:editingId', $event.target.value)"
          class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 font-mono"
        />
        <button
          v-if="editingId !== nodeId"
          @click="emit('confirm-id-change')"
          class="px-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-0.5"
        >
          <Check :size="10" />
          应用
        </button>
      </div>
    </div>

    <div class="space-y-1 relative z-[80]">
      <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">识别算法</label>
      <div class="flex gap-2">
        <div class="relative flex-1">
          <button
            @click="toggleDropdown('recognition')"
            class="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 cursor-pointer text-left"
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <component
                v-if="recognitionConfig?.icon"
                :is="recognitionConfig.icon"
                :size="14"
                :class="recognitionConfig.color"
                class="shrink-0"
              />
              <span class="truncate">
                {{ recognitionConfig?.label }}
                <span class="text-slate-400 text-[10px] ml-0.5">({{ recognitionConfig?.value }})</span>
              </span>
            </div>
            <ChevronDown
              :size="12"
              class="text-slate-400 shrink-0 ml-1"
              :class="{ 'rotate-180': isRecognitionDropdownOpen }"
            />
          </button>

          <div
            v-if="isRecognitionDropdownOpen"
            class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar-dark flex flex-col py-1"
          >
            <button
              v-for="type in recognitionTypes"
              :key="type.value"
              @click="emit('select-recognition', type.value)"
              class="flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors shrink-0"
              :class="{
                'bg-indigo-50/60 text-indigo-600': currentRecognition === type.value,
                'text-slate-700': currentRecognition !== type.value
              }"
            >
              <component v-if="type.icon" :is="type.icon" :size="14" :class="type.color" class="shrink-0" />
              <span class="truncate">{{ type.label }}</span>
              <span class="ml-auto text-[10px] font-mono text-slate-400">{{ type.value }}</span>
              <Check v-if="currentRecognition === type.value" :size="12" class="text-indigo-600 ml-2" />
            </button>
          </div>
        </div>
        <button
          @click="emit('jump-to-settings', 'recognition')"
          :disabled="currentRecognition === 'DirectHit'"
          class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Settings :size="14" />
        </button>
      </div>
    </div>

    <div class="space-y-1 relative z-[70]">
      <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">执行动作</label>
      <div class="flex gap-2">
        <div class="relative flex-1">
          <button
            @click="toggleDropdown('action')"
            class="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 cursor-pointer text-left"
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <component v-if="actionConfig?.icon" :is="actionConfig.icon" :size="14" :class="actionConfig.color" class="shrink-0" />
              <span class="truncate">
                {{ actionConfig?.label }}
                <span class="text-slate-400 text-[10px] ml-0.5">({{ actionConfig?.value }})</span>
              </span>
            </div>
            <ChevronDown
              :size="12"
              class="text-slate-400 shrink-0 ml-1"
              :class="{ 'rotate-180': isActionDropdownOpen }"
            />
          </button>

          <div
            v-if="isActionDropdownOpen"
            class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar-dark flex flex-col py-1"
          >
            <button
              v-for="type in actionTypes"
              :key="type.value"
              @click="emit('select-action', type.value)"
              class="flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors shrink-0"
              :class="{
                'bg-indigo-50/60 text-indigo-600': currentAction === type.value,
                'text-slate-700': currentAction !== type.value
              }"
            >
              <component v-if="type.icon" :is="type.icon" :size="14" :class="type.color" class="shrink-0" />
              <span class="truncate">{{ type.label }}</span>
              <span class="ml-auto text-[10px] font-mono text-slate-400">{{ type.value }}</span>
              <Check v-if="currentAction === type.value" :size="12" class="text-indigo-600 ml-2" />
            </button>
          </div>
        </div>
        <button
          @click="emit('jump-to-settings', 'action')"
          :disabled="['DoNothing', 'StopTask'].includes(currentAction)"
          class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Settings :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
