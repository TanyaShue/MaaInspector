<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { FileJson, GitBranch, Info, MessageSquare, Play, Settings, X, Zap } from 'lucide-vue-next'
import DeviceScreen from './DeviceScreen.vue'
import BasicPropsTab from './NodeDetailsPanels/BasicPropsTab.vue'
import FlowTab from './NodeDetailsPanels/FlowTab.vue'
import CommonTab from './NodeDetailsPanels/CommonTab.vue'
import FocusTab from './NodeDetailsPanels/FocusTab.vue'
import RecognitionTab from './NodeDetailsPanels/RecognitionTab.vue'
import ActionTab from './NodeDetailsPanels/ActionTab.vue'
import JsonPreviewTab from './NodeDetailsPanels/JsonPreviewTab.vue'
import ConfiguredFieldsPanel from './NodeDetailsPanels/ConfiguredFieldsPanel.vue'
import { useNodeForm, type UseNodeFormEmit } from '@/composables/useNodeForm'
import { useNodeDetailsUiConfig } from '@/composables/useNodeDetailsUiConfig'
import { recognitionTypes, actionTypes } from '@/utils/node-config'
import { useDeviceScreenPicker, type PickerPayload } from '@/composables/useDeviceScreenPicker'
import type { FlowBusinessData, FlowNodeMeta } from '@/utils/flowTypes'
import { removePreviousNodeTypeProperties } from '@/utils/nodeTypeProperties'
import { getNodeLayout, removeConfiguredNodeTypeProperties } from '@/utils/nodeDetailsUi'

const props = defineProps<{
  visible: boolean
  nodeId?: string
  nodeData?: FlowNodeMeta
  nodeType?: string
  availableTypes?: string[]
  typeConfig?: Record<string, unknown>
  currentFilename?: string
  pipelineVersion?: 'V1' | 'V2'
  placement?: 'node' | 'canvas'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update-id', payload: { oldId?: string; newId: string }): void
  (e: 'update-type', newType: string): void
  (e: 'update-data', payload: FlowBusinessData & { _action?: string } & Record<string, unknown>): void
  (e: 'open-picker', payload: string | PickerPayload, referenceField?: string | null, referenceLabel?: string): void
}>()

const formMethods = useNodeForm(props, emit as unknown as UseNodeFormEmit)
const {
  formData, jsonStr, jsonError, getValue, setValue,
  getArrayList, setArrayList, setArrayLists, updateJsonFromForm, handleJsonInput,
  focusData, availableFocusEvents, addFocusParam, removeFocusParam, updateFocusParam
} = formMethods

const deviceScreenPicker = useDeviceScreenPicker({
  nodeId: props.nodeId,
  currentFilename: props.currentFilename,
  formData: formData.value as Record<string, unknown>,
  getValue,
  setValue,
  onUpdateData: (payload) => emit('update-data', payload as FlowBusinessData & { _action?: string } & Record<string, unknown>)
})

const {
  showDeviceScreen,
  deviceScreenConfig,
  openDevicePicker,
  openImageManager,
  handleDevicePick,
  handleImageDelete
} = deviceScreenPicker

const nodeDetailsUi = useNodeDetailsUiConfig()
void nodeDetailsUi.load()

// UI 状态
const activeTab = ref('basic')
const fallbackTabs = [
  { key: 'basic', label: '基本属性', icon: Settings },
  { key: 'flow', label: '流程控制', icon: GitBranch },
  { key: 'common', label: '通用属性', icon: Zap },
  { key: 'focus', label: '消息回调', icon: MessageSquare },
  { key: 'recognition', label: '识别属性', icon: Info },
  { key: 'action', label: '动作属性', icon: Play },
  { key: 'json', label: 'JSON 预览', icon: FileJson },
]
const tabIconMap = {
  settings: Settings,
  'git-branch': GitBranch,
  zap: Zap,
  'message-square': MessageSquare,
  info: Info,
  play: Play,
  'file-json': FileJson
}
const tabs = computed(() => nodeDetailsUi.config.value?.tabs.map(tab => ({
  ...tab,
  icon: tabIconMap[tab.icon as keyof typeof tabIconMap] || Settings
})) || fallbackTabs)

const editingId = ref('')
const dropdownStates = reactive({
  recognition: false,
  action: false,
  focus: false,
})

