<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Copy,
    Crosshair,
    FileJson,
    Hash,
    Image as ImageIcon,
    Maximize2,
    MousePointerClick,
    ScanEye,
    XCircle,
  } from 'lucide-vue-next'
  import { ACTION_CONFIG_MAP, NODE_CONFIG_MAP } from '@/utils/node-config'
  import { formatDebugRect } from '@/utils/debugDetailPresentation'
  import type { DebugDetailField } from '@/utils/debugDetailPresentation'
  import DebugTypedResult from './DebugTypedResult.vue'

  export interface DetailSnapshot {
    originalImage: string
    recognitionImage: string
  }

  export interface DetailResultGroups {
    all: unknown[]
    filtered: unknown[]
    best?: unknown
  }

  export interface DetailStage {
    type: string
    status: string
    id?: string | number | null
    nodeId?: string | number | null
    focus?: unknown
    parameters: DebugDetailField[]
    snapshot?: DetailSnapshot
    rawFields: unknown
    results?: DetailResultGroups
    result?: unknown
    box?: unknown
  }

  export interface DetailMeta {
    algorithm?: string | null
    hit?: boolean
    box?: unknown
  }

  export interface NextChild {
    name?: string
    status?: string
    jump_back?: boolean
    [key: string]: unknown
  }

  export interface DebugEventRecord {
    recordId: string
    taskId: string | number
    name: string
    nextList: NextChild[]
    timestamp: number
  }

  export interface DetailData {
    record: DebugEventRecord
    child: NextChild
    meta?: DetailMeta
    recognition?: DetailStage
    action?: DetailStage
  }

  const props = defineProps<{ detail: DetailData }>()
  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'image-preview', src: string): void
    (e: 'copy', text: string): void
  }>()

  type DetailStageTab = 'recognition' | 'action'
  const getDefaultStage = (): DetailStageTab => props.detail.recognition ? 'recognition' : 'action'
  const activeStage = ref<DetailStageTab>(getDefaultStage())

  watch(
    () => props.detail.record.recordId,
    () => {
      activeStage.value = getDefaultStage()
    }
  )

  const recognitionLabel = computed(
    () =>
      NODE_CONFIG_MAP[props.detail.recognition?.type || '']?.label ||
      props.detail.recognition?.type ||
      '识别'
  )
  const actionLabel = computed(
    () =>
      ACTION_CONFIG_MAP[props.detail.action?.type || '']?.label ||
      props.detail.action?.type ||
      '动作'
  )
  const isSuccess = (status?: string) => status === 'succeeded'
  const statusText = (status?: string) => {
    if (status === 'succeeded') return '成功'
    if (status === 'failed') return '失败'
    if (status === 'starting') return '进行中'
    return '未知'
  }
  const rawJson = (value: unknown) => {
    try {
      return JSON.stringify(value ?? {}, null, 2)
    } catch {
      return String(value ?? '')
    }
  }
  const resultType = (value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const algorithm = (value as Record<string, unknown>).algorithm
      if (typeof algorithm === 'string' && algorithm) return algorithm
    }
    return props.detail.recognition?.type || 'Unknown'
  }
  const resultGroups = computed(() => {
    const results = props.detail.recognition?.results
    if (!results) return []
    return [
      {
        key: 'all',
        label: '全部结果',
        description: '算法返回的所有候选结果',
        values: results.all,
        accent: 'border-slate-200 bg-slate-50',
        defaultOpen: false,
      },
      {
        key: 'filtered',
        label: '命中结果',
        description: '经过阈值与规则过滤后命中的结果',
        values: results.filtered,
        accent: 'border-emerald-200 bg-emerald-50/60',
        defaultOpen: false,
      },
      {
        key: 'best',
        label: '最佳结果',
        description: '最终用于后续动作的最佳匹配',
        values: results.best === undefined || results.best === null ? [] : [results.best],
        accent: 'border-amber-200 bg-amber-50/60',
        defaultOpen: true,
      },
    ]
  })
</script>

