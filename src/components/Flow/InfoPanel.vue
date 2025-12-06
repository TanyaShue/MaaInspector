<script setup>
import {computed, ref, reactive, onMounted, defineComponent, h, watch, defineExpose} from 'vue'
import {
  Server, Database, Bot, Power, Settings, RefreshCw, CheckCircle2, XCircle, Loader2, HardDrive,
  FolderInput, Link, ChevronDown, Minimize2, Maximize2, Smartphone, FileText, Circle,
  FilePlus, Save
} from 'lucide-vue-next'
import {useVueFlow} from '@vue-flow/core'
import {deviceApi, resourceApi, agentApi, systemApi} from '../../services/api'
import DeviceSettingsModal from './Modals/DeviceSettingsModal.vue'
import ResourceSettingsModal from './Modals/ResourceSettingsModal.vue'
import CreateResourceModal from './Modals/CreateResourceModal.vue'

// --- Props & Emits ---
const props = defineProps({
  nodeCount: {type: Number, default: 0},
  edgeCount: {type: Number, default: 0},
  isDirty: {type: Boolean, default: false},
  currentFilename: {type: String, default: ''},
  edgeType: {type: String, default: 'smoothstep'},  // 连线类型
  spacing: {type: String, default: 'normal'}         // 布局间隔
})

// [核心] 增加 request-switch-file 和 update-canvas-config 事件
const emit = defineEmits(['load-nodes', 'load-images', 'save-nodes', 'device-connected', 'request-switch-file', 'update-canvas-config'])

// --- 内部组件 ---
const StatusIndicator = defineComponent({
  props: {status: String, size: {type: Number, default: 16}},
  setup(props) {
    return () => {
      if (props.status === 'connected') return h(CheckCircle2, {
        size: props.size,
        class: 'text-emerald-500 fill-emerald-50'
      })
      if (props.status === 'connecting' || props.status === 'disconnecting') return h(Loader2, {
        size: props.size,
        class: 'text-blue-500 animate-spin'
      })
      if (props.status === 'failed') return h(XCircle, {size: props.size, class: 'text-red-500'})
      return h(Circle, {size: props.size, class: 'text-slate-300'})
    }
  }
})

// --- 视图状态 ---
const {viewport} = useVueFlow()
const zoomPercentage = computed(() => Math.round((viewport.value.zoom || 1) * 100) + '%')
const isCollapsed = ref(false)
const showDeviceSettings = ref(false)
const showResourceSettings = ref(false)
const showCreateFileModal = ref(false)

// --- 全局数据源 ---
const availableDevices = ref([])
const resourceProfiles = ref([])
const currentAgentSocket = ref('')
const systemStatus = ref('disconnected')

// --- 选中状态 ---
const selectedDeviceIndex = ref(0)
const selectedProfileIndex = ref(0)
const selectedResourceFile = ref('')  // 存储唯一ID: source|filename
const availableFiles = ref([])

// --- 工具函数：生成和解析唯一ID ---
const makeFileId = (source, filename) => `${source}|${filename}`
const parseFileId = (id) => {
  if (!id) return { source: '', filename: '' }
  const sepIndex = id.lastIndexOf('|')
  if (sepIndex === -1) return { source: '', filename: id }
  return { source: id.slice(0, sepIndex), filename: id.slice(sepIndex + 1) }
}
const getFileObjById = (id) => availableFiles.value.find(f => makeFileId(f.source, f.value) === id)

// --- 保存状态 ---
const isSaving = ref(false)

// --- 控制器逻辑封装 ---
function useStatusModule(api, label) {
  const status = ref('disconnected')
  const message = ref(`${label}未连接`)
  const info = ref({})

  const connect = async (payload) => {
    if (status.value === 'connecting') return
    status.value = 'connecting'
    message.value = '处理中...'
    try {
      const method = api.load ? api.load : api.connect
      const res = await method(payload)
      status.value = 'connected'
      message.value = res.message || '已就绪'
      if (res.info) info.value = res.info
      return res
    } catch (e) {
      status.value = 'failed'
      message.value = '失败: ' + (e.message || '未知错误')
      setTimeout(() => {
        if (status.value === 'failed') status.value = 'disconnected'
      }, 3000)
      throw e
    }
  }

  const disconnect = async () => {
    if (!api.disconnect) {
      status.value = 'disconnected'
      info.value = {}
      return
    }
    status.value = 'disconnecting'
    try {
      await api.disconnect()
    } catch (e) {
    }
    status.value = 'disconnected'
    message.value = '已断开'
    info.value = {}
  }
  return reactive({status, message, info, connect, disconnect})
}

