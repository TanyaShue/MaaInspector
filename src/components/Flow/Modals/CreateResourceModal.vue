<script setup>
import { ref, watch, computed } from 'vue'
import { FilePlus, Folder, Save, X, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean,
  paths: Array // 当前配置下的所有路径选项
})

const emit = defineEmits(['close', 'create'])

const filename = ref('')
const selectedPathIndex = ref(0)
const errorMsg = ref('')

// 当 Modal 打开时重置状态
watch(() => props.visible, (val) => {
  if (val) {
    filename.value = ''
    selectedPathIndex.value = 0
    errorMsg.value = ''
  }
})

const handleCreate = () => {
  if (!filename.value.trim()) {
    errorMsg.value = "请输入文件名"
    return
  }
  // 简单的文件名校验
  if (filename.value.match(/[<>:"/\\|?*]/)) {
    errorMsg.value = "文件名包含非法字符"
    return
  }

  const targetPath = props.paths[selectedPathIndex.value]
  if (!targetPath) {
    errorMsg.value = "无效的路径"
    return
  }

  emit('create', {
    path: targetPath,
    filename: filename.value.trim()
  })
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-white rounded-xl shadow-2xl border border-slate-200 w-[400px] overflow-hidden">

      <div class="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
        <h3 class="font-bold text-slate-700 flex items-center gap-2">
          <FilePlus :size="16" class="text-indigo-500" />
          新建资源文件
        </h3>
        <button @click="$emit('close')" class="text-slate-400 hover:text-red-500 transition-colors">
          <X :size="20" />
        </button>
      </div>

      <div class="p-5 space-y-4">

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-slate-400 uppercase">文件名 (无需后缀)</label>
          <div class="relative">
            <input
              v-model="filename"
              type="text"
              placeholder="e.g. level_1_script"
              class="w-full bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-12 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"
              @keyup.enter="handleCreate"
            />
            <span class="absolute right-3 top-2 text-xs text-slate-400 font-mono">.json</span>
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-[10px] font-bold text-slate-400 uppercase">存储位置 (Root Path)</label>
          <div class="relative">
            <div class="absolute left-3 top-2 text-slate-400 pointer-events-none"><Folder :size="14" /></div>
            <select v-model="selectedPathIndex" class="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 appearance-none cursor-pointer truncate">
              <option v-for="(path, idx) in paths" :key="idx" :value="idx">
                {{ path }}
              </option>
              <option v-if="!paths || paths.length === 0" disabled>无可用路径</option>
            </select>
          </div>
          <p class="text-[10px] text-slate-400 ml-1">文件将创建于: <span class="font-mono text-slate-500">/pipeline/</span> 目录下</p>
        </div>

        <div v-if="errorMsg" class="text-xs text-red-500 flex items-center gap-1 bg-red-50 p-2 rounded">
          <AlertCircle :size="12" /> {{ errorMsg }}
        </div>

      </div>

      <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
        <button @click="$emit('close')" class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-colors">取消</button>
        <button @click="handleCreate" class="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1">
          <Save :size="14" /> 创建
        </button>
      </div>
    </div>
  </div>
</template>