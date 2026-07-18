<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown, FileJson, Folder, FolderOpen, Loader2, Move, Plus, X } from 'lucide-vue-next'
import FlowEditor from './FlowEditor.vue'
import InfoPanel from './Flow/InfoPanel.vue'
import ToolbarIconDropdown from './Flow/Common/ToolbarIconDropdown.vue'
import { useFlowWorkspaceVm } from '@/composables/viewModels/useFlowWorkspaceVm'
import {
  EDGE_TYPE_OPTIONS,
  LAYOUT_ALGORITHM_OPTIONS,
  LAYOUT_DIRECTION_OPTIONS,
  SPACING_TYPE_OPTIONS,
  type EdgeType
} from '@/utils/flowOptions'
import type { LayoutAlgorithm, LayoutDirection, SpacingKey } from '@/utils/flowTypes'
import type { FlowEditorPort } from '@/composables/viewModels/types'
import type { ResourceFileInfo } from '@/services/api'
import { makeFileId } from '@/utils/fileId'
import { getResourceFileName, groupResourceFilesByFolder } from '@/utils/resourceFileGroups'

const loadNodeDebugPanel = () => import('./Flow/NodeDebugPanel.vue')
const NodeDebugPanel = defineAsyncComponent(loadNodeDebugPanel)
const infoPanelCollapsed = ref(false)
const resourceFiles = ref<ResourceFileInfo[]>([])
const openFileMenuTabId = ref('')
const tabStripRef = ref<HTMLElement | null>(null)
const fileMenuPosition = ref({ left: 8, top: 48 })
const fileMenuTab = computed(() => tabs.value.items.find(tab => tab.id === openFileMenuTabId.value) || null)
const selectedResourceSource = ref('')
const resourceSources = computed(() =>
  Array.from(new Set(resourceFiles.value.map(file => file.source).filter(Boolean)))
)
const selectedSourceGroups = computed(() =>
  groupResourceFilesByFolder(resourceFiles.value, selectedResourceSource.value)
)

watch(resourceSources, sources => {
  if (!sources.includes(selectedResourceSource.value)) {
    selectedResourceSource.value = sources[0] || ''
  }
}, { immediate: true })

onMounted(() => {
  const preload = () => { void loadNodeDebugPanel() }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 1500 })
  } else {
    setTimeout(preload, 0)
  }
  document.addEventListener('click', closeFileMenuOnOutsideClick)
})

onBeforeUnmount(() => document.removeEventListener('click', closeFileMenuOnOutsideClick))

const {
  tabs,
  activeTabId,
  appSettings,
  makeTabTitle,
  infoPanelRef,
  debugPanel,
  activeTab,
  resourceLoaded,
  activeEditorRef,
  activeEditorStatus,
  handleEditorStatusChange,
  dirtyTabIds,
  hasDirtyTabs,
  isRestoringWorkspace,
  registerEditor,
  selectTab,
  addTab,
  closeTab,
  handleRequestSwitchFile,
  openDebugPanel,
  closeDebugPanel,
  applyActiveEditorLayout,
  handleLoadNodes,
  handleLoadImages,
  handleUpdateCanvasConfig,
  handleUpdatePipelineVersion,
  handleSaveAllNodes,
  handleRestoreTabs,
  handleClearTabs,
  handleDeviceConnected
} = useFlowWorkspaceVm()

const handleToolbarLayout = () => {
  void applyActiveEditorLayout()
}

const handleToolbarAlgorithmChange = (value: PropertyKey) => {
  handleUpdateCanvasConfig({ layoutAlgorithm: value as LayoutAlgorithm })
}

const handleToolbarDirectionChange = (value: PropertyKey) => {
  handleUpdateCanvasConfig({ layoutDirection: value as LayoutDirection })
}

const handleToolbarSpacingChange = (value: PropertyKey) => {
  handleUpdateCanvasConfig({ spacing: value as SpacingKey })
}

const handleToolbarEdgeTypeChange = (value: PropertyKey) => {
  handleUpdateCanvasConfig({ edgeType: value as EdgeType })
}

function closeFileMenuOnOutsideClick(event: MouseEvent) {
  if (!tabStripRef.value?.contains(event.target as Node)) openFileMenuTabId.value = ''
}

const handleTabClick = (tabId: string, event: MouseEvent) => {
  if (tabId !== activeTabId.value) {
    openFileMenuTabId.value = ''
    void selectTab(tabId)
    return
  }
  const tabElement = (event.currentTarget as HTMLElement).parentElement
  if (tabElement) {
    const rect = tabElement.getBoundingClientRect()
    fileMenuPosition.value = {
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
      top: rect.bottom + 1
    }
  }
  openFileMenuTabId.value = openFileMenuTabId.value === tabId ? '' : tabId
}

