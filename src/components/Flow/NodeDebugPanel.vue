<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X, Bug, PlayCircle, PauseCircle, MapPin, Loader2, Search as SearchIcon,
  Terminal, Activity, CheckCircle2, XCircle
} from 'lucide-vue-next'
import { deviceApi, debugApi } from '../../services/api.ts'
import type { FlowNode } from '../../utils/flowTypes'

const STATUS = {
  UNKNOWN: 'unknown',
  STARTING: 'starting',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed'
} as const
type StatusKey = (typeof STATUS)[keyof typeof STATUS]
type NodeStatus = 'success' | 'error' | 'running' | 'ignored' | null

interface NextChild {
  name: string
  status: StatusKey
  reco_id?: string | null
  jump_back?: boolean
  anchor?: boolean
  [key: string]: unknown
}

interface DebugEventRecord {
  recordId: string
  taskId: string | number
  name: string
  nextList: NextChild[]
  timestamp: number
}

interface RecognitionPayload {
  type?: string
  status?: StatusKey
  task_id?: string | number
  name?: string
  reco_id?: string
  timestamp?: number
  [key: string]: unknown
}

interface NextListPayload {
  type?: string
  task_id?: string | number
  name?: string
  next_list?: NextChild[]
  timestamp?: number
  [key: string]: unknown
}

type SsePayload = RecognitionPayload | NextListPayload

const props = defineProps<{
  visible?: boolean
  nodes?: FlowNode[]
  currentFilename?: string
  currentSource?: string
  initialNodeId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'locate-node', id: string): void
  (e: 'debug-node', id: string): void
  (e: 'update-node-status', payload: { nodeId: string; status: NodeStatus }): void
}>()

