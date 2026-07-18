<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  GitBranch,
  GripVertical,
  X,
} from 'lucide-vue-next'

type LinkKey = 'next' | 'on_error'

const props = defineProps<{
  nextList?: string[]
  onErrorList?: string[]
}>()

const nextList = computed(() => props.nextList ?? [])
const onErrorList = computed(() => props.onErrorList ?? [])

const emit = defineEmits<{
  (e: 'add-link', payload: { key: LinkKey; value: Ref<string> }): void
  (e: 'remove-link', payload: { key: LinkKey; index: number }): void
  (e: 'move-link', payload: {
    key: LinkKey
    index: number
    direction?: number
    position?: 'top' | 'bottom'
  }): void
  (e: 'reorder-link', payload: {
    sourceKey: LinkKey
    sourceIndex: number
    targetKey: LinkKey
    targetIndex: number
  }): void
}>()

const newNextLink = ref<string>('')
const newErrorLink = ref<string>('')

const hasNext = computed(() => nextList.value.length > 0)
const hasError = computed(() => onErrorList.value.length > 0)

const addNext = () => emit('add-link', { key: 'next', value: newNextLink })
const addError = () => emit('add-link', { key: 'on_error', value: newErrorLink })

const draggedLink = ref<{ key: LinkKey; index: number } | null>(null)
const dragOverKey = ref<LinkKey | null>(null)
const dragTarget = ref<{ key: LinkKey; index: number } | null>(null)
const dragPointer = ref({ x: 0, y: 0 })
const draggedLabel = computed(() => {
  const source = draggedLink.value
  if (!source) return ''
  const list = source.key === 'next' ? nextList.value : onErrorList.value
  return list[source.index] ?? ''
})

const getDropTarget = (x: number, y: number) => {
  const element = document.elementFromPoint(x, y) as HTMLElement | null
  const zone = element?.closest<HTMLElement>('[data-flow-link-drop-key]')
  const key = zone?.dataset.flowLinkDropKey as LinkKey | undefined
  if (!zone || (key !== 'next' && key !== 'on_error')) return null

  const indicator = element?.closest<HTMLElement>('[data-flow-link-insert-index]')
  if (indicator && zone.contains(indicator)) {
    return {
      key,
      index: Number(indicator.dataset.flowLinkInsertIndex),
    }
  }

  const item = element?.closest<HTMLElement>('[data-flow-link-index]')
  if (item && zone.contains(item)) {
    const index = Number(item.dataset.flowLinkIndex)
    const rect = item.getBoundingClientRect()
    return {
      key,
      index: index + (y > rect.top + rect.height / 2 ? 1 : 0),
    }
  }

  return {
    key,
    index: key === 'next' ? nextList.value.length : onErrorList.value.length,
  }
}

const handlePointerMove = (event: PointerEvent) => {
  if (!draggedLink.value) return
  event.preventDefault()
  dragPointer.value = { x: event.clientX, y: event.clientY }
  dragTarget.value = getDropTarget(event.clientX, event.clientY)
  dragOverKey.value = dragTarget.value?.key ?? null
}

const handlePointerUp = (event: PointerEvent) => {
  if (!draggedLink.value) return
  const target = getDropTarget(event.clientX, event.clientY)
  if (target) dropAt(target.key, target.index)
  else resetDrag()
}

