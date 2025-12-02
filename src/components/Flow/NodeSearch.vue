{
type: uploaded file
fileName: NodeSearch.vue
fullContent:
<script setup>
import {ref, computed, watch, onMounted, onUnmounted} from 'vue'
import {X, Search, MapPin, Regex, FileJson, Loader2, ArrowRightCircle} from 'lucide-vue-next'
import {resourceApi} from '../../services/api'

const props = defineProps({
  visible: {type: Boolean, default: false},
  nodes: {type: Array, default: () => []},
  currentFilename: {type: String, default: ''} // [新增] 需要知道当前文件名以排除
})

// [修改] 增加 switch-file 事件
const emit = defineEmits(['close', 'locate-node', 'switch-file'])

// 搜索状态
const searchQuery = ref('')
const useRegex = ref(false)
const inputRef = ref(null)
const isSearchingRemote = ref(false)

// 结果集
const otherFileResults = ref([]) // 远程结果

// 拖动状态
const position = ref({x: 100, y: 100})
const isDragging = ref(false)
const dragOffset = ref({x: 0, y: 0})

// --- 1. 本地搜索逻辑 ---
const localResults = computed(() => {
  if (!searchQuery.value.trim()) return props.nodes.slice(0, 10)

  const query = searchQuery.value
  let regex = null

  if (useRegex.value) {
    try {
      regex = new RegExp(query, 'i')
    } catch (e) {
      return []
    }
  }

  return props.nodes.filter(node => {
    const displayId = node.data?.data?.id || node.id
    const rawId = node.id

    if (regex) {
      return regex.test(displayId) || regex.test(rawId)
    } else {
      return displayId.toLowerCase().includes(query.toLowerCase()) ||
          rawId.toLowerCase().includes(query.toLowerCase())
    }
  }).slice(0, 10)
})

// --- 2. 远程搜索逻辑 (防抖) ---
let debounceTimer = null

const performRemoteSearch = async () => {
  if (!searchQuery.value.trim()) {
    otherFileResults.value = []
    return
  }

  isSearchingRemote.value = true
  try {
    const res = await resourceApi.searchGlobalNodes(
        searchQuery.value,
        useRegex.value,
        props.currentFilename
    )
    otherFileResults.value = res.results || []
  } catch (e) {
    console.error("Remote search failed", e)
    otherFileResults.value = []
  } finally {
    isSearchingRemote.value = false
  }
}

watch([searchQuery, useRegex], () => {
  // 清除上一次计时
  if (debounceTimer) clearTimeout(debounceTimer)

  // 本地结果是 computed，自动更新
  // 远程结果需要延迟请求
  if (searchQuery.value.trim()) {
    debounceTimer = setTimeout(performRemoteSearch, 500) // 500ms 防抖
  } else {
    otherFileResults.value = []
  }
})


// --- 辅助函数 ---
const getNodeDisplayId = (node) => node.data?.data?.id || node.id
const getNodeTypeLabel = (type) => {
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
  return typeMap[type] || type || '未知'
}

// --- 交互 ---
const locateLocalNode = (node) => {
  emit('locate-node', node.id)
}

const switchToRemoteNode = (result) => {
  // result: { filename, source, node_id, display_id }
  emit('switch-file', {
    filename: result.filename,
    source: result.source,
    nodeId: result.node_id // 这里的 node_id 是 JSON key，对应 VueFlow 的 node.id
  })
}

// 拖动逻辑 (保持不变)
const startDrag = (e) => {
  if (e.target.closest('input') || e.target.closest('.search-results') || e.target.closest('button')) return
  isDragging.value = true
  dragOffset.value = {x: e.clientX - position.value.x, y: e.clientY - position.value.y}
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}
const onDrag = (e) => {
  if (!isDragging.value) return
  position.value = {x: e.clientX - dragOffset.value.x, y: e.clientY - dragOffset.value.y}
}
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

watch(() => props.visible, (val) => {
  if (val) {
    searchQuery.value = ''
    otherFileResults.value = []
    position.value = {x: window.innerWidth / 2 - 200, y: 120}
    setTimeout(() => inputRef.value?.focus(), 100)
  }
})

// 快捷键
const handleKeydown = (e) => {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', handleKeydown))
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
        class="fixed z-[100] w-[400px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden select-none flex flex-col max-h-[500px]"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
        @mousedown.stop
    >
      <div
          class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100 cursor-move shrink-0"
          @mousedown="startDrag">
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
            <Search :size="14" class="text-emerald-500"/>
          </div>
          <span class="font-bold text-slate-700 text-sm">搜索节点</span>
        </div>
        <button @click.stop="$emit('close')"
                class="p-1.5 hover:bg-white/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
          <X :size="16"/>
        </button>
      </div>

      <div class="p-3 border-b border-slate-100 bg-white shrink-0">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
                ref="inputRef"
                v-model="searchQuery"
                type="text"
                :placeholder="useRegex ? '输入正则表达式...' : '输入节点 ID 搜索...'"
                class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all font-mono"
            />
          </div>
          <button
              @click="useRegex = !useRegex"
              class="px-3 rounded-lg border flex items-center justify-center transition-all"
              :class="useRegex ? 'bg-indigo-100 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
              title="正则表达式开关"
          >
            <Regex :size="16"/>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">

        <div v-if="localResults.length > 0" class="py-2">
          <div
              class="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Current File</span>
            <span class="bg-slate-200 text-slate-600 px-1.5 rounded-full">{{ localResults.length }}</span>
          </div>
          <div
              v-for="node in localResults"
              :key="node.id"
              class="flex items-center justify-between px-4 py-2 hover:bg-emerald-50 cursor-pointer transition-colors group"
              @click="locateLocalNode(node)"
          >
            <div class="min-w-0">
              <div class="font-mono text-sm text-slate-700 font-medium truncate">{{ getNodeDisplayId(node) }}</div>
              <div class="text-[10px] text-slate-400 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {{ getNodeTypeLabel(node.data?.type) }}
              </div>
            </div>
            <MapPin :size="14" class="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity"/>
          </div>
        </div>

        <div v-if="localResults.length > 0 && (otherFileResults.length > 0 || isSearchingRemote)"
             class="h-px bg-slate-200 mx-4 my-1"></div>

        <div v-if="searchQuery.trim()" class="py-2">
          <div
              class="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Other Files</span>
            <span v-if="!isSearchingRemote"
                  class="bg-slate-200 text-slate-600 px-1.5 rounded-full">{{ otherFileResults.length }}</span>
            <Loader2 v-else :size="12" class="animate-spin text-blue-500"/>
          </div>

          <div v-if="otherFileResults.length === 0 && !isSearchingRemote && searchQuery"
               class="px-4 py-2 text-xs text-slate-400 italic">
            无其他文件匹配
          </div>

          <div
              v-for="(res, idx) in otherFileResults"
              :key="idx + res.node_id"
              class="flex items-center justify-between px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors group border-l-2 border-transparent hover:border-blue-400"
              @click="switchToRemoteNode(res)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-0.5">
                <FileJson :size="10" class="text-slate-400"/>
                <span class="text-[10px] text-slate-500 truncate max-w-[150px]" :title="res.filename">{{
                    res.filename
                  }}</span>
              </div>
              <div class="font-mono text-sm text-slate-700 font-medium truncate">{{ res.display_id }}</div>
            </div>
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <span class="text-[10px] text-blue-600 font-bold">Go</span>
              <ArrowRightCircle :size="14" class="text-blue-500"/>
            </div>
          </div>
        </div>

      </div>

      <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 shrink-0">
        <div class="text-[10px] text-slate-400 flex items-center gap-2">
          <span class="px-1.5 py-0.5 bg-slate-200 rounded text-slate-500 font-mono">ESC</span> Close
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
</style>
}