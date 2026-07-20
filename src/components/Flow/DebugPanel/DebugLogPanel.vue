<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDownToLine, Check, ChevronDown, ChevronUp, Copy } from 'lucide-vue-next'
import { logApi } from '@/services/api'
import {
  presentDebugLog,
  type DebugLogKind,
  type DebugLogLevel,
} from '@/utils/debugLogPresentation'

type LogKind = DebugLogKind

const props = defineProps<{ active?: boolean }>()

const tabs: Array<{ id: LogKind; label: string }> = [
  { id: 'maafw', label: 'MaaFW' },
  { id: 'agent', label: 'Agent' },
  { id: 'software', label: '软件' },
]
const activeKind = ref<LogKind>('maafw')
const lines = ref<Record<LogKind, string[]>>({
  maafw: [],
  agent: [],
  software: [],
})
const scroller = ref<HTMLElement | null>(null)
const followLatest = ref(false)
const scrollPositions = ref<Record<LogKind, number>>({
  maafw: 0,
  agent: 0,
  software: 0,
})
const expandedLines = ref(new Set<string>())
const copiedLineKey = ref('')
let timer: ReturnType<typeof setInterval> | null = null
let copiedFeedbackTimer: ReturnType<typeof setTimeout> | null = null
const loadingKinds = new Set<LogKind>()
let programmaticScroll = false
let scrollGuardFrame: number | null = null

const setScrollPosition = async (position: number) => {
  programmaticScroll = true
  if (scrollGuardFrame !== null) cancelAnimationFrame(scrollGuardFrame)
  await nextTick()
  const element = scroller.value
  if (element) element.scrollTop = position
  scrollGuardFrame = requestAnimationFrame(() => {
    programmaticScroll = false
    scrollGuardFrame = null
  })
}

const scrollToLatest = async () => {
  await nextTick()
  const element = scroller.value
  if (!element) return
  scrollPositions.value[activeKind.value] = element.scrollHeight
  await setScrollPosition(element.scrollHeight)
}

const restoreScrollPosition = (kind: LogKind) =>
  setScrollPosition(scrollPositions.value[kind] || 0)

const selectKind = async (kind: LogKind) => {
  if (kind === activeKind.value) return
  if (scroller.value && !programmaticScroll) {
    scrollPositions.value[activeKind.value] = scroller.value.scrollTop
  }
  activeKind.value = kind
  if (followLatest.value) await scrollToLatest()
  else await restoreScrollPosition(kind)
}

const toggleFollowLatest = () => {
  followLatest.value = !followLatest.value
  if (followLatest.value) void scrollToLatest()
}

const disableFollowLatest = () => {
  if (followLatest.value) followLatest.value = false
}

const handleManualScrollIntent = () => {
  if (scrollGuardFrame !== null) cancelAnimationFrame(scrollGuardFrame)
  scrollGuardFrame = null
  programmaticScroll = false
  disableFollowLatest()
}

const handleScroll = () => {
  if (programmaticScroll) return
  if (scroller.value) {
    scrollPositions.value[activeKind.value] = scroller.value.scrollTop
  }
  disableFollowLatest()
}

const refresh = async () => {
  if (!props.active) return
  const kind = activeKind.value
  if (loadingKinds.has(kind)) return
  loadingKinds.add(kind)
  try {
    lines.value[kind] = await logApi.readTail(kind, 100)
    if (kind !== activeKind.value) return
    if (followLatest.value) await scrollToLatest()
    else await restoreScrollPosition(kind)
  } catch (error) {
    lines.value[kind] = [`读取日志失败: ${error instanceof Error ? error.message : String(error)}`]
  } finally {
    loadingKinds.delete(kind)
  }
}

const displayedLines = computed(() =>
  lines.value[activeKind.value].map((line, index) => ({
    ...presentDebugLog(activeKind.value, line),
    index,
    key: `${activeKind.value}:${index}:${hashLogLine(line)}`,
  }))
)

const hashLogLine = (line: string) => {
  let hash = 0
  for (let index = 0; index < line.length; index += 1) {
    hash = (Math.imul(hash, 31) + line.charCodeAt(index)) | 0
  }
  return hash.toString(36)
}