const handlePointerDown = (event: PointerEvent, key: LinkKey, index: number) => {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  draggedLink.value = { key, index }
  dragOverKey.value = key
  dragTarget.value = { key, index }
  dragPointer.value = { x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', handlePointerMove, { passive: false })
  window.addEventListener('pointerup', handlePointerUp, { once: true })
}

const resetDrag = () => {
  draggedLink.value = null
  dragOverKey.value = null
  dragTarget.value = null
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}

const dropAt = (targetKey: LinkKey, targetIndex: number) => {
  const source = draggedLink.value
  if (!source) return
  emit('reorder-link', {
    sourceKey: source.key,
    sourceIndex: source.index,
    targetKey,
    targetIndex,
  })
  resetDrag()
}

onBeforeUnmount(resetDrag)
</script>

<template>
  <div class="p-3 space-y-4">
    <div class="space-y-2">
      <div class="flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
        <GitBranch :size="12" />
        后继节点 (Next)
      </div>
      <div class="space-y-1">
        <div
          v-if="hasNext"
          data-flow-link-drop-key="next"
          class="min-h-8 space-y-1 rounded-lg transition-colors"
          :class="{ 'bg-blue-100/50 ring-1 ring-blue-200': dragOverKey === 'next' }"
        >
          <div
            v-for="(link, idx) in nextList"
            :key="`next-${link}-${idx}`"
          >
            <div
              v-if="dragTarget?.key === 'next' && dragTarget.index === idx"
              :data-testid="`next-drop-indicator-${idx}`"
              :data-flow-link-insert-index="idx"
              class="flex items-center gap-2 py-0.5 text-[10px] font-semibold text-blue-600"
            >
              <span class="h-0.5 flex-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
              <span class="rounded-full bg-blue-100 px-2 py-0.5">插入到这里</span>
              <span class="h-0.5 flex-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
            </div>
            <div
              :data-flow-link-index="idx"
              class="flex items-center gap-1.5 p-2 bg-blue-50/70 border border-blue-100 rounded-lg transition-opacity"
              :class="{ 'opacity-40': draggedLink?.key === 'next' && draggedLink.index === idx }"
            >
              <GripVertical
                :size="14"
                data-testid="next-drag-handle"
                class="nodrag shrink-0 cursor-grab touch-none text-blue-300 active:cursor-grabbing"
                @pointerdown="handlePointerDown($event, 'next', idx)"
              />
              <span class="flex-1 text-xs font-mono text-blue-800 truncate">{{ link }}</span>
              <div class="flex items-center gap-1">
                <button
                  :disabled="idx === 0"
                  class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40"
                  title="移到顶部"
                  aria-label="移到顶部"
                  @click="emit('move-link', { key: 'next', index: idx, position: 'top' })"
                >
                  <ChevronsUp :size="12" />
                </button>
                <button
                  :disabled="idx === 0"
                  class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40"
                  title="上移"
                  aria-label="上移"
                  @click="emit('move-link', { key: 'next', index: idx, direction: -1 })"
                >
                  <ChevronUp :size="12" />
                </button>
                <button
                  :disabled="idx === nextList.length - 1"
                  class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40"
                  title="下移"
                  aria-label="下移"
                  @click="emit('move-link', { key: 'next', index: idx, direction: 1 })"
                >
                  <ChevronDown :size="12" />
                </button>
                <button
                  :disabled="idx === nextList.length - 1"
                  class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40"
                  title="移到底部"
                  aria-label="移到底部"
                  @click="emit('move-link', { key: 'next', index: idx, position: 'bottom' })"
                >
                  <ChevronsDown :size="12" />
                </button>
                <button
                  class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100"
                  title="删除"
                  aria-label="删除"
                  @click="emit('remove-link', { key: 'next', index: idx })"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="dragTarget?.key === 'next' && dragTarget.index === nextList.length"
            :data-testid="`next-drop-indicator-${nextList.length}`"
            :data-flow-link-insert-index="nextList.length"
            class="flex items-center gap-2 py-0.5 text-[10px] font-semibold text-blue-600"
          >
            <span class="h-0.5 flex-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
            <span class="rounded-full bg-blue-100 px-2 py-0.5">插入到这里</span>
            <span class="h-0.5 flex-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
          </div>
        </div>
        <div
          v-else
          data-testid="next-empty-drop-zone"
          data-flow-link-drop-key="next"
          class="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-2 py-1.5 transition-colors"
          :class="{ 'bg-blue-50 border-blue-300 text-blue-500': dragOverKey === 'next' }"
        >
          <div
            v-if="dragTarget?.key === 'next'"
            data-flow-link-insert-index="0"
            class="flex items-center gap-2 text-[10px] font-semibold text-blue-600"
          >
            <span class="h-0.5 flex-1 rounded-full bg-blue-500" />
            <span class="rounded-full bg-blue-100 px-2 py-0.5">插入到这里</span>
            <span class="h-0.5 flex-1 rounded-full bg-blue-500" />
          </div>
          <span v-else>暂无后继节点，添加一个以定义执行顺序</span>
        </div>
        <div class="flex gap-1">
          <input
            v-model="newNextLink"
            class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            placeholder="输入节点 ID，回车添加"
            @keyup.enter="addNext"
          >
          <button
            class="px-3 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 transition-colors"
            @click="addNext"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-1.5 text-rose-600 text-xs font-semibold">
        <div class="w-1.5 h-1.5 rounded-full bg-rose-500" />
        错误节点 (OnError)
      </div>
      <div class="space-y-1">
        <div
          v-if="hasError"
          data-flow-link-drop-key="on_error"
          class="min-h-8 space-y-1 rounded-lg transition-colors"
          :class="{ 'bg-rose-100/50 ring-1 ring-rose-200': dragOverKey === 'on_error' }"
        >
          <div
            v-for="(link, idx) in onErrorList"
            :key="`err-${link}-${idx}`"
          >
            <div
              v-if="dragTarget?.key === 'on_error' && dragTarget.index === idx"
              :data-testid="`on-error-drop-indicator-${idx}`"
              :data-flow-link-insert-index="idx"
              class="flex items-center gap-2 py-0.5 text-[10px] font-semibold text-rose-600"
            >
              <span class="h-0.5 flex-1 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
              <span class="rounded-full bg-rose-100 px-2 py-0.5">插入到这里</span>
              <span class="h-0.5 flex-1 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
            </div>
            <div
              :data-flow-link-index="idx"
              class="flex items-center gap-1.5 p-2 bg-rose-50/70 border border-rose-100 rounded-lg transition-opacity"
              :class="{ 'opacity-40': draggedLink?.key === 'on_error' && draggedLink.index === idx }"
            >
              <GripVertical
                :size="14"
                data-testid="on-error-drag-handle"
                class="nodrag shrink-0 cursor-grab touch-none text-rose-300 active:cursor-grabbing"
                @pointerdown="handlePointerDown($event, 'on_error', idx)"
              />
              <span class="flex-1 text-xs font-mono text-rose-800 truncate">{{ link }}</span>
              <div class="flex items-center gap-1">
                <button
                  :disabled="idx === 0"
                  class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40"
                  title="移到顶部"
                  aria-label="移到顶部"
                  @click="emit('move-link', { key: 'on_error', index: idx, position: 'top' })"
                >
                  <ChevronsUp :size="12" />
                </button>
                <button
                  :disabled="idx === 0"
                  class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40"
                  title="上移"
                  aria-label="上移"
                  @click="emit('move-link', { key: 'on_error', index: idx, direction: -1 })"
                >
                  <ChevronUp :size="12" />
                </button>
                <button
                  :disabled="idx === onErrorList.length - 1"
                  class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40"
                  title="下移"
                  aria-label="下移"
                  @click="emit('move-link', { key: 'on_error', index: idx, direction: 1 })"
                >
                  <ChevronDown :size="12" />
                </button>
                <button
                  :disabled="idx === onErrorList.length - 1"
                  class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40"
                  title="移到底部"
                  aria-label="移到底部"
                  @click="emit('move-link', { key: 'on_error', index: idx, position: 'bottom' })"
                >
                  <ChevronsDown :size="12" />
                </button>
                <button
                  class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100"
                  title="删除"
                  aria-label="删除"
                  @click="emit('remove-link', { key: 'on_error', index: idx })"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="dragTarget?.key === 'on_error' && dragTarget.index === onErrorList.length"
            :data-testid="`on-error-drop-indicator-${onErrorList.length}`"
            :data-flow-link-insert-index="onErrorList.length"
            class="flex items-center gap-2 py-0.5 text-[10px] font-semibold text-rose-600"
          >
            <span class="h-0.5 flex-1 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
            <span class="rounded-full bg-rose-100 px-2 py-0.5">插入到这里</span>
            <span class="h-0.5 flex-1 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
          </div>
        </div>
        <div
          v-else
          data-testid="on-error-empty-drop-zone"
          data-flow-link-drop-key="on_error"
          class="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-2 py-1.5 transition-colors"
          :class="{ 'bg-rose-50 border-rose-300 text-rose-500': dragOverKey === 'on_error' }"
        >
          <div
            v-if="dragTarget?.key === 'on_error'"
            data-flow-link-insert-index="0"
            class="flex items-center gap-2 text-[10px] font-semibold text-rose-600"
          >
            <span class="h-0.5 flex-1 rounded-full bg-rose-500" />
            <span class="rounded-full bg-rose-100 px-2 py-0.5">插入到这里</span>
            <span class="h-0.5 flex-1 rounded-full bg-rose-500" />
          </div>
          <span v-else>暂未配置错误分支，可添加备用流程</span>
        </div>
        <div class="flex gap-1">
          <input
            v-model="newErrorLink"
            class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
            placeholder="输入节点 ID，回车添加"
            @keyup.enter="addError"
          >
          <button
            class="px-3 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 transition-colors"
            @click="addError"
          >
            添加
          </button>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="draggedLink"
        class="pointer-events-none fixed z-[200] max-w-64 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-indigo-200 bg-white/95 px-3 py-2 font-mono text-xs text-slate-700 shadow-xl"
        :style="{ left: `${dragPointer.x}px`, top: `${dragPointer.y}px` }"
      >
        {{ draggedLabel }}
      </div>
    </Teleport>
  </div>
</template>
