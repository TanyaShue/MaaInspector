<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { openPath, openUrl } from '@tauri-apps/plugin-opener'
import {
  ArchiveRestore, Check, ChevronRight, CircleAlert, Download, ExternalLink, FolderOpen,
  Github, Info, LayoutDashboard, LoaderCircle, RefreshCw, RotateCcw, Save, Settings,
  Terminal, X
} from 'lucide-vue-next'
import { appUpdater, type AvailableUpdate } from '@/services/appUpdater'
import { logApi, systemApi } from '@/services/api'
import { LAYOUT_ALGORITHM_OPTIONS, LAYOUT_DIRECTION_OPTIONS } from '@/utils/flowOptions'
import type { EdgeType } from '@/utils/flowOptions'
import type { LayoutAlgorithm, LayoutDirection, SpacingKey } from '@/utils/flowTypes'

export type PipelineVersion = 'V1' | 'V2'
type SectionId = 'canvas' | 'workspace' | 'storage' | 'developer' | 'about'
type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error'

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

const groups = [
  { id: 'canvas' as const, label: '画布', icon: LayoutDashboard },
  { id: 'workspace' as const, label: '工作区', icon: Settings },
  { id: 'storage' as const, label: '存储与备份', icon: ArchiveRestore },
  { id: 'developer' as const, label: '开发者', icon: Terminal },
  { id: 'about' as const, label: '关于我们', icon: Info }
]

const edgeType = ref<EdgeType>(props.defaultEdgeType)
const spacing = ref<SpacingKey>(props.defaultSpacing)
const layoutAlgorithm = ref<LayoutAlgorithm>(props.defaultLayoutAlgorithm)
const layoutDirection = ref<LayoutDirection>(props.defaultLayoutDirection)
const pipelineVersion = ref<PipelineVersion>(props.defaultPipelineVersion)
const restoreWorkspaceOnStart = ref(props.defaultRestoreWorkspaceOnStart)
const lowMemoryMode = ref(props.defaultLowMemoryMode)
const activeSection = ref<SectionId>('canvas')
const scrollContainer = ref<HTMLElement | null>(null)
const sectionRefs = new Map<SectionId, HTMLElement>()

const currentVersion = ref('')
const updateStatus = ref<UpdateStatus>('idle')
const availableUpdate = ref<AvailableUpdate | null>(null)
const updateError = ref('')
const updateProgress = ref<number | null>(null)
const downloadedBytes = ref(0)
const totalBytes = ref<number | null>(null)

const setSectionRef = (id: SectionId, element: Element | ComponentPublicInstance | null) => {
  if (element instanceof HTMLElement) sectionRefs.set(id, element)
}

