<script setup lang="ts">
import {
  Bot, Loader2, Save, Bell, Settings as SettingsIcon, Bug, Database, Monitor,
  ChevronDown
} from 'lucide-vue-next'
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import type { FlowBusinessData, TemplateImage } from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import type { SpacingKey, LayoutAlgorithm, LayoutDirection } from '@/utils/flowTypes'
import type { TabResourceInfo } from '@/utils/flowWorkspaceTypes'
import { useInfoPanelVm } from '@/composables/viewModels/useInfoPanelVm'
import ResourceSettingsModal from './Modals/ResourceSettingsModal.vue'
import CreateResourceModal from './Modals/CreateResourceModal.vue'
import AppSettingsModal from './Modals/AppSettingsModal.vue'
import DeviceManager from './InfoPanel/DeviceManager.vue'
import ResourceManager from './InfoPanel/ResourceManager.vue'
import AgentManager from './InfoPanel/AgentManager.vue'
import { useAnnouncementState } from '@/features/changelog/useAnnouncementState'

const AnnouncementModal = defineAsyncComponent(
  () => import('./Modals/AnnouncementModal.vue')
)
const {
  visible: showAnnouncement,
  hasUnread: hasUnreadAnnouncement,
  open: openAnnouncement,
  close: handleAnnouncementClose
} = useAnnouncementState(__APP_VERSION__)

const props = defineProps<{
  tabs?: FlowTab[]
  nodeCount?: number
  edgeCount?: number
  isDirty?: boolean
  hasDirtyTabs?: boolean
  dirtyTabCount?: number
  currentFilename?: string
  selectedResourceFile?: string
  zoom?: number
  edgeType?: EdgeType
  spacing?: SpacingKey
  layoutAlgorithm?: LayoutAlgorithm
  layoutDirection?: LayoutDirection
  pipelineVersion?: 'V1' | 'V2'
  lowMemoryMode?: boolean
  restoreWorkspaceOnStart?: boolean
  collapsed?: boolean
}>()

interface FlowTab {
  id: string
  title: string
  resourceFile: string
}

const emit = defineEmits<{
  'load-nodes': [payload: { filename: string; source: string; nodes: Record<string, FlowBusinessData>; fileVersion?: 'V1' | 'V2' }]
  'load-images': [payload: Record<string, TemplateImage[]>, basePath?: string]
  'save-nodes': [payload: { source: string; filename: string }]
  'save-all-nodes': []
  'device-connected': [status: boolean]
  'update:selected-resource-file': [value: string]
  'update-canvas-config': [payload: { edgeType?: EdgeType; spacing?: SpacingKey; layoutAlgorithm?: LayoutAlgorithm; layoutDirection?: LayoutDirection }]
  'update-pipeline-version': [payload: 'V1' | 'V2']
  'update-low-memory': [payload: boolean]
  'restore-tabs': [tabs: TabResourceInfo[]]
  'clear-tabs': []
  'open-debug-panel': []
  'open-app-settings': []
  'update:collapsed': [value: boolean]
  'resource-files-change': [files: import('@/services/api').ResourceFileInfo[]]
}>()

const {
  appConfig,
  systemState,
  showResourceSettings,
  showCreateFileModal,
  createFileInitialPath,
  showAppSettings,
  resourceManagerRef,
  deviceManagerRef,
  agentManagerRef,
  resourceStatus,
  deviceStatus,
  agentStatus,
  openedFileIds,
  editableProfiles,
  handleResourceStatus,
  handleDeviceStatus,
  handleAgentStatus,
  handleSaveNodes,
  executeFileSwitch,
  triggerLoadFromCacheWrapper,
  handleFileSelected,
  handleDeviceConnected,
  handleConfigChanged,
  handleCreateFile,
  openCreateResourceFile,
  saveResourceSettings,
  handleAppSettingsSave,
} = useInfoPanelVm(props, emit)

type QuickPanel = 'device' | 'resource' | 'agent'
const rootRef = ref<HTMLElement | null>(null)
const openPanel = ref<QuickPanel | null>(null)

const togglePanel = (panel: QuickPanel) => {
  openPanel.value = openPanel.value === panel ? null : panel
}

const openAppSettings = () => {
  openPanel.value = null
  showResourceSettings.value = false
  showCreateFileModal.value = false
  showAnnouncement.value = false
  emit('open-app-settings')
  showAppSettings.value = true
}

const closeOnOutsideClick = (event: MouseEvent) => {
  if (!rootRef.value?.contains(event.target as Node)) openPanel.value = null
}

