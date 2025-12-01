<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X, Search, MapPin } from 'lucide-vue-next'

const props = defineProps({
  visible: { type: Boolean, default: false },
  nodes: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'locate-node'])

// 搜索关键词
const searchQuery = ref('')
const inputRef = ref(null)

// 拖动状态
const position = ref({ x: 100, y: 100 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 搜索结果
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.nodes.slice(0, 10) // 显示前10个节点
  }
  const query = searchQuery.value.toLowerCase()
  return props.nodes.filter(node => 
    node.id.toLowerCase().includes(query) ||
    (node.data?.data?.id && node.data.data.id.toLowerCase().includes(query))
  ).slice(0, 20) // 最多显示20个结果
})

// 获取节点显示ID
const getNodeDisplayId = (node) => {
  return node.data?.data?.id || node.id
}

// 获取节点类型标签
const getNodeTypeLabel = (node) => {
  const typeMap = {
    'DirectHit': '通用匹配',
    'TemplateMatch': '模板匹配',
    'FeatureMatch': '特征匹配',
    'ColorMatch': '颜色识别',
    'OCR': 'OCR识别',
    'NeuralNetworkClassify': '模型分类',
    'NeuralNetworkDetect': '模型检测',
    'Custom': '自定义',
    'Unknown': '未知'
  }
  return typeMap[node.data?.type] || '未知'
}

// 定位到节点
const locateNode = (node) => {
  emit('locate-node', node.id)
}

// 拖动逻辑
const startDrag = (e) => {
  if (e.target.closest('input') || e.target.closest('.search-results')) return
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e) => {
  if (!isDragging.value) return
  position.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 监听 visible 变化，自动聚焦输入框
watch(() => props.visible, (val) => {
  if (val) {
    searchQuery.value = ''
    // 重置位置到中心
    position.value = { x: window.innerWidth / 2 - 160, y: 100 }
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
})

// 键盘快捷键
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<template>
  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="visible"
      class="fixed z-[100] w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden select-none"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @mousedown.stop
    >
      <!-- 标题栏（可拖动） -->
      <div
        class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100 cursor-move"
        @mousedown="startDrag"
      >
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
            <Search :size="14" class="text-emerald-500" />
          </div>
          <span class="font-bold text-slate-700 text-sm">搜索节点</span>
        </div>
        <button
          @click.stop="$emit('close')"
          class="p-1.5 hover:bg-white/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- 搜索输入框 -->
      <div class="p-3 border-b border-slate-100">
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            placeholder="输入节点 ID 进行搜索..."
            class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
          />
        </div>
        <div class="mt-2 text-[10px] text-slate-400">
          共 {{ nodes.length }} 个节点，显示 {{ searchResults.length }} 个结果
        </div>
      </div>

      <!-- 搜索结果列表 -->
      <div class="search-results max-h-[300px] overflow-y-auto custom-scrollbar">
        <div v-if="searchResults.length === 0" class="p-4 text-center text-slate-400 text-sm">
          未找到匹配的节点
        </div>
        <div
          v-for="node in searchResults"
          :key="node.id"
          class="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0 group"
          @click="locateNode(node)"
        >
          <div class="flex-1 min-w-0">
            <div class="font-mono text-sm text-slate-700 truncate" :title="getNodeDisplayId(node)">
              {{ getNodeDisplayId(node) }}
            </div>
            <div class="text-[10px] text-slate-400">
              {{ getNodeTypeLabel(node) }}
            </div>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <MapPin :size="14" class="text-emerald-500" />
            <span class="text-[10px] text-emerald-600 font-medium">定位</span>
          </div>
        </div>
      </div>

      <!-- 提示 -->
      <div class="px-4 py-2 bg-slate-50 border-t border-slate-100">
        <div class="text-[10px] text-slate-400 flex items-center gap-2">
          <span class="px-1.5 py-0.5 bg-slate-200 rounded text-slate-500 font-mono">ESC</span>
          <span>关闭</span>
          <span class="mx-1">·</span>
          <span>点击结果定位节点</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}
</style>

