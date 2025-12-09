<script setup lang="ts">
import { computed } from 'vue'
import { ImageIcon, Trash2, RotateCw } from 'lucide-vue-next'
import type { TemplateImage } from '../../../utils/flowTypes'

const props = defineProps<{
  localImages?: TemplateImage[]
  localTempImages?: TemplateImage[]
  localDeletedImages?: TemplateImage[]
}>()

const emit = defineEmits<{
  (e: 'delete-image', path: string): void
  (e: 'delete-temp', path: string): void
  (e: 'restore', path: string): void
}>()

const localImages = computed(() => props.localImages ?? [])
const localTempImages = computed(() => props.localTempImages ?? [])
const localDeletedImages = computed(() => props.localDeletedImages ?? [])
</script>

<template>
  <div class="flex-1 p-2 overflow-y-auto custom-scrollbar">
    <div v-if="localImages.length === 0 && localTempImages.length === 0 && localDeletedImages.length === 0"
         class="flex flex-col items-center justify-center h-40 text-slate-400 space-y-2">
      <ImageIcon :size="24" class="opacity-30"/>
      <span class="text-xs">暂无图片</span>
    </div>

    <div v-if="localImages.length > 0" class="space-y-2">
      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
        当前图片 ({{ localImages.length }})
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div v-for="(item, index) in localImages" :key="'current-' + index"
             class="group relative rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square bg-white border border-slate-200">
          <button @click.stop="emit('delete-image', item.path)"
                  class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md bg-black/50 hover:bg-red-500 opacity-0 group-hover:opacity-100">
            <Trash2 :size="12"/>
          </button>
          <div class="w-full h-full bg-slate-100 flex items-center justify-center relative">
            <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:6px_6px]"></div>
            <img :src="item.base64" class="w-full h-full object-contain relative z-10"/>
            <div class="absolute bottom-0 left-0 right-0 backdrop-blur-[1px] py-1 px-1 z-20 truncate bg-black/60">
              <div class="text-[9px] text-white/90 font-mono text-center truncate select-none" :title="item.path">
                {{ item.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="localTempImages.length > 0" class="space-y-2 mt-3">
      <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider px-1 flex items-center gap-1">
        <ImageIcon :size="10"/> 新增图片(保存文件修改后写入文件) ({{ localTempImages.length }})
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div v-for="(item, index) in localTempImages" :key="'temp-' + index"
             class="group relative rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square bg-white border-2 border-emerald-400">
          <button @click.stop="emit('delete-temp', item.path)"
                  class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md bg-black/50 hover:bg-red-500 opacity-0 group-hover:opacity-100">
            <Trash2 :size="12"/>
          </button>
          <div class="w-full h-full flex items-center justify-center relative bg-emerald-50">
            <img :src="item.base64" class="w-full h-full object-contain relative z-10"/>
            <div class="absolute bottom-0 left-0 right-0 backdrop-blur-[1px] py-1 px-1 z-20 truncate bg-emerald-600/80">
              <div class="text-[9px] text-white/90 font-mono text-center truncate select-none" :title="item.path">
                {{ item.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="localDeletedImages.length > 0" class="space-y-2 mt-3">
      <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1">
        <Trash2 :size="10" class="opacity-50"/> 已删除图片(保存文件修改后彻底删除) ({{ localDeletedImages.length }})
      </div>
      <div class="grid grid-cols-3 gap-1">
        <div v-for="(item, index) in localDeletedImages" :key="'deleted-' + index"
             class="group relative rounded-md overflow-hidden shadow-sm transition-all aspect-square bg-slate-200 border border-slate-300">
          <button @click.stop="emit('restore', item.path)"
                  class="absolute top-0.5 right-0.5 z-20 p-1 text-white rounded-md bg-slate-500/70 hover:bg-emerald-500 opacity-0 group-hover:opacity-100">
            <RotateCw :size="12"/>
          </button>
          <div class="w-full h-full bg-slate-200 flex items-center justify-center relative opacity-50 grayscale">
            <img :src="item.base64" class="w-full h-full object-contain relative z-10"/>
            <div class="absolute bottom-0 left-0 right-0 bg-slate-500/80 backdrop-blur-[1px] py-1 px-1 z-20 truncate">
              <div class="text-[9px] text-white/70 font-mono text-center truncate select-none" :title="item.path">
                {{ item.path }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>