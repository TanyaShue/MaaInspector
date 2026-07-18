<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue'
  import { X, Bug, PlayCircle, PauseCircle, Grip } from 'lucide-vue-next'
  import { debugApi } from '@/services/api'
  import type { FlowNode } from '@/utils/flowTypes'
  import DebugNodeSelector from './DebugPanel/DebugNodeSelector.vue'
  import DebugEventTimeline from './DebugPanel/DebugEventTimeline.vue'
  import DebugDetailPanel from './DebugPanel/DebugDetailPanel.vue'
  import ImagePreviewOverlay from './DebugPanel/ImagePreviewOverlay.vue'
  import { useDebugPanelState } from '@/composables/useDebugPanelState'
  import type {
    NextChild,
    DebugEventRecord,
    NodeStatusPayload,
  } from '@/composables/useDebugPanelState'
  import { useFloatingPanel } from '@/composables/useFloatingPanel'
  import { buildDebugConfigFields } from '@/utils/debugDetailPresentation'
  import type { DebugDetailField } from '@/utils/debugDetailPresentation'

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
    (
      e: 'update-node-status',
      payload: { nodeId: string; status: 'success' | 'error' | 'running' | 'ignored' | null }
    ): void
  }>()

  const {
    STATUS,
    events,
    isStreamRunning,
    previewUrl,
    startPreviewAutoRefresh,
    stopPreviewAutoRefresh,
    startRealtimeStream,
    stopRealtimeStream,
    handlePauseDebug,
    copyText,
    clearEvents,
  } = useDebugPanelState()

  const { panelStyle, loadLayout, ensureInViewport, startMove, startResize, stopInteraction } =
    useFloatingPanel({
      storageKey: 'maainspector.debugPanel.floatingLayout.v1',
      defaultWidth: 1120,
      defaultHeight: 720,
      minWidth: 680,
      minHeight: 440,
      edgeGap: 24,
    })

  const searchValue = ref('')
  const selectedNodeId = ref('')
  const fullImagePreview = ref<{ visible: boolean; src: string }>({ visible: false, src: '' })
  const selectedDetail = ref<{
    record: DebugEventRecord
    child: NextChild
    recognition?: {
      type: string
      status: string
      id?: string | number | null
      focus?: unknown
      parameters: DebugDetailField[]
      snapshot: { mainImage: string; drawImages: string[] }
      rawFields: unknown
      results: { all: unknown[]; filtered: unknown[]; best?: unknown }
    }
    action?: {
      type: string
      status: string
      id?: string | number | null
      nodeId?: string | number | null
      focus?: unknown
      parameters: DebugDetailField[]
      snapshot: { mainImage: string; drawImages: string[] }
      rawFields: unknown
    }
    meta?: {
      algorithm?: string | null
      hit?: boolean
      box?: unknown
    }
  } | null>(null)

  const nodeOptions = computed(() =>
    (props.nodes || []).map((node) => ({
      id: node.id,
      label: node.data?.data?.id || node.id,
    }))
  )

  const showPreviewPanel = computed(() => !selectedDetail.value)

  const handleOptionSelect = (opt: { id: string }) => {
    searchValue.value = opt.id
    selectedNodeId.value = opt.id
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

  const handleResetStream = () => {
    clearEvents()
    selectedDetail.value = null
    if (isStreamRunning.value) {
      startRealtimeStream(
        (payload: NodeStatusPayload) => emit('update-node-status', payload),
        props.nodes
      )
    }
  }

  const handleActionButton = async () => {
    handleDebugNow()
  }

  interface RecoDetail {
    raw_image?: string
    debug_image?: string
    image?: string
    draw_images?: unknown[]
    algorithm?: string
    hit?: boolean
    box?: unknown
    all_results?: unknown[]
    filtered_results?: unknown[]
    best_result?: unknown
    [key: string]: unknown
  }

  const omitFields = (value: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))

  const handleChildClick = async (child: NextChild, item: DebugEventRecord) => {
    const recognitionStatus = child.recognitionStatus || child.status
    const actionStatus = child.actionStatus
    const hasRecognitionResult =
      recognitionStatus === STATUS.SUCCEEDED || recognitionStatus === STATUS.FAILED
    const hasActionResult = actionStatus === STATUS.SUCCEEDED || actionStatus === STATUS.FAILED
    if (!hasRecognitionResult && !hasActionResult) return
    const actionMainImage =
      (typeof child.debug_image === 'string' && child.debug_image) ||
      (typeof child.image === 'string' && child.image) ||
      (typeof child.screenshot === 'string' && child.screenshot) ||
      ''
    const childDrawImages = Array.isArray(child.draw_images)
      ? child.draw_images.filter((value): value is string => typeof value === 'string')
      : []
    let meta:
      | { algorithm?: string; hit?: boolean; box?: unknown }
      | undefined
    const nodeData = props.nodes?.find(
      (node) => node.id === child.name || node.data?.data?.id === child.name
    )?.data?.data
    const recognitionType =
      typeof nodeData?.recognition === 'string' ? nodeData.recognition : 'Unknown'
    const actionType = typeof nodeData?.action === 'string' ? nodeData.action : 'DoNothing'
    const recognition = hasRecognitionResult
      ? {
          type: recognitionType,
          status: recognitionStatus,
          id: child.reco_id,
          focus: child.recognitionFocus,
          parameters: buildDebugConfigFields(nodeData, 'recognition', recognitionType),
          snapshot: { mainImage: '', drawImages: [] as string[] },
          rawFields: {
            name: child.name,
            status: recognitionStatus,
            reco_id: child.reco_id,
            focus: child.recognitionFocus,
          } as unknown,
          results: { all: [] as unknown[], filtered: [] as unknown[], best: undefined as unknown },
        }
      : undefined
    const action = hasActionResult
      ? {
          type: actionType,
          status: actionStatus || STATUS.UNKNOWN,
          id: child.action_id,
          nodeId: child.node_id,
          focus: child.actionFocus,
          parameters: buildDebugConfigFields(nodeData, 'action', actionType),
          snapshot: { mainImage: actionMainImage, drawImages: childDrawImages },
          rawFields: omitFields(child as Record<string, unknown>, [
            'debug_image',
            'image',
            'screenshot',
            'draw_images',
            'recognitionStatus',
            'reco_id',
            'recognitionFocus',
          ]),
        }
      : undefined

    if (child.reco_id !== undefined && child.reco_id !== null) {
      try {
        const res = await debugApi.getRecoDetails(child.reco_id)
        const detail = (res as Record<string, unknown>)?.detail as RecoDetail | undefined
        if (detail) {
          const rawImage = typeof detail.raw_image === 'string' ? detail.raw_image : ''
          const debugImage = typeof detail.debug_image === 'string' ? detail.debug_image : ''
          const imageField = typeof detail.image === 'string' ? detail.image : ''
          const recognitionMainImage = rawImage || debugImage || imageField || ''
          let recognitionDrawImages: string[] = []
          if (Array.isArray(detail.draw_images)) {
            recognitionDrawImages = detail.draw_images.filter(
              (x: unknown): x is string => typeof x === 'string'
            )
          }
          if (recognition) {
            const allResults = Array.isArray(detail.all_results) ? detail.all_results : []
            const filteredResults = Array.isArray(detail.filtered_results)
              ? detail.filtered_results
              : []
            const bestResult = detail.best_result
            recognition.snapshot = {
              mainImage: recognitionMainImage || recognitionDrawImages[0] || '',
              drawImages: recognitionDrawImages,
            }
            recognition.rawFields = {
              ...omitFields(detail as Record<string, unknown>, [
                'raw_image',
                'debug_image',
                'image',
                'draw_images',
              ]),
              recognition_focus: child.recognitionFocus,
            }
            recognition.results = {
              all: allResults,
              filtered:
                filteredResults.length > 0
                  ? filteredResults
                  : detail.hit && bestResult !== undefined && bestResult !== null
                    ? [bestResult]
                    : [],
              best: bestResult,
            }
          }
          meta = {
            algorithm: detail.algorithm ?? undefined,
            hit: typeof detail.hit === 'boolean' ? detail.hit : undefined,
            box: detail.box ?? undefined,
          }
        }
      } catch (err) {
        console.warn('[DebugPanel] 获取识别详情失败', err)
      }
    }

    selectedDetail.value = {
      record: item,
      child,
      meta,
      recognition,
      action,
    }
  }

  const handleDetailClose = () => {
    selectedDetail.value = null
    closeImagePreview()
  }

  const openImagePreview = (src: string) => {
    if (!src) return
    fullImagePreview.value = { visible: true, src }
  }

  const closeImagePreview = () => {
    fullImagePreview.value = { visible: false, src: '' }
  }

  watch(
    () => props.visible,
    (val) => {
      if (val) {
        loadLayout()
        selectedNodeId.value = props.initialNodeId || ''
        searchValue.value = props.initialNodeId || ''
        startPreviewAutoRefresh()
        startRealtimeStream(
          (payload: NodeStatusPayload) => emit('update-node-status', payload),
          props.nodes
        )
      } else {
        stopPreviewAutoRefresh()
        stopRealtimeStream()
      }
    }
  )

  watch(
    () => props.initialNodeId,
    (val) => {
      if (props.visible && val) {
        selectedNodeId.value = val
        searchValue.value = val
      }
    }
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', ensureInViewport)
  }

  onUnmounted(() => {
    stopInteraction()
    stopRealtimeStream()
    stopPreviewAutoRefresh()
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', ensureInViewport)
    }
  })