const deviceCtrl = useStatusModule(deviceApi, '设备')
const resourceCtrl = useStatusModule(resourceApi, '资源')
const agentCtrl = useStatusModule(agentApi, 'Agent')

// --- 计算属性 ---
const currentDevice = computed(() => availableDevices.value[selectedDeviceIndex.value] || {})
const currentProfile = computed(() => resourceProfiles.value[selectedProfileIndex.value] || {name: 'None', paths: []})

const fetchAndEmitNodes = async () => {
  if (!selectedResourceFile.value) return
  const fileObj = getFileObjById(selectedResourceFile.value)
  if (!fileObj) return

  try {
    resourceCtrl.message = '加载节点中...'
    const res = await resourceApi.getFileNodes(fileObj.source, fileObj.value)
    const nodes = res.nodes || {}

    // 传递 source 到 load-nodes 事件
    emit('load-nodes', {filename: fileObj.value, source: fileObj.source, nodes: nodes})
    resourceCtrl.message = `已加载: ${Object.keys(nodes).length} 节点`

    try {
      const imgRes = await resourceApi.getTemplateImages(fileObj.source, fileObj.value)
      if (imgRes.results) emit('load-images', imgRes.results)
    } catch (imgError) {
      console.warn("图片加载失败", imgError)
    }

  } catch (e) {
    console.error("加载节点失败", e)
    resourceCtrl.message = '节点加载失败'
  }
}

const handleSaveNodes = async () => {
  if (!selectedResourceFile.value || isSaving.value) return
  isSaving.value = true
  try {
    const fileObj = getFileObjById(selectedResourceFile.value)
    if (!fileObj) throw new Error('未找到当前文件')
    emit('save-nodes', {source: fileObj.source, filename: fileObj.value})
  } catch (e) {
    console.error('保存失败', e)
    alert('保存失败: ' + (e.message || '未知错误'))
    throw e
  } finally {
    isSaving.value = false
  }
}

const executeFileSwitch = async (filename, source) => {
  const normSource = source ? source.replace(/\\/g, '/').toLowerCase() : ''
  let target = availableFiles.value.find(f => {
    const fSource = f.source ? f.source.replace(/\\/g, '/').toLowerCase() : ''
    if (source) {
      return f.value === filename && fSource === normSource
    }
    return f.value === filename
  })

  if (target) {
    selectedResourceFile.value = makeFileId(target.source, target.value)
    await fetchAndEmitNodes()
  } else {
    alert(`无法切换: 未找到文件 ${filename}`)
  }
}

// [核心逻辑] 暴露给父组件调用
defineExpose({executeFileSwitch, handleSaveNodes})

// [交互] 下拉框变化 -> 通知父组件处理 (newFileId 是唯一ID: source|filename)
const handleFileSelectChange = (newFileId) => {
  if (newFileId === selectedResourceFile.value) return
  const fileObj = getFileObjById(newFileId)
  if (!fileObj) return

  emit('request-switch-file', {
    filename: fileObj.value,
    source: fileObj.source
  })
}

