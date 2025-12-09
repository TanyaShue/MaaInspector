<script setup lang="ts">
import {ref, computed, watch, onMounted, onUnmounted} from 'vue'
import {X, Search, MapPin, Regex, FileJson, Loader2, ArrowRightCircle} from 'lucide-vue-next'
import {resourceApi} from '../../services/api.ts'
import type { FlowNode } from '../../utils/flowTypes'

interface RemoteResult {
  node_id: string
  filename: string
  source: string
  display_id: string
  [key: string]: unknown
}

const props = defineProps<{
  visible?: boolean
  nodes?: FlowNode[]
  currentFilename?: string
  currentSource?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locate-node', id: string): void
  (e: 'switch-file', payload: { filename: string; source: string; nodeId: string }): void
}>()

// 搜索状态
const searchQuery = ref<string>('')
const useRegex = ref<boolean>(false)
const inputRef = ref<HTMLInputElement | null>(null)
const isSearchingRemote = ref<boolean>(false)

// 结果集
const otherFileResults = ref<RemoteResult[]>([]) // 远程结果

// 拖动状态
const position = ref({x: 100, y: 100})
const isDragging = ref(false)
const dragOffset = ref({x: 0, y: 0})

// --- 1. 本地搜索逻辑 ---
const localResults = computed(() => {
  const nodeList = props.nodes || []
  let filtered = nodeList
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value
    let regex = null

    if (useRegex.value) {
      try {
        regex = new RegExp(query, 'i')
      } catch (e) {
        return []
      }
    }

    filtered = nodeList.filter(node => {
      const displayId = node.data?.data?.id || node.id
      const rawId = node.id

      if (regex) {
        return regex.test(displayId) || regex.test(rawId)
      } else {
        return displayId.toLowerCase().includes(query.toLowerCase()) ||
            rawId.toLowerCase().includes(query.toLowerCase())
      }
    })
  }
  
  // 按节点名称排序
  return [...filtered]
    .sort((a, b) => {
      const aId = ((a as any).data?.data?.id || a.id).toLowerCase()
      const bId = ((b as any).data?.data?.id || b.id).toLowerCase()
      return aId.localeCompare(bId)
    })
    .slice(0, 15)
})

// --- [新增] 2. 远程结果分组逻辑 ---
const groupedRemoteResults = computed(() => {
  if (!otherFileResults.value.length) return []
  
  const groups: Record<string, { key: string; source: string; filename: string; items: RemoteResult[] }> = {}
  
  otherFileResults.value.forEach(item => {
    // 创建唯一的分组Key (路径 + 文件名)
    const key = `${item.source}::${item.filename}`
    
    if (!groups[key]) {
      groups[key] = {
        key,
        source: item.source,
        filename: item.filename,
        items: []
      }
    }
    groups[key].items.push(item)
  })
  
  // 可以根据需求对文件组进行排序，这里默认按API返回顺序保持
  return Object.values(groups)
})

// --- 3. 远程搜索逻辑 (防抖) ---
let debounceTimer: ReturnType<typeof setTimeout> | null = null

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
        props.currentFilename || '',
        props.currentSource || ''
    )
    otherFileResults.value = (res as any).results || []
  } catch (e) {
    console.error("Remote search failed", e)
    otherFileResults.value = []
  } finally {
    isSearchingRemote.value = false
  }
}

watch([searchQuery, useRegex], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  
  if (searchQuery.value.trim()) {
    debounceTimer = setTimeout(performRemoteSearch, 500) // 500ms 防抖
  } else {
    otherFileResults.value = []
  }
})


// --- 辅助函数 ---
const getNodeDisplayId = (node: FlowNode) => (node as any).data?.data?.id || node.id
const getNodeTypeLabel = (type?: string) => {
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
  return typeMap[type as keyof typeof typeMap] || type || '未知'
}

const shortenPath = (fullPath: string, maxLen = 35) => {
  if (!fullPath) return ''
  const normalized = fullPath.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  
  if (parts.length <= 2) return parts.join('/')
  
  const lastTwo = parts.slice(-2).join('/')
  if (normalized.length <= maxLen) return normalized
  
  const firstPart = parts[0]
  return `${firstPart}/.../${lastTwo}`
}

// --- 交互 ---
const locateLocalNode = (node: FlowNode) => {
  emit('locate-node', node.id)
}

const switchToRemoteNode = (result: RemoteResult) => {
  emit('switch-file', {
    filename: result.filename,
    source: result.source,
    nodeId: result.node_id
  })
}

// 拖动逻辑
const startDrag = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (target && (target.closest('input') || target.closest('.search-results') || target.closest('button'))) return
  isDragging.value = true
  dragOffset.value = {x: e.clientX - position.value.x, y: e.clientY - position.value.y}
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}
const onDrag = (e: MouseEvent) => {
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

const handleKeydown = (e: KeyboardEvent) => {
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
          <div class="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>当前文件</span>
            <span class="bg-emerald-100 text-emerald-600 px-1.5 rounded-full">{{ localResults.length }}</span>
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
            <MapPin :size="14" class="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"/>
          </div>
        </div>

        <div v-if="localResults.length > 0 && (otherFileResults.length > 0 || isSearchingRemote)"
             class="h-px bg-slate-200 mx-4 my-1"></div>

        <div v-if="searchQuery.trim()" class="pb-2 pt-2">
          <div class="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
            <span>全局搜索</span>
            <span v-if="!isSearchingRemote" class="bg-slate-200 text-slate-600 px-1.5 rounded-full">{{ otherFileResults.length }}</span>
            <Loader2 v-else :size="12" class="animate-spin text-blue-500"/>
          </div>

          <div v-if="otherFileResults.length === 0 && !isSearchingRemote && searchQuery"
               class="px-4 py-2 text-xs text-slate-400 italic">
            其他资源目录中无匹配节点
          </div>

          <div v-if="!isSearchingRemote && groupedRemoteResults.length > 0">
            <div v-for="group in groupedRemoteResults" :key="group.key" class="mb-2">
              
              <div class="px-4 py-1.5 bg-slate-100 border-y border-slate-200/50 flex items-center gap-2 sticky top-0 z-10">
                <FileJson :size="12" class="text-slate-500"/>
                <span class="text-xs font-semibold text-slate-600 truncate" :title="group.filename">{{ group.filename }}</span>
                <span class="text-[10px] text-slate-400 truncate ml-auto font-mono" :title="group.source">
                  {{ shortenPath(group.source) }}
                </span>
              </div>

              <div
                  v-for="(res, idx) in group.items"
                  :key="idx + res.node_id"
                  class="flex items-center justify-between px-4 pl-8 py-2 hover:bg-blue-50 cursor-pointer transition-colors group border-l-[3px] border-transparent hover:border-blue-400 ml-0"
                  @click="switchToRemoteNode(res)"
              >
                <div class="min-w-0 flex-1">
                  <div class="font-mono text-sm text-slate-700 font-medium truncate flex items-center gap-2">
                    {{ res.display_id }}
                  </div>
                </div>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <span class="text-[10px] text-blue-600 font-bold">Go</span>
                  <ArrowRightCircle :size="14" class="text-blue-500"/>
                </div>
              </div>

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
