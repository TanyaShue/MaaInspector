<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, Trash2, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  visible?: boolean
  nodeCount?: number
  edgeCount?: number
}>(), {
  visible: false,
  nodeCount: 0,
  edgeCount: 0
})

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()

const finalStep = ref(false)

watch(() => props.visible, (visible) => {
  if (!visible) finalStep.value = false
})

const handleCancel = () => {
  finalStep.value = false
  emit('cancel')
}

const handleConfirmClick = () => {
  if (!finalStep.value) {
    finalStep.value = true
    return
  }

  finalStep.value = false
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        @mousedown.self="handleCancel"
      >
        <div
          class="w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          @mousedown.stop
        >
          <div class="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="rounded-xl bg-red-100 p-2">
                <AlertTriangle class="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-800">
                  清除画布
                </h3>
                <p class="mt-0.5 text-xs text-slate-500">
                  该操作会删除当前画布中的全部内容
                </p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              title="关闭"
              @click="handleCancel"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="space-y-3 px-5 py-4">
            <p class="text-sm text-slate-600">
              当前将删除 <span class="font-bold text-slate-900">{{ nodeCount }}</span> 个节点和
              <span class="font-bold text-slate-900">{{ edgeCount }}</span> 条连线。
            </p>
            <div
              class="rounded-lg border px-3 py-2 text-xs"
              :class="finalStep ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'"
            >
              {{ finalStep ? '最终确认：再次点击后将立即清空画布。' : '第一次确认后，还需要进行一次最终确认。' }}
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
              @click="handleCancel"
            >
              取消
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors"
              :class="finalStep ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'"
              @click="handleConfirmClick"
            >
              <Trash2 :size="13" />
              {{ finalStep ? '最终确认清除' : '清除画布' }}
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
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.96);
}
</style>