const scrollToSection = (id: SectionId) => {
  activeSection.value = id
  sectionRefs.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const handleContentScroll = () => {
  const container = scrollContainer.value
  if (!container) return
  const threshold = container.getBoundingClientRect().top + 80
  let nearest: SectionId = 'canvas'
  for (const group of groups) {
    const section = sectionRefs.get(group.id)
    if (section && section.getBoundingClientRect().top <= threshold) nearest = group.id
  }
  activeSection.value = nearest
}

const resetForm = () => {
  edgeType.value = props.defaultEdgeType
  spacing.value = props.defaultSpacing
  layoutAlgorithm.value = props.defaultLayoutAlgorithm
  layoutDirection.value = props.defaultLayoutDirection
  pipelineVersion.value = props.defaultPipelineVersion
  restoreWorkspaceOnStart.value = props.defaultRestoreWorkspaceOnStart
  lowMemoryMode.value = props.defaultLowMemoryMode
}

watch(() => props.visible, async visible => {
  if (!visible) return
  resetForm()
  activeSection.value = 'canvas'
  updateStatus.value = 'idle'
  availableUpdate.value = null
  updateError.value = ''
  currentVersion.value = await appUpdater.getCurrentVersion()
  await nextTick()
  if (scrollContainer.value) scrollContainer.value.scrollTop = 0
}, { immediate: true })

onBeforeUnmount(() => void appUpdater.dispose())

const handleSave = () => emit('save', {
  edgeType: edgeType.value,
  spacing: spacing.value,
  layoutAlgorithm: layoutAlgorithm.value,
  layoutDirection: layoutDirection.value,
  pipelineVersion: pipelineVersion.value,
  restoreWorkspaceOnStart: restoreWorkspaceOnStart.value,
  lowMemoryMode: lowMemoryMode.value
})

const handleReset = () => {
  edgeType.value = 'smoothstep'
  spacing.value = 'normal'
  layoutAlgorithm.value = 'layered'
  layoutDirection.value = 'TB'
  pipelineVersion.value = 'V1'
  restoreWorkspaceOnStart.value = true
  lowMemoryMode.value = false
}

const handleCheckUpdate = async () => {
  updateStatus.value = 'checking'
  updateError.value = ''
  updateProgress.value = null
  try {
    availableUpdate.value = await appUpdater.check()
    updateStatus.value = availableUpdate.value ? 'available' : 'current'
  } catch (error) {
    updateStatus.value = 'error'
    updateError.value = error instanceof Error ? error.message : String(error)
  }
}

const handleInstallUpdate = async () => {
  updateStatus.value = 'downloading'
  updateError.value = ''
  try {
    await appUpdater.downloadAndInstall(progress => {
      downloadedBytes.value = progress.downloaded
      totalBytes.value = progress.total
      updateProgress.value = progress.percent
    })
    updateStatus.value = 'ready'
  } catch (error) {
    updateStatus.value = 'error'
    updateError.value = error instanceof Error ? error.message : String(error)
  }
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const handleOpenDevTools = async () => {
  try { await invoke('devtools_open') } catch (error) { console.error('Failed to open DevTools:', error) }
}
const handleOpenLogDir = async () => {
  try { await openPath(await logApi.getDir()) } catch (error) { console.error('Failed to open log directory:', error) }
}
const handleOpenBackupDir = async () => {
  try { await openPath(await systemApi.getBackupDir()) } catch (error) { console.error('Failed to open backup directory:', error) }
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" @click.self="$emit('close')">
    <div class="flex h-[min(720px,calc(100vh-2rem))] w-[min(900px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
      <header class="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-white px-5 py-4">
        <div class="flex items-center gap-3">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-indigo-500 text-white shadow-sm shadow-indigo-200"><Settings :size="17" /></span>
          <div><h3 class="text-sm font-bold text-slate-800">应用设置</h3><p class="mt-0.5 text-[10px] text-slate-400">自定义 MaaInspector 的行为与更新</p></div>
        </div>
        <div class="flex items-center gap-2">
          <button class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100" @click="handleReset"><RotateCcw :size="12" />重置默认</button>
          <button class="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" title="关闭" @click="$emit('close')"><X :size="15" /></button>
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav class="w-48 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3">
          <p class="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">设置组</p>
          <button v-for="group in groups" :key="group.id" class="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-all" :class="activeSection === group.id ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'" @click="scrollToSection(group.id)">
            <component :is="group.icon" :size="15" />
            <span class="flex-1">{{ group.label }}</span>
            <ChevronRight v-if="activeSection === group.id" :size="13" />
          </button>
        </nav>

        <main ref="scrollContainer" class="custom-scrollbar min-w-0 flex-1 scroll-smooth overflow-y-auto bg-white px-7 py-2" @scroll.passive="handleContentScroll">
          <section :ref="el => setSectionRef('canvas', el)" class="scroll-mt-2 py-6">
            <h4 class="text-base font-bold text-slate-800">画布</h4><p class="mt-1 text-xs text-slate-400">新建流程图和自动布局的默认行为</p>
            <div class="mt-5 divide-y divide-slate-100 border-y border-slate-100">
              <div class="setting-row"><div><h5>连线类型</h5><p>新建流程图使用的默认连线样式</p></div><div class="option-grid grid-cols-2"><button :class="{ active: edgeType === 'smoothstep' }" @click="edgeType = 'smoothstep'">直角连线</button><button :class="{ active: edgeType === 'default' }" @click="edgeType = 'default'">贝塞尔曲线</button></div></div>
              <div class="setting-row"><div><h5>节点间距</h5><p>自动布局时节点之间的默认间距</p></div><div class="option-grid grid-cols-3"><button v-for="item in [{ value: 'compact', label: '紧凑' }, { value: 'normal', label: '默认' }, { value: 'loose', label: '宽松' }]" :key="item.value" :class="{ active: spacing === item.value }" @click="spacing = item.value as SpacingKey">{{ item.label }}</button></div></div>
              <div class="setting-row"><div><h5>布局算法</h5><p>根据流程规模选择默认排布方式</p></div><div class="option-grid grid-cols-3"><button v-for="option in LAYOUT_ALGORITHM_OPTIONS" :key="option.value" :class="{ active: layoutAlgorithm === option.value }" @click="layoutAlgorithm = option.value">{{ option.label }}</button></div></div>
              <div class="setting-row"><div><h5>布局方向</h5><p>自动布局的主要延伸方向</p></div><div class="option-grid grid-cols-2"><button v-for="option in LAYOUT_DIRECTION_OPTIONS" :key="option.value" :class="{ active: layoutDirection === option.value }" @click="layoutDirection = option.value">{{ option.label }}</button></div></div>
            </div>
          </section>

          <section :ref="el => setSectionRef('workspace', el)" class="scroll-mt-2 py-6">
            <h4 class="text-base font-bold text-slate-800">工作区</h4><p class="mt-1 text-xs text-slate-400">文件格式、启动恢复与标签页性能</p>
            <div class="mt-5 divide-y divide-slate-100 border-y border-slate-100">
              <div class="setting-row"><div><h5>Pipeline 版本</h5><p>保存 Pipeline 文件时使用的格式版本</p></div><div class="option-grid grid-cols-2"><button :class="{ active: pipelineVersion === 'V1' }" @click="pipelineVersion = 'V1'">V1</button><button :class="{ active: pipelineVersion === 'V2' }" @click="pipelineVersion = 'V2'">V2</button></div></div>
              <div class="setting-row"><div><h5>启动时恢复工作区</h5><p>自动加载上次资源，并重连设备与 Agent</p></div><button class="toggle" :class="{ enabled: restoreWorkspaceOnStart }" @click="restoreWorkspaceOnStart = !restoreWorkspaceOnStart"><span /></button></div>
              <div class="setting-row"><div><h5>低消耗模式</h5><p>{{ lowMemoryMode ? '切换标签页时重建编辑器，减少内存占用' : '保留编辑器实例，标签页切换更快速' }}</p></div><button class="toggle" :class="{ enabled: lowMemoryMode }" @click="lowMemoryMode = !lowMemoryMode"><span /></button></div>
            </div>
          </section>

          <section :ref="el => setSectionRef('storage', el)" class="scroll-mt-2 py-6">
            <h4 class="text-base font-bold text-slate-800">存储与备份</h4><p class="mt-1 text-xs text-slate-400">查看 MaaInspector 在本机保存的数据</p>
            <div class="mt-5 divide-y divide-slate-100 border-y border-slate-100">
              <div class="setting-row"><div><h5>数据备份</h5><p>备份按日期保存于软件目录的 backup 文件夹</p></div><button class="action-button" @click="handleOpenBackupDir"><FolderOpen :size="14" />打开备份目录</button></div>
              <div class="setting-row"><div><h5>运行日志</h5><p>查看前端与后端分别保存的日志文件</p></div><button class="action-button" @click="handleOpenLogDir"><FolderOpen :size="14" />打开日志目录</button></div>
            </div>
          </section>

          <section :ref="el => setSectionRef('developer', el)" class="scroll-mt-2 py-6">
            <h4 class="text-base font-bold text-slate-800">开发者</h4><p class="mt-1 text-xs text-slate-400">用于排查界面问题的高级工具</p>
            <div class="mt-5 border-y border-slate-100"><div class="setting-row"><div><h5>开发者工具</h5><p>打开 WebView DevTools 检查界面和网络请求</p></div><button class="action-button" @click="handleOpenDevTools"><Terminal :size="14" />打开 DevTools</button></div></div>
          </section>

          <section :ref="el => setSectionRef('about', el)" class="scroll-mt-2 py-6">
            <h4 class="text-base font-bold text-slate-800">关于我们</h4><p class="mt-1 text-xs text-slate-400">项目信息、版本与软件更新</p>
            <div class="mt-5 divide-y divide-slate-100 border-y border-slate-100">
              <div class="setting-row items-start"><div><h5>MaaInspector</h5><p class="max-w-md leading-5">为 MaaFramework 打造的可视化节点编辑与调试工具。由 TanYaShue 和社区贡献者共同维护，基于 MIT 许可证开源。</p></div><button class="action-button" @click="openUrl('https://github.com/TanyaShue/MaaInspector')"><Github :size="14" />GitHub<ExternalLink :size="11" /></button></div>
              <div class="setting-row items-start">
                <div class="min-w-0 flex-1"><h5>软件更新</h5><p>当前版本 v{{ currentVersion || '—' }}</p>
                  <div v-if="updateStatus === 'available' && availableUpdate" class="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3"><p class="font-semibold text-indigo-700">发现新版本 v{{ availableUpdate.version }}</p><p v-if="availableUpdate.body" class="mt-2 max-h-28 whitespace-pre-wrap overflow-y-auto text-[11px] leading-5 text-slate-600">{{ availableUpdate.body }}</p></div>
                  <div v-if="updateStatus === 'downloading'" class="mt-3"><div class="h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-indigo-500 transition-all" :class="{ 'animate-pulse w-1/2': updateProgress === null }" :style="updateProgress === null ? undefined : { width: `${updateProgress}%` }" /></div><p class="mt-1.5 text-[10px] text-slate-400">正在下载 {{ formatBytes(downloadedBytes) }}<template v-if="totalBytes !== null"> / {{ formatBytes(totalBytes) }}</template></p></div>
                  <p v-if="updateStatus === 'current'" class="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Check :size="13" />已是最新版本</p>
                  <p v-if="updateStatus === 'ready'" class="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Check :size="13" />更新已安装，重启后生效</p>
                  <p v-if="updateStatus === 'error'" class="mt-2 flex items-start gap-1 text-[11px] text-rose-600"><CircleAlert class="mt-0.5 shrink-0" :size="13" />{{ updateError }}</p>
                </div>
                <button v-if="updateStatus === 'available'" class="action-button primary" @click="handleInstallUpdate"><Download :size="14" />下载并安装</button>
                <button v-else-if="updateStatus === 'ready'" class="action-button primary" @click="appUpdater.relaunch()"><RefreshCw :size="14" />立即重启</button>
                <button v-else class="action-button" :disabled="updateStatus === 'checking' || updateStatus === 'downloading'" @click="handleCheckUpdate"><LoaderCircle v-if="updateStatus === 'checking'" class="animate-spin" :size="14" /><RefreshCw v-else :size="14" />{{ updateStatus === 'checking' ? '检查中' : '检查更新' }}</button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer class="flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3.5"><button class="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100" @click="$emit('close')">取消</button><button class="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-600" @click="handleSave"><Save :size="14" />保存设置</button></footer>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgb(203 213 225) transparent; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgb(203 213 225); border-radius: 999px; }
.setting-row { display: flex; min-height: 88px; align-items: center; justify-content: space-between; gap: 2rem; padding: 1.25rem 0; }
.setting-row h5 { font-size: 0.75rem; font-weight: 700; color: rgb(51 65 85); }
.setting-row p { margin-top: 0.3rem; font-size: 0.6875rem; color: rgb(148 163 184); }
.option-grid { display: grid; width: 18rem; gap: 0.375rem; }
.option-grid button { border: 1px solid rgb(226 232 240); border-radius: 0.5rem; background: white; padding: 0.5rem 0.7rem; font-size: 0.6875rem; font-weight: 600; color: rgb(100 116 139); transition: 150ms; }
.option-grid button:hover { border-color: rgb(165 180 252); color: rgb(79 70 229); }
.option-grid button.active { border-color: rgb(99 102 241); background: rgb(99 102 241); color: white; box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }
.toggle { position: relative; height: 1.5rem; width: 2.75rem; flex-shrink: 0; border-radius: 999px; background: rgb(203 213 225); transition: 150ms; }
.toggle span { position: absolute; left: 0.2rem; top: 0.2rem; height: 1.1rem; width: 1.1rem; border-radius: 999px; background: white; box-shadow: 0 1px 3px rgb(15 23 42 / 0.2); transition: 150ms; }
.toggle.enabled { background: rgb(99 102 241); }
.toggle.enabled span { transform: translateX(1.25rem); }
.action-button { display: inline-flex; flex-shrink: 0; align-items: center; gap: 0.4rem; border: 1px solid rgb(226 232 240); border-radius: 0.5rem; background: white; padding: 0.5rem 0.75rem; font-size: 0.6875rem; font-weight: 600; color: rgb(71 85 105); transition: 150ms; }
.action-button:hover:not(:disabled) { border-color: rgb(165 180 252); background: rgb(238 242 255); color: rgb(79 70 229); }
.action-button:disabled { cursor: not-allowed; opacity: 0.55; }
.action-button.primary { border-color: rgb(99 102 241); background: rgb(99 102 241); color: white; }
.action-button.primary:hover { border-color: rgb(79 70 229); background: rgb(79 70 229); color: white; }
@media (max-width: 720px) { nav { width: 9rem; } .setting-row { align-items: flex-start; flex-direction: column; gap: 0.75rem; } .option-grid { width: 100%; } }
</style>
