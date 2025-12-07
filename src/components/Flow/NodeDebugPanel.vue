<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X, Bug, PlayCircle, MapPin, Loader2, RefreshCw, Search as SearchIcon,
  Terminal, Activity
} from 'lucide-vue-next'
import { deviceApi, debugApi } from '../../services/api'

const props = defineProps({
  visible: { type: Boolean, default: false },
  nodes: { type: Array, default: () => [] },
  currentFilename: { type: String, default: '' },
  currentSource: { type: String, default: '' },
  initialNodeId: { type: String, default: '' }
})

const emit = defineEmits(['close', 'locate-node', 'debug-node'])

const position = ref({ x: 360, y: 140 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const searchValue = ref('')
const selectedNodeId = ref('')
const previewUrl = ref('')
const isLoadingPreview = ref(false)
const events = ref([])

let stopStream = null

const nodeOptions = computed(() => props.nodes.map(node => ({
  id: node.id,
  label: node.data?.data?.id || node.id
})))

const sortedEvents = computed(() => [...events.value].sort((a, b) => b.timestamp - a.timestamp))

const startDrag = (e) => {
  if (e.target.closest('input') || e.target.closest('select') || e.target.closest('button')) return
  isDragging.value = true
  dragOffset.value = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}
const onDrag = (e) => {
  if (!isDragging.value) return
  position.value = { x: e.clientX - dragOffset.value.x, y: e.clientY - dragOffset.value.y }
}
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const fetchPreview = async () => {
  isLoadingPreview.value = true
  try {
    const res = await deviceApi.getScreenshot()
    previewUrl.value = res?.image || ''
  } catch (e) {
    console.warn('[DebugPanel] 获取设备预览失败，使用占位图', e)
    previewUrl.value = ''
  } finally {
    isLoadingPreview.value = false
  }
}

const appendEvent = (payload) => {
  if (!payload) return
  const nextList = Array.isArray(payload.next_list) ? payload.next_list : []
  const record = {
    taskId: payload.task_id || Date.now(),
    name: payload.name || searchValue.value || selectedNodeId.value || '未知节点',
    nextList,
    timestamp: Date.now()
  }
  events.value = [record, ...events.value].slice(0, 30)
}

const startMockStream = () => {
  stopMockStream()
  stopStream = debugApi.subscribeMockNodeStream(appendEvent, {
    initialNodeId: selectedNodeId.value || searchValue.value
  })
}

const stopMockStream = () => {
  if (stopStream) stopStream()
  stopStream = null
}

const handleDebugNow = () => {
  const targetId = (searchValue.value || selectedNodeId.value || '').trim()
  if (!targetId) return
  emit('debug-node', targetId)
}

const handleLocate = (id) => {
  const targetId = id || selectedNodeId.value || searchValue.value
  if (targetId) emit('locate-node', targetId)
}

const handleViewResult = (item) => {
  console.info('[DebugPanel] 查看调试结果（占位）', item)
}

const formatTime = (ts) => {
  const d = new Date(ts)
  return d.toLocaleTimeString()
}

watch(() => props.visible, (val) => {
  if (val) {
    selectedNodeId.value = props.initialNodeId || ''
    searchValue.value = props.initialNodeId || ''
    position.value = { x: window.innerWidth - 920, y: 160 }
    events.value = []
    startMockStream()
    fetchPreview()
  } else {
    stopMockStream()
  }
})

watch(() => props.initialNodeId, (val) => {
  if (props.visible && val) {
    selectedNodeId.value = val
    searchValue.value = val
  }
})

onMounted(() => {
  document.addEventListener('mouseup', stopDrag)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', stopDrag)
  stopMockStream()
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
        class="fixed z-[120] w-[900px] h-[520px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden select-none flex flex-col"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
        @mousedown.stop
    >
      <div
          class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-200 cursor-move"
          @mousedown="startDrag"
      >
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-amber-100">
            <Bug :size="16" class="text-amber-600"/>
          </div>
          <div class="flex flex-col leading-tight">
            <span class="font-bold text-slate-800 text-sm">调试窗口</span>
            <span class="text-[11px] text-slate-500 font-mono">文件：{{ currentFilename || '未选择' }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold shadow hover:bg-amber-600 transition-colors"
              @click.stop="handleDebugNow"
          >
            <PlayCircle :size="16"/>
            <span>在窗口调试</span>
          </button>
          <button
              class="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              @click.stop="$emit('close')"
          >
            <X :size="16"/>
          </button>
        </div>
      </div>

      <div class="flex flex-1">
        <div class="w-[240px] bg-slate-50 border-r border-slate-200 p-3 flex flex-col gap-3">
          <div class="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <Terminal :size="14" class="text-amber-500"/> 设备预览
          </div>
          <div class="relative w-full aspect-[4/5] bg-white border border-dashed border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
            <img v-if="previewUrl" :src="previewUrl" alt="preview" class="w-full h-full object-contain"/>
            <div v-else class="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
              <Bug :size="20" class="text-amber-500"/>
              <span>等待截图或使用占位图</span>
            </div>
            <div v-if="isLoadingPreview" class="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 class="animate-spin text-amber-500" :size="20"/>
            </div>
          </div>
          <button
              class="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white transition-colors"
              @click="fetchPreview"
          >
            <RefreshCw :size="16" class="text-amber-500"/>
            刷新预览
          </button>
          <div class="text-[10px] text-slate-400 leading-relaxed">
            右侧调试面板会持续接收伪造的后端事件，JumpBack 节点会被单独标记。
          </div>
        </div>

        <div class="flex-1 flex flex-col">
          <div class="p-4 border-b border-slate-100 bg-white flex flex-col gap-3">
            <div class="flex gap-3">
              <div class="relative flex-1">
                <SearchIcon :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                    v-model="searchValue"
                    type="text"
                    :placeholder="selectedNodeId ? '' : '输入节点 ID...'"
                    class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all font-mono"
                />
              </div>
              <select
                  v-model="selectedNodeId"
                  class="w-52 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              >
                <option value="">选择节点...</option>
                <option v-for="opt in nodeOptions" :key="opt.id" :value="opt.id">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-slate-500">
              <div class="flex items-center gap-1">
                <Activity :size="14" class="text-amber-500"/>
                <span>实时事件数量：{{ events.length }}</span>
              </div>
              <button
                  class="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                  @click="startMockStream"
              >重置模拟流</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3 custom-scrollbar">
            <div v-if="sortedEvents.length === 0" class="h-full w-full flex items-center justify-center text-slate-400 text-sm">
              等待调试结果流入...
            </div>

            <div
                v-for="item in sortedEvents"
                :key="`${item.taskId}-${item.timestamp}`"
                class="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
                    任务 #{{ item.taskId }}
                  </span>
                  <span class="text-sm font-mono text-slate-700">主节点：{{ item.name }}</span>
                  <span class="text-[11px] text-slate-400">时间 {{ formatTime(item.timestamp) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                      class="px-2 py-1 text-[12px] rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      @click="handleViewResult(item)"
                  >查看调试结果</button>
                  <button
                      class="px-2 py-1 text-[12px] rounded bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 flex items-center gap-1"
                      @click="handleLocate(item.name)"
                  >
                    <MapPin :size="14"/> 定位节点
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                    v-for="(child, idx) in item.nextList"
                    :key="child.name + idx"
                    class="px-2 py-1 rounded-full text-[12px] font-mono border"
                    :class="child.jump_back ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'"
                >
                  {{ child.name }} <span class="ml-1 text-[11px] font-semibold">{{ child.jump_back ? 'JumpBack' : '顺序' }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
</style>