const anyDropdownOpen = computed(() => dropdownStates.recognition || dropdownStates.action || dropdownStates.focus)
const toggleDropdown = (key: keyof typeof dropdownStates | string) => {
  (Object.keys(dropdownStates) as Array<keyof typeof dropdownStates>).forEach(k => {
    dropdownStates[k] = k === key ? !dropdownStates[k] : false
  })
}
const closeAllDropdowns = () => {
  (Object.keys(dropdownStates) as Array<keyof typeof dropdownStates>).forEach(k => dropdownStates[k] = false)
}
watch(activeTab, closeAllDropdowns)

const currentRecognition = computed<string>(() =>
  typeof formData.value.recognition === 'string' ? formData.value.recognition : 'DirectHit'
)
const currentAction = computed<string>(() =>
  typeof formData.value.action === 'string' ? formData.value.action : 'DoNothing'
)
const recognitionConfig = computed(() => recognitionTypes.find(r => r.value === currentRecognition.value) || recognitionTypes[0])
const actionConfig = computed(() => actionTypes.find(a => a.value === currentAction.value) || actionTypes[0])
const nextList = computed(() => getArrayList('next'))
const onErrorList = computed(() => getArrayList('on_error'))
const commonLayout = computed(() => nodeDetailsUi.config.value?.layouts.common)
const recognitionLayout = computed(() => nodeDetailsUi.config.value
  ? getNodeLayout(nodeDetailsUi.config.value, 'recognition', currentRecognition.value)
  : undefined)
const actionLayout = computed(() => nodeDetailsUi.config.value
  ? getNodeLayout(nodeDetailsUi.config.value, 'action', currentAction.value)
  : undefined)
const useConfiguredRecognition = computed(() => recognitionLayout.value?.renderer !== 'legacy')
const useConfiguredAction = computed(() => actionLayout.value?.renderer !== 'legacy')

const confirmIdChange = () => {
  if (editingId.value && editingId.value !== props.nodeId) {
    emit('update-id', { oldId: props.nodeId, newId: editingId.value })
  }
}

const selectRecognitionType = (newType: string) => {
  const nextLayout = nodeDetailsUi.config.value
    ? getNodeLayout(nodeDetailsUi.config.value, 'recognition', newType)
    : undefined
  const canUseConfiguredCleanup = nodeDetailsUi.config.value
    && recognitionLayout.value
    && recognitionLayout.value.renderer !== 'legacy'
    && nextLayout
    && nextLayout.renderer !== 'legacy'
  formData.value = canUseConfiguredCleanup && nodeDetailsUi.config.value
    ? removeConfiguredNodeTypeProperties(
      formData.value as Record<string, unknown>,
      'recognition',
      currentRecognition.value,
      newType,
      nodeDetailsUi.config.value
    )
    : removePreviousNodeTypeProperties(
      formData.value,
      'recognition',
      currentRecognition.value,
      newType
    )
  setValue('recognition', newType)
  emit('update-type', newType)
  dropdownStates.recognition = false
}

const selectActionType = (newAction: string) => {
  const nextLayout = nodeDetailsUi.config.value
    ? getNodeLayout(nodeDetailsUi.config.value, 'action', newAction)
    : undefined
  const canUseConfiguredCleanup = nodeDetailsUi.config.value
    && actionLayout.value
    && actionLayout.value.renderer !== 'legacy'
    && nextLayout
    && nextLayout.renderer !== 'legacy'
  formData.value = canUseConfiguredCleanup && nodeDetailsUi.config.value
    ? removeConfiguredNodeTypeProperties(
      formData.value as Record<string, unknown>,
      'action',
      currentAction.value,
      newAction,
      nodeDetailsUi.config.value
    )
    : removePreviousNodeTypeProperties(
      formData.value,
      'action',
      currentAction.value,
      newAction
    )
  setValue('action', newAction)
  dropdownStates.action = false
}

const handleFocusUpdate = (payload: { key: string; value: string }) => {
  updateFocusParam(payload.key, payload.value)
}

const jumpToSettings = (type: string) => {
  activeTab.value = type
  nextTick(closeAllDropdowns)
}

const handleAddLink = ({ key, value }: { key: string; value: { value?: string } }) => {
  const val = value?.value?.trim()
  if (!val) return
  const current = getArrayList(key)
  if (!current.includes(val)) {
    current.push(val)
    setArrayList(key, current)
  }
  if (value && typeof value.value === 'string') value.value = ''
}

const handleRemoveLink = ({ key, index }: { key: string; index: number }) => {
  const current = getArrayList(key)
  current.splice(index, 1)
  setArrayList(key, current)
}

