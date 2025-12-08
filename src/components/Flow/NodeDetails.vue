<script setup>
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
import { useNodeForm, recognitionTypes, actionTypes } from '../../utils/nodeLogic.js'

const props = defineProps({
  visible: Boolean,
  nodeId: String,
  nodeData: Object,
  nodeType: String,
  availableTypes: Array,
  typeConfig: Object,
  currentFilename: String // 当前打开的文件名
})
const emit = defineEmits(['close', 'update-id', 'update-type', 'update-data'])

const formMethods = useNodeForm(props, emit)
const {
  formData, jsonStr, jsonError, getValue, setValue,
  getArrayList, setArrayList, updateJsonFromForm, handleJsonInput,
  focusData, availableFocusEvents, addFocusParam, removeFocusParam, updateFocusParam
} = formMethods

// UI 状态
const activeTab = ref('basic')
const tabs = [
  { key: 'basic', label: '基本属性', icon: Settings },
  { key: 'flow', label: '流程控制', icon: GitBranch },
  { key: 'common', label: '通用属性', icon: Zap },
  { key: 'focus', label: '消息回调', icon: MessageSquare },
  { key: 'recognition', label: '识别属性', icon: Info },
  { key: 'action', label: '动作属性', icon: Play },
  { key: 'json', label: 'JSON 预览', icon: FileJson },
]

const editingId = ref('')
const dropdownStates = reactive({
  recognition: false,
  action: false,
  focus: false,
})

const anyDropdownOpen = computed(() => dropdownStates.recognition || dropdownStates.action || dropdownStates.focus)
const toggleDropdown = (key) => {
  Object.keys(dropdownStates).forEach(k => {
    dropdownStates[k] = k === key ? !dropdownStates[k] : false
  })
}
const closeAllDropdowns = () => {
  Object.keys(dropdownStates).forEach(k => dropdownStates[k] = false)
}
watch(activeTab, closeAllDropdowns)

// Device Screen 状态
const showDeviceScreen = ref(false)
const deviceScreenConfig = reactive({
  targetField: '',
  referenceField: '',
  referenceRect: null,
  referenceLabel: '',
  title: '区域选择',
  mode: 'coordinate',
  imageList: [],
  tempImageList: [],
  deletedImageList: [],
  filename: '',
  nodeId: ''
})

const currentRecognition = computed(() => formData.value.recognition || 'DirectHit')
const currentAction = computed(() => formData.value.action || 'DoNothing')
const recognitionConfig = computed(() => recognitionTypes.find(r => r.value === currentRecognition.value) || recognitionTypes[0])
const actionConfig = computed(() => actionTypes.find(a => a.value === currentAction.value) || actionTypes[0])
const nextList = computed(() => getArrayList('next'))
const onErrorList = computed(() => getArrayList('on_error'))

const confirmIdChange = () => {
  if (editingId.value && editingId.value !== props.nodeId) {
    emit('update-id', { oldId: props.nodeId, newId: editingId.value })
  }
}

const selectRecognitionType = (newType) => {
  setValue('recognition', newType)
  emit('update-type', newType)
  dropdownStates.recognition = false
}

const selectActionType = (newAction) => {
  setValue('action', newAction)
  dropdownStates.action = false
}

const jumpToSettings = (type) => {
  activeTab.value = type
  nextTick(closeAllDropdowns)
}

const parseRect = (val) => {
  if (Array.isArray(val) && val.length === 4) return val
  if (typeof val === 'string') {
    try {
      const arr = JSON.parse(val)
      if (Array.isArray(arr) && arr.length === 4) return arr
    } catch (e) {
      const parts = val.split(',').map(Number)
      if (parts.length === 4 && !parts.some(isNaN)) return parts
    }
  }
  return null
}

const openDevicePicker = (field, referenceField = null, mode = 'coordinate', refLabel = null) => {
  deviceScreenConfig.targetField = field
  deviceScreenConfig.referenceField = referenceField
  deviceScreenConfig.referenceRect = null
  deviceScreenConfig.mode = mode
  deviceScreenConfig.referenceLabel = refLabel || referenceField || '参考区域'
  deviceScreenConfig.title = mode === 'ocr' ? 'OCR 区域识别' : (field.includes('offset') ? `设置偏移 (${field})` : `选取区域 (${field})`)
  deviceScreenConfig.imageList = []
  if (referenceField) deviceScreenConfig.referenceRect = parseRect(getValue(referenceField))
  showDeviceScreen.value = true
}

const openImageManager = () => {
  deviceScreenConfig.mode = 'image_manager'
  deviceScreenConfig.title = '模板图片管理'
  deviceScreenConfig.targetField = 'template'
  deviceScreenConfig.referenceRect = parseRect(getValue('roi'))
  deviceScreenConfig.referenceLabel = 'roi'
  deviceScreenConfig.imageList = props.nodeData?._images || []
  deviceScreenConfig.tempImageList = props.nodeData?._temp_images || []
  deviceScreenConfig.deletedImageList = props.nodeData?._del_images || []
  deviceScreenConfig.filename = props.currentFilename || ''
  deviceScreenConfig.nodeId = props.nodeId || ''
  showDeviceScreen.value = true
}

