<script setup>
import {Loader2, Save, AlertTriangle} from 'lucide-vue-next'

defineProps({
  visible: {type: Boolean, required: true},
  filename: {type: String, default: 'Unknown'},
  isSaving: {type: Boolean, default: false}
})

const emit = defineEmits(['cancel', 'discard', 'save'])
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
    <div
        class="bg-white rounded-xl shadow-2xl border border-slate-200 w-[380px] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        @mousedown.stop>
      <div class="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-100">
        <div class="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle :size="20" class="text-amber-600"/>
        </div>
        <div>
          <h3 class="font-bold text-slate-800">未保存的更改</h3>
          <p class="text-xs text-slate-500 mt-0.5">当前文件有修改尚未保存</p>
        </div>
      </div>

      <div class="px-5 py-4">
        <p class="text-sm text-slate-600">
          您正在切换到另一个文件，当前文件 <span class="font-mono font-bold text-slate-800">{{ filename }}</span>
          有未保存的更改。
        </p>
        <p class="text-sm text-slate-500 mt-2">是否要保存更改？</p>
      </div>

      <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
        <button
            @click="$emit('cancel')"
            class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
            @click="$emit('discard')"
            class="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
        >
          不保存
        </button>
        <button
            @click="$emit('save')"
            :disabled="isSaving"
            class="px-3 py-1.5 text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <component :is="isSaving ? Loader2 : Save" :size="12" :class="{'animate-spin': isSaving}"/>
          保存并切换
        </button>
      </div>
    </div>
  </div>
</template>