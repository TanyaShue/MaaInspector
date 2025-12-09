<script setup lang="ts">
import { computed, ref, type Ref } from 'vue'
import { ChevronDown, ChevronUp, GitBranch, X } from 'lucide-vue-next'

type LinkKey = 'next' | 'on_error'

const props = withDefaults(defineProps<{
  nextList: string[]
  onErrorList: string[]
}>(), {
  nextList: () => [],
  onErrorList: () => []
})

const emit = defineEmits<{
  (e: 'add-link', payload: { key: LinkKey; value: Ref<string> }): void
  (e: 'remove-link', payload: { key: LinkKey; index: number }): void
  (e: 'move-link', payload: { key: LinkKey; index: number; direction: number }): void
}>()

const newNextLink = ref<string>('')
const newErrorLink = ref<string>('')

const hasNext = computed(() => props.nextList.length > 0)
const hasError = computed(() => props.onErrorList.length > 0)

const addNext = () => emit('add-link', { key: 'next', value: newNextLink })
const addError = () => emit('add-link', { key: 'on_error', value: newErrorLink })
</script>

<template>
  <div class="p-3 space-y-4">
    <div class="space-y-2">
      <div class="flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
        <GitBranch :size="12" />
        后继节点 (Next)
      </div>
      <div class="space-y-1">
        <div v-if="hasNext" class="space-y-1">
          <div
            v-for="(link, idx) in nextList"
            :key="`next-${link}-${idx}`"
            class="flex items-center gap-2 p-2 bg-blue-50/70 border border-blue-100 rounded-lg"
          >
            <span class="flex-1 text-xs font-mono text-blue-800 truncate">{{ link }}</span>
            <div class="flex items-center gap-1">
              <button
                @click="emit('move-link', { key: 'next', index: idx, direction: -1 })"
                :disabled="idx === 0"
                class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40"
              >
                <ChevronUp :size="12" />
              </button>
              <button
                @click="emit('move-link', { key: 'next', index: idx, direction: 1 })"
                :disabled="idx === nextList.length - 1"
                class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40"
              >
                <ChevronDown :size="12" />
              </button>
              <button
                @click="emit('remove-link', { key: 'next', index: idx })"
                class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100"
              >
                <X :size="12" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-2 py-1.5">
          暂无后继节点，添加一个以定义执行顺序
        </div>
        <div class="flex gap-1">
          <input
            v-model="newNextLink"
            @keyup.enter="addNext"
            class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            placeholder="输入节点 ID，回车添加"
          />
          <button
            @click="addNext"
            class="px-3 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-1.5 text-rose-600 text-xs font-semibold">
        <div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
        错误节点 (OnError)
      </div>
      <div class="space-y-1">
        <div v-if="hasError" class="space-y-1">
          <div
            v-for="(link, idx) in onErrorList"
            :key="`err-${link}-${idx}`"
            class="flex items-center gap-2 p-2 bg-rose-50/70 border border-rose-100 rounded-lg"
          >
            <span class="flex-1 text-xs font-mono text-rose-800 truncate">{{ link }}</span>
            <div class="flex items-center gap-1">
              <button
                @click="emit('move-link', { key: 'on_error', index: idx, direction: -1 })"
                :disabled="idx === 0"
                class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40"
              >
                <ChevronUp :size="12" />
              </button>
              <button
                @click="emit('move-link', { key: 'on_error', index: idx, direction: 1 })"
                :disabled="idx === onErrorList.length - 1"
                class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40"
              >
                <ChevronDown :size="12" />
              </button>
              <button
                @click="emit('remove-link', { key: 'on_error', index: idx })"
                class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100"
              >
                <X :size="12" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-2 py-1.5">
          暂未配置错误分支，可添加备用流程
        </div>
        <div class="flex gap-1">
          <input
            v-model="newErrorLink"
            @keyup.enter="addError"
            class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
            placeholder="输入节点 ID，回车添加"
          />
          <button
            @click="addError"
            class="px-3 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
