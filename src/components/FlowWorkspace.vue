<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { FileJson, Loader2, Move, Plus, X } from 'lucide-vue-next'
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

const NodeDebugPanel = defineAsyncComponent(() => import('./Flow/NodeDebugPanel.vue'))
const infoPanelCollapsed = ref(false)

const {
  tabs,
  activeTabId,
  appSettings,
  makeTabTitle,
  infoPanelRef,
  debugPanel,
  activeTab,
  activeEditorRef,
  activeEditorStatus,
  isRestoringWorkspace,
  registerEditor,
  registerActiveEditor,
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
</script>

<template>
  <div class="w-full h-full flex flex-col bg-slate-100 overflow-hidden">
    <div class="shrink-0 border-b border-slate-200 bg-white px-2 py-1.5">
      <div class="flex items-end gap-2">
        <div class="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden">
          <button
            v-for="(tab, index) in tabs.items"
            :key="tab.id"
            type="button"
            class="group h-9 min-w-0 max-w-[220px] px-3 flex items-center gap-2 border border-b-0 text-xs font-medium transition-colors"
            :class="activeTab?.id === tab.id
              ? 'bg-slate-50 border-slate-200 text-slate-900 rounded-t-lg shadow-sm'
              : 'bg-white border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'"
            @click="selectTab(tab.id)"
          >
            <FileJson
              :size="14"
              class="shrink-0"
            />
            <span class="truncate">{{ makeTabTitle(tab, index) }}</span>
            <span
              v-if="tabs.items.length > 1"
              class="ml-auto p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
              title="关闭标签页"
              @click.stop="closeTab(tab.id)"
            >
              <X :size="13" />
            </span>
          </button>
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
            :edge-type="appSettings.edgeType"
            :spacing="appSettings.spacing"
            :layout-algorithm="appSettings.layoutAlgorithm"
            :layout-direction="appSettings.layoutDirection"
            :pipeline-version="appSettings.pipelineVersion"
            :restore-workspace-on-start="appSettings.restoreWorkspaceOnStart"
            @load-nodes="handleLoadNodes"
            @load-images="handleLoadImages"
            @save-nodes="(payload) => activeEditorRef?.handleSaveNodes(payload)"
            @device-connected="handleDeviceConnected"
            @update-canvas-config="handleUpdateCanvasConfig"
            @update-pipeline-version="handleUpdatePipelineVersion"
            @restore-tabs="handleRestoreTabs"
            @clear-tabs="handleClearTabs"
            @open-debug-panel="openDebugPanel"
          />
        </div>
      </div>
    </div>

    <div class="relative flex-1 min-h-0">
      <FlowEditor
        v-if="appSettings.lowMemoryMode && activeTab"
        :key="activeTab.id"
        :ref="(el: any) => registerActiveEditor(el as FlowEditorPort | null)"
        :tab-id="activeTab.id"
        :is-active="true"
        :debug-panel-visible="debugPanel.visible"
        @request-switch-file="handleRequestSwitchFile"
        @open-debug-panel="openDebugPanel"
        @close-debug-panel="closeDebugPanel"
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
          :debug-panel-visible="debugPanel.visible"
          @request-switch-file="handleRequestSwitchFile"
          @open-debug-panel="openDebugPanel"
          @close-debug-panel="closeDebugPanel"
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
            请在右上角控制台加载资源后选择文件
          </div>
        </div>
      </div>

      <div
        v-if="isRestoringWorkspace"
        class="absolute inset-0 z-40 flex items-center justify-center bg-slate-100/90 backdrop-blur-sm pointer-events-auto"
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
