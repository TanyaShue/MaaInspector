<script setup lang="ts">
import { computed, ref } from 'vue'
import { ImageIcon, Trash2, RotateCw, Check, GripVertical } from 'lucide-vue-next'
import type { TemplateImage } from '@/utils/flowTypes'

const props = defineProps<{
  localImages?: TemplateImage[]
  localTempImages?: TemplateImage[]
  localDeletedImages?: TemplateImage[]
}>()

const emit = defineEmits<{
  (e: 'delete-image', path: string): void
  (e: 'delete-temp', path: string): void
  (e: 'restore', path: string): void
  (e: 'reorder', images: TemplateImage[]): void
  (e: 'batch-delete', paths: string[]): void
  (e: 'batch-restore', paths: string[]): void
}>()

const localImages = computed(() => props.localImages ?? [])
const localTempImages = computed(() => props.localTempImages ?? [])
const localDeletedImages = computed(() => props.localDeletedImages ?? [])

const selectedPaths = ref<Set<string>>(new Set())
const isSelectionMode = ref(false)
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const toggleSelection = (path: string) => {
  if (selectedPaths.value.has(path)) {
    selectedPaths.value.delete(path)
  } else {
    selectedPaths.value.add(path)
  }
  if (selectedPaths.value.size === 0) {
    isSelectionMode.value = false
  }
}

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  if (!isSelectionMode.value) {
    selectedPaths.value.clear()
  }
}

const selectAll = () => {
  const allPaths = [...localImages.value, ...localTempImages.value].map(img => img.path)
  selectedPaths.value = new Set(allPaths)
}

const batchDelete = () => {
  const paths = Array.from(selectedPaths.value)
  emit('batch-delete', paths)
  selectedPaths.value.clear()
  isSelectionMode.value = false
}

const batchRestore = () => {
  const paths = Array.from(selectedPaths.value)
  emit('batch-restore', paths)
  selectedPaths.value.clear()
  isSelectionMode.value = false
}

const handleDragStart = (index: number) => {
  dragIndex.value = index
}

const handleDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  dragOverIndex.value = index
}

