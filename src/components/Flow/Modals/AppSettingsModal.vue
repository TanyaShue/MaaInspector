<script setup lang="ts">
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { openPath } from '@tauri-apps/plugin-opener'
import { Settings, Save, RotateCcw, Terminal, FolderOpen, X } from 'lucide-vue-next'
import { logApi, systemApi } from '@/services/api'
import { LAYOUT_ALGORITHM_OPTIONS, LAYOUT_DIRECTION_OPTIONS } from '@/utils/flowOptions'
import type { EdgeType } from '@/utils/flowOptions'
import type { LayoutAlgorithm, LayoutDirection, SpacingKey } from '@/utils/flowTypes'

export type PipelineVersion = 'V1' | 'V2'

interface AppSettingsProps {
  visible?: boolean
  defaultEdgeType?: EdgeType
  defaultSpacing?: SpacingKey
  defaultLayoutAlgorithm?: LayoutAlgorithm
  defaultLayoutDirection?: LayoutDirection
  defaultPipelineVersion?: PipelineVersion
  defaultRestoreWorkspaceOnStart?: boolean
  defaultLowMemoryMode?: boolean
}

const props = withDefaults(defineProps<AppSettingsProps>(), {
  visible: false,
  defaultEdgeType: 'smoothstep',
  defaultSpacing: 'normal',
  defaultLayoutAlgorithm: 'layered',
  defaultLayoutDirection: 'TB',
  defaultPipelineVersion: 'V1',
  defaultRestoreWorkspaceOnStart: true,
  defaultLowMemoryMode: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: {
    edgeType: EdgeType
    spacing: SpacingKey
    layoutAlgorithm: LayoutAlgorithm
    layoutDirection: LayoutDirection
    pipelineVersion: PipelineVersion
    restoreWorkspaceOnStart: boolean
    lowMemoryMode: boolean
  }): void
}>()

const edgeType = ref<EdgeType>(props.defaultEdgeType)
const spacing = ref<SpacingKey>(props.defaultSpacing)
const layoutAlgorithm = ref<LayoutAlgorithm>(props.defaultLayoutAlgorithm)
const layoutDirection = ref<LayoutDirection>(props.defaultLayoutDirection)
const pipelineVersion = ref<PipelineVersion>(props.defaultPipelineVersion)
const restoreWorkspaceOnStart = ref<boolean>(props.defaultRestoreWorkspaceOnStart)
const lowMemoryMode = ref<boolean>(props.defaultLowMemoryMode)

watch(() => props.visible, (val: boolean) => {
  if (val) {
    edgeType.value = props.defaultEdgeType
    spacing.value = props.defaultSpacing
    layoutAlgorithm.value = props.defaultLayoutAlgorithm
    layoutDirection.value = props.defaultLayoutDirection
    pipelineVersion.value = props.defaultPipelineVersion
    restoreWorkspaceOnStart.value = props.defaultRestoreWorkspaceOnStart
    lowMemoryMode.value = props.defaultLowMemoryMode
  }
})

const handleSave = () => {
  emit('save', {
    edgeType: edgeType.value,
    spacing: spacing.value,
    layoutAlgorithm: layoutAlgorithm.value,
    layoutDirection: layoutDirection.value,
    pipelineVersion: pipelineVersion.value,
    restoreWorkspaceOnStart: restoreWorkspaceOnStart.value,
    lowMemoryMode: lowMemoryMode.value
  })
}

const handleReset = () => {
  edgeType.value = 'smoothstep'
  spacing.value = 'normal'
  layoutAlgorithm.value = 'layered'
  layoutDirection.value = 'TB'
  pipelineVersion.value = 'V1'
  restoreWorkspaceOnStart.value = true
  lowMemoryMode.value = false
}

const handleOpenDevTools = async () => {
  try {
    await invoke('devtools_open')
  } catch (e) {
    console.error('Failed to open DevTools:', e)
  }
}

const handleOpenLogDir = async () => {
  try {
    const dir = await logApi.getDir()
    await openPath(dir)
  } catch (e) {
    console.error('Failed to open log directory:', e)
  }
}

