<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Trash2, X, Image as ImageIcon, FileWarning } from 'lucide-vue-next'

interface UsedImageInfo {
  path: string
  used_by: string[]
}

const props = withDefaults(defineProps<{
  visible: boolean
  unusedImages: string[]
  usedImages: UsedImageInfo[]
  isProcessing: boolean
}>(), {
  visible: false,
  unusedImages: () => [],
  usedImages: () => [],
  isProcessing: false
})

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
  (e: 'skip'): void
}>()

const hasUnused = computed<boolean>(() => props.unusedImages.length > 0)
const hasUsed = computed<boolean>(() => props.usedImages.length > 0)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible"
           class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-amber-100 rounded-xl">
                <AlertTriangle class="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-800">图片处理确认</h3>
                <p class="text-xs text-slate-500">检测到以下图片需要处理</p>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <!-- 未被引用的图片 -->
            <div v-if="hasUnused" class="space-y-2">
              <div class="flex items-center gap-2 text-sm font-bold text-red-600">
                <Trash2 :size="16" />
                <span>可彻底删除的图片 ({{ unusedImages.length }})</span>
              </div>
              <p class="text-xs text-slate-500 mb-2">以下图片未被其他节点引用，可以安全删除：</p>
              <div class="bg-red-50 border border-red-100 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div v-for="path in unusedImages" :key="path" 
                     class="flex items-center gap-2 py-1 text-xs text-red-700">
                  <ImageIcon :size="12" class="text-red-400 shrink-0" />
                  <span class="font-mono truncate">{{ path }}</span>
                </div>
              </div>
            </div>

            <!-- 被其他文件引用的图片 -->
            <div v-if="hasUsed" class="space-y-2">
              <div class="flex items-center gap-2 text-sm font-bold text-amber-600">
                <FileWarning :size="16" />
                <span>被其他文件引用的图片 ({{ usedImages.length }})</span>
              </div>
              <p class="text-xs text-slate-500 mb-2">以下图片被其他节点引用，将保留在磁盘上：</p>
              <div class="bg-amber-50 border border-amber-100 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div v-for="item in usedImages" :key="item.path" 
                     class="py-1.5 border-b border-amber-100 last:border-0">
                  <div class="flex items-center gap-2 text-xs text-amber-700">
                    <ImageIcon :size="12" class="text-amber-400 shrink-0" />
                    <span class="font-mono truncate">{{ item.path }}</span>
                  </div>
                  <div class="ml-5 mt-0.5 text-[10px] text-amber-500">
                    引用: {{ item.used_by.slice(0, 3).join(', ') }}
                    <span v-if="item.used_by.length > 3">等 {{ item.used_by.length }} 处</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 无图片需要处理 -->
            <div v-if="!hasUnused && !hasUsed" class="text-center py-4 text-slate-500">
              <ImageIcon :size="32" class="mx-auto mb-2 text-slate-300" />
              <p class="text-sm">没有需要处理的图片</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button @click="$emit('cancel')"
                    :disabled="isProcessing"
                    class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">
              取消
            </button>
            <button v-if="hasUnused"
                    @click="$emit('skip')"
                    :disabled="isProcessing"
                    class="px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50">
              保留所有图片
            </button>
            <button @click="$emit('confirm')"
                    :disabled="isProcessing"
                    class="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow transition-all disabled:opacity-50 flex items-center gap-2">
              <Trash2 v-if="hasUnused && !isProcessing" :size="14" />
              <span v-if="isProcessing">处理中...</span>
              <span v-else-if="hasUnused">删除并保存</span>
              <span v-else>确认保存</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
}
</style>