<template>
  <aside
    class="flex min-h-0 w-[420px] shrink-0 flex-col bg-slate-50/70"
  >
    <header class="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-slate-800">{{ detail.child.name }}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
            <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
              任务 #{{ detail.record.taskId }}
            </span>
            <span
              v-if="detail.child.jump_back"
              class="rounded bg-purple-50 px-1.5 py-0.5 text-purple-600"
            >
              回跳节点
            </span>
          </div>
        </div>
        <button
          class="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
          @click="emit('close')"
        >
          <ArrowLeft :size="12" />返回
        </button>
      </div>
    </header>

    <nav
      v-if="detail.recognition && detail.action"
      class="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 bg-white px-3 py-2"
      aria-label="任务详情类型"
    >
      <button
        class="stage-tab"
        :class="activeStage === 'recognition' ? 'stage-tab-active-blue' : 'stage-tab-idle'"
        @click="activeStage = 'recognition'"
      >
        <ScanEye :size="13" />识别详情
      </button>
      <button
        class="stage-tab"
        :class="activeStage === 'action' ? 'stage-tab-active-violet' : 'stage-tab-idle'"
        @click="activeStage = 'action'"
      >
        <MousePointerClick :size="13" />动作详情
      </button>
    </nav>

    <div class="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
      <section
        v-if="detail.recognition && activeStage === 'recognition'"
        class="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm"
      >
        <div class="stage-header border-blue-100 bg-blue-50/70">
          <div class="flex items-center gap-2">
            <span class="stage-icon bg-blue-100 text-blue-600"><ScanEye :size="15" /></span>
            <div>
              <div class="text-xs font-semibold text-slate-700">识别 · {{ recognitionLabel }}</div>
              <div class="font-mono text-[10px] text-slate-400">{{ detail.recognition.type }}</div>
            </div>
          </div>
          <span
            class="status-pill"
            :class="
              isSuccess(detail.recognition.status)
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            "
          >
            <component
              :is="isSuccess(detail.recognition.status) ? CheckCircle2 : XCircle"
              :size="11"
            />
            {{ statusText(detail.recognition.status) }}
          </span>
        </div>

        <div class="space-y-3 p-3">
          <div class="grid grid-cols-2 gap-2 text-[10px]">
            <div v-if="detail.recognition.id != null" class="detail-stat">
              <Hash :size="11" /><span>识别 ID</span><b>{{ detail.recognition.id }}</b>
            </div>
            <div v-if="detail.meta?.algorithm" class="detail-stat">
              <Crosshair :size="11" /><span>算法</span><b>{{ detail.meta.algorithm }}</b>
            </div>
            <div v-if="detail.meta?.hit !== undefined" class="detail-stat">
              <CheckCircle2 :size="11" /><span>是否命中</span>
              <b :class="detail.meta.hit ? 'text-emerald-600' : 'text-rose-600'">
                {{ detail.meta.hit ? '命中' : '未命中' }}
              </b>
            </div>
            <div v-if="detail.meta?.box" class="detail-stat col-span-2">
              <Crosshair :size="11" /><span>命中区域</span>
              <b>{{ formatDebugRect(detail.meta.box) }}</b>
            </div>
          </div>

          <details v-if="detail.recognition.parameters.length" class="fold-card" open>
            <summary class="fold-summary">
              <ChevronRight :size="12" class="fold-chevron" />
              <span>识别参数</span>
              <span class="fold-count">{{ detail.recognition.parameters.length }}</span>
            </summary>
            <div class="space-y-1.5 border-t border-slate-100 p-2">
              <div
                v-for="field in detail.recognition.parameters"
                :key="field.key"
                class="parameter-row group"
              >
                <span>{{ field.label }}</span>
                <code v-if="field.kind === 'rect' || field.kind === 'point'">
                  {{ formatDebugRect(field.value) }}
                </code>
                <code v-else>{{ field.kind === 'boolean' ? (field.value ? '启用' : '关闭') : field.text }}</code>
                <button
                  class="copy-button"
                  :title="`复制 ${field.label}`"
                  @click="emit('copy', field.text)"
                >
                  <Copy :size="10" />
                </button>
              </div>
            </div>
          </details>

          <details v-if="resultGroups.length" class="fold-card algorithm-output" open>
            <summary class="fold-summary bg-gradient-to-r from-blue-50 to-indigo-50">
              <ChevronRight :size="12" class="fold-chevron" />
              <span>算法输出</span>
              <span class="ml-auto text-[9px] font-normal text-slate-400">可展开每组和每个结构</span>
            </summary>
            <div class="space-y-2 border-t border-blue-100 p-2">
              <details
                v-for="group in resultGroups"
                :key="group.key"
                class="result-group"
                :class="group.accent"
                :open="group.defaultOpen"
              >
                <summary class="result-group-summary">
                  <ChevronRight :size="12" class="fold-chevron" />
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-slate-700">{{ group.label }}</div>
                    <div class="truncate text-[9px] font-normal text-slate-400">
                      {{ group.description }}
                    </div>
                  </div>
                  <span class="fold-count">{{ group.values.length }}</span>
                  <button
                    v-if="group.values.length"
                    class="copy-button"
                    title="复制整组结果"
                    @click.prevent.stop="emit('copy', rawJson(group.values))"
                  >
                    <Copy :size="10" />
                  </button>
                </summary>
                <div class="space-y-1.5 border-t border-white/80 p-2">
                  <DebugTypedResult
                    v-for="(value, index) in group.values"
                    :key="index"
                    mode="recognition"
                    :type="resultType(value)"
                    :label="group.values.length > 1 ? `结果 #${index + 1}` : group.label"
                    :value="value"
                    @copy="emit('copy', $event)"
                  />
                  <div v-if="group.values.length === 0" class="empty-result">暂无结果</div>
                </div>
              </details>
            </div>
          </details>

          <details class="fold-card snapshot-card" open>
            <summary class="fold-summary">
              <ChevronRight :size="12" class="fold-chevron" />
              <ImageIcon :size="12" />
              <span>调试快照</span>
              <span class="ml-auto text-[9px] font-normal text-slate-400">默认展开</span>
            </summary>
            <div class="border-t border-slate-100 p-2">
              <button
                class="snapshot-main"
                :class="detail.recognition.snapshot?.originalImage ? 'cursor-zoom-in' : ''"
                @click="
                  detail.recognition.snapshot?.originalImage &&
                  emit('image-preview', detail.recognition.snapshot.originalImage)
                "
              >
                <img
                  v-if="detail.recognition.snapshot?.originalImage"
                  :src="detail.recognition.snapshot.originalImage"
                  alt="original snapshot"
                  class="h-full w-full object-contain"
                />
                <span v-else class="text-xs text-slate-400">暂无原图</span>
                <span class="snapshot-label">原图</span>
                <Maximize2
                  v-if="detail.recognition.snapshot?.originalImage"
                  :size="13"
                  class="absolute right-2 top-2 text-white drop-shadow"
                />
              </button>
              <button
                v-if="detail.recognition.snapshot?.recognitionImage"
                class="recognition-snapshot"
                title="点击查看识别图"
                @click="emit('image-preview', detail.recognition.snapshot.recognitionImage)"
              >
                <img
                  :src="detail.recognition.snapshot.recognitionImage"
                  alt="recognition result snapshot"
                  class="h-full w-full object-contain"
                />
                <span>识别图</span>
              </button>
            </div>
          </details>

          <details class="fold-card raw-json-card">
            <summary class="fold-summary">
              <ChevronRight :size="12" class="fold-chevron" />
              <FileJson :size="12" />
              <span>识别原始字段</span>
              <button
                class="copy-button ml-auto"
                title="复制识别原始字段"
                @click.prevent.stop="emit('copy', rawJson(detail.recognition.rawFields))"
              >
                <Copy :size="10" />
              </button>
            </summary>
            <pre>{{ rawJson(detail.recognition.rawFields) }}</pre>
          </details>
        </div>
      </section>

      <section
        v-if="detail.action && activeStage === 'action'"
        class="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm"
      >
        <div class="stage-header border-violet-100 bg-violet-50/70">
          <div class="flex items-center gap-2">
            <span class="stage-icon bg-violet-100 text-violet-600">
              <MousePointerClick :size="15" />
            </span>
            <div>
              <div class="text-xs font-semibold text-slate-700">动作 · {{ actionLabel }}</div>
              <div class="font-mono text-[10px] text-slate-400">{{ detail.action.type }}</div>
            </div>
          </div>
          <span
            class="status-pill"
            :class="
              isSuccess(detail.action.status)
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            "
          >
            <component :is="isSuccess(detail.action.status) ? CheckCircle2 : XCircle" :size="11" />
            {{ statusText(detail.action.status) }}
          </span>
        </div>

        <div class="space-y-3 p-3">
          <div class="grid grid-cols-2 gap-2 text-[10px]">
            <div v-if="detail.action.id != null" class="detail-stat">
              <Hash :size="11" /><span>动作 ID</span><b>{{ detail.action.id }}</b>
            </div>
            <div v-if="detail.action.nodeId != null" class="detail-stat">
              <Hash :size="11" /><span>节点 ID</span><b>{{ detail.action.nodeId }}</b>
            </div>
            <div v-if="detail.action.box" class="detail-stat col-span-2">
              <Crosshair :size="11" /><span>执行区域</span>
              <b>{{ formatDebugRect(detail.action.box) }}</b>
            </div>
          </div>

          <details v-if="detail.action.parameters.length" class="fold-card" open>
            <summary class="fold-summary">
              <ChevronRight :size="12" class="fold-chevron" />
              <span>动作参数</span>
              <span class="fold-count">{{ detail.action.parameters.length }}</span>
            </summary>
            <div class="space-y-1.5 border-t border-slate-100 p-2">
              <div
                v-for="field in detail.action.parameters"
                :key="field.key"
                class="parameter-row"
              >
                <span>{{ field.label }}</span>
                <code v-if="field.kind === 'rect' || field.kind === 'point'">
                  {{ formatDebugRect(field.value) }}
                </code>
                <code v-else>{{ field.kind === 'boolean' ? (field.value ? '启用' : '关闭') : field.text }}</code>
                <button
                  class="copy-button"
                  :title="`复制 ${field.label}`"
                  @click="emit('copy', field.text)"
                >
                  <Copy :size="10" />
                </button>
              </div>
            </div>
          </details>

          <details
            v-if="detail.action.result !== undefined"
            class="fold-card action-output"
            open
          >
            <summary class="fold-summary bg-gradient-to-r from-violet-50 to-fuchsia-50">
              <ChevronRight :size="12" class="fold-chevron" />
              <span>动作执行结果</span>
              <span class="ml-auto text-[9px] font-normal text-slate-400">
                {{ detail.action.type }}
              </span>
            </summary>
            <div class="border-t border-violet-100 p-2">
              <DebugTypedResult
                mode="action"
                :type="detail.action.type"
                label="实际执行结果"
                :value="detail.action.result"
                @copy="emit('copy', $event)"
              />
            </div>
          </details>

          <details class="fold-card raw-json-card">
            <summary class="fold-summary">
              <ChevronRight :size="12" class="fold-chevron" />
              <FileJson :size="12" />
              <span>动作原始字段</span>
              <button
                class="copy-button ml-auto"
                title="复制动作原始字段"
                @click.prevent.stop="emit('copy', rawJson(detail.action.rawFields))"
              >
                <Copy :size="10" />
              </button>
            </summary>
            <pre>{{ rawJson(detail.action.rawFields) }}</pre>
          </details>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
  .stage-tab {
    @apply flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors;
  }

  .stage-tab-idle {
    @apply border-transparent bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100;
  }

  .stage-tab-active-blue {
    @apply border-blue-200 bg-blue-50 text-blue-700;
  }

  .stage-tab-active-violet {
    @apply border-violet-200 bg-violet-50 text-violet-700;
  }

  .stage-header {
    @apply flex items-center justify-between border-b px-3 py-2;
  }

  .stage-icon {
    @apply flex h-7 w-7 items-center justify-center rounded-lg;
  }

  .status-pill {
    @apply flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold;
  }

  .detail-stat {
    @apply flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-slate-400;
  }

  .detail-stat b {
    @apply ml-auto min-w-0 truncate font-mono font-medium text-slate-700;
  }

  .fold-card {
    @apply overflow-hidden rounded-lg border border-slate-200 bg-white;
  }

  .fold-summary,
  .result-group-summary {
    @apply flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-2 text-[10px] font-semibold text-slate-600;
  }

  .fold-summary::-webkit-details-marker,
  .result-group-summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary .fold-chevron {
    @apply rotate-90;
  }

  .fold-chevron {
    @apply shrink-0 text-slate-400 transition-transform;
  }

  .fold-count {
    @apply ml-auto rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 shadow-sm;
  }

  .result-group {
    @apply overflow-hidden rounded-lg border;
  }

  .parameter-row {
    @apply flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[10px];
  }

  .parameter-row > span:first-child {
    @apply shrink-0 text-slate-500;
  }

  .parameter-row code {
    @apply min-w-0 flex-1 whitespace-pre-wrap break-all text-right font-mono text-slate-700;
  }

  .copy-button {
    @apply flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600;
  }

  .snapshot-main {
    @apply relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-950/5;
  }

  .snapshot-label {
    @apply absolute bottom-2 left-2 rounded bg-slate-900/70 px-1.5 py-0.5 text-[9px] font-medium text-white;
  }

  .recognition-snapshot {
    @apply relative mt-2 flex h-20 w-32 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-blue-200 bg-slate-50 transition hover:border-blue-400 hover:shadow-sm;
  }

  .recognition-snapshot span {
    @apply absolute bottom-1 left-1 rounded bg-blue-600/85 px-1.5 py-0.5 text-[8px] font-medium text-white;
  }

  .raw-json-card pre {
    @apply max-h-72 overflow-auto whitespace-pre-wrap break-all border-t border-slate-700 bg-slate-900 p-3 font-mono text-[10px] leading-4 text-slate-200;
  }

  .empty-result {
    @apply rounded-lg border border-dashed border-slate-200 bg-white/70 py-3 text-center text-[10px] text-slate-400;
  }
</style>
