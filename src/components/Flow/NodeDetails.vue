<script setup>
import {computed, nextTick, reactive, ref, watch, inject} from 'vue'
import {
  AlertCircle, Check, ChevronDown, ChevronRight, ChevronUp, Clock,
  FileJson, GitBranch, Info, MessageSquare, Plus,
  Settings, X, Zap
} from 'lucide-vue-next'
import DeviceScreen from './DeviceScreen.vue'
import NodeRecognition from './NodeDetailsModals/NodeRecognition.vue'
import NodeAction from './NodeDetailsModals/NodeAction.vue'
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
const activeTab = ref('properties')
const expandedSections = reactive({
  basic: true, flow: false, common: false, recognition: true, action: true, focus: false
})
const editingId = ref('')
const newNextLink = ref('')
const newErrorLink = ref('')
const recSectionRef = ref(null)
const actSectionRef = ref(null)

const isRecognitionDropdownOpen = ref(false)
const isActionDropdownOpen = ref(false)
const isFocusDropdownOpen = ref(false)

const anyDropdownOpen = computed(() =>
    isRecognitionDropdownOpen.value ||
    isActionDropdownOpen.value ||
    isFocusDropdownOpen.value
)

const closeAllDropdowns = () => {
  isRecognitionDropdownOpen.value = false
  isActionDropdownOpen.value = false
  isFocusDropdownOpen.value = false
}

watch(activeTab, () => {
  closeAllDropdowns()
})

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

const toggleSection = (key) => {
  expandedSections[key] = !expandedSections[key]
}

const confirmIdChange = () => {
  if (editingId.value && editingId.value !== props.nodeId) {
    emit('update-id', {oldId: props.nodeId, newId: editingId.value})
  }
}

const selectRecognitionType = (newType) => {
  setValue('recognition', newType)
  emit('update-type', newType)
  isRecognitionDropdownOpen.value = false
}

const selectActionType = (newAction) => {
  setValue('action', newAction)
  isActionDropdownOpen.value = false
}

const jumpToSettings = (type) => {
  expandedSections[type] = true
  nextTick(() => {
    const target = type === 'recognition' ? recSectionRef.value : actSectionRef.value
    if (target) target.scrollIntoView({behavior: 'smooth', block: 'start'})
  })
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
  deviceScreenConfig.referenceLabel = "roi"
  deviceScreenConfig.imageList = props.nodeData?._images || []
  deviceScreenConfig.tempImageList = props.nodeData?._temp_images || []
  deviceScreenConfig.deletedImageList = props.nodeData?._del_images || []
  // 传递文件名和节点ID用于生成默认保存路径
  deviceScreenConfig.filename = props.currentFilename || ''
  deviceScreenConfig.nodeId = props.nodeId || ''
  showDeviceScreen.value = true
}

const handleDevicePick = (result) => {
  if (deviceScreenConfig.mode === 'image_manager') {
    if (result.type === 'save_image_changes') {
      // 保存图片变更：更新 template、处理删除和新增
      emit('update-data', {
        _action: 'save_image_changes',
        validPaths: result.validPaths, // 更新到 template 的路径
        images: result.images, // 当前 _images
        tempImages: result.tempImages, // 当前 _temp_images
        deletedImages: result.deletedImages // 当前 _del_images
      })
    } else if (result.type === 'add_temp_image') {
      // 添加临时图片到 _temp_images 并添加路径到 template
      emit('update-data', {
        _action: 'add_temp_image',
        imagePath: result.imagePath,
        imageBase64: result.imageBase64
      })
    } else if (result.type === 'restore_image') {
      // 恢复已删除的图片
      emit('update-data', {
        _action: 'restore_image',
        imagePath: result.imagePath
      })
    }
    // 只有在明确需要关闭时才关闭
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
  emit('update-data', {_action: 'delete_image', name: imageName})
}

const addLink = (key, valueRef) => {
  const val = valueRef.value.trim()
  if (!val) return
  const current = getArrayList(key)
  if (!current.includes(val)) {
    current.push(val)
    setArrayList(key, current)
  }
  valueRef.value = ''
}

const removeLink = (key, index) => {
  const current = getArrayList(key)
  current.splice(index, 1)
  setArrayList(key, current)
}

const moveLink = (key, index, direction) => {
  const current = getArrayList(key)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= current.length) return
  const [item] = current.splice(index, 1)
  current.splice(targetIndex, 0, item)
  setArrayList(key, current)
}

watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = props.nodeId
    closeAllDropdowns()
  }
}, {immediate: true})
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
        class="absolute left-[105%] top-0 w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 nodrag cursor-default flex flex-col overflow-hidden max-h-[750px] h-[85vh]"
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

      <div class="flex border-b border-slate-100 bg-slate-50/30 shrink-0">
        <button @click="activeTab = 'properties'"
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
                :class="activeTab === 'properties' ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' : 'text-slate-500 hover:text-slate-700'">
          <Settings :size="12"/>
          属性
        </button>
        <button @click="activeTab = 'json'; updateJsonFromForm()"
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all"
                :class="activeTab === 'json' ? 'text-indigo-600 bg-white border-b-2 border-indigo-500 -mb-px' : 'text-slate-500 hover:text-slate-700'">
          <FileJson :size="12"/>
          JSON
        </button>
      </div>

      <div class="flex-1 min-h-0 relative">
        <div v-show="activeTab === 'properties'"
             class="absolute inset-0 overflow-y-auto custom-scrollbar p-3 space-y-2.5">

          <div class="bg-white rounded-xl border border-slate-200 overflow-visible relative z-50">
            <button @click="toggleSection('basic')"
                    class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors rounded-t-xl">
              <div class="flex items-center gap-1.5">
                <Settings :size="12" class="text-slate-500"/>
                <span class="font-semibold text-slate-700 text-xs">基本属性</span></div>
              <component :is="expandedSections.basic ? ChevronDown : ChevronRight" :size="14" class="text-slate-400"/>
            </button>
            <div v-show="expandedSections.basic" class="p-3 space-y-3 border-t border-slate-100 rounded-b-xl">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">节点 ID</label>
                <div class="flex gap-1.5"><input v-model="editingId"
                                                 class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 font-mono"/>
                  <button v-if="editingId !== nodeId" @click="confirmIdChange"
                          class="px-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-0.5">
                    <Check :size="10"/>
                    应用
                  </button>
                </div>
              </div>

              <div class="space-y-1 relative z-[80]">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">识别算法</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <button
                        @click="isRecognitionDropdownOpen = !isRecognitionDropdownOpen; isActionDropdownOpen = false"
                        class="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 cursor-pointer text-left">
                      <div class="flex items-center gap-2 overflow-hidden">
                        <component v-if="recognitionConfig.icon" :is="recognitionConfig.icon" :size="14" :class="recognitionConfig.color"
                                   class="shrink-0"/>
                        <span class="truncate">{{ recognitionConfig.label }} <span
                            class="text-slate-400 text-[10px] ml-0.5">({{ recognitionConfig.value }})</span></span>
                      </div>
                      <ChevronDown :size="12" class="text-slate-400 shrink-0 ml-1"
                                   :class="{ 'rotate-180': isRecognitionDropdownOpen }"/>
                    </button>

                    <div v-if="isRecognitionDropdownOpen"
                         class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col py-1">
                      <button v-for="type in recognitionTypes" :key="type.value"
                              @click="selectRecognitionType(type.value)"
                              class="flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors shrink-0"
                              :class="{ 'bg-indigo-50/60 text-indigo-600': currentRecognition === type.value, 'text-slate-700': currentRecognition !== type.value }">
                        <component v-if="type.icon" :is="type.icon" :size="14" :class="type.color" class="shrink-0"/>
                        <span class="truncate">{{ type.label }}</span>
                        <span class="ml-auto text-[10px] font-mono text-slate-400">{{ type.value }}</span>
                        <Check v-if="currentRecognition === type.value" :size="12" class="text-indigo-600 ml-2"/>
                      </button>
                    </div>
                  </div>
                  <button @click="jumpToSettings('recognition')" :disabled="currentRecognition === 'DirectHit'"
                          class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Settings :size="14"/>
                  </button>
                </div>
              </div>

              <div class="space-y-1 relative z-[70]">
                <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">执行动作</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <button @click="isActionDropdownOpen = !isActionDropdownOpen; isRecognitionDropdownOpen = false"
                            class="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 cursor-pointer text-left">
                      <div class="flex items-center gap-2 overflow-hidden">
                        <component v-if="actionConfig.icon" :is="actionConfig.icon" :size="14" :class="actionConfig.color" class="shrink-0"/>
                        <span class="truncate">{{ actionConfig.label }} <span class="text-slate-400 text-[10px] ml-0.5">({{
                            actionConfig.value
                          }})</span></span>
                      </div>
                      <ChevronDown :size="12" class="text-slate-400 shrink-0 ml-1"
                                   :class="{ 'rotate-180': isActionDropdownOpen }"/>
                    </button>

                    <div v-if="isActionDropdownOpen"
                         class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col py-1">
                      <button v-for="type in actionTypes" :key="type.value" @click="selectActionType(type.value)"
                              class="flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors shrink-0"
                              :class="{ 'bg-indigo-50/60 text-indigo-600': currentAction === type.value, 'text-slate-700': currentAction !== type.value }">
                        <component v-if="type.icon" :is="type.icon" :size="14" :class="type.color" class="shrink-0"/>
                        <span class="truncate">{{ type.label }}</span>
                        <span class="ml-auto text-[10px] font-mono text-slate-400">{{ type.value }}</span>
                        <Check v-if="currentAction === type.value" :size="12" class="text-indigo-600 ml-2"/>
                      </button>
                    </div>
                  </div>
                  <button @click="jumpToSettings('action')"
                          :disabled="['DoNothing', 'StopTask'].includes(currentAction)"
                          class="px-2 rounded-lg border border-slate-200 transition-colors flex items-center justify-center bg-indigo-50 text-indigo-500 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Settings :size="14"/>
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden relative z-40">
            <button @click="toggleSection('flow')"
                    class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors">
              <div class="flex items-center gap-1.5">
                <GitBranch :size="12" class="text-blue-500"/>
                <span class="font-semibold text-slate-700 text-xs">流程控制</span></div>
              <component :is="expandedSections.flow ? ChevronDown : ChevronRight" :size="14" class="text-slate-400"/>
            </button>
            <div v-show="expandedSections.flow" class="p-3 space-y-3 border-t border-slate-100">
              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  后继节点 (Next)
                </label>
                <div class="space-y-1">
                  <div v-if="nextList.length" class="space-y-1">
                    <div v-for="(link, idx) in nextList" :key="`next-${link}-${idx}`"
                         class="flex items-center gap-2 p-2 bg-blue-50/70 border border-blue-100 rounded-lg">
                      <span class="flex-1 text-xs font-mono text-blue-800 truncate">{{ link }}</span>
                      <div class="flex items-center gap-1">
                        <button @click="moveLink('next', idx, -1)" :disabled="idx === 0"
                                class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40">
                          <ChevronUp :size="12"/>
                        </button>
                        <button @click="moveLink('next', idx, 1)" :disabled="idx === nextList.length - 1"
                                class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100 disabled:opacity-40">
                          <ChevronDown :size="12"/>
                        </button>
                        <button @click="removeLink('next', idx)"
                                class="p-1 rounded-md border border-blue-100 text-blue-500 hover:bg-blue-100">
                          <X :size="12"/>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-2 py-1.5">
                    暂无后继节点，添加一个以定义执行顺序
                  </div>
                  <div class="flex gap-1">
                    <input v-model="newNextLink" @keyup.enter="addLink('next', newNextLink)"
                           class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                           placeholder="输入节点 ID，回车添加"/>
                    <button @click="addLink('next', newNextLink)"
                            class="px-3 rounded-lg bg-blue-500 text-white text-[11px] font-bold hover:bg-blue-600 transition-colors">
                      添加
                    </button>
                  </div>
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-[10px] font-semibold text-rose-600 uppercase tracking-wide flex items-center gap-1">
                  <div class="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  错误节点 (OnError)
                </label>
                <div class="space-y-1">
                  <div v-if="onErrorList.length" class="space-y-1">
                    <div v-for="(link, idx) in onErrorList" :key="`err-${link}-${idx}`"
                         class="flex items-center gap-2 p-2 bg-rose-50/70 border border-rose-100 rounded-lg">
                      <span class="flex-1 text-xs font-mono text-rose-800 truncate">{{ link }}</span>
                      <div class="flex items-center gap-1">
                        <button @click="moveLink('on_error', idx, -1)" :disabled="idx === 0"
                                class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40">
                          <ChevronUp :size="12"/>
                        </button>
                        <button @click="moveLink('on_error', idx, 1)" :disabled="idx === onErrorList.length - 1"
                                class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100 disabled:opacity-40">
                          <ChevronDown :size="12"/>
                        </button>
                        <button @click="removeLink('on_error', idx)"
                                class="p-1 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-100">
                          <X :size="12"/>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-[10px] text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-2 py-1.5">
                    暂未配置错误分支，可添加备用流程
                  </div>
                  <div class="flex gap-1">
                    <input v-model="newErrorLink" @keyup.enter="addLink('on_error', newErrorLink)"
                           class="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
                           placeholder="输入节点 ID，回车添加"/>
                    <button @click="addLink('on_error', newErrorLink)"
                            class="px-3 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 transition-colors">
                      添加
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-hidden relative z-30">
            <button @click="toggleSection('common')"
                    class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors">
              <div class="flex items-center gap-1.5">
                <Zap :size="12" class="text-emerald-500"/>
                <span class="font-semibold text-slate-700 text-xs">通用属性</span></div>
              <component :is="expandedSections.common ? ChevronDown : ChevronRight" :size="14" class="text-slate-400"/>
            </button>
            <div v-show="expandedSections.common" class="p-3 space-y-2.5 border-t border-slate-100">
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">速率
                  (ms)</label><input type="number" :value="getValue('rate_limit', 1000)"
                                     @input="setValue('rate_limit', parseInt($event.target.value) || 1000)"
                                     class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
                </div>
                <div class="space-y-1"><label class="text-[10px] font-semibold text-slate-500 uppercase">超时
                  (ms)</label><input type="number" :value="getValue('timeout', 20000)"
                                     @input="setValue('timeout', parseInt($event.target.value) || 20000)"
                                     class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
                </div>
              </div>
              <div class="flex flex-wrap gap-3 pt-1"><label
                  class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox"
                                                                                       :checked="getValue('is_sub', false)"
                                                                                       @change="setValue('is_sub', $event.target.checked)"
                                                                                       class="w-3.5 h-3.5 rounded text-indigo-600"/><span
                  class="text-[11px] text-slate-600">子节点</span></label><label
                  class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox"
                                                                                       :checked="getValue('inverse', false)"
                                                                                       @change="setValue('inverse', $event.target.checked)"
                                                                                       class="w-3.5 h-3.5 rounded text-indigo-600"/><span
                  class="text-[11px] text-slate-600">反转结果</span></label><label
                  class="inline-flex items-center gap-1.5 cursor-pointer group"><input type="checkbox"
                                                                                       :checked="getValue('enabled', true)"
                                                                                       @change="setValue('enabled', $event.target.checked)"
                                                                                       class="w-3.5 h-3.5 rounded text-indigo-600"/><span
                  class="text-[11px] text-slate-600">启用</span></label></div>
              <div class="h-px bg-slate-100 my-1 w-full"></div>
              <div class="grid grid-cols-2 gap-2">
                <div class="space-y-1"><label
                    class="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Clock :size="10" class="text-violet-500"/>
                  前延迟 (ms)</label><input type="number" :value="getValue('pre_delay', 200)"
                                            @input="setValue('pre_delay', parseInt($event.target.value) || 200)"
                                            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
                </div>
                <div class="space-y-1"><label
                    class="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Clock :size="10" class="text-violet-500"/>
                  后延迟 (ms)</label><input type="number" :value="getValue('post_delay', 200)"
                                            @input="setValue('post_delay', parseInt($event.target.value) || 200)"
                                            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
                </div>
                <div class="space-y-1"><label
                    class="text-[10px] font-semibold text-slate-500 uppercase">前等待冻结</label><input type="number"
                                                                                                        :value="getValue('pre_wait_freezes', 0)"
                                                                                                        @input="setValue('pre_wait_freezes', parseInt($event.target.value) || 0)"
                                                                                                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
                </div>
                <div class="space-y-1"><label
                    class="text-[10px] font-semibold text-slate-500 uppercase">后等待冻结</label><input type="number"
                                                                                                        :value="getValue('post_wait_freezes', 0)"
                                                                                                        @input="setValue('post_wait_freezes', parseInt($event.target.value) || 0)"
                                                                                                        class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:border-indigo-400"/>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 overflow-visible relative z-20">
            <button @click="toggleSection('focus')"
                    class="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors rounded-t-xl">
              <div class="flex items-center gap-1.5">
                <MessageSquare :size="12" class="text-pink-500"/>
                <span class="font-semibold text-slate-700 text-xs">消息回调</span></div>
              <component :is="expandedSections.focus ? ChevronDown : ChevronRight" :size="14" class="text-slate-400"/>
            </button>
            <div v-show="expandedSections.focus" class="p-3 space-y-3 border-t border-slate-100 rounded-b-xl">
              <div v-for="(msg, key) in focusData" :key="key"
                   class="space-y-1 p-2 bg-slate-50 rounded-lg border border-slate-100 relative group">
                <div class="flex justify-between items-center">
                  <div class="text-[10px] font-bold text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded">{{
                      key
                    }}
                  </div>
                  <button @click="removeFocusParam(key)" class="text-slate-300 hover:text-red-500">
                    <X :size="12"/>
                  </button>
                </div>
                <input :value="msg" @input="updateFocusParam(key, $event.target.value)"
                       class="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:border-pink-300 outline-none"
                       placeholder="消息模板..."/>
              </div>

              <div class="relative" v-if="availableFocusEvents.length > 0">
                <button @click="isFocusDropdownOpen = !isFocusDropdownOpen"
                        class="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-pink-300 hover:text-pink-500 outline-none cursor-pointer transition-colors">
                  <Plus :size="12"/>
                  添加回调事件
                </button>
                <div v-if="isFocusDropdownOpen"
                     class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col py-1 z-[60]">
                  <button v-for="t in availableFocusEvents" :key="t" @click="addFocusParam(t)"
                          class="px-3 py-2 text-xs text-left text-slate-700 hover:bg-slate-50 transition-colors">{{ t }}
                  </button>
                </div>
              </div>
              <div v-else class="text-center text-[10px] text-slate-400 py-1">已添加所有可用事件</div>
              <div class="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                <Info :size="12" class="text-slate-400 mt-0.5 shrink-0"/>
                <div class="space-y-1">
                  <div class="text-[10px] text-slate-500 font-medium">可用占位符：</div>
                  <div class="text-[10px] font-mono text-slate-400 break-all leading-relaxed select-all">{name},
                    {task_id}, {reco_id}, {action_id}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="currentRecognition !== 'DirectHit'" ref="recSectionRef"
               class="bg-white rounded-xl border border-slate-200 overflow-visible relative z-10">
            <button @click="toggleSection('recognition')"
                    class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 hover:from-indigo-100 hover:to-violet-100 transition-colors rounded-t-xl">
              <div class="flex items-center gap-1.5">
                <component :is="recognitionConfig.icon" :size="12" :class="recognitionConfig.color"/>
                <span class="font-semibold text-slate-700 text-xs">{{ recognitionConfig.label }} 属性</span></div>
              <component :is="expandedSections.recognition ? ChevronDown : ChevronRight" :size="14"
                         class="text-slate-400"/>
            </button>
            <div v-show="expandedSections.recognition">
              <NodeRecognition
                  :currentType="currentRecognition"
                  :form="formMethods"
                  @open-picker="openDevicePicker"
                  @open-image-manager="openImageManager"
              />
            </div>
          </div>

          <div v-if="!['DoNothing', 'StopTask'].includes(currentAction)" ref="actSectionRef"
               class="bg-white rounded-xl border border-slate-200 overflow-hidden relative z-0">
            <button @click="toggleSection('action')"
                    class="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 hover:from-emerald-100 hover:to-teal-100 transition-colors">
              <div class="flex items-center gap-1.5">
                <component :is="actionConfig.icon" :size="12" :class="actionConfig.color"/>
                <span class="font-semibold text-slate-700 text-xs">{{ actionConfig.label }} 属性</span></div>
              <component :is="expandedSections.action ? ChevronDown : ChevronRight" :size="14" class="text-slate-400"/>
            </button>
            <div v-show="expandedSections.action">
              <NodeAction
                  :currentType="currentAction"
                  :form="formMethods"
                  @open-picker="openDevicePicker"
              />
            </div>
          </div>

        </div>

        <div v-show="activeTab === 'json'"
             class="absolute inset-0 z-10 w-full h-full p-3 flex flex-col bg-white overflow-hidden">
          <div class="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex flex-col relative">
            <textarea
                class="w-full h-full bg-transparent text-[10px] font-mono text-green-400 p-3 outline-none resize-none custom-scrollbar"
                :value="jsonStr" @input="handleJsonInput" spellcheck="false"></textarea>
            <div v-if="jsonError"
                 class="absolute bottom-3 left-3 right-3 bg-red-500/90 text-white px-3 py-2 rounded-lg backdrop-blur-sm shadow-lg flex items-start gap-2 z-10">
              <AlertCircle :size="16" class="shrink-0 mt-0.5"/>
              <div class="text-[10px] font-mono break-all leading-tight">{{ jsonError }}</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-400 text-center shrink-0">编辑后自动保存，格式错误将不会生效</div>
        </div>
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

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 4px; }
</style>