// --- 连接逻辑 ---
const handleDeviceConnect = async () => {
  try {
    await deviceCtrl.connect(currentDevice.value)
    emit('device-connected', true)
  } catch (e) {
    emit('device-connected', false)
  }
}
const handleDeviceDisconnect = async () => {
  await deviceCtrl.disconnect()
  emit('device-connected', false)
}
const handleResourceLoad = async () => {
  try {
    const res = await resourceCtrl.connect(currentProfile.value)
    if (res.list) {
      availableFiles.value = res.list
      // 使用唯一 ID 检查文件是否仍然存在
      let fileStillExists = selectedResourceFile.value ? getFileObjById(selectedResourceFile.value) : null

      // 兼容旧配置：如果没有找到，尝试仅通过文件名匹配（适用于从旧配置恢复的情况）
      if (!fileStillExists && selectedResourceFile.value && !selectedResourceFile.value.includes('|')) {
        const matchByName = availableFiles.value.find(f => f.value === selectedResourceFile.value)
        if (matchByName) {
          selectedResourceFile.value = makeFileId(matchByName.source, matchByName.value)
          fileStillExists = matchByName
        }
      }

      if (!selectedResourceFile.value || !fileStillExists) {
        if (availableFiles.value.length > 0) {
          const firstFile = availableFiles.value[0]
          await executeFileSwitch(firstFile.value, firstFile.source)
        } else {
          selectedResourceFile.value = ''
        }
      } else {
        await fetchAndEmitNodes()
      }
    }
  } catch (e) {
    console.error("资源加载流程异常", e)
  }
}
const handleCreateFile = async ({path, filename}) => {
  try {
    resourceCtrl.message = '创建文件中...'
    await resourceApi.createFile(path, filename)
    showCreateFileModal.value = false
    await handleResourceLoad()
    const simpleName = filename.endsWith('.json') ? filename : filename + '.json'
    // 查找新创建的文件：source 现在是资源根目录，与 path 相同（规范化比较）
    const normalizedPath = path.replace(/\\/g, '/').toLowerCase()
    const newFileObj = availableFiles.value.find(f =>
      f.value === simpleName &&
      f.source.replace(/\\/g, '/').toLowerCase() === normalizedPath
    )
    if (newFileObj) {
      await executeFileSwitch(newFileObj.value, newFileObj.source)
      resourceCtrl.message = '新建成功并已加载'
    }
  } catch (e) {
    console.error(e)
    alert(`创建失败: ${e.message || '未知错误'}`)
    resourceCtrl.message = '创建失败'
  }
}
const handleProfileSwitch = () => handleResourceLoad()
const handleAgentConnect = () => agentCtrl.connect({socket_id: currentAgentSocket.value})

// --- 初始化 ---
let isInit = true

const fetchSystemState = async () => {
  systemStatus.value = 'loading'
  isInit = true
  try {
    const data = await systemApi.getInitialState()
    if (data.devices) availableDevices.value = data.devices
    if (data.resource_profiles) resourceProfiles.value = data.resource_profiles
    const state = data.current_state || {}
    if (availableDevices.value[state.device_index]) selectedDeviceIndex.value = state.device_index
    if (resourceProfiles.value[state.resource_profile_index]) selectedProfileIndex.value = state.resource_profile_index
    // 使用 source 和 filename 生成唯一 ID
    if (state.resource_file && state.resource_source) {
      selectedResourceFile.value = makeFileId(state.resource_source, state.resource_file)
    } else if (state.resource_file) {
      // 兼容旧配置：没有 resource_source 时，仅使用文件名（后续加载时会尝试匹配）
      selectedResourceFile.value = state.resource_file
    }
    if (state.agent_socket_id) currentAgentSocket.value = state.agent_socket_id
    else if (data.agent_socket_id) currentAgentSocket.value = data.agent_socket_id

    // 加载画布配置（连线类型和布局间隔）
    if (state.edge_type || state.spacing) {
      emit('update-canvas-config', {
        edgeType: state.edge_type || 'smoothstep',
        spacing: state.spacing || 'normal'
      })
    }

    systemStatus.value = 'connected'
  } catch (e) {
    console.error("Init failed", e)
    systemStatus.value = 'error'
  } finally {
    setTimeout(() => {
      isInit = false
    }, 500)
  }
}
onMounted(() => fetchSystemState())

