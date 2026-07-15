<script setup lang="ts">
import {
  Bot, Settings, RefreshCw, Loader2,
  Minimize2, Maximize2,
  Save, Bell, Settings as SettingsIcon, Bug, Database, Monitor
} from 'lucide-vue-next'
import { computed } from 'vue'
import type { FlowBusinessData, TemplateImage } from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import type { SpacingKey, LayoutAlgorithm, LayoutDirection } from '@/utils/flowTypes'
import type { TabResourceInfo } from '@/utils/flowWorkspaceTypes'
import { useInfoPanelVm } from '@/composables/viewModels/useInfoPanelVm'
import ResourceSettingsModal from './Modals/ResourceSettingsModal.vue'
import CreateResourceModal from './Modals/CreateResourceModal.vue'
import AppSettingsModal from './Modals/AppSettingsModal.vue'
import AnnouncementModal from './Modals/AnnouncementModal.vue'
import DeviceManager from './InfoPanel/DeviceManager.vue'
import ResourceManager from './InfoPanel/ResourceManager.vue'
import AgentManager from './InfoPanel/AgentManager.vue'
import StatusIndicator from './Common/StatusIndicator.vue'

const props = defineProps<{
  tabs?: FlowTab[]
  nodeCount?: number
  edgeCount?: number
  isDirty?: boolean
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
  'device-connected': [status: boolean]
  'update:selected-resource-file': [value: string]
  'update-canvas-config': [payload: { edgeType?: EdgeType; spacing?: SpacingKey; layoutAlgorithm?: LayoutAlgorithm; layoutDirection?: LayoutDirection }]
  'update-pipeline-version': [payload: 'V1' | 'V2']
  'update-low-memory': [payload: boolean]
  'restore-tabs': [tabs: TabResourceInfo[]]
  'clear-tabs': []
  'open-debug-panel': []
  'update:collapsed': [value: boolean]
}>()

const {
  appConfig,
  systemState,
  isCollapsed: internalCollapsed,
  showResourceSettings,
  showCreateFileModal,
  showAppSettings,
  showAnnouncement,
  hasUnreadAnnouncement,
  resourceManagerRef,
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
  handleFetchSystemState,
  saveResourceSettings,
  handleAppSettingsSave,
  handleAnnouncementClose
} = useInfoPanelVm(props, emit)

const panelCollapsed = computed({
  get: () => props.collapsed ?? internalCollapsed.value,
  set: (value: boolean) => {
    internalCollapsed.value = value
    emit('update:collapsed', value)
  }
})

defineExpose({ executeFileSwitch, handleSaveNodes, triggerLoadFromCache: triggerLoadFromCacheWrapper })
</script>

