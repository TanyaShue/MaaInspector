<script setup lang="ts">
import {computed, ref, reactive, onMounted, onUnmounted, defineComponent, h, watch} from 'vue'
import {
  Database, Bot, Power, Settings, RefreshCw, CheckCircle2, XCircle, Loader2, HardDrive,
  Minimize2, Maximize2, Smartphone, Circle, ChevronDown,
  FilePlus, Save, Search
} from 'lucide-vue-next'
import {useVueFlow} from '@vue-flow/core'
import {deviceApi, resourceApi, agentApi, systemApi} from '../../services/api.ts'
import type { DeviceInfo, ResourceProfile, ResourceFileInfo } from '../../services/api.ts'
import type { FlowBusinessData, TemplateImage, SpacingKey } from '../../utils/flowTypes'
import type { EdgeType } from '../../utils/flowOptions'
import ResourceSettingsModal from './Modals/ResourceSettingsModal.vue'
import CreateResourceModal from './Modals/CreateResourceModal.vue'
import Dropdown from './Common/Dropdown.vue'
import type { DropdownOption } from './Common/Dropdown.vue'

// --- Props & Emits ---
const props = defineProps<{
  nodeCount?: number
  edgeCount?: number
  isDirty?: boolean
  currentFilename?: string
  edgeType?: EdgeType
  spacing?: SpacingKey
}>()

const emit = defineEmits<{
  (e: 'load-nodes', payload: { filename: string; source: string; nodes: Record<string, FlowBusinessData> }): void
  (e: 'load-images', payload: Record<string, TemplateImage[]>): void
  (e: 'save-nodes', payload: { source: string; filename: string }): void
  (e: 'device-connected', status: boolean): void
  (e: 'request-switch-file', payload: { filename: string; source: string }): void
  (e: 'update-canvas-config', payload: { edgeType?: EdgeType; spacing?: SpacingKey }): void
}>()

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
const showResourceSettings = ref(false)
const showCreateFileModal = ref(false)

// --- 全局数据源 ---
type EditableProfile = ResourceProfile & { paths: string[] }
const normalizeProfiles = (profiles?: ResourceProfile[]): EditableProfile[] =>
  (profiles || []).map(p => ({
    ...p,
    paths: Array.isArray((p as any).paths) ? [...(p as any).paths] : []
  }))

const resourceProfiles = ref<EditableProfile[]>([])
const currentAgentSocket = ref<string>('')
const systemStatus = ref<'connected' | 'loading' | 'error' | 'disconnected'>('disconnected')

// --- 设备搜索相关 ---
const deviceType = ref<'win32' | 'adb'>('adb')
const searchedDevices = ref<DeviceInfo[]>([])
const selectedDeviceIndex = ref<number>(-1)
const isSearchingDevices = ref(false)

// Win32 连接方法枚举
const win32ScreencapMethods = [
  { value: 0, label: 'Null' },
  { value: 1, label: 'GDI' },
  { value: 2, label: 'FramePool' },
  { value: 4, label: 'DXGI_DesktopDup' },
  { value: 8, label: 'DXGI_DesktopDup_Window' },
  { value: 16, label: 'PrintWindow' },
  { value: 32, label: 'ScreenDC' },
]

const win32InputMethods = [
  { value: 0, label: 'Null' },
  { value: 1, label: 'Seize' },
  { value: 2, label: 'SendMessage' },
  { value: 4, label: 'PostMessage' },
  { value: 8, label: 'LegacyEvent' },
  { value: 16, label: 'PostThreadMessage' },
  { value: 32, label: 'SendMessageWithCursorPos' },
  { value: 64, label: 'PostMessageWithCursorPos' },
]

// Win32 连接参数
const win32ScreencapMethod = ref(4) // DXGI_DesktopDup
const win32MouseMethod = ref(1) // Seize
const win32KeyboardMethod = ref(1) // Seize

// --- 设备截图相关 ---
const deviceScreenshot = ref<string>('')
let screenshotTimer: ReturnType<typeof setInterval> | null = null

// --- 选中状态 ---
const selectedProfileIndex = ref(0)
const selectedResourceFile = ref('')  // 存储唯一ID: source|filename
const availableFiles = ref<ResourceFileInfo[]>([])