const saveAllConfig = async () => {
  if (isInit) return
  if (systemStatus.value !== 'connected') return
  try {
    // 解析当前选中文件的 source 和 filename
    const { source: currentSource, filename: currentFilename } = parseFileId(selectedResourceFile.value)
    const payload = {
      devices: availableDevices.value,
      resource_profiles: resourceProfiles.value,
      agent_socket_id: currentAgentSocket.value,
      current_state: {
        device_index: selectedDeviceIndex.value,
        resource_profile_index: selectedProfileIndex.value,
        resource_file: currentFilename,
        resource_source: currentSource,
        agent_socket_id: currentAgentSocket.value,
        edge_type: props.edgeType,    // 保存连线类型
        spacing: props.spacing         // 保存布局间隔
      }
    }
    await systemApi.saveDeviceConfig(payload)
  } catch (e) {
    console.error("Auto save failed", e)
  }
}
watch([selectedDeviceIndex, selectedProfileIndex, selectedResourceFile, currentAgentSocket], () => saveAllConfig(), {deep: false})

// 监听画布配置变化
watch(() => [props.edgeType, props.spacing], () => saveAllConfig(), {deep: false})

const saveDeviceSettings = (data) => {
  availableDevices.value = data.devices
  if (selectedDeviceIndex.value >= availableDevices.value.length) selectedDeviceIndex.value = 0
  if (data.index !== undefined) selectedDeviceIndex.value = data.index
  showDeviceSettings.value = false
  saveAllConfig()
}
const saveResourceSettings = (data) => {
  resourceProfiles.value = data.profiles
  if (selectedProfileIndex.value >= resourceProfiles.value.length) selectedProfileIndex.value = 0
  if (data.index !== undefined) selectedProfileIndex.value = data.index
  showResourceSettings.value = false
  saveAllConfig()
}
</script>

