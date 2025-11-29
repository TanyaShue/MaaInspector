<script setup>
import { ref, watch } from 'vue'
import { Database, Plus, ArrowUp, ArrowDown, Trash2, X, Save } from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean,
  profiles: Array,
  currentIndex: Number
})

const emit = defineEmits(['close', 'save'])

const editingProfiles = ref([])
const editProfIndex = ref(0)

watch(() => props.visible, (val) => {
  if (val) {
    editingProfiles.value = JSON.parse(JSON.stringify(props.profiles))
    editProfIndex.value = props.currentIndex || 0
  }
})

const addPathToProfile = () => {
  if (!editingProfiles.value[editProfIndex.value]) return
  editingProfiles.value[editProfIndex.value].paths.push("D:/New/Path")
}
const removePath = (pIndex) => {
  editingProfiles.value[editProfIndex.value].paths.splice(pIndex, 1)
}
const movePath = (pIndex, direction) => {
  const paths = editingProfiles.value[editProfIndex.value].paths
  if (direction === -1 && pIndex > 0) {
    [paths[pIndex], paths[pIndex-1]] = [paths[pIndex-1], paths[pIndex]]
  } else if (direction === 1 && pIndex < paths.length - 1) {
    [paths[pIndex], paths[pIndex+1]] = [paths[pIndex+1], paths[pIndex]]
  }
}

const save = () => {
  emit('save', { profiles: editingProfiles.value, index: editProfIndex.value })
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-white rounded-xl shadow-2xl border border-slate-200 flex overflow-hidden w-[700px] h-[500px]">
      <div class="w-[200px] bg-slate-50 border-r border-slate-100 flex flex-col">
        <div class="p-3 text-xs font-bold text-slate-500 border-b border-slate-100">配置列表 (Profiles)</div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
           <div v-for="(prof, idx) in editingProfiles" :key="idx" @click="editProfIndex = idx"
            class="px-3 py-2 rounded-lg cursor-pointer text-xs truncate border transition-all"
            :class="editProfIndex === idx ? 'bg-white border-slate-200 shadow-sm text-indigo-600 font-bold' : 'border-transparent text-slate-600 hover:bg-slate-100'">
             {{ prof.name }}
           </div>
        </div>
        <div class="p-2 border-t border-slate-100">
          <button @click="editingProfiles.push({name:'New Profile', paths:[]}); editProfIndex = editingProfiles.length-1" class="border border-dashed border-slate-300 rounded-lg py-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white transition-colors flex items-center justify-center gap-1 w-full"><Plus :size="12" /> 新建配置</button>
        </div>
      </div>

      <div class="flex-1 flex flex-col bg-white">
        <div class="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 class="font-bold text-slate-700 flex items-center gap-2"><Database :size="16" /> 编辑资源配置</h3>
          <button @click="$emit('close')" class="text-slate-400 hover:text-red-500 transition-colors"><X :size="20" /></button>
        </div>

        <div v-if="editingProfiles[editProfIndex]" class="flex-1 p-5 overflow-hidden flex flex-col gap-4">
          <div class="space-y-1">
             <label class="text-[10px] font-bold text-slate-400 uppercase">Profile Name</label>
             <input v-model="editingProfiles[editProfIndex].name" type="text" class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 font-bold text-indigo-600" />
          </div>

          <div class="flex-1 flex flex-col min-h-0">
             <div class="flex items-center justify-between mb-1">
               <label class="text-[10px] font-bold text-slate-400 uppercase">Resource Paths (按加载顺序)</label>
               <button @click="addPathToProfile" class="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"><Plus :size="10" /> 添加路径</button>
             </div>

             <div class="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-1 space-y-1 custom-scrollbar">
               <div v-for="(path, pIdx) in editingProfiles[editProfIndex].paths" :key="pIdx" class="flex items-center gap-2 bg-white p-2 rounded shadow-sm border border-slate-100 group">
                  <span class="text-[10px] font-mono text-slate-400 w-4 text-center">{{ pIdx + 1 }}</span>
                  <input v-model="editingProfiles[editProfIndex].paths[pIdx]" class="flex-1 text-xs border-none outline-none p-0 text-slate-600 placeholder:text-slate-300" placeholder="Path..." />

                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button @click="movePath(pIdx, -1)" :disabled="pIdx===0" class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 disabled:opacity-30"><ArrowUp :size="12" /></button>
                    <button @click="movePath(pIdx, 1)" :disabled="pIdx===editingProfiles[editProfIndex].paths.length-1" class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 disabled:opacity-30"><ArrowDown :size="12" /></button>
                    <button @click="removePath(pIdx)" class="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><Trash2 :size="12" /></button>
                  </div>
               </div>
               <div v-if="editingProfiles[editProfIndex].paths.length === 0" class="text-center py-4 text-xs text-slate-400 italic">暂无路径</div>
             </div>
          </div>

          <div class="border-t border-slate-100 pt-2 flex justify-between">
             <button @click="editingProfiles.splice(editProfIndex, 1); editProfIndex = Math.max(0, editingProfiles.length-1)" class="text-xs text-red-500 hover:underline">删除此配置</button>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-300">
           <Database :size="48" class="mb-2 opacity-50" />
           <span class="text-xs">请选择或新建资源配置</span>
        </div>

        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
           <button @click="$emit('close')" class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-colors">取消</button>
           <button @click="save" class="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1"><Save :size="14" /> 保存所有配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
</style>