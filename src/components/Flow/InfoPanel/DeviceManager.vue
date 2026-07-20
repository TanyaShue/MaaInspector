<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  Smartphone, Power, Search, Loader2
} from 'lucide-vue-next'
import { deviceApi, systemApi } from '@/services/api'
import { ElMessage } from 'element-plus'
import { useAppConfigStore } from '@/stores/appConfig'
import Dropdown from '@/components/Flow/Common/Dropdown.vue'
import StatusIndicator from '@/components/Flow/Common/StatusIndicator.vue'
import type { DropdownOption } from '@/components/Flow/Common/types'
import type { ApiDeviceInfo, ApiResponse } from '@/services/api'
import type { DevicePanelSnapshot } from '@/composables/viewModels/types'

const props = defineProps<{
  active: boolean
  isConnected: boolean
  snapshot?: DevicePanelSnapshot
}>()
const appConfig = useAppConfigStore()

const emit = defineEmits<{
  'device-connected': [status: boolean]
  'status-change': [snapshot: DevicePanelSnapshot]
}>()

type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'failed' | 'disconnecting'

// 设备类型
const deviceType = ref<'win32' | 'adb'>(props.snapshot?.deviceType ?? 'adb')

// 设备搜索相关
const searchedDevices = ref<ApiDeviceInfo[]>([...(props.snapshot?.searchedDevices ?? [])])
const selectedDeviceIndex = ref<number>(props.snapshot?.selectedDeviceIndex ?? -1)
const isSearchingDevices = ref(false)

// 连接状态
const status = ref<DeviceStatus>(props.snapshot?.status ?? 'disconnected')
const message = ref(props.snapshot?.message ?? '设备未连接')
const info = ref<Record<string, unknown>>(props.snapshot?.info ?? {})

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
const win32ScreencapMethod = ref(props.snapshot?.win32ScreencapMethod ?? 4)
const win32MouseMethod = ref(props.snapshot?.win32MouseMethod ?? 1)
const win32KeyboardMethod = ref(props.snapshot?.win32KeyboardMethod ?? 1)

// 设备截图相关
const deviceScreenshot = ref<string>('')
let screenshotTimer: ReturnType<typeof setTimeout> | null = null
let screenshotRequestPending = false
let screenshotGeneration = 0

// 当前设备
const currentDevice = computed<ApiDeviceInfo | null>(() => {
  if (selectedDeviceIndex.value >= 0 && selectedDeviceIndex.value < searchedDevices.value.length) {
    return searchedDevices.value[selectedDeviceIndex.value]
  }
  return null
})