<template>
  <div class="relative flex flex-col items-end gap-2 font-sans select-none pointer-events-auto z-50">
    <Transition name="fade-scale" mode="out-in">
      <div v-if="isCollapsed"
           class="bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full flex items-center p-1 pl-3 pr-1 gap-3 transition-all duration-300"
           :class="{'!border-amber-300': props.isDirty}">
        <div class="flex items-center gap-1.5" :title="deviceCtrl.message">
          <StatusIndicator :status="deviceCtrl.status" :size="12"/>
          <span class="text-xs font-bold text-slate-600 max-w-[80px] truncate">{{
              deviceCtrl.status === 'connected' ? currentDevice.name : '无设备'
            }}</span>
        </div>
        <div class="w-px h-4 bg-slate-200"></div>
        <div class="flex items-center gap-1.5">
          <StatusIndicator :status="resourceCtrl.status" :size="12"/>
          <div class="relative group flex items-center gap-1">
            <div v-if="props.isDirty" class="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="文件已修改"></div>
            <select
                :value="selectedResourceFile"
                @change="handleFileSelectChange($event.target.value)"
                class="appearance-none bg-transparent text-xs font-mono text-slate-600 outline-none w-[100px] truncate cursor-pointer hover:text-indigo-600 transition-colors pr-3"
                :class="{'!text-amber-600 font-bold': props.isDirty}"
                :disabled="resourceCtrl.status !== 'connected' || availableFiles.length === 0"
            >
              <option v-for="file in availableFiles" :key="makeFileId(file.source, file.value)" :value="makeFileId(file.source, file.value)">{{ file.label }}</option>
              <option v-if="resourceCtrl.status !== 'connected'" disabled>未加载资源</option>
            </select>
            <ChevronDown v-if="resourceCtrl.status === 'connected'" :size="10"
                         class="absolute right-0 top-1 text-slate-400 pointer-events-none"/>
          </div>
        </div>
        <div class="w-px h-4 bg-slate-200"></div>
        <div class="flex items-center gap-1" :title="agentCtrl.message">
          <Bot :size="14" :class="agentCtrl.status === 'connected' ? 'text-violet-500' : 'text-slate-400'"/>
          <StatusIndicator :status="agentCtrl.status" :size="10"/>
        </div>
        <button v-if="props.isDirty" @click="handleSaveNodes" :disabled="isSaving"
                class="p-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                title="保存更改">
          <component :is="isSaving ? Loader2 : Save" :size="12" :class="{'animate-spin': isSaving}"/>
        </button>
        <button @click="isCollapsed = false"
                class="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors">
          <Maximize2 :size="14"/>
        </button>
      </div>

      <div v-else
           class="w-80 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[90vh] origin-top-right transition-all">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div class="flex items-center gap-2">
            <Settings class="w-4 h-4 text-slate-500"/>
            <span class="font-bold text-slate-700 text-sm">系统控制台</span>
            <div class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ml-1"
                 :class="{'bg-emerald-50 border-emerald-100 text-emerald-600': systemStatus === 'connected', 'bg-red-50 border-red-100 text-red-500': systemStatus === 'error', 'bg-blue-50 border-blue-100 text-blue-500': systemStatus === 'loading', 'bg-slate-100 border-slate-200 text-slate-400': systemStatus === 'disconnected'}">
              <div class="w-1.5 h-1.5 rounded-full"
                   :class="{'bg-emerald-500': systemStatus === 'connected', 'bg-red-500': systemStatus === 'error', 'bg-blue-500': systemStatus === 'loading', 'bg-slate-400': systemStatus === 'disconnected'}"></div>
              <span class="font-bold">{{
                  systemStatus === 'connected' ? 'ON' : (systemStatus === 'error' ? 'ERR' : (systemStatus === 'loading' ? '...' : 'OFF'))
                }}</span>
            </div>
            <button @click="fetchSystemState"
                    class="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-500 transition-colors">
              <RefreshCw :size="12" :class="{'animate-spin': systemStatus === 'loading'}"/>
            </button>
          </div>
          <button @click="isCollapsed = true" class="p-1 rounded-md text-slate-400 hover:bg-slate-200">
            <Minimize2 :size="16"/>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Smartphone :size="14" class="text-indigo-500"/>
                设备管理
              </div>
              <StatusIndicator :status="deviceCtrl.status"/>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm"
                 :class="{'!bg-indigo-50/30 !border-indigo-100': deviceCtrl.status === 'connected'}">
              <div v-if="deviceCtrl.status !== 'connected'" class="relative">
                <div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                  <Server :size="14"/>
                </div>
                <select v-model="selectedDeviceIndex" class="input-base pl-10 appearance-none cursor-pointer">
                  <option v-for="(dev, index) in availableDevices" :key="index" :value="index">{{ dev.name }}
                    ({{ dev.address }})
                  </option>
                  <option v-if="availableDevices.length === 0" disabled>无可用设备...</option>
                </select>
                <div class="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                  <ChevronDown :size="14"/>
                </div>
              </div>
              <div v-else
                   class="flex items-center justify-between bg-white border border-indigo-100 rounded-lg p-2 shadow-sm">
                <div class="flex flex-col overflow-hidden"><span
                    class="text-xs font-bold text-indigo-700 truncate">{{ currentDevice.name }}</span><span
                    class="text-[10px] font-mono text-slate-500 truncate">{{ currentDevice.address }}</span></div>
                <div class="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] rounded font-bold">LINKED</div>
              </div>

              <div class="flex gap-2">
                <button v-if="deviceCtrl.status !== 'connected'" @click="handleDeviceConnect"
                        :disabled="deviceCtrl.status === 'connecting' || availableDevices.length === 0"
                        class="btn-primary flex-1 bg-indigo-500 shadow-indigo-100">
                  <Power :size="14"/>
                  连接
                </button>
                <button v-else @click="handleDeviceDisconnect" class="btn-danger flex-1">
                  <Power :size="14"/>
                  断开
                </button>
                <button @click="showDeviceSettings = true" class="btn-icon">
                  <Settings :size="16"/>
                </button>
              </div>
            </div>
          </section>

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Database :size="14" class="text-emerald-500"/>
                资源配置
              </div>
              <StatusIndicator :status="resourceCtrl.status"/>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                    <FolderInput :size="14"/>
                  </div>
                  <select v-model="selectedProfileIndex" @change="handleProfileSwitch"
                          class="input-base pl-10 appearance-none cursor-pointer">
                    <option v-for="(prof, idx) in resourceProfiles" :key="idx" :value="idx">{{ prof.name }}</option>
                    <option v-if="resourceProfiles.length === 0" disabled>无配置...</option>
                  </select>
                  <div class="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                    <ChevronDown :size="14"/>
                  </div>
                </div>
                <button @click="showResourceSettings = true" class="btn-icon">
                  <Settings :size="16"/>
                </button>
              </div>
              <div class="flex gap-2">
                <button @click="handleResourceLoad" :disabled="resourceCtrl.status === 'connecting'"
                        class="flex-1 btn-primary bg-emerald-500 shadow-emerald-100">
                  <component :is="resourceCtrl.status === 'connecting' ? RefreshCw : HardDrive" :size="12"
                             :class="{'animate-spin': resourceCtrl.status === 'connecting'}"/>
                  <span>{{ resourceCtrl.status === 'connected' ? '重新加载' : '加载资源' }}</span>
                </button>
                <button @click="showCreateFileModal = true" :disabled="resourceProfiles.length === 0"
                        class="btn-icon px-3">
                  <FilePlus :size="16"/>
                </button>
              </div>
              <div v-if="resourceCtrl.status === 'connected'" class="animate-in fade-in slide-in-from-top-2">
                <div class="relative">
                  <div class="absolute left-3 top-2.5 text-emerald-600 pointer-events-none">
                    <FileText :size="14"/>
                  </div>
                  <select :value="selectedResourceFile" @change="handleFileSelectChange($event.target.value)"
                          class="input-base pl-10 border-emerald-200 focus:ring-emerald-100 appearance-none cursor-pointer"
                          :class="{'!border-amber-300 !ring-amber-100': props.isDirty}">
                    <option v-for="file in availableFiles" :key="makeFileId(file.source, file.value)" :value="makeFileId(file.source, file.value)">{{
                        file.label
                      }}
                    </option>
                    <option v-if="availableFiles.length === 0" disabled>配置路径下无文件</option>
                  </select>
                  <div class="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                    <ChevronDown :size="14"/>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Bot :size="14" class="text-violet-500"/>
                Agent
              </div>
              <StatusIndicator :status="agentCtrl.status"/>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
              <div class="relative group">
                <div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                  <Link :size="14"/>
                </div>
                <input v-model="currentAgentSocket" type="text" placeholder="Socket ID..."
                       class="input-base pl-10 focus:border-violet-500 focus:ring-violet-100"
                       @keyup.enter="handleAgentConnect"/>
              </div>
              <button v-if="agentCtrl.status !== 'connected'" @click="handleAgentConnect"
                      :disabled="agentCtrl.status === 'connecting'"
                      class="w-full btn-primary bg-violet-500 shadow-violet-100">启动 Agent
              </button>
              <button v-else @click="agentCtrl.disconnect()" class="w-full btn-danger">停止 Agent</button>
            </div>
          </section>
        </div>

        <div
            class="shrink-0 px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center">
          <div class="flex gap-2 items-center">
            <span>{{ props.nodeCount }} Nodes</span>
            <span>{{ props.edgeCount }} Edges</span>
            <span v-if="props.isDirty" class="flex items-center gap-1 text-amber-600 font-medium">
               <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
               已修改
             </span>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="props.isDirty" @click="handleSaveNodes" :disabled="isSaving"
                    class="flex items-center gap-1 px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-[10px] font-bold transition-colors disabled:opacity-50">
              <component :is="isSaving ? Loader2 : Save" :size="10" :class="{'animate-spin': isSaving}"/>
              {{ isSaving ? '保存中...' : '保存' }}
            </button>
            <span class="font-mono font-bold text-slate-300">{{ zoomPercentage }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <DeviceSettingsModal :visible="showDeviceSettings" :devices="availableDevices" :currentIndex="selectedDeviceIndex"
                         @close="showDeviceSettings = false" @save="saveDeviceSettings"/>
    <ResourceSettingsModal :visible="showResourceSettings" :profiles="resourceProfiles"
                           :currentIndex="selectedProfileIndex" @close="showResourceSettings = false"
                           @save="saveResourceSettings"/>
    <CreateResourceModal :visible="showCreateFileModal" :paths="currentProfile.paths"
                         @close="showCreateFileModal = false" @create="handleCreateFile"/>
  </div>
</template>
