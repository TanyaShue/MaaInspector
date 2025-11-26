<script setup>
import { ref, watch } from 'vue'
import { X, Save, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean,
  nodeData: Object
})

const emit = defineEmits(['close', 'save'])

const jsonStr = ref('')
const error = ref('')

// 当弹窗打开时，格式化 JSON 用于展示
watch(() => props.nodeData, (val) => {
  if (val) {
    // 过滤掉 VueFlow 内部属性，只保留业务数据
    const { id, type, position, label, ...businessData } = val
    // 将 id 和 type 也放进去方便查看，但主要编辑 businessData
    const displayData = { id, type, ...businessData }
    jsonStr.value = JSON.stringify(displayData, null, 2)
    error.value = ''
  }
}, { immediate: true })

const handleSave = () => {
  try {
    const parsed = JSON.parse(jsonStr.value)
    error.value = ''
    emit('save', parsed)
  } catch (e) {
    error.value = 'JSON 格式错误: ' + e.message
  }
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-white w-[500px] rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

      <!-- 头部 -->
      <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h3 class="font-bold text-slate-700">节点数据编辑</h3>
        <button @click="$emit('close')" class="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-500">
          <X :size="20" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="p-4 flex-1 flex flex-col gap-2">
        <div class="text-xs text-slate-500 mb-1">请编辑节点的 JSON 属性，保存后将自动更新节点类型。</div>

        <textarea
          v-model="jsonStr"
          class="w-full h-64 p-3 font-mono text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 resize-none"
          spellcheck="false"
        ></textarea>

        <!-- 错误提示 -->
        <div v-if="error" class="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-2 rounded">
          <AlertCircle :size="16" />
          <span>{{ error }}</span>
        </div>
      </div>

      <!-- 底部 -->
      <div class="px-4 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
        <button @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg transition-all">
          取消
        </button>
        <button @click="handleSave" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 rounded-lg flex items-center gap-1 transition-all">
          <Save :size="16" />
          保存更改
        </button>
      </div>
    </div>
  </div>
</template>