const handleTabResourceSelect = async (tabId: string, file: ResourceFileInfo) => {
  const fileId = makeFileId(file.source, file.value)
  const tab = tabs.value.items.find(item => item.id === tabId)
  if (!file.value || tab?.resourceFile === fileId) {
    openFileMenuTabId.value = ''
    return
  }
  if (tabId !== activeTabId.value) await selectTab(tabId)
  openFileMenuTabId.value = ''
  await handleRequestSwitchFile({ filename: file.value, source: file.source })
}

const isFileOpenedElsewhere = (tabId: string, file: ResourceFileInfo) => {
  const fileId = makeFileId(file.source, file.value)
  return tabs.value.items.some(tab => tab.id !== tabId && tab.resourceFile === fileId)
}

const selectResourceSource = (source: string) => {
  selectedResourceSource.value = source
}

const openCreateResourceFile = (source: string) => {
  infoPanelRef.value?.openCreateResourceFile(source)
}
</script>

<template>
  <div class="w-full h-full flex flex-col bg-slate-100 overflow-hidden">
    <div class="shrink-0 border-b border-slate-200 bg-white px-2 py-1.5">
      <div class="flex items-end gap-2">
        <div ref="tabStripRef" class="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden">
          <div
            v-for="(tab, index) in tabs.items"
            :key="tab.id"
            class="group relative flex h-9 min-w-0 max-w-[250px] items-stretch border border-b-0 text-xs font-medium transition-colors"
            :class="activeTab?.id === tab.id
              ? 'bg-slate-50 border-slate-200 text-slate-900 rounded-t-lg shadow-sm'
              : 'bg-white border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 px-3"
              :title="activeTab?.id === tab.id ? '点击切换当前标签的资源文件' : `切换到 ${makeTabTitle(tab, index)}`"
              @click="handleTabClick(tab.id, $event)"
            >
              <FileJson :size="14" class="shrink-0" />
              <span class="truncate">{{ makeTabTitle(tab, index) }}</span>
              <span
                v-if="dirtyTabIds.has(tab.id)"
                class="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                title="此文件有未保存的修改"
              />
              <ChevronDown
                v-if="activeTab?.id === tab.id"
                :size="13"
                class="shrink-0 text-indigo-500 transition-transform"
                :class="openFileMenuTabId === tab.id ? 'rotate-180' : ''"
              />
            </button>
            <button
              v-if="tabs.items.length > 1"
              type="button"
              class="mr-1 self-center rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="关闭标签页"
              @click.stop="closeTab(tab.id)"
            >
              <X :size="13" />
            </button>
          </div>
          <button
            type="button"
            class="h-9 w-9 rounded-t-lg border border-b-0 border-transparent bg-white text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
            title="新建流程标签页"
            @click="addTab"
          >
            <Plus
              :size="16"
              class="mx-auto"
            />
          </button>
        </div>

        <div class="ml-auto flex shrink-0 items-center gap-1 pb-0.5">
          <button
            type="button"
            class="h-7 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            title="自动布局"
            :disabled="!activeEditorRef || activeEditorStatus.nodeCount === 0"
            @click="handleToolbarLayout"
          >
            <Move
              :size="14"
              class="mx-auto"
            />
          </button>
          <ToolbarIconDropdown
            title="布局算法"
            :model-value="appSettings.layoutAlgorithm"
            :options="LAYOUT_ALGORITHM_OPTIONS"
            :disabled="!activeEditorRef"
            @update:model-value="handleToolbarAlgorithmChange"
          />
          <ToolbarIconDropdown
            title="布局方向"
            :model-value="appSettings.layoutDirection"
            :options="LAYOUT_DIRECTION_OPTIONS"
            :disabled="!activeEditorRef"
            @update:model-value="handleToolbarDirectionChange"
          />
          <ToolbarIconDropdown
            title="布局间隔"
            :model-value="appSettings.spacing"
            :options="SPACING_TYPE_OPTIONS"
            :disabled="!activeEditorRef"
            @update:model-value="handleToolbarSpacingChange"
          />
          <ToolbarIconDropdown
            title="连线类型"
            :model-value="appSettings.edgeType"
            :options="EDGE_TYPE_OPTIONS"
            :disabled="!activeEditorRef"
            @update:model-value="handleToolbarEdgeTypeChange"
          />
          <div class="mx-1 h-5 w-px bg-slate-200" />
          <InfoPanel
            ref="infoPanelRef"
            v-model:collapsed="infoPanelCollapsed"
            :tabs="tabs.items"
            :current-filename="activeTab?.title || ''"
            :selected-resource-file="activeTab?.resourceFile || ''"
            :node-count="activeEditorStatus.nodeCount"
            :edge-count="activeEditorStatus.edgeCount"
            :is-dirty="activeEditorStatus.isDirty"
            :has-dirty-tabs="hasDirtyTabs"
            :dirty-tab-count="dirtyTabIds.size"
            :edge-type="appSettings.edgeType"
            :spacing="appSettings.spacing"
            :layout-algorithm="appSettings.layoutAlgorithm"
            :layout-direction="appSettings.layoutDirection"
            :pipeline-version="appSettings.pipelineVersion"
            :restore-workspace-on-start="appSettings.restoreWorkspaceOnStart"
            @load-nodes="handleLoadNodes"
            @load-images="handleLoadImages"
            @save-nodes="(payload) => activeEditorRef?.handleSaveNodes(payload)"
            @save-all-nodes="handleSaveAllNodes"
            @device-connected="handleDeviceConnected"
            @update-canvas-config="handleUpdateCanvasConfig"
            @update-pipeline-version="handleUpdatePipelineVersion"
            @restore-tabs="handleRestoreTabs"
            @clear-tabs="handleClearTabs"
            @open-debug-panel="openDebugPanel"
            @resource-files-change="resourceFiles = $event"
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="fileMenuTab"
        class="fixed z-[100] w-72 overflow-hidden rounded-b-xl rounded-tr-xl border border-slate-200 bg-white shadow-2xl"
        :style="{ left: `${fileMenuPosition.left}px`, top: `${fileMenuPosition.top}px` }"
        @click.stop
      >
        <div class="border-b border-slate-100 bg-slate-50 px-3 py-2">
          <div class="text-xs font-bold text-slate-700">切换此标签的资源文件</div>
          <div class="mt-0.5 text-[10px] text-slate-400">选择后将在当前标签中直接加载</div>
        </div>
        <div v-if="resourceFiles.length" class="max-h-72 overflow-y-auto p-1.5">
          <button
            v-for="file in resourceFiles"
            :key="makeFileId(file.source, file.value)"
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors"
            :class="isFileOpenedElsewhere(fileMenuTab.id, file)
              ? 'cursor-not-allowed text-slate-300'
              : fileMenuTab.resourceFile === makeFileId(file.source, file.value)
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
            :disabled="isFileOpenedElsewhere(fileMenuTab.id, file)"
            @click="handleTabResourceSelect(fileMenuTab.id, file)"
          >
            <FileJson :size="14" class="shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-semibold">{{ file.label || file.value }}</span>
              <span class="block truncate text-[10px] text-slate-400">{{ file.source }}</span>
            </span>
            <Check v-if="fileMenuTab.resourceFile === makeFileId(file.source, file.value)" :size="14" class="shrink-0 text-indigo-500" />
          </button>
        </div>
        <div v-else class="px-4 py-6 text-center text-xs text-slate-400">
          请先从右侧“资源”按钮加载资源
        </div>
      </div>
    </Teleport>

    <div class="relative flex-1 min-h-0">
      <FlowEditor
        v-if="appSettings.lowMemoryMode && activeTab"
        :key="activeTab.id"
        :ref="(el: any) => registerEditor(activeTab.id, el as FlowEditorPort | null)"
        :tab-id="activeTab.id"
        :is-active="true"
        :low-memory-mode="appSettings.lowMemoryMode"
        :debug-panel-visible="debugPanel.visible"
        @request-switch-file="handleRequestSwitchFile"
        @open-debug-panel="openDebugPanel"
        @close-debug-panel="closeDebugPanel"
        @status-change="status => handleEditorStatusChange(activeTab.id, status)"
      />

      <div
        v-else-if="activeTab"
        class="absolute inset-0"
      >
        <FlowEditor
          v-for="tab in tabs.items"
          v-show="tab.id === activeTabId"
          :key="tab.id"
          :ref="(el: any) => registerEditor(tab.id, el as FlowEditorPort | null)"
          :tab-id="tab.id"
          :is-active="tab.id === activeTabId"
          :low-memory-mode="appSettings.lowMemoryMode"
          :debug-panel-visible="debugPanel.visible"
          @request-switch-file="handleRequestSwitchFile"
          @open-debug-panel="openDebugPanel"
          @close-debug-panel="closeDebugPanel"
          @status-change="status => handleEditorStatusChange(tab.id, status)"
        />
      </div>

      <div
        v-else
        class="absolute inset-0 flex items-center justify-center bg-slate-100"
      >
        <div class="text-center text-slate-500">
          <FileJson
            :size="40"
            class="mx-auto mb-3 text-slate-300"
          />
          <div class="text-sm font-semibold text-slate-600">
            未打开标签页
          </div>
          <div class="mt-1 text-xs">
            请从右上角“资源”按钮加载资源后选择文件
          </div>
        </div>
      </div>

      <div
        v-if="activeTab && !activeTab.resourceFile && resourceLoaded"
        class="absolute inset-0 z-20 flex items-center justify-center bg-slate-100/95 p-6"
      >
        <div class="flex h-[min(38rem,calc(100%-3rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div class="rounded-xl bg-indigo-50 p-2.5 text-indigo-500">
              <FolderOpen :size="22" />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-slate-800">为当前标签选择资源文件</h3>
              <p class="mt-0.5 text-xs text-slate-500">选择后会直接在此标签中加载</p>
            </div>
          </div>

          <div v-if="resourceSources.length" class="flex min-h-0 flex-1">
            <aside class="w-64 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/70 p-2.5">
              <div class="mb-2 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Resource Path
              </div>
              <button
                v-for="source in resourceSources"
                :key="source"
                type="button"
                class="mb-1 flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
                :class="selectedResourceSource === source
                  ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white hover:text-slate-800'"
                :title="source"
                @click="selectResourceSource(source)"
              >
                <Folder :size="15" class="mt-0.5 shrink-0" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-semibold">
                    {{ source.replace(/\\/g, '/').split('/').filter(Boolean).pop() || source }}
                  </span>
                  <span class="mt-0.5 block break-all text-[10px] leading-4 text-slate-400">{{ source }}</span>
                </span>
              </button>
            </aside>

            <section class="flex min-w-0 flex-1 flex-col">
              <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-700">资源文件</div>
                  <div class="mt-0.5 truncate text-[10px] text-slate-400">{{ selectedResourceSource }}</div>
                </div>
                <button
                  type="button"
                  class="ml-3 flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-600"
                  @click="openCreateResourceFile(selectedResourceSource)"
                >
                  <Plus :size="14" />
                  新建
                </button>
              </div>

              <div v-if="selectedSourceGroups.length" class="min-h-0 flex-1 overflow-y-auto p-3">
                <section v-for="group in selectedSourceGroups" :key="group.folder" class="mb-4 last:mb-0">
                  <div class="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-400">
                    <Folder :size="13" />
                    {{ group.folder }}
                  </div>
                  <div class="grid grid-cols-1 gap-1 xl:grid-cols-2">
                    <button
                      v-for="file in group.files"
                      :key="makeFileId(file.source, file.value)"
                      type="button"
                      class="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors"
                      :class="isFileOpenedElsewhere(activeTab.id, file)
                        ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                        : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'"
                      :disabled="isFileOpenedElsewhere(activeTab.id, file)"
                      @click="handleTabResourceSelect(activeTab.id, file)"
                    >
                      <FileJson :size="16" class="shrink-0" />
                      <span class="min-w-0 flex-1 truncate text-xs font-semibold">{{ getResourceFileName(file) }}</span>
                      <span v-if="isFileOpenedElsewhere(activeTab.id, file)" class="shrink-0 text-[10px] text-slate-400">
                        已打开
                      </span>
                    </button>
                  </div>
                </section>
              </div>
              <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                <FileJson :size="32" class="mb-3 text-slate-300" />
                <div class="text-sm font-semibold text-slate-600">此路径下还没有资源文件</div>
                <div class="mt-1 text-xs text-slate-400">点击右上角“新建”创建空白资源文件</div>
              </div>
            </section>
          </div>

          <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
            <FileJson :size="32" class="mx-auto mb-3 text-slate-300" />
            <div class="text-sm font-semibold text-slate-600">当前资源配置没有可用路径</div>
            <div class="mt-1 text-xs text-slate-400">请先在右上角“资源”设置中添加 Resource Path</div>
          </div>
        </div>
      </div>

      <div
        v-if="isRestoringWorkspace"
        class="absolute inset-0 z-40 flex items-center justify-center bg-slate-100/95 pointer-events-auto"
      >
        <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg">
          <Loader2 class="h-5 w-5 animate-spin text-indigo-500" />
          <div>
            <div class="text-sm font-semibold text-slate-700">
              正在恢复工作区...
            </div>
            <div class="mt-0.5 text-xs text-slate-500">
              标签页数据加载完成后将显示画布
            </div>
          </div>
        </div>
      </div>

      <NodeDebugPanel
        :visible="debugPanel.visible"
        :initial-node-id="debugPanel.nodeId"
        @close="closeDebugPanel"
        @locate-node="(nodeId) => activeEditorRef?.handleLocateNode(nodeId)"
        @debug-node="(nodeId) => activeEditorRef?.handleDebugNodeFromPanel(nodeId)"
        @update-node-status="(payload) => activeEditorRef?.handleUpdateNodeStatus(payload)"
      />
    </div>
  </div>
</template>