const handleDragEnd = () => {
  if (dragIndex.value !== null && dragOverIndex.value !== null && dragIndex.value !== dragOverIndex.value) {
    const newImages = [...localImages.value]
    const [dragged] = newImages.splice(dragIndex.value, 1)
    newImages.splice(dragOverIndex.value, 0, dragged)
    emit('reorder', newImages)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

const hasSelection = computed(() => selectedPaths.value.size > 0)
</script>

<template>
  <div class="flex-1 p-2 overflow-y-auto custom-scrollbar">
    <div class="flex items-center justify-between mb-2 px-1">
      <button
        class="text-[10px] px-2 py-1 rounded border transition-colors"
        :class="isSelectionMode ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
        @click="toggleSelectionMode"
      >
        {{ isSelectionMode ? '取消选择' : '批量选择' }}
      </button>
      <div
        v-if="isSelectionMode"
        class="flex gap-1"
      >
        <button
          class="text-[10px] px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          @click="selectAll"
        >
          全选
        </button>
        <button
          v-if="hasSelection"
          class="text-[10px] px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
          @click="batchDelete"
        >
          删除选中 ({{ selectedPaths.size }})
        </button>
        <button
          v-if="hasSelection && localDeletedImages.length > 0"
          class="text-[10px] px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
          @click="batchRestore"
        >
          恢复选中
        </button>
      </div>
    </div>

    <div
      v-if="localImages.length === 0 && localTempImages.length === 0 && localDeletedImages.length === 0"
      class="flex flex-col items-center justify-center h-40 text-slate-400 space-y-2"
    >
      <ImageIcon
        :size="24"
        class="opacity-30"
      />
      <span class="text-xs">暂无图片</span>
    </div>

    <div
      v-if="localImages.length > 0"
      class="space-y-2"
    >
      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
        当前图片 ({{ localImages.length }})
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div
          v-for="(item, index) in localImages"
          :key="'current-' + index"
          class="group relative rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square bg-white border border-slate-200"
          :class="{
            'ring-2 ring-indigo-500': isSelectionMode && selectedPaths.has(item.path),
            'opacity-50': dragIndex === index,
            'border-indigo-300': dragOverIndex === index
          }"
          draggable="true"
          @dragstart="handleDragStart(index)"
          @dragover="(e) => handleDragOver(e, index)"
          @dragend="handleDragEnd"
          @click="isSelectionMode ? toggleSelection(item.path) : null"
        >
          <div
            v-if="isSelectionMode"
            class="absolute top-0.5 left-0.5 z-20"
          >
            <div
              class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
              :class="selectedPaths.has(item.path) ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'"
            >
              <Check
                v-if="selectedPaths.has(item.path)"
                :size="10"
                class="text-white"
              />
            </div>
          </div>
          <button
            v-if="!isSelectionMode"
            class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md bg-black/50 hover:bg-red-500 opacity-0 group-hover:opacity-100"
            @click.stop="emit('delete-image', item.path)"
          >
            <Trash2 :size="12" />
          </button>
          <div
            v-if="!isSelectionMode"
            class="absolute top-0.5 left-0.5 z-10 opacity-0 group-hover:opacity-100 cursor-grab"
          >
            <GripVertical
              :size="12"
              class="text-white/70"
            />
          </div>
          <div class="w-full h-full bg-slate-100 flex items-center justify-center relative">
            <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]" />
            <img
              :src="item.url"
              class="w-full h-full object-contain relative z-10"
            >
            <div class="absolute bottom-0 left-0 right-0 py-1 px-1 z-20 truncate bg-black/70">
              <div
                class="text-[9px] text-white/90 font-mono text-center truncate select-none"
                :title="item.path"
              >
                {{ item.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="localTempImages.length > 0"
      class="space-y-2 mt-3"
    >
      <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider px-1 flex items-center gap-1">
        <ImageIcon :size="10" /> 新增图片(保存文件修改后写入文件) ({{ localTempImages.length }})
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div
          v-for="(item, index) in localTempImages"
          :key="'temp-' + index"
          class="group relative rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square bg-white border-2 border-emerald-400"
          :class="{
            'ring-2 ring-indigo-500': isSelectionMode && selectedPaths.has(item.path)
          }"
          @click="isSelectionMode ? toggleSelection(item.path) : null"
        >
          <div
            v-if="isSelectionMode"
            class="absolute top-0.5 left-0.5 z-20"
          >
            <div
              class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
              :class="selectedPaths.has(item.path) ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'"
            >
              <Check
                v-if="selectedPaths.has(item.path)"
                :size="10"
                class="text-white"
              />
            </div>
          </div>
          <button
            v-if="!isSelectionMode"
            class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md bg-black/50 hover:bg-red-500 opacity-0 group-hover:opacity-100"
            @click.stop="emit('delete-temp', item.path)"
          >
            <Trash2 :size="12" />
          </button>
          <div class="w-full h-full flex items-center justify-center relative bg-emerald-50">
            <img
              :src="item.url"
              class="w-full h-full object-contain relative z-10"
            >
            <div class="absolute bottom-0 left-0 right-0 py-1 px-1 z-20 truncate bg-emerald-600/90">
              <div
                class="text-[9px] text-white/90 font-mono text-center truncate select-none"
                :title="item.path"
              >
                {{ item.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="localDeletedImages.length > 0"
      class="space-y-2 mt-3"
    >
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1">
        <Trash2
          :size="10"
          class="opacity-50"
        /> 已删除图片(保存文件修改后彻底删除) ({{ localDeletedImages.length }})
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div
          v-for="(item, index) in localDeletedImages"
          :key="'deleted-' + index"
          class="group relative rounded-md overflow-hidden shadow-sm transition-all aspect-square bg-slate-200 border border-slate-300"
          :class="{
            'ring-2 ring-indigo-500': isSelectionMode && selectedPaths.has(item.path)
          }"
          @click="isSelectionMode ? toggleSelection(item.path) : null"
        >
          <div
            v-if="isSelectionMode"
            class="absolute top-0.5 left-0.5 z-20"
          >
            <div
              class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
              :class="selectedPaths.has(item.path) ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'"
            >
              <Check
                v-if="selectedPaths.has(item.path)"
                :size="10"
                class="text-white"
              />
            </div>
          </div>
          <button
            v-if="!isSelectionMode"
            class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md bg-slate-500/70 hover:bg-emerald-500 opacity-0 group-hover:opacity-100"
            @click.stop="emit('restore', item.path)"
          >
            <RotateCw :size="12" />
          </button>
          <div class="w-full h-full bg-slate-200 flex items-center justify-center relative opacity-50 grayscale">
            <img
              :src="item.url"
              class="w-full h-full object-contain relative z-10"
            >
            <div class="absolute bottom-0 left-0 right-0 bg-slate-500/90 py-1 px-1 z-20 truncate">
              <div
                class="text-[9px] text-white/70 font-mono text-center truncate select-none"
                :title="item.path"
              >
                {{ item.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