const levelBadgeClass = (level: DebugLogLevel) => {
  if (level === 'error') return 'border-rose-200 bg-rose-50 text-rose-600'
  if (level === 'warn') return 'border-amber-200 bg-amber-50 text-amber-600'
  if (level === 'info') return 'border-sky-200 bg-sky-50 text-sky-600'
  if (level === 'system') return 'border-violet-200 bg-violet-50 text-violet-600'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

const rowClass = (level: DebugLogLevel) => {
  if (level === 'error') return 'border-l-rose-400 bg-rose-50/25'
  if (level === 'warn') return 'border-l-amber-400 bg-amber-50/20'
  if (level === 'info') return 'border-l-sky-300'
  if (level === 'system') return 'border-l-violet-400 bg-violet-50/20'
  return 'border-l-slate-200'
}

const isLongLine = (message: string, metadata: string) =>
  message.length > 220 || message.includes('\n') || metadata.length > 160

const toggleExpanded = (key: string) => {
  const next = new Set(expandedLines.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedLines.value = next
}

const copyRawLog = async (key: string, raw: string) => {
  try {
    await navigator.clipboard.writeText(raw)
    copiedLineKey.value = key
    if (copiedFeedbackTimer) clearTimeout(copiedFeedbackTimer)
    copiedFeedbackTimer = setTimeout(() => {
      copiedLineKey.value = ''
      copiedFeedbackTimer = null
    }, 1600)
  } catch (error) {
    console.warn('[DebugLogPanel] 复制原始日志失败', error)
  }
}

const stopPolling = () => {
  if (timer) clearInterval(timer)
  timer = null
}

const startPolling = () => {
  stopPolling()
  void refresh()
  timer = setInterval(refresh, 1000)
}

watch(
  () => props.active,
  active => (active ? startPolling() : stopPolling()),
  { immediate: true }
)
watch(activeKind, () => void refresh())
onBeforeUnmount(() => {
  stopPolling()
  if (scrollGuardFrame !== null) cancelAnimationFrame(scrollGuardFrame)
  if (copiedFeedbackTimer) clearTimeout(copiedFeedbackTimer)
})
</script>

<template>
  <section class="flex min-h-0 flex-col bg-white">
    <nav class="flex h-9 shrink-0 border-b border-slate-200 bg-slate-50/80 px-1.5 pt-1">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="relative flex-1 rounded-t-md border-b-2 px-1 text-[10px] font-semibold transition-colors"
        :class="
          activeKind === tab.id
            ? 'border-indigo-500 bg-white text-indigo-600 shadow-[0_-1px_3px_rgba(15,23,42,0.04)]'
            : 'border-transparent text-slate-400 hover:bg-white/70 hover:text-slate-600'
        "
        @click="selectKind(tab.id)"
      >
        {{ tab.label }}
      </button>
      <button
        type="button"
        data-testid="debug-log-follow"
        class="mb-1 ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors"
        :class="
          followLatest
            ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
            : 'border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-600'
        "
        :aria-pressed="followLatest"
        :title="followLatest ? '停止自动滚动到最新日志' : '自动滚动到最新日志'"
        aria-label="自动滚动到最新日志"
        @click="toggleFollowLatest"
      >
        <ArrowDownToLine :size="13" />
      </button>
    </nav>
    <div
      ref="scroller"
      data-testid="debug-log-output"
      class="min-h-0 flex-1 select-text overflow-auto bg-white font-mono text-[10px] leading-4"
      @scroll.passive="handleScroll"
      @wheel.passive="handleManualScrollIntent"
      @touchmove.passive="handleManualScrollIntent"
    >
      <div v-if="displayedLines.length === 0" class="flex h-full items-center justify-center text-slate-400">
        暂无日志
      </div>
      <div
        v-for="line in displayedLines"
        :key="line.key"
        class="group flex border-b border-l-2 border-b-slate-100 px-1.5 py-1.5 transition-colors hover:bg-indigo-50/30"
        :class="rowClass(line.level)"
        :title="line.raw.length <= 500 ? line.raw : undefined"
      >
        <span class="mr-1.5 w-5 shrink-0 select-none pt-0.5 text-right text-slate-300">{{ line.index + 1 }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-1">
            <span
              class="shrink-0 rounded border px-1 py-px text-[8px] font-bold leading-3"
              :class="levelBadgeClass(line.level)"
            >{{ line.levelLabel }}</span>
            <span class="shrink-0 tabular-nums text-[9px] text-slate-400">{{ line.time }}</span>
            <span class="min-w-0 truncate text-[9px] font-medium text-slate-500">{{ line.source }}</span>
            <button
              type="button"
              class="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded text-slate-300 opacity-50 transition-colors hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100"
              :class="{ '!text-emerald-500 opacity-100': copiedLineKey === line.key }"
              :aria-label="`复制第 ${line.index + 1} 条原始日志`"
              :title="copiedLineKey === line.key ? '已复制' : '复制原始日志'"
              @click="copyRawLog(line.key, line.raw)"
            >
              <Check v-if="copiedLineKey === line.key" :size="11" />
              <Copy v-else :size="11" />
            </button>
          </div>
          <div
            class="log-message mt-0.5 whitespace-pre-wrap break-all text-[10px] leading-[15px] text-slate-700"
            :class="{ collapsed: isLongLine(line.message, line.metadata) && !expandedLines.has(line.key) }"
          >{{ line.message }}</div>
          <div
            v-if="line.metadata"
            class="mt-0.5 truncate text-[9px] text-slate-400"
            :class="{ hidden: isLongLine(line.message, line.metadata) && !expandedLines.has(line.key) }"
          >{{ line.metadata }}</div>
          <button
            v-if="isLongLine(line.message, line.metadata)"
            type="button"
            class="mt-0.5 flex items-center gap-0.5 text-[9px] text-indigo-500 hover:text-indigo-700"
            @click="toggleExpanded(line.key)"
          >
            <ChevronUp v-if="expandedLines.has(line.key)" :size="10" />
            <ChevronDown v-else :size="10" />
            {{ expandedLines.has(line.key) ? '收起' : '展开' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.log-message.collapsed {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style>