const handleMoveLink = ({
  key,
  index,
  direction,
  position,
}: {
  key: string
  index: number
  direction?: number
  position?: 'top' | 'bottom'
}) => {
  const current = getArrayList(key)
  const targetIndex = position === 'top'
    ? 0
    : position === 'bottom'
      ? current.length - 1
      : index + (direction ?? 0)
  if (targetIndex < 0 || targetIndex >= current.length) return
  const [item] = current.splice(index, 1)
  current.splice(targetIndex, 0, item)
  setArrayList(key, current)
}

const handleReorderLink = ({
  sourceKey,
  sourceIndex,
  targetKey,
  targetIndex,
}: {
  sourceKey: string
  sourceIndex: number
  targetKey: string
  targetIndex: number
}) => {
  const source = getArrayList(sourceKey)
  if (sourceIndex < 0 || sourceIndex >= source.length) return

  const [item] = source.splice(sourceIndex, 1)
  if (sourceKey === targetKey) {
    const adjustedIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    source.splice(Math.max(0, Math.min(adjustedIndex, source.length)), 0, item)
    setArrayList(sourceKey, source)
    return
  }

  const target = getArrayList(targetKey)
  target.splice(Math.max(0, Math.min(targetIndex, target.length)), 0, item)
  setArrayLists({
    [sourceKey]: source,
    [targetKey]: target,
  })
}

const handleJsonTextInput = (val: string) => {
  handleJsonInput({ target: { value: val } } as unknown as Event)
}

const handleUpdateEditingId = (val: string) => {
  editingId.value = val
}

watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = props.nodeId || ''
    closeAllDropdowns()
  }
}, { immediate: true })
</script>

