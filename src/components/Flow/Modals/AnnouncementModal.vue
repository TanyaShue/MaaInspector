<script setup lang="ts">
import { Bell, X, Clock, CheckCircle } from 'lucide-vue-next'
import { onMounted, onUnmounted } from 'vue'
import ChangelogSection from '@/features/changelog/ChangelogSection.vue'
import { changelogReleases } from '@/features/changelog'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const announcements = changelogReleases

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
    aria-labelledby="announcement-title"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl shadow-2xl border border-slate-200 flex overflow-hidden w-[min(600px,calc(100vw-2rem))] max-h-[80vh]">
      <div class="flex-1 flex flex-col bg-white">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
          <h3
            id="announcement-title"
            class="font-bold text-slate-700 flex items-center gap-2"
          >
            <div class="p-1.5 bg-indigo-500 rounded-lg">
              <Bell
                :size="16"
                class="text-white"
              />
            </div>
            更新公告
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-red-500 transition-colors"
            aria-label="关闭更新公告"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          <!-- 公告列表 -->
          <div
            v-if="announcements.length > 0"
            class="p-5 space-y-4"
          >
            <div
              v-for="item in announcements"
              :key="item.id"
              class="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <!-- 版本头部 -->
              <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">{{ item.version }}</span>
                  <span class="flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock :size="11" />
                    {{ item.date }}
                  </span>
                </div>
                <CheckCircle
                  :size="16"
                  class="text-emerald-500"
                />
              </div>

              <!-- 更新内容 -->
              <div class="p-4 space-y-3">
                <ChangelogSection
                  v-for="section in item.sections"
                  :key="section.kind"
                  :section="section"
                />
              </div>
            </div>
          </div>

          <!-- 无公告 -->
          <div
            v-else
            class="flex flex-col items-center justify-center py-12 text-slate-400"
          >
            <Bell
              :size="48"
              class="mb-2 opacity-50"
            />
            <p class="text-sm">
              暂无更新公告
            </p>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            class="px-6 py-2 text-xs font-bold bg-indigo-500 text-white rounded-lg shadow-sm hover:bg-indigo-600 transition-colors"
            @click="emit('close')"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(203 213 225) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgb(203 213 225);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgb(148 163 184);
}
</style>