const handleOpenBackupDir = async () => {
  try {
    const dir = await systemApi.getBackupDir()
    await openPath(dir)
  } catch (e) {
    console.error('Failed to open backup directory:', e)
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] animate-in fade-in duration-200"
    @click.self="$emit('close')"
  >
    <div class="flex max-h-[calc(100vh-2rem)] w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
      <div class="flex-1 min-h-0 flex flex-col bg-white">
        <div class="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-white px-5 py-4">
          <div class="flex items-center gap-3">
            <span class="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500 text-white shadow-sm shadow-indigo-200"><Settings :size="17" /></span>
            <div><h3 class="text-sm font-bold text-slate-800">应用设置</h3><p class="mt-0.5 text-[10px] text-slate-400">画布、工作区与开发选项</p></div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
              @click="handleReset"
            >
              <RotateCcw :size="12" />
              重置默认
            </button>
            <button class="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" title="关闭" @click="$emit('close')">
              <X :size="15" />
            </button>
          </div>
        </div>

        <div class="custom-scrollbar min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-5">
          <div class="space-y-6">
            <!-- 画布默认配置 -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div class="w-1 h-4 bg-indigo-500 rounded" />
                <h4 class="text-sm font-bold text-slate-700">
                  画布默认配置
                </h4>
              </div>

              <!-- 连线类型 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">连线类型</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="edgeType === 'smoothstep'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="edgeType = 'smoothstep'"
                  >
                    直角连线
                  </button>
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="edgeType === 'default'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="edgeType = 'default'"
                  >
                    贝塞尔曲线
                  </button>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  新建流程图时使用的默认连线样式
                </p>
              </div>

              <!-- 节点间距 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">节点间距</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="spacing === 'compact'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="spacing = 'compact'"
                  >
                    紧凑
                  </button>
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="spacing === 'normal'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="spacing = 'normal'"
                  >
                    默认
                  </button>
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="spacing === 'loose'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="spacing = 'loose'"
                  >
                    宽松
                  </button>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  自动布局时节点之间的默认间距
                </p>
              </div>

              <!-- 布局算法 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">布局算法</label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="option in LAYOUT_ALGORITHM_OPTIONS"
                    :key="option.value"
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="layoutAlgorithm === option.value
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="layoutAlgorithm = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <!-- 布局方向 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">布局方向</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="option in LAYOUT_DIRECTION_OPTIONS"
                    :key="option.value"
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="layoutDirection === option.value
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="layoutDirection = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <!-- 保存时的 pipeline 版本 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">保存时的 pipeline 版本</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="pipelineVersion === 'V1'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="pipelineVersion = 'V1'"
                  >
                    V1
                  </button>
                  <button
                    class="py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all"
                    :class="pipelineVersion === 'V2'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
                    @click="pipelineVersion = 'V2'"
                  >
                    V2
                  </button>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  保存 pipeline 文件时使用的格式版本
                </p>
              </div>

              <!-- 工作区恢复 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">启动时恢复工作区</label>
                <button
                  class="w-full py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all text-left"
                  :class="restoreWorkspaceOnStart
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'"
                  @click="restoreWorkspaceOnStart = !restoreWorkspaceOnStart"
                >
                  <span class="block font-semibold">{{ restoreWorkspaceOnStart ? '自动恢复已开启' : '自动恢复已关闭' }}</span>
                  <span class="mt-1 block text-[10px] opacity-75">{{ restoreWorkspaceOnStart ? '启动后加载上次资源，并重连设备与 Agent；失败最多重试 5 次' : '启动后保持空白工作区，不自动连接外部服务' }}</span>
                </button>
              </div>

              <!-- 低消耗模式 -->
              <div class="space-y-2">
                <label class="text-[11px] font-bold text-slate-500 uppercase block">标签页切换模式</label>
                <button
                  class="w-full py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all text-left"
                  :class="lowMemoryMode
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'"
                  @click="lowMemoryMode = !lowMemoryMode"
                >
                  <div class="flex flex-col gap-1">
                    <span class="font-semibold">
                      {{ lowMemoryMode ? '低消耗模式' : '快速切换模式' }}
                    </span>
                    <span class="text-[10px] opacity-75">
                      {{ lowMemoryMode
                        ? '切换时重建编辑器实例,占用内存更少但速度较慢'
                        : '切换时保留所有编辑器实例,速度更快但占用更多内存' }}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <!-- 数据备份 -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div class="w-1 h-4 bg-emerald-500 rounded" />
                <h4 class="text-sm font-bold text-slate-700">
                  数据备份
                </h4>
              </div>
              <button
                class="w-full py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all text-left bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400"
                @click="handleOpenBackupDir"
              >
                <div class="flex items-center gap-2">
                  <FolderOpen :size="14" />
                  <span>打开备份目录</span>
                </div>
                <p class="text-[10px] text-emerald-600/70 mt-1">
                  备份位于软件根目录的 backup 文件夹，并按日期分类
                </p>
              </button>
            </div>

            <!-- 开发者工具 -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div class="w-1 h-4 bg-slate-400 rounded" />
                <h4 class="text-sm font-bold text-slate-600">
                  开发者工具
                </h4>
              </div>
              <button
                class="w-full py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all text-left bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                @click="handleOpenDevTools"
              >
                <div class="flex items-center gap-2">
                  <Terminal :size="14" />
                  <span>打开开发者工具</span>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  在生产环境中打开浏览器 DevTools (F12)
                </p>
              </button>
              <button
                class="w-full py-2.5 px-3 text-xs font-medium rounded-lg border-2 transition-all text-left bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                @click="handleOpenLogDir"
              >
                <div class="flex items-center gap-2">
                  <FolderOpen :size="14" />
                  <span>打开日志目录</span>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">
                  查看前端与后端分离保存的日志文件
                </p>
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3.5">
          <button
            class="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
            @click="$emit('close')"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-xs font-bold bg-indigo-500 text-white rounded-lg shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1.5"
            @click="handleSave"
          >
            <Save :size="14" />
            保存设置
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