const handleDevicePick = (result) => {
  if (deviceScreenConfig.mode === 'image_manager') {
    if (result.type === 'save_image_changes') {
      emit('update-data', {
        _action: 'save_image_changes',
        validPaths: result.validPaths,
        images: result.images,
        tempImages: result.tempImages,
        deletedImages: result.deletedImages
      })
    } else if (result.type === 'add_temp_image') {
      emit('update-data', {
        _action: 'add_temp_image',
        imagePath: result.imagePath,
        imageBase64: result.imageBase64
      })
    } else if (result.type === 'restore_image') {
      emit('update-data', {
        _action: 'restore_image',
        imagePath: result.imagePath
      })
    }
    if (result.closeModal !== false) {
      showDeviceScreen.value = false
    }
  } else {
    const field = deviceScreenConfig.targetField
    const refRect = deviceScreenConfig.referenceRect
    if (deviceScreenConfig.mode !== 'ocr' && field.includes('offset') && refRect) {
      setValue(field, [result[0] - refRect[0], result[1] - refRect[1], result[2] - refRect[2], result[3] - refRect[3]])
    } else {
      setValue(field, result)
    }
  }
}

const handleImageDelete = (imageName) => {
  emit('update-data', { _action: 'delete_image', name: imageName })
}

const handleAddLink = ({ key, value }) => {
  const val = value?.value?.trim()
  if (!val) return
  const current = getArrayList(key)
  if (!current.includes(val)) {
    current.push(val)
    setArrayList(key, current)
  }
  value.value = ''
}

const handleRemoveLink = ({ key, index }) => {
  const current = getArrayList(key)
  current.splice(index, 1)
  setArrayList(key, current)
}

const handleMoveLink = ({ key, index, direction }) => {
  const current = getArrayList(key)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= current.length) return
  const [item] = current.splice(index, 1)
  current.splice(targetIndex, 0, item)
  setArrayList(key, current)
}

const handleJsonTextInput = (val) => {
  handleJsonInput({ target: { value: val } })
}

watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = props.nodeId
    closeAllDropdowns()
  }
}, { immediate: true })
</script>

<template>
  <div v-if="anyDropdownOpen" class="fixed inset-0 z-[60] bg-transparent" @click="closeAllDropdowns"></div>

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
          class="absolute left-[105%] top-0 w-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 nodrag cursor-default flex flex-col overflow-hidden max-h-[70vh] h-auto"
        @dblclick.stop
        @wheel.stop
    >
      <div
          class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-white shadow-sm border border-slate-100">
            <component v-if="recognitionConfig.icon" :is="recognitionConfig.icon" :size="16" :class="recognitionConfig.color"/>
          </div>
          <div><span class="font-bold text-slate-700 text-sm">节点属性</span>
            <div class="text-[10px] text-slate-400 font-mono">#{{ nodeId }}</div>
          </div>
        </div>
        <button @click.stop="$emit('close'); closeAllDropdowns()"
                class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
          <X :size="16"/>
        </button>
      </div>

      <div class="flex flex-wrap items-stretch gap-1 border-b border-slate-100 bg-slate-50/30 shrink-0 px-2 py-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="() => { activeTab = tab.key; if (tab.key === 'json') updateJsonFromForm() }"
          :title="tab.label"
          class="flex-1 basis-[48px] flex items-center justify-center px-2 py-2 text-xs font-medium transition-all rounded-lg"
          :class="activeTab === tab.key ? 'text-indigo-600 bg-white border border-indigo-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 bg-white/70 border border-transparent hover:border-slate-200'"
        >
          <component :is="tab.icon" :size="12" />
        </button>
      </div>

      <div class="flex-1 min-h-[300px] relative">
        <div v-show="activeTab === 'basic'" class="absolute inset-0 overflow-y-auto custom-scrollbar-dark">
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
            @update:editingId="val => editingId.value = val"
            @confirm-id-change="confirmIdChange"
            @toggle-dropdown="toggleDropdown"
            @select-recognition="selectRecognitionType"
            @select-action="selectActionType"
            @jump-to-settings="jumpToSettings"
          />
        </div>

        <div v-show="activeTab === 'flow'" class="absolute inset-0 overflow-y-auto custom-scrollbar-dark">
          <FlowTab
            :next-list="nextList"
            :on-error-list="onErrorList"
            @add-link="handleAddLink"
            @remove-link="handleRemoveLink"
            @move-link="handleMoveLink"
          />
        </div>

        <div v-show="activeTab === 'common'" class="absolute inset-0 overflow-y-auto custom-scrollbar-dark">
          <CommonTab :get-value="getValue" :set-value="setValue" />
        </div>

        <div v-show="activeTab === 'focus'" class="absolute inset-0 overflow-y-auto custom-scrollbar-dark">
          <FocusTab
            :focus-data="focusData"
            :available-focus-events="availableFocusEvents"
            :is-dropdown-open="dropdownStates.focus"
            @toggle-dropdown="() => toggleDropdown('focus')"
            @add-focus="addFocusParam"
            @remove-focus="removeFocusParam"
            @update-focus="({ key, value }) => updateFocusParam(key, value)"
          />
        </div>

        <div v-show="activeTab === 'recognition'" class="absolute inset-0 overflow-y-auto custom-scrollbar-dark">
          <RecognitionTab
            :current-recognition="currentRecognition"
            :recognition-config="recognitionConfig"
            :form="formMethods"
            @open-picker="openDevicePicker"
            @open-image-manager="openImageManager"
          />
        </div>

        <div v-show="activeTab === 'action'" class="absolute inset-0 overflow-y-auto custom-scrollbar-dark">
          <ActionTab
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
        :image-list="deviceScreenConfig.imageList"
        :temp-image-list="deviceScreenConfig.tempImageList"
        :deleted-image-list="deviceScreenConfig.deletedImageList"
        :filename="deviceScreenConfig.filename"
        :node-id="deviceScreenConfig.nodeId"
        @confirm="handleDevicePick"
        @close="showDeviceScreen = false"
        @delete-image="handleImageDelete"
    />
  </Teleport>
</template>