onMounted(() => document.addEventListener('click', closeOnOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', closeOnOutsideClick))

const handleResourceStatusWithFiles = (snapshot: Parameters<typeof handleResourceStatus>[0]) => {
  handleResourceStatus(snapshot)
  emit('resource-files-change', snapshot.availableFiles ?? resourceStatus.value.availableFiles)
}

const statusLabel = (status: string, connectedLabel: string) => {
  if (status === 'connected') return connectedLabel
  if (status === 'connecting' || status === 'disconnecting') return '处理中'
  if (status === 'failed') return '异常'
  return '未连接'
}

defineExpose({
  executeFileSwitch,
  handleSaveNodes,
  triggerLoadFromCache: triggerLoadFromCacheWrapper,
  openCreateResourceFile
})
</script>

<template>
  <div ref="rootRef" class="relative flex shrink-0 items-center font-sans select-none pointer-events-auto z-50">
    <div class="flex shrink-0 items-center gap-1">
      <div class="relative">
        <button
          type="button"
          class="status-trigger"
          :class="[deviceStatus.status === 'connected' ? 'status-trigger-connected' : '', openPanel === 'device' ? 'ring-2 ring-indigo-100 border-indigo-300' : '']"
          :title="deviceStatus.message"
          @click="togglePanel('device')"
        >
          <Monitor :size="14" />
          <span>设备</span>
          <span class="status-text" :class="deviceStatus.status === 'connected' ? 'text-emerald-600' : ''">
            {{ statusLabel(deviceStatus.status, '已连接') }}
          </span>
          <ChevronDown :size="12" :class="openPanel === 'device' ? 'rotate-180' : ''" />
        </button>

        <div v-show="openPanel === 'device'" class="quick-panel left-0">
          <div class="quick-panel-body">
            <DeviceManager
              ref="deviceManagerRef"
              :active="openPanel === 'device'"
              :is-connected="appConfig.system.status === 'connected'"
              :snapshot="deviceStatus"
              @device-connected="handleDeviceConnected"
              @status-change="handleDeviceStatus"
            />
          </div>
        </div>
      </div>

      <div class="relative">
        <button
          type="button"
          class="status-trigger"
          :class="{
            'status-trigger-connected': resourceStatus.status === 'connected',
            'ring-2 ring-emerald-100 !border-emerald-300': openPanel === 'resource'
          }"
          :title="resourceStatus.message"
          @click="togglePanel('resource')"
        >
          <Database :size="14" />
          <span>资源</span>
          <span class="status-text" :class="resourceStatus.status === 'connected' ? 'text-emerald-600' : ''">
            {{ statusLabel(resourceStatus.status, '已加载') }}
          </span>
          <ChevronDown :size="12" :class="openPanel === 'resource' ? 'rotate-180' : ''" />
        </button>

        <div v-show="openPanel === 'resource'" class="quick-panel right-0">
          <div class="quick-panel-body">
            <ResourceManager
              ref="resourceManagerRef"
              :profiles="editableProfiles"
              :profile-index="appConfig.resource.profileIndex"
              :selected-file="appConfig.resource.selectedFileId"
              :opened-file-ids="openedFileIds"
              :restore-workspace-on-start="props.restoreWorkspaceOnStart"
              :initial-status="resourceStatus.status === 'disconnecting' ? 'disconnected' : resourceStatus.status"
              :initial-message="resourceStatus.message"
              :initial-files="resourceStatus.availableFiles"
              @file-selected="handleFileSelected"
              @config-changed="handleConfigChanged"
              @update:profile-index="(v) => appConfig.switchResourceProfile(v)"
              @update:selected-file="(v) => appConfig.selectResourceFile(v)"
              @open-settings="showResourceSettings = true"
              @restore-tabs="(tabs) => emit('restore-tabs', tabs)"
              @clear-tabs="emit('clear-tabs')"
              @status-change="handleResourceStatusWithFiles"
            />
          </div>
        </div>
      </div>

      <div class="relative">
        <button
          type="button"
          class="status-trigger"
          :class="[agentStatus.status === 'connected' ? 'status-trigger-connected' : '', openPanel === 'agent' ? 'ring-2 ring-emerald-100 border-emerald-300' : '']"
          :title="agentStatus.message"
          @click="togglePanel('agent')"
        >
          <Bot :size="14" />
          <span>Agent</span>
          <span class="status-text" :class="agentStatus.status === 'connected' ? 'text-emerald-600' : ''">
            {{ statusLabel(agentStatus.status, '已连接') }}
          </span>
          <ChevronDown :size="12" :class="openPanel === 'agent' ? 'rotate-180' : ''" />
        </button>

        <div v-show="openPanel === 'agent'" class="quick-panel right-0">
          <div class="quick-panel-body"><AgentManager ref="agentManagerRef" @status-change="handleAgentStatus" /></div>
        </div>
      </div>

        <div class="group/save relative">
          <button
            :disabled="systemState.isSaving.value || !props.isDirty"
            class="flex h-7 w-8 items-center justify-center rounded-lg border shadow-sm transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300 enabled:border-amber-200 enabled:bg-amber-50 enabled:text-amber-600 enabled:hover:border-amber-300 enabled:hover:bg-amber-100"
            :title="props.isDirty ? '保存当前标签的修改' : '当前标签没有可保存的修改'"
            @click="handleSaveNodes"
          >
            <component
              :is="systemState.isSaving.value ? Loader2 : Save"
              :size="12"
              :class="{'animate-spin': systemState.isSaving.value}"
            />
            <span
              v-if="props.hasDirtyTabs"
              class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
              title="存在未保存的标签"
            />
          </button>
          <div
            v-if="props.hasDirtyTabs"
            class="invisible absolute right-0 top-full z-[90] pt-1 opacity-0 transition-all group-hover/save:visible group-hover/save:opacity-100"
          >
            <button
              type="button"
              class="flex w-36 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600 shadow-xl hover:bg-amber-50 hover:text-amber-700"
              @click="emit('save-all-nodes')"
            >
              <Save :size="13" />
              保存全部修改
              <span class="ml-auto text-[10px] text-slate-400">{{ props.dirtyTabCount || 0 }}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          title="应用设置"
          @click="openAppSettings"
        >
          <SettingsIcon :size="14" />
        </button>

        <button
          type="button"
          class="relative flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
          title="更新公告"
          @click="openAnnouncement"
        >
          <Bell
            :size="14"
            :class="hasUnreadAnnouncement ? 'text-amber-500' : ''"
          />
          <span
            v-if="hasUnreadAnnouncement"
            class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
          />
        </button>

        <button
          type="button"
          class="flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
          title="打开调试模块"
          @click="emit('open-debug-panel')"
        >
          <Bug :size="14" />
        </button>
    </div>

    <ResourceSettingsModal
      :visible="showResourceSettings"
      :profiles="editableProfiles"
      :current-index="appConfig.resource.profileIndex"
      @close="showResourceSettings = false"
      @save="saveResourceSettings"
    />
    <CreateResourceModal
      :visible="showCreateFileModal"
      :paths="appConfig.currentProfile.paths ?? []"
      :initial-path="createFileInitialPath"
      @close="showCreateFileModal = false"
      @create="handleCreateFile"
    />
    <AppSettingsModal
      :visible="showAppSettings"
      :default-edge-type="props.edgeType"
      :default-spacing="props.spacing"
      :default-layout-algorithm="props.layoutAlgorithm"
      :default-layout-direction="props.layoutDirection"
      :default-pipeline-version="appConfig.canvas.pipelineVersion"
      :default-restore-workspace-on-start="props.restoreWorkspaceOnStart"
      :default-low-memory-mode="props.lowMemoryMode"
      :default-node-name-prefix-enabled="appConfig.canvas.nodeNamePrefixEnabled"
      :default-node-name-prefix-mode="appConfig.canvas.nodeNamePrefixMode"
      :default-node-name-custom-prefix="appConfig.canvas.nodeNameCustomPrefix"
      :default-log-dir="appConfig.storage.log_dir"
      :default-config-dir="appConfig.storage.config_dir"
      @close="showAppSettings = false"
      @save="handleAppSettingsSave"
    />
    <AnnouncementModal
      v-if="showAnnouncement"
      @close="handleAnnouncementClose"
    />
  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.input-base {
  @apply w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50;
}

.btn-primary {
  @apply flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-icon {
  @apply p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.status-trigger {
  @apply relative flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700;
}

.status-trigger-connected {
  @apply border-emerald-200 bg-emerald-50 text-emerald-700;
}

.status-text {
  @apply border-l border-slate-200 pl-1.5 text-[10px] font-bold text-slate-400;
}

.quick-panel {
  @apply absolute top-[calc(100%+0.5rem)] z-[70] flex max-h-[calc(100vh-5rem)] w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl;
}

.quick-panel-body {
  @apply overflow-y-auto p-3;
}
</style>