<template>
  <div class="relative flex shrink-0 items-center font-sans select-none pointer-events-auto z-50">
    <Transition
      name="fade-scale"
      mode="out-in"
    >
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="relative flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          :class="deviceStatus.status === 'connected' ? 'text-emerald-600' : ''"
          :title="deviceStatus.message"
          @click="panelCollapsed = false"
        >
          <Monitor :size="14" />
          <StatusIndicator
            :status="deviceStatus.status"
            :size="8"
            class="absolute -right-0.5 -top-0.5 rounded-full bg-white"
          />
        </button>

        <button
          type="button"
          class="relative flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          :class="{
            'border-amber-300 text-amber-600': props.isDirty,
            'text-emerald-600': resourceStatus.status === 'connected' && !props.isDirty
          }"
          :title="props.isDirty ? '文件已修改' : resourceStatus.message"
          @click="panelCollapsed = false"
        >
          <Database :size="14" />
          <StatusIndicator
            :status="resourceStatus.status"
            :size="8"
            class="absolute -right-0.5 -top-0.5 rounded-full bg-white"
          />
          <span
            v-if="props.isDirty"
            class="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
          />
        </button>

        <button
          type="button"
          class="relative flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          :class="agentStatus.status === 'connected' ? 'text-violet-600' : ''"
          :title="agentStatus.message"
          @click="panelCollapsed = false"
        >
          <Bot :size="14" />
          <StatusIndicator
            :status="agentStatus.status"
            :size="8"
            class="absolute -right-0.5 -top-0.5 rounded-full bg-white"
          />
        </button>

        <button
          v-if="props.isDirty"
          :disabled="systemState.isSaving.value"
          class="flex h-7 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          title="保存更改"
          @click="handleSaveNodes"
        >
          <component
            :is="systemState.isSaving.value ? Loader2 : Save"
            :size="12"
            :class="{'animate-spin': systemState.isSaving.value}"
          />
        </button>

        <button
          type="button"
          class="flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          :title="panelCollapsed ? '展开控制台' : '收起控制台'"
          @click="panelCollapsed = !panelCollapsed"
        >
          <component
            :is="panelCollapsed ? Maximize2 : Minimize2"
            :size="14"
          />
        </button>

        <button
          type="button"
          class="flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
          title="应用设置"
          @click="showAppSettings = true"
        >
          <SettingsIcon :size="14" />
        </button>

        <button
          type="button"
          class="relative flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
          title="更新公告"
          @click="showAnnouncement = true"
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
      </div>
    </Transition>

    <div
      v-if="!panelCollapsed"
      class="fixed right-3 top-14 z-50 w-80 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[90vh] origin-top-right transition-all"
    >
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div class="flex items-center gap-2">
            <Settings class="w-4 h-4 text-slate-500" />
            <span class="font-bold text-slate-700 text-sm">系统控制台</span>
            <div
              class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ml-1"
              :class="{'bg-emerald-50 border-emerald-100 text-emerald-600': appConfig.system.status === 'connected', 'bg-red-50 border-red-100 text-red-500': appConfig.system.status === 'error', 'bg-blue-50 border-blue-100 text-blue-500': appConfig.system.status === 'loading', 'bg-slate-100 border-slate-200 text-slate-400': appConfig.system.status === 'disconnected'}"
            >
              <div
                class="w-1.5 h-1.5 rounded-full"
                :class="{'bg-emerald-500': appConfig.system.status === 'connected', 'bg-red-500': appConfig.system.status === 'error', 'bg-blue-500': appConfig.system.status === 'loading', 'bg-slate-400': appConfig.system.status === 'disconnected'}"
              />
              <span class="font-bold">{{
                appConfig.system.status === 'connected' ? 'ON' : (appConfig.system.status === 'error' ? 'ERR' : (appConfig.system.status === 'loading' ? '...' : 'OFF'))
              }}</span>
            </div>
            <button
              class="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-500 transition-colors"
              @click="handleFetchSystemState"
            >
              <RefreshCw
                :size="12"
                :class="{'animate-spin': appConfig.system.status === 'loading'}"
              />
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-500 transition-colors"
              title="应用设置"
              @click="showAppSettings = true"
            >
              <SettingsIcon :size="14" />
            </button>
            <button
              v-if="hasUnreadAnnouncement"
              class="p-1 rounded hover:bg-slate-200 text-amber-500 hover:text-amber-600 transition-colors relative"
              title="更新公告"
              @click="showAnnouncement = true"
            >
              <Bell :size="14" />
              <span class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            </button>
            <button
              v-else
              class="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-amber-500 transition-colors"
              title="更新公告"
              @click="showAnnouncement = true"
            >
              <Bell :size="14" />
            </button>
            <button
              class="p-1 rounded-md text-slate-400 hover:bg-slate-200"
              @click="panelCollapsed = true"
            >
              <Minimize2 :size="16" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <DeviceManager
            :is-connected="appConfig.system.status === 'connected'"
            :snapshot="deviceStatus"
            @device-connected="handleDeviceConnected"
            @status-change="handleDeviceStatus"
          />

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
            @open-create-file="showCreateFileModal = true"
            @restore-tabs="(tabs) => emit('restore-tabs', tabs)"
            @clear-tabs="emit('clear-tabs')"
            @status-change="handleResourceStatus"
          />

          <AgentManager @status-change="handleAgentStatus" />

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Bug
                  :size="14"
                  class="text-amber-500"
                />
                调试模块
              </div>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
              <button
                class="w-full btn-primary bg-amber-500 shadow-amber-100"
                @click="emit('open-debug-panel')"
              >
                <Bug :size="14" />
                打开调试模块
              </button>
            </div>
          </section>
        </div>

        <div
          class="shrink-0 px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center"
        >
          <div class="flex gap-2 items-center">
            <span>{{ props.nodeCount }} Nodes</span>
            <span>{{ props.edgeCount }} Edges</span>
            <span
              v-if="props.isDirty"
              class="flex items-center gap-1 text-amber-600 font-medium"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              已修改
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="props.isDirty"
              :disabled="systemState.isSaving.value"
              class="flex items-center gap-1 px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-[10px] font-bold transition-colors disabled:opacity-50"
              @click="handleSaveNodes"
            >
              <component
                :is="systemState.isSaving.value ? Loader2 : Save"
                :size="10"
                :class="{'animate-spin': systemState.isSaving.value}"
              />
              {{ systemState.isSaving.value ? '保存中...' : '保存' }}
            </button>
            <span class="font-mono font-bold text-slate-300">{{ Math.round((props.zoom || 1) * 100) }}%</span>
          </div>
        </div>
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
      :default-low-memory-mode="props.lowMemoryMode"
      @close="showAppSettings = false"
      @save="handleAppSettingsSave"
    />
    <AnnouncementModal
      :visible="showAnnouncement"
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
</style>
