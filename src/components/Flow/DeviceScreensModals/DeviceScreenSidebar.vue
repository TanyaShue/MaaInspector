<script setup lang="ts">
import { computed } from 'vue'
import {
  Crosshair, Check, X, MousePointer2, ScanText, Loader2, ImageIcon,
  Copy, Maximize, ArrowLeftRight
} from 'lucide-vue-next'
import DeviceScreenImageList from './DeviceScreenImageList.vue'

type ModeType = 'coordinate' | 'ocr' | 'image_manager'
interface Selection { x: number; y: number; w: number; h: number }
interface GuideItem { icon: any; text: string }
import type { TemplateImage } from '../../../utils/flowTypes'

const props = defineProps<{
  mode?: ModeType
  title?: string
  selection: Selection
  ocrResult?: string
  isOcrLoading?: boolean
  previewUrl?: string
  saveImagePath?: string
  guideList?: GuideItem[]
  offsetInfo?: number[] | null
  referenceRect?: number[] | null
  referenceLabel?: string
  hasTemplateChanged?: boolean
  localImages?: TemplateImage[]
  localTempImages?: TemplateImage[]
  localDeletedImages?: TemplateImage[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
  (e: 'ocr-start'): void
  (e: 'update:ocrResult', val: string): void
  (e: 'update:saveImagePath', val: string): void
  (e: 'save-temp-image'): void
  (e: 'save-image-changes'): void
  (e: 'delete-image', path: string): void
  (e: 'delete-temp', path: string): void
  (e: 'restore-image', path: string): void
}>()

// 复制选区数据
const safeOcrResult = computed(() => props.ocrResult ?? '')
const safeSaveImagePath = computed(() => props.saveImagePath ?? '')

const copySelection = () => {
  if (!props.selection) return
  const { x, y, w, h } = props.selection
  const text = `[${Math.round(x)}, ${Math.round(y)}, ${Math.round(w)}, ${Math.round(h)}]`
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied:', text)
  }).catch(err => {
    console.error('Failed to copy:', err)
  })
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <div class="flex flex-row h-full">
    <div class="w-64 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0"
         :class="{'border-r': props.mode === 'image_manager'}">

      <div class="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
          <Crosshair :size="16" class="text-indigo-500"/>
          {{ title }}
        </h3>
      </div>

      <div class="flex-1 p-4 space-y-5 overflow-y-auto">

        <div v-if="props.mode === 'ocr'" class="space-y-2">
          <div class="text-xs font-semibold text-purple-500 uppercase tracking-wider flex items-center gap-1">
            <ScanText :size="12"/>
            OCR 识别
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-sm">
            <button @click="emit('ocr-start')" :disabled="selection.w === 0 || isOcrLoading"
                    class="w-full py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Loader2 v-if="isOcrLoading" :size="12" class="animate-spin"/>
              <ScanText v-else :size="12"/>
              {{ isOcrLoading ? '识别中...' : '开始识别' }}
            </button>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">识别结果(取最高评分)</label>
              <textarea
                :value="safeOcrResult"
                @input="(e) => $emit('update:ocrResult', (e.target as HTMLTextAreaElement | null)?.value || '')"
                rows="1"
                class="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 resize-none font-mono h-9"
                placeholder="等待识别...">
              </textarea>
            </div>
          </div>
        </div>

        <div v-else-if="props.mode === 'image_manager'" class="space-y-3">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <ImageIcon :size="12"/>
            选区截图预览
          </div>
          <div class="bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shadow-inner flex items-center justify-center min-h-[120px] h-[120px] relative p-2">
            <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]"></div>
            <img v-if="previewUrl" :src="previewUrl" class="relative z-10 w-full h-full object-contain drop-shadow-sm"/>
            <div v-else class="text-[10px] text-slate-400 relative z-10 flex flex-col items-center gap-1">
              <MousePointer2 :size="16" class="opacity-50"/>
              <span>请左键框选区域</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">保存路径</label>
            <div class="flex gap-1">
              <input
                :value="safeSaveImagePath"
                @input="(e) => $emit('update:saveImagePath', (e.target as HTMLInputElement | null)?.value || '')"
                type="text"
                class="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700 font-mono outline-none focus:border-emerald-400"
                placeholder="文件名.png"/>
              <button
                @click="emit('save-temp-image')"
                :disabled="!previewUrl || !safeSaveImagePath.trim()"
                class="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[11px] font-bold disabled:opacity-50">
                保存
              </button>
            </div>
          </div>
        </div>

        <div v-else class="space-y-2">
            <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <div class="flex items-center gap-1"><MousePointer2 :size="12"/> 当前选区</div>
            <button @click="copySelection" class="text-slate-400 hover:text-indigo-600 p-1"><Copy :size="12"/></button>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3 font-mono text-xs shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1"><span class="text-slate-400">X:</span><span class="font-bold text-slate-700">{{ Math.round(selection.x) }}</span></div>
              <div class="flex items-center gap-1"><span class="text-slate-400">Y:</span><span class="font-bold text-slate-700">{{ Math.round(selection.y) }}</span></div>
              <div class="flex items-center gap-1"><span class="text-slate-400">W:</span><span class="font-bold text-slate-700">{{ Math.round(selection.w) }}</span></div>
              <div class="flex items-center gap-1"><span class="text-slate-400">H:</span><span class="font-bold text-slate-700">{{ Math.round(selection.h) }}</span></div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-xs font-semibold text-indigo-500 uppercase tracking-wider flex items-center gap-1">操作指南</div>
          <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed space-y-2">
            <div v-for="(guide, index) in guideList" :key="index" class="flex items-start gap-2">
              <component :is="guide.icon" :size="14" class="text-indigo-400 mt-0.5 shrink-0"/>
              <span v-html="guide.text"></span>
            </div>
          </div>
        </div>

        <div v-if="props.referenceRect" class="pt-2 border-t border-slate-100 space-y-2">
          <div class="w-full space-y-1">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate" :title="props.referenceLabel">
              <Maximize :size="10"/> {{ props.referenceLabel }}
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] text-slate-500 font-mono text-center truncate">
              [{{ props.referenceRect.join(', ') }}]
            </div>
          </div>
          <div class="w-full space-y-1">
            <div class="text-[10px] font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1 truncate">
              <ArrowLeftRight :size="10"/> 相对偏移
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-[10px] text-blue-600 font-mono text-center truncate">
              [{{ offsetInfo ? offsetInfo.join(', ') : '0, 0, 0, 0' }}]
            </div>
          </div>
        </div>
      </div>

      <div v-if="props.mode !== 'image_manager'" class="p-4 border-t border-slate-200 bg-white space-y-2 shrink-0">
        <button @click="handleConfirm" :disabled="props.mode === 'ocr' ? (!ocrResult && !isOcrLoading) : selection.w === 0" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
          <Check :size="16"/> {{ props.mode === 'ocr' ? '确认结果' : '确认选取' }}
        </button>
        <button @click="$emit('close')" class="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          <X :size="16"/> 取消
        </button>
      </div>
    </div>

    <div v-if="props.mode === 'image_manager'" class="w-80 bg-slate-50 relative border-l border-slate-200">
      <div class="absolute inset-0 flex flex-col">
        <div class="px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <ImageIcon :size="16" class="text-pink-500"/>
            图片列表
          </h3>
        </div>

        <DeviceScreenImageList
          :localImages="localImages"
          :localTempImages="localTempImages"
          :localDeletedImages="localDeletedImages"
          @delete-image="$emit('delete-image', $event)"
          @delete-temp="$emit('delete-temp', $event)"
          @restore="$emit('restore-image', $event)"
        />

        <div class="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0">
          <button @click="$emit('save-image-changes')" :disabled="!hasTemplateChanged" class="w-full py-2 text-white rounded-lg text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700">
            <Check :size="16"/> 保存
          </button>
          <button @click="$emit('close')" class="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <X :size="16"/> 关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>