const position = ref({ x: 360, y: 140 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const searchValue = ref('')
const selectedNodeId = ref('')
const isOptionOpen = ref(false)
const previewUrl = ref('')
const isLoadingPreview = ref(false)
const events = ref<DebugEventRecord[]>([])
const isStreamRunning = ref(false)
const selectedDetail = ref<{
  record: DebugEventRecord
  child: NextChild
  image: string
  fields: Array<{ label: string; value: string }>
} | null>(null)

let stopStream: (() => void) | null = null
let previewTimer: ReturnType<typeof setInterval> | null = null
const nodeOptions = computed(() => (props.nodes || []).map(node => ({
  id: node.id,
  label: (node as any).data?.data?.id || node.id
})))

const filteredNodeOptions = computed(() => {
  const keyword = searchValue.value.trim().toLowerCase()
  if (!keyword) return nodeOptions.value
  return nodeOptions.value.filter(opt =>
      opt.id.toLowerCase().includes(keyword) || opt.label.toLowerCase().includes(keyword))
})

const sortedEvents = computed(() => [...events.value].sort((a, b) => b.timestamp - a.timestamp))
const actionButtonText = computed(() => '开始调试')
const showPreviewPanel = computed(() => !selectedDetail.value)

const createRecordId = (taskId?: string | number) => `${taskId || 'task'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const mapStatusToNode = (status: StatusKey): NodeStatus => {
  if (status === STATUS.SUCCEEDED) return 'success'
  if (status === STATUS.FAILED) return 'error'
  if (status === STATUS.STARTING) return 'running'
  return null
}
const startDrag = (e: MouseEvent) => {
  const target = e.target as HTMLElement | null
  if (target && (target.closest('input') || target.closest('select') || target.closest('button'))) return
  isDragging.value = true
  dragOffset.value = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}
const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  position.value = { x: e.clientX - dragOffset.value.x, y: e.clientY - dragOffset.value.y }
}
const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const fetchPreview = async () => {
  if (isLoadingPreview.value) return
  isLoadingPreview.value = true
  try {
    const res = await deviceApi.getScreenshot()
    previewUrl.value = (res as any)?.image || (res as any)?.data || ''
  } catch (e) {
    console.warn('[DebugPanel] 获取设备预览失败，使用占位图', e)
    previewUrl.value = ''
  } finally {
    isLoadingPreview.value = false
  }
}

const startPreviewAutoRefresh = () => {
  stopPreviewAutoRefresh()
  fetchPreview()
  previewTimer = setInterval(fetchPreview, 1000)
}

const stopPreviewAutoRefresh = () => {
  if (previewTimer) clearInterval(previewTimer)
  previewTimer = null
}

const upsertNextList = (payload: NextListPayload) => {
  if (!payload) return
  const nextList = Array.isArray(payload.next_list) ? payload.next_list : []
  const taskId = payload.task_id || Date.now()
  const record = {
    recordId: createRecordId(taskId),
    taskId,
    name: payload.name || searchValue.value || selectedNodeId.value || '未知节点',
    nextList: nextList.map(child => {
      const childName = child?.name || 'Unknown'
      return {
        ...child,
        name: childName,
        status: STATUS.UNKNOWN,
        reco_id: child.reco_id ?? null
      }
    }),
    timestamp: payload.timestamp || Date.now()
  }

  // 每次 next_list 推送都新增一条主任务记录，保留历史记录
  events.value = [record, ...events.value].slice(0, 200)

  // 将当前文件中对应节点名称的状态置为 ignored（等待识别）
  if (nextList.length && props.nodes) {
    const targetNames = new Set(nextList.map(child => child.name).filter(Boolean))
    props.nodes.forEach(node => {
      const nodeName = (node as any).data?.data?.id || node.id
      if (targetNames.has(nodeName)) {
        emit('update-node-status', { nodeId: nodeName, status: 'ignored' })
      }
    })
  }
}

const normalizeDetailFields = (child: any) => {
  if (!child) return []
  if (Array.isArray(child.detailList)) return child.detailList
  if (Array.isArray(child.details)) return child.details
  const skipKeys = ['name', 'status', 'jump_back', 'debug_image', 'image', 'screenshot']
  return Object.entries(child)
      .filter(([k]) => !skipKeys.includes(k))
      .map(([label, value]) => ({
        label,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
      }))
}

const applyRecognition = (payload: RecognitionPayload) => {
  if (!payload) return
  const status = payload.status || STATUS.UNKNOWN
  const targetName = payload.name || '未知节点'
  let matched = false
  let updatedRecord = null
  const updatedEvents = [...events.value]

  for (let i = 0; i < updatedEvents.length; i++) {
    const evt = updatedEvents[i]
    if (evt.taskId !== payload.task_id) continue
    matched = true
    const nextList = [...evt.nextList]
    let idx = nextList.findIndex(c => c.name === targetName)
    if (idx === -1) {
      nextList.push({
        name: targetName,
        jump_back: false,
        anchor: false,
        status: STATUS.UNKNOWN
      })
      idx = nextList.length - 1
    }
    nextList[idx] = {
      ...nextList[idx],
      status,
      reco_id: payload.reco_id
    }
    updatedEvents[i] = { ...evt, nextList }
    updatedRecord = updatedEvents[i]
    break
  }

  if (!matched) {
    const taskId = payload.task_id || Date.now()
    updatedRecord = {
      recordId: createRecordId(taskId),
      taskId,
      name: targetName,
      nextList: [{
        name: targetName,
        jump_back: false,
        anchor: false,
        status,
        reco_id: payload.reco_id
      }],
      timestamp: payload.timestamp || Date.now()
    }
    updatedEvents.unshift(updatedRecord)
  }

  events.value = updatedEvents.slice(0, 200)

  const mapped = mapStatusToNode(status)
  if (mapped) emit('update-node-status', { nodeId: targetName, status: mapped })
}

const handleSsePayload = (payload: SsePayload) => {
  if (!payload || !payload.type) return
  if (payload.type === 'node_next_list') {
    upsertNextList(payload)
  }
  if (payload.type === 'node_recognition') {
    applyRecognition(payload)
  }
}

const startRealtimeStream = () => {
  if (isStreamRunning.value) return
  stopStream = debugApi.subscribeNodeStream((data: any) => handleSsePayload(data as SsePayload))
  isStreamRunning.value = true
}

const stopRealtimeStream = () => {
  if (stopStream) stopStream()
  stopStream = null
  isStreamRunning.value = false
}

const handleDebugNow = () => {
  const targetId = (searchValue.value || selectedNodeId.value || '').trim()
  if (!targetId) return
  emit('debug-node', targetId)
}

const handleLocate = (id: string) => {
  const targetId = id || selectedNodeId.value || searchValue.value
  if (targetId) emit('locate-node', targetId)
}

const handleStartStream = () => {
  if (!isStreamRunning.value) {
    startRealtimeStream()
  }
}

const handleResetStream = () => {
  events.value = []
  selectedDetail.value = null
  if (isStreamRunning.value) {
    startRealtimeStream()
  }
}

const handleActionButton = async () => {
  handleStartStream()
  handleDebugNow()
}

const handlePauseDebug = async () => {
  try {
    await debugApi.stop()
  } catch (e) {
    console.warn('[DebugPanel] 暂停调试失败', e)
  }
}

const handleChildClick = (child: NextChild, item: DebugEventRecord) => {
  if (child.status !== STATUS.SUCCEEDED && child.status !== STATUS.FAILED) return
  if (child.reco_id !== undefined) {
    console.log('当前节点 reco_id:', child.reco_id)
  }
  const image =
    (typeof (child as any).debug_image === 'string' && (child as any).debug_image) ||
    (typeof (child as any).image === 'string' && (child as any).image) ||
    (typeof (child as any).screenshot === 'string' && (child as any).screenshot) ||
    ''
  selectedDetail.value = {
    record: item,
    child,
    image,
    fields: normalizeDetailFields(child)
  }
}

const handleDetailClose = () => {
  selectedDetail.value = null
}

const handleOptionSelect = (opt: { id: string }) => {
  searchValue.value = opt.id
  selectedNodeId.value = opt.id
  isOptionOpen.value = false
}

const toggleOptionList = () => {
  isOptionOpen.value = !isOptionOpen.value
}

const closeOptionList = () => {
  setTimeout(() => {
    isOptionOpen.value = false
  }, 120)
}

const formatTime = (ts: number | string) => {
  const d = new Date(ts as any)
  return d.toLocaleTimeString()
}

watch(() => props.visible, (val) => {
  if (val) {
    selectedNodeId.value = props.initialNodeId || ''
    searchValue.value = props.initialNodeId || ''
    position.value = { x: window.innerWidth - 920, y: 160 }
    startPreviewAutoRefresh()
    startRealtimeStream()
  } else {
    stopPreviewAutoRefresh()
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
  stopRealtimeStream()
  stopPreviewAutoRefresh()
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
              class="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              @click.stop="$emit('close')"
          >
            <X :size="16"/>
          </button>
        </div>
      </div>

      <div class="flex flex-1 min-h-0">
        <div
            v-if="showPreviewPanel"
            class="w-[240px] bg-slate-50 border-r border-slate-200 p-3 flex flex-col gap-3"
        >
          <div class="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <Terminal :size="14" class="text-amber-500"/> 设备预览
          </div>
          <div class="relative w-full aspect-[4/5] bg-white border border-dashed border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
            <img v-if="previewUrl" :src="previewUrl" alt="preview" class="w-full h-full object-contain"/>
            <div v-else class="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
              <Bug :size="20" class="text-amber-500"/>
              <span>等待截图或使用占位图</span>
            </div>
          </div>
          <div class="text-[10px] text-slate-400 leading-relaxed">
            右侧调试面板实时接收后端推送的调试事件，JumpBack 节点会被单独标记。
          </div>
        </div>

        <div class="flex-1 flex flex-col min-h-0">
          <div class="p-4 border-b border-slate-100 bg-white flex flex-col gap-3">
            <div class="flex gap-3 items-center">
              <div class="relative flex-1">
                <SearchIcon :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                    v-model="searchValue"
                    type="text"
                    :placeholder="selectedNodeId ? '' : '输入或选择节点 ID...'"
                    class="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all font-mono"
                    @focus="isOptionOpen = true"
                    @blur="closeOptionList"
                    @keyup.enter="handleDebugNow"
                />
                <button
                    class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-xs border border-slate-200 text-slate-500 hover:bg-white"
                    type="button"
                    @mousedown.prevent
                    @click="toggleOptionList"
                >
                  列表
                </button>
                <div
                    v-if="isOptionOpen && filteredNodeOptions.length"
                    class="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-sm custom-scrollbar"
                >
                  <button
                      v-for="opt in filteredNodeOptions"
                      :key="opt.id"
                      type="button"
                      class="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm text-slate-700 flex justify-between items-center"
                      @mousedown.prevent
                      @click="handleOptionSelect(opt)"
                  >
                    <span class="font-mono">{{ opt.label }}</span>
                    <span class="text-[11px] text-slate-400">{{ opt.id }}</span>
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                    class="flex items-center gap-1 px-3 py-2 rounded-lg text-white text-xs font-semibold shadow transition-colors"
                    :class="isStreamRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'"
                    @click="handleActionButton"
                >
                  <PlayCircle :size="16"/>
                  <span>{{ actionButtonText }}</span>
                </button>
                <button
                    class="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold shadow transition-colors border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                    @click="handlePauseDebug"
                >
                  <PauseCircle :size="16" class="text-amber-600"/>
                  <span>暂停调试</span>
                </button>
              </div>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-slate-500">
              <div class="flex items-center gap-1">
                <Activity :size="14" class="text-amber-500"/>
                <span>实时事件数量：{{ events.length }}</span>
              </div>
              <div class="flex items-center gap-3 text-[11px] text-slate-500">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                  <span>顺序</span>
                  <span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                  <span>JumpBack</span>
                </div>
                <button
                    class="px-2 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                    @click="handleResetStream"
                >清空调试记录</button>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3 custom-scrollbar min-h-0">
            <div v-if="sortedEvents.length === 0" class="h-full w-full flex items-center justify-center text-slate-400 text-sm">
              等待调试结果流入...
            </div>

            <div
                v-for="item in sortedEvents"
                :key="item.recordId || `${item.taskId}-${item.timestamp}`"
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
                      class="px-2 py-1 text-[12px] rounded bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 flex items-center gap-1"
                      @click="handleLocate(item.name)"
                  >
                    <MapPin :size="14"/> 定位节点
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                    v-for="(child, idx) in item.nextList"
                    :key="child.name + idx"
                    class="px-2 py-1 rounded-full text-[12px] font-mono border transition-colors flex items-center gap-2"
                    :class="[
                      child.jump_back ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100',
                    child.status === STATUS.UNKNOWN
                      ? 'opacity-60'
                      : child.status === STATUS.STARTING
                        ? 'ring-1 ring-amber-200'
                        : child.status === STATUS.SUCCEEDED
                          ? (child.jump_back ? 'ring-1 ring-purple-200' : 'ring-1 ring-blue-200')
                          : 'ring-1 ring-rose-200'
                    ]"
                    @click="handleChildClick(child, item)"
                >
                  <span>{{ child.name }}</span>
                  <span class="text-[11px] flex items-center gap-1">
                    <Activity v-if="child.status === STATUS.UNKNOWN" :size="14" class="text-slate-400"/>
                    <Loader2 v-else-if="child.status === STATUS.STARTING" :size="12" class="animate-spin text-amber-600"/>
                    <CheckCircle2 v-else-if="child.status === STATUS.SUCCEEDED" :size="14" class="text-emerald-600"/>
                    <XCircle v-else :size="14" class="text-rose-600"/>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <transition name="detail-slide">
          <div
              v-if="selectedDetail"
              class="w-[320px] border-l border-slate-200 bg-white flex flex-col min-h-0"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-slate-700">{{ selectedDetail.child.name }}</span>
                <span class="text-[11px] text-slate-500">任务 #{{ selectedDetail.record.taskId }}</span>
              </div>
              <button
                  class="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                  @click="handleDetailClose"
              >
                返回
              </button>
            </div>

            <div class="flex-1 overflow-y-auto custom-scrollbar">
              <div class="p-3 space-y-3">
                <div class="text-xs text-slate-500 font-semibold flex items-center gap-2">
                  <Activity :size="14" class="text-amber-500"/> 调试快照
                </div>
                <div class="relative w-full aspect-[4/5] bg-slate-50 border border-dashed border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                      v-if="selectedDetail.image"
                      :src="selectedDetail.image"
                      alt="debug detail"
                      class="w-full h-full object-contain"
                  />
                  <div v-else class="text-xs text-slate-400 flex flex-col items-center gap-1">
                    <Bug :size="18" class="text-amber-500"/>
                    <span>暂无调试截图</span>
                  </div>
                </div>

                <div class="text-xs text-slate-500 font-semibold flex items-center gap-2 pt-2">
                  <Terminal :size="14" class="text-amber-500"/> 调试结果
                </div>
                <div class="grid gap-2" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                  <div
                      v-for="(field, idx) in selectedDetail.fields"
                      :key="idx"
                      class="p-2 rounded border border-slate-200 bg-slate-50"
                  >
                    <div class="text-[11px] text-slate-500 truncate">{{ field.label }}</div>
                    <div class="text-sm text-slate-700 break-words">{{ field.value || '—' }}</div>
                  </div>
                  <div
                      v-if="!selectedDetail.fields || selectedDetail.fields.length === 0"
                      class="text-xs text-slate-400"
                  >
                    暂无可显示的调试结果。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
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

.detail-slide-enter-active,
.detail-slide-leave-active {
  transition: all 180ms ease;
}
.detail-slide-enter-from,
.detail-slide-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>