// 下拉框选项
const deviceOptions = computed<DropdownOption[]>(() => {
  return searchedDevices.value.map((dev, index) => ({
    label: (dev.name || dev.window_name || dev.address || `设备${index + 1}`) as string,
    value: index
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

// 设备按钮标签
const deviceButtonLabel = computed(() => status.value === 'connected' ? '重新连接' : '连接设备')

// 截图逻辑
const fetchDeviceScreenshot = async () => {
  if (!props.active || status.value !== 'connected' || screenshotRequestPending) return
  screenshotRequestPending = true
  try {
    const res = await deviceApi.getScreenshot()
    if (res.success && res.image) {
      deviceScreenshot.value = res.image
    }
  } catch (e) {
    console.warn('获取设备截图失败', e)
  } finally {
    screenshotRequestPending = false
  }
}

const startScreenshotTimer = () => {
  stopScreenshotTimer()
  if (!props.active || status.value !== 'connected') return
  const generation = screenshotGeneration
  const poll = async () => {
    await fetchDeviceScreenshot()
    if (
      generation !== screenshotGeneration ||
      !props.active ||
      status.value !== 'connected'
    ) return
    screenshotTimer = setTimeout(() => void poll(), 1000)
  }
  void poll()
}

const stopScreenshotTimer = () => {
  screenshotGeneration++
  if (screenshotTimer) {
    clearTimeout(screenshotTimer)
    screenshotTimer = null
  }
  deviceScreenshot.value = ''
}

// 搜索设备
const handleSearchDevices = async () => {
  if (isSearchingDevices.value) return
  isSearchingDevices.value = true
  message.value = '搜索设备中...'

  try {
    const searchType = deviceType.value === 'win32' ? 'win32control' : 'adb'
    const res = await systemApi.searchDevices(searchType)
    const devices = (res.data?.devices ?? res.devices ?? []) as ApiDeviceInfo[]

    searchedDevices.value = devices
    if (devices.length > 0) {
      selectedDeviceIndex.value = 0
      message.value = `找到 ${devices.length} 个设备`
    } else {
      selectedDeviceIndex.value = -1
      message.value = '未找到设备'
    }
  } catch (e: unknown) {
    console.error('搜索设备失败', e)
    message.value = '搜索失败: ' + (e instanceof Error ? e.message : '未知错误')
    searchedDevices.value = []
    selectedDeviceIndex.value = -1
  } finally {
    isSearchingDevices.value = false
  }
}

// 连接设备
const handleDeviceConnect = async (): Promise<boolean> => {
  const device = currentDevice.value
  if (!device) {
    ElMessage.error('请先搜索并选择设备')
    return false
  }

  if (status.value === 'connecting') return false
  status.value = 'connecting'
  message.value = '连接中...'

  try {
    let res: ApiResponse

    if (deviceType.value === 'win32') {
      res = await deviceApi.connectWin32({
        hwnd: device.hwnd as number | string,
        screencap_method: win32ScreencapMethod.value,
        mouse_method: win32MouseMethod.value,
        keyboard_method: win32KeyboardMethod.value,
      })
    } else {
      res = await deviceApi.connectAdb({
        adb_path: device.adb_path as string,
        address: device.address as string,
        config: device.config || {},
      })
    }

    const ok = res?.success ?? true
    const msg = res?.message || (ok ? '设备已连接' : '连接失败')

    if (!ok) {
      status.value = 'failed'
      message.value = msg
      emit('device-connected', false)
      return false
    }

    status.value = 'connected'
    message.value = msg
    if (res?.info) info.value = res.info
    emit('device-connected', true)

    appConfig.rememberDevice({
      ...device,
      type: deviceType.value,
      screencap_method: win32ScreencapMethod.value,
      mouse_method: win32MouseMethod.value,
      keyboard_method: win32KeyboardMethod.value
    })

    startScreenshotTimer()
    return true
  } catch (e: unknown) {
    status.value = 'failed'
    message.value = '连接失败: ' + (e instanceof Error ? e.message : '未知错误')
    emit('device-connected', false)
    return false
  }
}

// 暴露方法供父组件调用
const loadLastDevice = (lastDevice: ApiDeviceInfo) => {
  const deviceTypeValue = lastDevice.type === 'win32' ? 'win32' : 'adb'
  deviceType.value = deviceTypeValue
  searchedDevices.value = [lastDevice]
  selectedDeviceIndex.value = 0

  if (deviceTypeValue === 'win32') {
    if (lastDevice.screencap_method !== undefined) win32ScreencapMethod.value = lastDevice.screencap_method
    if (lastDevice.mouse_method !== undefined) win32MouseMethod.value = lastDevice.mouse_method
    if (lastDevice.keyboard_method !== undefined) win32KeyboardMethod.value = lastDevice.keyboard_method
  }

  message.value = '已加载上次连接的设备'
}

const autoRestoreDevice = async (lastDevice: ApiDeviceInfo, maxAttempts = 5): Promise<boolean> => {
  loadLastDevice(lastDevice)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    message.value = attempt === 1 ? '正在自动连接上次设备...' : `正在重试连接设备 (${attempt}/${maxAttempts})...`
    if (await handleDeviceConnect()) return true
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 600))
  }
  message.value = `自动连接失败，已尝试 ${maxAttempts} 次`
  return false
}

defineExpose({ loadLastDevice, autoRestoreDevice, status, message, info, currentDevice })

// 设备切换时重置连接状态
watch(selectedDeviceIndex, (nv, ov) => {
  if (nv === ov) return
  status.value = 'disconnected'
  message.value = '设备未连接'
  info.value = {}
  emit('device-connected', false)
  stopScreenshotTimer()
})

// 设备类型切换时清空搜索结果
watch(deviceType, () => {
  searchedDevices.value = []
  selectedDeviceIndex.value = -1
  status.value = 'disconnected'
  message.value = '设备未连接'
  info.value = {}
  emit('device-connected', false)
  stopScreenshotTimer()
})

// 监听设备连接状态变化
watch(
  [() => props.active, status],
  ([active, currentStatus]) => {
    if (active && currentStatus === 'connected') startScreenshotTimer()
    else stopScreenshotTimer()
  },
  { immediate: true }
)

watch([
  status,
  message,
  deviceType,
  searchedDevices,
  selectedDeviceIndex,
  info,
  win32ScreencapMethod,
  win32MouseMethod,
  win32KeyboardMethod
], () => {
  emit('status-change', {
    status: status.value,
    message: message.value,
    deviceType: deviceType.value,
    searchedDevices: searchedDevices.value,
    selectedDeviceIndex: selectedDeviceIndex.value,
    info: info.value,
    win32ScreencapMethod: win32ScreencapMethod.value,
    win32MouseMethod: win32MouseMethod.value,
    win32KeyboardMethod: win32KeyboardMethod.value
  })
}, { immediate: true })

onUnmounted(() => {
  stopScreenshotTimer()
})
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between text-xs mb-1">
      <div class="flex items-center gap-1.5 font-bold text-slate-700">
        <Smartphone
          :size="14"
          class="text-indigo-500"
        />
        设备管理
      </div>
      <StatusIndicator :status="status" />
    </div>
    <div
      class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm"
      :class="{'!bg-indigo-50/30 !border-indigo-100': status === 'connected'}"
    >
      <!-- 设备类型选择 -->
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">设备类型</label>
        <div class="grid grid-cols-2 gap-2">
          <button 
            class="py-2 px-3 text-xs font-bold rounded-lg border-2 transition-all"
            :class="deviceType === 'adb' 
              ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
            @click="deviceType = 'adb'"
          >
            ADB 设备
          </button>
          <button 
            class="py-2 px-3 text-xs font-bold rounded-lg border-2 transition-all"
            :class="deviceType === 'win32' 
              ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'"
            @click="deviceType = 'win32'"
          >
            Win32 窗口
          </button>
        </div>
      </div>

      <!-- 搜索按钮 -->
      <button
        :disabled="isSearchingDevices"
        class="w-full btn-primary bg-indigo-500 shadow-indigo-100 flex items-center justify-center gap-2"
        @click="handleSearchDevices"
      >
        <component
          :is="isSearchingDevices ? Loader2 : Search"
          :size="14"
          :class="{'animate-spin': isSearchingDevices}"
        />
        {{ isSearchingDevices ? '搜索中...' : '搜索设备' }}
      </button>

      <!-- 设备列表 -->
      <div
        v-if="searchedDevices.length > 0"
        class="space-y-2"
      >
        <Dropdown
          v-model="selectedDeviceIndex"
          :options="deviceOptions"
          :disabled="status === 'connecting'"
          placeholder="选择设备"
        />

        <!-- 设备信息展示 -->
        <div
          v-if="currentDevice"
          class="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 shadow-sm"
          :class="{'!bg-indigo-50/40 !border-indigo-100': status === 'connected'}"
        >
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
          <div
            class="px-2 py-0.5 rounded text-[10px] font-bold"
            :class="status === 'connected' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'"
          >
            {{ status === 'connected' ? '已连接' : '未连接' }}
          </div>
        </div>

        <!-- Win32 额外参数 -->
        <div
          v-if="deviceType === 'win32'"
          class="space-y-2 pt-2 border-t border-slate-200"
        >
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
        <button
          :disabled="status === 'connecting' || !currentDevice"
          class="w-full btn-primary bg-indigo-500 shadow-indigo-100"
          @click="handleDeviceConnect"
        >
          <component
            :is="status === 'connecting' ? Loader2 : Power"
            :size="14"
            :class="{'animate-spin': status === 'connecting'}"
          />
          {{ deviceButtonLabel }}
        </button>

        <!-- 设备截图预览 -->
        <div
          v-if="status === 'connected' && deviceScreenshot" 
          class="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
        >
          <div class="text-[10px] font-bold text-slate-500 px-2 py-1 bg-slate-50 border-b border-slate-200">
            实时预览
          </div>
          <div class="relative aspect-video bg-slate-900">
            <img 
              :src="deviceScreenshot" 
              alt="设备截图" 
              class="w-full h-full object-contain"
            >
          </div>
        </div>
      </div>
      
      <div
        v-else-if="!isSearchingDevices"
        class="text-xs text-slate-400 text-center py-2"
      >
        点击"搜索设备"查找可用设备
      </div>
    </div>
  </section>
</template>

<style scoped>
.btn-primary {
  @apply flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