</script>

<template>
  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="scale-95 opacity-0"
    enter-to-class="scale-100 opacity-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="scale-100 opacity-100"
    leave-to-class="scale-95 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed z-[120] bg-white shadow-2xl border border-slate-200 rounded-lg overflow-hidden select-none flex flex-col"
      :style="panelStyle"
      @mousedown.stop
    >
      <div
        class="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 shrink-0 cursor-move"
        title="拖动移动调试窗口"
        @mousedown.stop="startMove"
      >
        <div class="flex items-center gap-2">
          <Bug :size="15" class="text-slate-600" />
          <span class="font-medium text-slate-700 text-sm">调试</span>
          <span v-if="currentFilename" class="text-xs text-slate-400 truncate max-w-[200px]">{{
            currentFilename
          }}</span>
        </div>
        <button
          class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          title="关闭调试窗口"
          @click.stop="$emit('close')"
          @mousedown.stop
        >
          <X :size="15" />
        </button>
      </div>

      <div class="flex flex-1 min-h-0">
        <div
          v-if="showPreviewPanel"
          class="w-[220px] bg-slate-50 border-r border-slate-200 flex flex-col shrink-0"
        >
          <div class="p-2 border-b border-slate-200">
            <div
              class="relative w-full aspect-[4/5] bg-white border border-slate-200 rounded overflow-hidden"
            >
              <img
                v-if="previewUrl"
                :src="previewUrl"
                alt="preview"
                class="w-full h-full object-contain"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-slate-400 text-xs"
              >
                无预览
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col min-h-0 w-0">
          <div class="p-2 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0">
            <DebugNodeSelector
              v-model="searchValue"
              :options="nodeOptions"
              placeholder="节点 ID..."
              @select="handleOptionSelect"
              @submit="handleDebugNow"
            />
            <button
              class="flex items-center gap-1 px-2.5 py-1.5 rounded text-white text-xs font-medium bg-slate-700 hover:bg-slate-800 transition-colors shrink-0"
              @click="handleActionButton"
            >
              <PlayCircle :size="14" />
              <span>调试</span>
            </button>
            <button
              class="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
              @click="handlePauseDebug"
            >
              <PauseCircle :size="14" />
              <span>暂停</span>
            </button>
            <button
              class="px-2 py-1.5 rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 ml-auto shrink-0"
              @click="handleResetStream"
            >
              清空
            </button>
          </div>

          <DebugEventTimeline
            :events="events"
            :status-constants="STATUS"
            @locate-node="handleLocate"
            @child-click="handleChildClick"
          />
        </div>

        <transition name="detail-slide">
          <DebugDetailPanel
            v-if="selectedDetail"
            :detail="selectedDetail"
            @close="handleDetailClose"
            @image-preview="openImagePreview"
            @copy="copyText"
          />
        </transition>
      </div>
      <button
        class="absolute bottom-0 right-0 z-[130] p-1 text-slate-300 hover:text-amber-500 cursor-nwse-resize bg-white/80 rounded-tl-md"
        title="拖动调整调试窗口大小"
        @mousedown.stop="startResize"
      >
        <Grip :size="14" />
      </button>
    </div>
  </transition>

  <ImagePreviewOverlay
    :visible="fullImagePreview.visible"
    :src="fullImagePreview.src"
    @close="closeImagePreview"
  />
</template>

<style scoped>
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