<template>
  <div
    v-if="anyDropdownOpen"
    class="fixed inset-0 z-[60] bg-transparent"
    @click="closeAllDropdowns"
  />

  <transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0 translate-x-[-10px] scale-95"
    enter-to-class="opacity-100 translate-x-0 scale-100"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-x-0 scale-100"
    leave-to-class="opacity-0 translate-x-[-10px] scale-95"
  >
    <div
      v-if="visible"
      class="w-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-[80] nodrag cursor-default flex flex-col overflow-hidden max-h-[70vh] h-auto"
      :class="placement === 'canvas' ? 'fixed right-4 top-4' : 'absolute left-[105%] top-0'"
      @dblclick.stop
      @wheel.stop
    >
      <div
        class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
            <component
              :is="recognitionConfig.icon"
              v-if="recognitionConfig.icon"
              :size="16"
              :class="recognitionConfig.color"
            />
          </div>
          <div>
            <span class="font-bold text-slate-700 text-sm">节点属性</span>
            <div class="text-[10px] text-slate-400 font-mono">
              #{{ nodeId }}
            </div>
          </div>
        </div>
        <button
          class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          @click.stop="$emit('close'); closeAllDropdowns()"
        >
          <X :size="16" />
        </button>
      </div>

      <div class="flex flex-wrap items-stretch gap-1 border-b border-slate-100 bg-slate-50/30 shrink-0 px-2 py-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :title="tab.label"
          class="flex-1 basis-[48px] flex items-center justify-center px-2 py-2 text-xs font-medium transition-all rounded-lg"
          :class="activeTab === tab.key ? 'text-indigo-600 bg-white border border-indigo-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 bg-white/70 border border-transparent hover:border-slate-200'"
          @click="() => { activeTab = tab.key; if (tab.key === 'json') updateJsonFromForm() }"
        >
          <component
            :is="tab.icon"
            :size="12"
          />
        </button>
      </div>

      <div class="flex-1 min-h-[300px] relative">
        <div
          v-show="activeTab === 'basic'"
          class="absolute inset-0 overflow-y-auto custom-scrollbar-dark"
        >
          <BasicPropsTab
            :node-id="nodeId"
            :editing-id="editingId"
            :recognition-config="recognitionConfig"
            :recognition-types="recognitionTypes"
            :current-recognition="currentRecognition"
            :is-recognition-dropdown-open="dropdownStates.recognition"
            :action-config="actionConfig"
            :action-types="actionTypes"
            :current-action="currentAction"
            :is-action-dropdown-open="dropdownStates.action"
            :form="formMethods"
            @update:editing-id="handleUpdateEditingId"
            @confirm-id-change="confirmIdChange"
            @toggle-dropdown="toggleDropdown"
            @select-recognition="selectRecognitionType"
            @select-action="selectActionType"
            @jump-to-settings="jumpToSettings"
          />
        </div>

        <div
          v-show="activeTab === 'flow'"
          class="absolute inset-0 overflow-y-auto custom-scrollbar-dark"
        >
          <FlowTab
            :next-list="nextList"
            :on-error-list="onErrorList"
            @add-link="handleAddLink"
            @remove-link="handleRemoveLink"
            @move-link="handleMoveLink"
            @reorder-link="handleReorderLink"
          />
        </div>

        <div
          v-show="activeTab === 'common'"
          class="absolute inset-0 overflow-y-auto custom-scrollbar-dark"
        >
          <ConfiguredFieldsPanel
            v-if="nodeDetailsUi.config.value && nodeDetailsUi.pipelineSchema.value && commonLayout"
            :columns="nodeDetailsUi.config.value.gridColumns"
            :layout="commonLayout"
            :ui-config="nodeDetailsUi.config.value"
            :pipeline-schema="nodeDetailsUi.pipelineSchema.value"
            :form="formMethods"
          />
          <CommonTab
            v-else
            :get-value="getValue"
            :set-value="setValue"
          />
        </div>

        <div
          v-show="activeTab === 'focus'"
          class="absolute inset-0 overflow-y-auto custom-scrollbar-dark"
        >
          <FocusTab
            :focus-data="focusData"
            :available-focus-events="availableFocusEvents"
            :is-dropdown-open="dropdownStates.focus"
            @toggle-dropdown="() => toggleDropdown('focus')"
            @add-focus="addFocusParam"
            @remove-focus="removeFocusParam"
            @update-focus="handleFocusUpdate"
          />
        </div>

        <div
          v-show="activeTab === 'recognition'"
          class="absolute inset-0 overflow-y-auto custom-scrollbar-dark"
        >
          <ConfiguredFieldsPanel
            v-if="nodeDetailsUi.config.value && nodeDetailsUi.pipelineSchema.value && recognitionLayout && useConfiguredRecognition"
            :title="`${recognitionConfig.label} 属性`"
            :subtitle="currentRecognition"
            :columns="nodeDetailsUi.config.value.gridColumns"
            :layout="recognitionLayout"
            :ui-config="nodeDetailsUi.config.value"
            :pipeline-schema="nodeDetailsUi.pipelineSchema.value"
            :form="formMethods"
            @open-picker="openDevicePicker"
            @open-image-manager="openImageManager"
          />
          <RecognitionTab
            v-else
            :current-recognition="currentRecognition"
            :recognition-config="recognitionConfig"
            :form="formMethods"
            @open-picker="openDevicePicker"
            @open-image-manager="openImageManager"
          />
        </div>

        <div
          v-show="activeTab === 'action'"
          class="absolute inset-0 overflow-y-auto custom-scrollbar-dark"
        >
          <ConfiguredFieldsPanel
            v-if="nodeDetailsUi.config.value && nodeDetailsUi.pipelineSchema.value && actionLayout && useConfiguredAction"
            :title="`${actionConfig.label} 属性`"
            :subtitle="currentAction"
            :columns="nodeDetailsUi.config.value.gridColumns"
            :layout="actionLayout"
            :ui-config="nodeDetailsUi.config.value"
            :pipeline-schema="nodeDetailsUi.pipelineSchema.value"
            :form="formMethods"
            @open-picker="openDevicePicker"
          />
          <ActionTab
            v-else
            :current-action="currentAction"
            :action-config="actionConfig"
            :form="formMethods"
            @open-picker="openDevicePicker"
          />
        </div>

        <JsonPreviewTab
          v-show="activeTab === 'json'"
          :json-str="jsonStr"
          :json-error="jsonError"
          @input="handleJsonTextInput"
        />
      </div>
    </div>
  </transition>

  <Teleport to="body">
    <DeviceScreen
      :visible="showDeviceScreen"
      :title="deviceScreenConfig.title"
      :reference-rect="deviceScreenConfig.referenceRect"
      :reference-label="deviceScreenConfig.referenceLabel"
      :mode="deviceScreenConfig.mode"
      :color-method="deviceScreenConfig.colorMethod"
      :image-list="deviceScreenConfig.imageList"
      :temp-image-list="deviceScreenConfig.tempImageList"
      :deleted-image-list="deviceScreenConfig.deletedImageList"
      :filename="deviceScreenConfig.filename"
      :node-id="deviceScreenConfig.nodeId"
      :initial-rect="deviceScreenConfig.initialRect"
      @confirm="handleDevicePick"
      @close="showDeviceScreen = false"
      @delete-image="handleImageDelete"
    />
  </Teleport>
</template>