// --- 工具函数：生成和解析唯一ID ---
const makeFileId = (source: string, filename: string) => `${source}|${filename}`
const parseFileId = (id: string) => {
  if (!id) return { source: '', filename: '' }
  const sepIndex = id.lastIndexOf('|')
  if (sepIndex === -1) return { source: '', filename: id }
  return { source: id.slice(0, sepIndex), filename: id.slice(sepIndex + 1) }
}
const getFileObjById = (id: string) => availableFiles.value.find((f: ResourceFileInfo) => makeFileId(f.source, f.value) === id)

// --- 保存状态 ---
const isSaving = ref(false)

// --- 控制器逻辑封装 ---
function useStatusModule(api: any, label: string) {
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'failed' | 'disconnecting'>('disconnected')
  const message = ref(`${label}未连接`)
  const info = ref<Record<string, unknown>>({})

  const connect = async (payload?: any) => {
    if (status.value === 'connecting') return
    status.value = 'connecting'
    message.value = '处理中...'
    try {
      const method = api.load ? api.load : api.connect
      const res = await method(payload)
      const ok = typeof (res as any)?.r === 'boolean'
        ? (res as any).r
        : ((res as any)?.success ?? true)
      const msg = (res as any)?.message || (ok ? '已就绪' : '加载失败')

      if (!ok) {
        status.value = 'failed'
        message.value = msg
        throw new Error(msg)
      }

      status.value = 'connected'
      message.value = msg
      if ((res as any).info) info.value = (res as any).info
      return res
    } catch (e: any) {
      status.value = 'failed'
      message.value = (e?.message ? '失败: ' + e.message : '失败: 未知错误')
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
const currentDevice = computed<DeviceInfo | null>(() => {
  if (selectedDeviceIndex.value >= 0 && selectedDeviceIndex.value < searchedDevices.value.length) {
    return searchedDevices.value[selectedDeviceIndex.value]
  }
  return null
})

const currentProfile = computed<EditableProfile>(() => resourceProfiles.value[selectedProfileIndex.value] || {name: 'None', paths: []})

// --- 下拉框选项 ---
const deviceOptions = computed<DropdownOption[]>(() => {
  return searchedDevices.value.map((dev, index) => ({
    label: (dev.name || dev.window_name || dev.address || `设备${index + 1}`) as string,
    value: index
  }))
})

const profileOptions = computed<DropdownOption[]>(() => {
  if (resourceProfiles.value.length === 0) {
    return [{ label: '无配置...', value: -1, disabled: true }]
  }
  return resourceProfiles.value.map((prof, idx) => ({
    label: prof.name || '未命名配置',
    value: idx
  }))
})

const fileOptions = computed<DropdownOption[]>(() => {
  if (availableFiles.value.length === 0) {
    return [{ label: '配置路径下无文件', value: '', disabled: true }]
  }
  return availableFiles.value.map((file) => ({
    label: file.label,
    value: makeFileId(file.source, file.value)
  }))
})

const win32ScreencapOptions = computed<DropdownOption[]>(() => {
  return win32ScreencapMethods.map(method => ({
    label: method.label,
    value: method.value
  }))
})

const win32MouseOptions = computed<DropdownOption[]>(() => {
  return win32InputMethods.map(method => ({
    label: method.label,
    value: method.value
  }))
})

const win32KeyboardOptions = computed<DropdownOption[]>(() => {
  return win32InputMethods.map(method => ({
    label: method.label,
    value: method.value
  }))
})

const fetchAndEmitNodes = async () => {
  if (!selectedResourceFile.value) return
  const fileObj = getFileObjById(selectedResourceFile.value)
  if (!fileObj) return

  try {
    resourceCtrl.message = '加载节点中...'
    const res = await resourceApi.getFileNodes<Record<string, FlowBusinessData>>(fileObj.source, fileObj.value)
    const nodes = res.nodes || {}

    emit('load-nodes', {filename: fileObj.value, source: fileObj.source, nodes: nodes})
    resourceCtrl.message = `已加载: ${Object.keys(nodes).length} 节点`

    try {
      const imgRes = await resourceApi.getTemplateImages(fileObj.source, fileObj.value)
      if (imgRes.results) emit('load-images', imgRes.results as Record<string, TemplateImage[]>)
    } catch (imgError) {
      console.warn("图片加载失败", imgError)
    }

  } catch (e: any) {
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
  } catch (e: any) {
    console.error('保存失败', e)
    alert('保存失败: ' + (e.message || '未知错误'))
    throw e
  } finally {
    isSaving.value = false
  }
}

const executeFileSwitch = async (filename: string, source?: string) => {
  const normSource = source ? source.replace(/\\/g, '/').toLowerCase() : ''
  let target = availableFiles.value.find((f: ResourceFileInfo) => {
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
const handleFileSelectChange = (newFileId: string) => {
  if (newFileId === selectedResourceFile.value) return
  const fileObj = getFileObjById(newFileId)
  if (!fileObj) return

  emit('request-switch-file', {
    filename: fileObj.value,
    source: fileObj.source
  })
}

// --- 设备截图逻辑 ---
const fetchDeviceScreenshot = async () => {
  if (deviceCtrl.status !== 'connected') return
  try {
    const res = await deviceApi.getScreenshot()
    // image 字段直接在响应对象上
    if (res.success && res.image) {
      deviceScreenshot.value = res.image
    }
  } catch (e) {
    console.warn('获取设备截图失败', e)
  }
}

const startScreenshotTimer = () => {
  stopScreenshotTimer()
  console.log('启动截图定时器')
  fetchDeviceScreenshot() // 立即获取一次
  screenshotTimer = setInterval(fetchDeviceScreenshot, 1000) // 每秒更新
  console.log('截图定时器 ID:', screenshotTimer)
}

const stopScreenshotTimer = () => {
  if (screenshotTimer) {
    clearInterval(screenshotTimer)
    screenshotTimer = null
  }
  deviceScreenshot.value = ''
}

// --- 设备搜索逻辑 ---
const handleSearchDevices = async () => {
  if (isSearchingDevices.value) return
  isSearchingDevices.value = true
  deviceCtrl.message = '搜索设备中...'
  
  try {
    const searchType = deviceType.value === 'win32' ? 'win32control' : 'adb'
    const res = await systemApi.searchDevices(searchType)
    const devices = (res.data?.devices ?? res.devices ?? []) as DeviceInfo[]
    
    searchedDevices.value = devices
    if (devices.length > 0) {
      selectedDeviceIndex.value = 0
      deviceCtrl.message = `找到 ${devices.length} 个设备`
    } else {
      selectedDeviceIndex.value = -1
      deviceCtrl.message = '未找到设备'
    }
  } catch (e: any) {
    console.error('搜索设备失败', e)
    deviceCtrl.message = '搜索失败: ' + (e?.message || '未知错误')
    searchedDevices.value = []
    selectedDeviceIndex.value = -1
  } finally {
    isSearchingDevices.value = false
  }
}

// --- 连接逻辑 ---
const handleDeviceConnect = async () => {
  const device = currentDevice.value
  if (!device) {
    alert('请先搜索并选择设备')
    return
  }

  if (deviceCtrl.status === 'connecting') return
  deviceCtrl.status = 'connecting'
  deviceCtrl.message = '连接中...'

  try {
    let res: any
    
    if (deviceType.value === 'win32') {
      // Win32 设备连接
      res = await deviceApi.connectWin32({
        hwnd: device.hwnd as number | string,
        screencap_method: win32ScreencapMethod.value,
        mouse_method: win32MouseMethod.value,
        keyboard_method: win32KeyboardMethod.value,
      })
    } else {
      // ADB 设备连接
      res = await deviceApi.connectAdb({
        adb_path: device.adb_path as string,
        address: device.address as string,
        config: device.config || {},
      })
    }

    const ok = res?.success ?? true
    const msg = res?.message || (ok ? '设备已连接' : '连接失败')

    if (!ok) {
      deviceCtrl.status = 'failed'
      deviceCtrl.message = msg
      emit('device-connected', false)
      setTimeout(() => {
        if (deviceCtrl.status === 'failed') deviceCtrl.status = 'disconnected'
      }, 3000)
      return
    }

    deviceCtrl.status = 'connected'
    deviceCtrl.message = msg
    if (res?.info) deviceCtrl.info = res.info
    emit('device-connected', true)
    
    // 启动截图定时器
    startScreenshotTimer()
  } catch (e: any) {
    deviceCtrl.status = 'failed'
    deviceCtrl.message = '连接失败: ' + (e?.message || '未知错误')
    emit('device-connected', false)
    setTimeout(() => {
      if (deviceCtrl.status === 'failed') deviceCtrl.status = 'disconnected'
    }, 3000)
  }
}

const handleResourceLoad = async () => {
  try {
    const res = await resourceCtrl.connect(currentProfile.value)
    const ok = (res as any)?.r ?? (res as any)?.success ?? true
    if (!ok) {
      resourceCtrl.message = (res as any)?.message || '资源加载失败'
      return
    }

    if ((res as any).list) {
      availableFiles.value = res.list
      let fileStillExists = selectedResourceFile.value ? getFileObjById(selectedResourceFile.value) : null

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
  } catch (e: any) {
    console.error("资源加载流程异常", e)
  }
}

const handleCreateFile = async ({path, filename}: { path: string; filename: string }) => {
  try {
    resourceCtrl.message = '创建文件中...'
    await resourceApi.createFile(path, filename)
    showCreateFileModal.value = false
    await handleResourceLoad()
    const simpleName = filename.endsWith('.json') ? filename : filename + '.json'
    const normalizedPath = path.replace(/\\/g, '/').toLowerCase()
    const newFileObj = availableFiles.value.find(f =>
      f.value === simpleName &&
      f.source.replace(/\\/g, '/').toLowerCase() === normalizedPath
    )
    if (newFileObj) {
      await executeFileSwitch(newFileObj.value, newFileObj.source)
      resourceCtrl.message = '新建成功并已加载'
    }
  } catch (e: any) {
    console.error(e)
    alert(`创建失败: ${e.message || '未知错误'}`)
    resourceCtrl.message = '创建失败'
  }
}

const handleProfileSwitch = () => handleResourceLoad()
const handleAgentConnect = () => agentCtrl.connect({socket_id: currentAgentSocket.value})

const deviceButtonLabel = computed(() => deviceCtrl.status === 'connected' ? '重新连接' : '连接设备')
const agentButtonLabel = computed(() => agentCtrl.status === 'connected' ? '重新连接 Agent' : '启动 Agent')

// 设备切换时重置连接状态
watch(selectedDeviceIndex, (nv, ov) => {
  if (nv === ov || isInit) return
  deviceCtrl.status = 'disconnected'
  deviceCtrl.message = '设备未连接'
  deviceCtrl.info = {}
  emit('device-connected', false)
  stopScreenshotTimer()
})

// 设备类型切换时清空搜索结果
watch(deviceType, () => {
  searchedDevices.value = []
  selectedDeviceIndex.value = -1
  deviceCtrl.status = 'disconnected'
  deviceCtrl.message = '设备未连接'
  deviceCtrl.info = {}
  emit('device-connected', false)
  stopScreenshotTimer()
})

// 监听设备连接状态变化
watch(() => deviceCtrl.status, (newStatus) => {
  if (newStatus !== 'connected') {
    stopScreenshotTimer()
  }
})


// --- 初始化 ---
let isInit = true

const fetchSystemState = async () => {
  systemStatus.value = 'loading'
  isInit = true
  try {
    const data = await systemApi.getInitialState()
    if (data.resource_profiles) resourceProfiles.value = normalizeProfiles(data.resource_profiles as ResourceProfile[])
    const state = data.current_state || {}
    if (state.resource_profile_index !== undefined && resourceProfiles.value[state.resource_profile_index]) selectedProfileIndex.value = state.resource_profile_index
    if (state.resource_file && state.resource_source) {
      selectedResourceFile.value = makeFileId(state.resource_source, state.resource_file)
    } else if (state.resource_file) {
      selectedResourceFile.value = state.resource_file
    }
    if (state.agent_socket_id) currentAgentSocket.value = state.agent_socket_id
    else if (data.agent_socket_id) currentAgentSocket.value = data.agent_socket_id

    if (state.edge_type || state.spacing) {
      emit('update-canvas-config', {
        edgeType: (state.edge_type as EdgeType) || 'smoothstep',
        spacing: (state.spacing as SpacingKey) || 'normal'
      })
    }

    // 加载最后连接成功的设备配置
    if (data.last_connected_device) {
      const lastDevice = data.last_connected_device
      const deviceTypeValue = lastDevice.type === 'win32' ? 'win32' : 'adb'
      
      // 设置设备类型
      deviceType.value = deviceTypeValue
      
      // 将最后连接的设备加入搜索结果
      searchedDevices.value = [lastDevice as DeviceInfo]
      selectedDeviceIndex.value = 0
      
      // 如果是 Win32 设备，恢复连接方法配置
      if (deviceTypeValue === 'win32') {
        if (lastDevice.screencap_method !== undefined) {
          win32ScreencapMethod.value = lastDevice.screencap_method
        }
        if (lastDevice.mouse_method !== undefined) {
          win32MouseMethod.value = lastDevice.mouse_method
        }
        if (lastDevice.keyboard_method !== undefined) {
          win32KeyboardMethod.value = lastDevice.keyboard_method
        }
      }
      
      deviceCtrl.message = '已加载上次连接的设备'
    }

    systemStatus.value = 'connected'
  } catch (e: any) {
    console.error("Init failed", e)
    systemStatus.value = 'error'
  } finally {
    setTimeout(() => {
      isInit = false
    }, 500)
  }
}

onMounted(() => fetchSystemState())

// 组件卸载时清理定时器
onUnmounted(() => {
  stopScreenshotTimer()
})

const saveAllConfig = async () => {
  if (isInit) return
  if (systemStatus.value !== 'connected') return
  try {
    const { source: currentSource, filename: currentFilename } = parseFileId(selectedResourceFile.value)
    const payload = {
      devices: [],
      resource_profiles: resourceProfiles.value,
      agent_socket_id: currentAgentSocket.value,
      current_state: {
        device_index: -1,
        resource_profile_index: selectedProfileIndex.value,
        resource_file: currentFilename,
        resource_source: currentSource,
        agent_socket_id: currentAgentSocket.value,
        edge_type: props.edgeType,
        spacing: props.spacing
      }
    }
    await systemApi.saveDeviceConfig(payload)
  } catch (e) {
    console.error("Auto save failed", e)
  }
}

watch([selectedProfileIndex, selectedResourceFile, currentAgentSocket], () => saveAllConfig(), {deep: false})
watch(() => [props.edgeType, props.spacing], () => saveAllConfig(), {deep: false})

const saveResourceSettings = (data: { profiles: EditableProfile[]; index?: number }) => {
  resourceProfiles.value = normalizeProfiles(data.profiles)
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
              deviceCtrl.status === 'connected' ? (currentDevice?.name || '设备') : '无设备'
            }}</span>
        </div>
        <div class="w-px h-4 bg-slate-200"></div>
        <div class="flex items-center gap-1.5 min-w-0">
          <StatusIndicator :status="resourceCtrl.status" :size="12"/>
          <div class="flex items-center gap-1 min-w-0">
            <div v-if="props.isDirty" class="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" title="文件已修改"></div>
            <div class="min-w-[120px] max-w-[160px]">
              <Dropdown
                :model-value="selectedResourceFile"
                @update:model-value="handleFileSelectChange"
                :options="fileOptions"
                :disabled="resourceCtrl.status !== 'connected' || availableFiles.length === 0"
                placeholder="未加载资源"
                size="xs"
              />
            </div>
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
          <!-- 设备管理 -->
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
              
              <!-- 设备类型选择 -->
              <div class="space-y-1.5">
                <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">设备类型</label>
                <div class="grid grid-cols-2 gap-2">
                  <button 
                    @click="deviceType = 'adb'"
                    class="py-2 px-3 text-xs font-bold rounded-lg border-2 transition-all"
                    :class="deviceType === 'adb' 
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'">
                    ADB 设备
                  </button>
                  <button 
                    @click="deviceType = 'win32'"
                    class="py-2 px-3 text-xs font-bold rounded-lg border-2 transition-all"
                    :class="deviceType === 'win32' 
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'">
                    Win32 窗口
                  </button>
                </div>
              </div>

              <!-- 搜索按钮 -->
              <button @click="handleSearchDevices" :disabled="isSearchingDevices"
                      class="w-full btn-primary bg-indigo-500 shadow-indigo-100 flex items-center justify-center gap-2">
                <component :is="isSearchingDevices ? Loader2 : Search" :size="14"
                           :class="{'animate-spin': isSearchingDevices}"/>
                {{ isSearchingDevices ? '搜索中...' : '搜索设备' }}
              </button>

              <!-- 设备列表 -->
              <div v-if="searchedDevices.length > 0" class="space-y-2">
                <Dropdown
                  v-model="selectedDeviceIndex"
                  :options="deviceOptions"
                  :disabled="deviceCtrl.status === 'connecting'"
                  placeholder="选择设备"
                />

                <!-- 设备信息展示 -->
                <div v-if="currentDevice"
                    class="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 shadow-sm"
                    :class="{'!bg-indigo-50/40 !border-indigo-100': deviceCtrl.status === 'connected'}">
                  <div class="flex flex-col overflow-hidden">
                    <span class="text-xs font-bold text-indigo-700 truncate">
                      {{ currentDevice.name || currentDevice.window_name || '未命名设备' }}
                    </span>
                    <span class="text-[10px] font-mono text-slate-500 truncate">
                      <template v-if="deviceType === 'win32'">
                        HWND: {{ currentDevice.hwnd || 'N/A' }}
                      </template>
                      <template v-else>
                        {{ currentDevice.address || 'N/A' }}
                      </template>
                    </span>
                  </div>
                  <div class="px-2 py-0.5 rounded text-[10px] font-bold"
                       :class="deviceCtrl.status === 'connected' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'">
                    {{ deviceCtrl.status === 'connected' ? '已连接' : '未连接' }}
                  </div>
                </div>

                <!-- Win32 额外参数 -->
                <div v-if="deviceType === 'win32'" class="space-y-2 pt-2 border-t border-slate-200">
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">截图方法</label>
                    <Dropdown
                      v-model="win32ScreencapMethod"
                      :options="win32ScreencapOptions"
                      size="sm"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">鼠标输入方法</label>
                    <Dropdown
                      v-model="win32MouseMethod"
                      :options="win32MouseOptions"
                      size="sm"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1">键盘输入方法</label>
                    <Dropdown
                      v-model="win32KeyboardMethod"
                      :options="win32KeyboardOptions"
                      size="sm"
                    />
                  </div>
                </div>

                <!-- 连接按钮 -->
                <button @click="handleDeviceConnect"
                        :disabled="deviceCtrl.status === 'connecting' || !currentDevice"
                        class="w-full btn-primary bg-indigo-500 shadow-indigo-100">
                  <component :is="deviceCtrl.status === 'connecting' ? Loader2 : Power" :size="14"
                             :class="{'animate-spin': deviceCtrl.status === 'connecting'}"/>
                  {{ deviceButtonLabel }}
                </button>

                <!-- 设备截图预览 -->
                <div v-if="deviceCtrl.status === 'connected' && deviceScreenshot" 
                     class="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <div class="text-[10px] font-bold text-slate-500 px-2 py-1 bg-slate-50 border-b border-slate-200">
                    实时预览
                  </div>
                  <div class="relative aspect-video bg-slate-900">
                    <img 
                      :src="deviceScreenshot" 
                      alt="设备截图" 
                      class="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
              
              <div v-else-if="!isSearchingDevices" class="text-xs text-slate-400 text-center py-2">
                点击"搜索设备"查找可用设备
              </div>
            </div>
          </section>

          <!-- 资源配置 -->
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
                <Dropdown
                  v-model="selectedProfileIndex"
                  @update:model-value="handleProfileSwitch"
                  :options="profileOptions"
                  placeholder="选择资源配置"
                  class="flex-1"
                />
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
                <Dropdown
                  :model-value="selectedResourceFile"
                  @update:model-value="handleFileSelectChange"
                  :options="fileOptions"
                  placeholder="选择文件"
                />
              </div>
            </div>
          </section>

          <!-- Agent -->
          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Bot :size="14" class="text-violet-500"/>
                Agent
              </div>
              <StatusIndicator :status="agentCtrl.status"/>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
              <input v-model="currentAgentSocket" type="text" placeholder="Socket ID..."
                     class="input-base focus:border-violet-500 focus:ring-violet-100 w-full"
                     @keyup.enter="handleAgentConnect"/>
              <button @click="handleAgentConnect"
                      :disabled="agentCtrl.status === 'connecting'"
                      class="w-full btn-primary bg-violet-500 shadow-violet-100">
                <component :is="agentCtrl.status === 'connecting' ? Loader2 : Bot" :size="14"
                           :class="{'animate-spin': agentCtrl.status === 'connecting'}"/>
                {{ agentButtonLabel }}
              </button>
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

    <ResourceSettingsModal :visible="showResourceSettings" :profiles="resourceProfiles"
                           :currentIndex="selectedProfileIndex" @close="showResourceSettings = false"
                           @save="saveResourceSettings"/>
    <CreateResourceModal :visible="showCreateFileModal" :paths="currentProfile.paths"
                         @close="showCreateFileModal = false" @create="handleCreateFile"/>
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
