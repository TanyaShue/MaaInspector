<script setup lang="ts">
import { FileJson, Folder, X } from 'lucide-vue-next'
import type { ResourceNodeLocation } from '@/utils/resourceNode'

defineProps<{
  visible: boolean
  nodeId: string
  candidates: ResourceNodeLocation[]
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'select', location: ResourceNodeLocation): void
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
      @mousedown.self="$emit('close')"
    >
      <section class="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header class="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-slate-800">
              选择节点定义
            </h2>
            <p class="mt-1 text-xs text-slate-500">
              找到 {{ candidates.length }} 个 <span class="font-mono text-indigo-600">{{ nodeId }}</span>，请选择要打开的文件。
            </p>
          </div>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭"
            @click="$emit('close')"
          >
            <X :size="17" />
          </button>
        </header>

        <div class="max-h-[420px] space-y-2 overflow-y-auto p-4">
          <button
            v-for="candidate in candidates"
            :key="`${candidate.source}::${candidate.filename}::${candidate.nodeId}`"
            type="button"
            class="flex w-full items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
            @click="$emit('select', candidate)"
          >
            <FileJson
              :size="18"
              class="mt-0.5 shrink-0 text-indigo-500"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-700">{{ candidate.filename }}</span>
              <span class="mt-1 flex items-center gap-1 truncate font-mono text-[11px] text-slate-400">
                <Folder :size="11" />
                {{ candidate.source }}
              </span>
            </span>
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
