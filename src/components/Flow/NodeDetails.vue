<script setup>
import { ref, computed, watch } from 'vue'
import { X, Edit3, Check, FileJson, Activity } from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean,
  nodeId: String,
  nodeData: Object, // 完整的 data 对象
  nodeType: String,
  availableTypes: Array,
  typeConfig: Object
})

const emit = defineEmits(['close', 'update-id', 'update-type'])

const editingId = ref('')

// 当打开时初始化 ID
watch(() => props.visible, (val) => {
  if (val) editingId.value = props.nodeId
})

const businessData = computed(() => props.nodeData.data || {})
const formattedOuterJson = computed(() => JSON.stringify(props.nodeData, null, 2))
const formattedInnerJson = computed(() => JSON.stringify(businessData.value, null, 2))

const confirmIdChange = () => {
  if (editingId.value && editingId.value !== props.nodeId) {
    emit('update-id', { oldId: props.nodeId, newId: editingId.value })
  }
}

const handleTypeChange = (e) => {
  emit('update-type', e.target.value)
}
</script>

<template>
  <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-x-[-10px]" enter-to-class="opacity-100 translate-x-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 translate-x-[-10px]">
    <div
      v-if="visible"
      class="absolute left-[105%] top-0 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 nodrag cursor-default flex flex-col overflow-hidden max-h-[500px]"
      @dblclick.stop
      @wheel.stop
    >
      <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <Edit3 class="w-4 h-4 text-slate-500" />
          <span class="font-bold text-slate-700">编辑节点</span>
        </div>
        <button class="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors" @click.stop="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="p-4 flex flex-col gap-4 overflow-y-auto">
        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
          <label class="text-xs font-bold text-slate-500 uppercase">Node ID</label>
          <div class="flex gap-2">
            <input
              v-model="editingId"
              class="flex-1 text-sm border border-slate-200 rounded px-2 py-1.5 focus:border-blue-400 outline-none font-mono text-slate-700"
            />
            <button
              v-if="editingId !== nodeId"
              @click="confirmIdChange"
              class="px-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold transition-colors flex items-center gap-1"
            >
              <Check :size="12" /> Apply
            </button>
          </div>
          <div class="text-[10px] text-slate-400">Changing ID will update all references.</div>
        </div>

        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
          <label class="text-xs font-bold text-slate-500 uppercase">Node Type</label>
          <div class="relative">
            <select
              :value="nodeType"
              @change="handleTypeChange"
              class="w-full appearance-none bg-white border border-slate-200 rounded px-2 py-1.5 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 cursor-pointer"
            >
              <option v-for="t in availableTypes" :key="t" :value="t">{{ typeConfig[t].label }} ({{ t }})</option>
            </select>
            <div class="absolute right-2 top-2 pointer-events-none text-slate-400">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        </div>

        <div class="space-y-1">
           <div class="flex items-center gap-2 text-slate-500"><FileJson :size="14" /><span class="text-xs font-bold uppercase">Business Data (data.data)</span></div>
           <div class="bg-slate-900 rounded-lg p-3 overflow-hidden">
             <pre class="font-mono text-[10px] text-green-400 whitespace-pre-wrap break-all leading-relaxed">{{ formattedInnerJson }}</pre>
           </div>
        </div>

         <div class="space-y-1">
           <div class="flex items-center gap-2 text-slate-500"><Activity :size="14" /><span class="text-xs font-bold uppercase">VueFlow Data (Outer)</span></div>
           <div class="bg-slate-100 rounded-lg p-2 overflow-hidden border border-slate-200">
             <pre class="font-mono text-[10px] text-slate-600 whitespace-pre-wrap break-all leading-relaxed">{{ formattedOuterJson }}</pre>
           </div>
        </div>
      </div>
    </div>
  </transition>
</template>