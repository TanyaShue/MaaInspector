<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Radar, Loader2, Edit3, X, Save, PlusCircle } from 'lucide-vue-next'
import { systemApi } from '../../../services/api'
import type { ApiResponse, DeviceInfo } from '../../../services/api'

type DeviceType = 'adb' | 'win32control' | string

type EditableDevice = DeviceInfo & {
  address?: string
  config?: Record<string, unknown>
  type?: DeviceType
  hwnd?: number | string
  class_name?: string
  window_name?: string
  adb_path?: string
  screencap_methods?: number
  input_methods?: number
  /**
   * saved: 来自已保存配置
   * discovered: 搜索发现，尚未保存
   * manual: 手动添加，尚未保存
   */
  source?: 'saved' | 'discovered' | 'manual'
}

interface DeviceSettingsProps {
  visible: boolean
  devices: EditableDevice[]
  currentIndex: number
}

const props = withDefaults(defineProps<DeviceSettingsProps>(), {
  visible: false,
  devices: () => [],
  currentIndex: 0
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { devices: EditableDevice[]; index: number }): void
}>()

const editingDevices = ref<EditableDevice[]>([])
const discoveredDevices = ref<EditableDevice[]>([])
const editDevIndex = ref<number>(0)
const searchingType = ref<DeviceType | ''>('')

const typeOptions: { value: DeviceType; label: string }[] = [
  { value: 'adb', label: 'ADB 设备' },
  { value: 'win32control', label: 'Win32 控件' }
]

const cloneDevices = (devices: EditableDevice[]): EditableDevice[] =>
  JSON.parse(JSON.stringify(devices || [])) as EditableDevice[]

const normalizeDevices = (devices: EditableDevice[], fallbackSource: EditableDevice['source'] = 'saved'): EditableDevice[] =>
  devices.map((dev) => {
    const address = typeof (dev as any).address === 'string' ? (dev as any).address : ''
    const config = typeof (dev as any).config === 'object' && (dev as any).config !== null ? (dev as any).config as Record<string, unknown> : {}
    const type = (dev as any).type || 'adb'
    const hwnd = (dev as any).hwnd
    const class_name = typeof (dev as any).class_name === 'string' ? (dev as any).class_name : ''
    const window_name = typeof (dev as any).window_name === 'string' ? (dev as any).window_name : ''
    return {
      ...dev,
      name: dev.name ?? 'New Device',
      address,
      config,
      type,
      hwnd,
      class_name,
      window_name,
      source: dev.source ?? fallbackSource
    }
  })

watch(() => props.visible, (val: boolean) => {
  if (val) {
    editingDevices.value = normalizeDevices(cloneDevices(props.devices))
    editDevIndex.value = props.currentIndex || 0
    discoveredDevices.value = []
  }
})

const isSameDevice = (a?: EditableDevice, b?: EditableDevice) => {
  if (!a || !b) return false
  const typeA = a.type || 'adb'
  const typeB = b.type || 'adb'
  if (typeA !== typeB) return false
  if (typeA === 'win32control') {
    return (a.hwnd ?? '') === (b.hwnd ?? '') &&
      (a.class_name || '') === (b.class_name || '') &&
      (a.window_name || '') === (b.window_name || '')
  }
  return (a.address || '') === (b.address || '')
}

const handleSearch = async (type: DeviceType) => {
  if (searchingType.value) return
  searchingType.value = type
  try {
    const res = await systemApi.searchDevices(type) as ApiResponse<{ devices?: DeviceInfo[] }> & { devices?: DeviceInfo[] }
    const found = (res.data?.devices ?? res.devices ?? []) as DeviceInfo[]
    if (found.length) {
      let added = 0
      found.forEach((d) => {
        const address = typeof (d as any).address === 'string' ? (d as any).address : ''
        const config = typeof (d as any).config === 'object' && (d as any).config !== null ? (d as any).config as Record<string, unknown> : {}
        const devType = (d as any).type || type || 'adb'
        const hwnd = (d as any).hwnd
        const class_name = (d as any).class_name
        const window_name = (d as any).window_name
        const candidate: EditableDevice = { ...d, address, config, type: devType, hwnd, class_name, window_name, source: 'discovered' }
        const existsSaved = editingDevices.value.find((ed) => isSameDevice(ed, candidate))
        const existsFound = discoveredDevices.value.find((ed) => isSameDevice(ed, candidate))
        if (!existsSaved && !existsFound) {
          discoveredDevices.value.push(candidate)
          added++
        }
      })
    }
  } catch (e: unknown) {
    const err = e as { message?: string }
    alert(err?.message || '搜索设备失败')
  } finally {
    searchingType.value = ''
  }
}

const handleAddDevice = () => {
  editingDevices.value.push({ name: 'New Device', address: '', config: {}, type: 'adb', source: 'manual' })
  editDevIndex.value = editingDevices.value.length - 1
}

const handleAddDiscovered = (idx: number) => {
  const dev = discoveredDevices.value[idx]
  if (!dev) return
  discoveredDevices.value.splice(idx, 1)
  const savedDev = { ...dev, source: 'saved' as const }
  editingDevices.value.push(savedDev)
  editDevIndex.value = editingDevices.value.length - 1
}

const handleConfigInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement | null
  const current = editingDevices.value[editDevIndex.value]
  if (!target || !current) return
  try {
    current.config = JSON.parse(target.value || '{}')
  } catch {
    // ignore invalid JSON while typing
  }
}

const handleRemoveDevice = () => {
  editingDevices.value.splice(editDevIndex.value, 1)
  editDevIndex.value = Math.max(0, editingDevices.value.length - 1)
}

const save = () => {
  const sanitized = editingDevices.value.map(({ source, ...rest }) => rest)
  emit('save', { devices: sanitized, index: editDevIndex.value })
}

const configPlaceholder = computed(() => {
  const current = editingDevices.value[editDevIndex.value]
  if (current?.type === 'win32control') {
    return '{ "config": "win32 暂无需配置" }'
  }
  return '{ "serial": "host:port" }'
})
</script>

<template>
  <div v-if="visible"
       class="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-white rounded-xl shadow-2xl border border-slate-200 flex overflow-hidden w-[900px] h-[560px]">
      <div class="w-[200px] bg-slate-50 border-r border-slate-100 flex flex-col">
        <div class="p-3 text-xs font-bold text-slate-500 border-b border-slate-100 flex items-center justify-between">
          <span>已保存</span>
          <span class="text-[10px] text-slate-400">{{ editingDevices.length }}</span>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div v-for="(dev, idx) in editingDevices" :key="idx" @click="editDevIndex = idx"
               class="px-3 py-2 rounded-lg cursor-pointer text-xs border transition-all space-y-0.5"
               :class="editDevIndex === idx ? 'bg-white border-slate-200 shadow-sm text-indigo-600 font-bold' : 'border-transparent text-slate-600 hover:bg-slate-100'">
            <div class="flex items-center justify-between gap-1">
              <span class="truncate">{{ dev.name }}</span>
              <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="dev.type === 'win32control' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'">
                {{ dev.type === 'win32control' ? 'Win32' : 'ADB' }}
              </span>
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-400 gap-1">
              <span class="truncate">
                <template v-if="dev.type === 'win32control'">
                  {{ dev.window_name || '未填写窗口名' }} ({{ dev.hwnd || 'hwnd?' }})
                </template>
                <template v-else>
                  {{ dev.address || '未填写地址' }}
                </template>
              </span>
              <span :class="dev.source === 'saved' ? 'text-emerald-600' : 'text-amber-600'">
                {{ dev.source === 'saved' ? '已保存' : '未保存' }}
              </span>
            </div>
          </div>
        </div>
        <div class="p-2 border-t border-slate-100 flex flex-col gap-2">
          <button @click="handleAddDevice"
                  class="border border-dashed border-slate-300 rounded-lg py-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white transition-colors flex items-center justify-center gap-1">
            <Plus :size="12"/>
            手动添加
          </button>
          <div class="grid grid-cols-2 gap-2">
            <button @click="handleSearch('adb')" :disabled="searchingType === 'adb'"
                    class="bg-indigo-100 text-indigo-600 rounded-lg py-1.5 text-[11px] font-bold hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-60">
              <component :is="searchingType === 'adb' ? Loader2 : Radar" :size="12" :class="{'animate-spin': searchingType === 'adb'}"/>
              {{ searchingType === 'adb' ? 'ADB 扫描中...' : '搜索 ADB' }}
            </button>
            <button @click="handleSearch('win32control')" :disabled="searchingType === 'win32control'"
                    class="bg-amber-100 text-amber-700 rounded-lg py-1.5 text-[11px] font-bold hover:bg-amber-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-60">
              <component :is="searchingType === 'win32control' ? Loader2 : Radar" :size="12" :class="{'animate-spin': searchingType === 'win32control'}"/>
              {{ searchingType === 'win32control' ? 'Win32 扫描中...' : '搜索 Win32' }}
            </button>
          </div>
        </div>
      </div>
      <div class="flex-1 flex flex-col bg-white">
        <div class="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 class="font-bold text-slate-700 flex items-center gap-2">
            <Edit3 :size="16"/>
            编辑设备
          </h3>
          <button @click="$emit('close')" class="text-slate-400 hover:text-red-500 transition-colors">
            <X :size="20"/>
          </button>
        </div>
        <div class="flex-1 overflow-hidden flex flex-col">
          <div class="p-4 border-b border-slate-100 bg-slate-50/60">
            <div class="flex items-center justify-between mb-2">
              <div class="text-[11px] font-bold text-slate-600">发现设备（未保存）</div>
              <div class="text-[10px] text-slate-400">点击添加到配置</div>
            </div>
            <div v-if="discoveredDevices.length" class="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
              <div v-for="(dev, idx) in discoveredDevices" :key="idx"
                   class="border border-dashed border-slate-200 bg-white rounded-lg p-2 text-[11px] flex flex-col gap-1">
                <div class="flex items-center justify-between gap-1">
                  <span class="font-semibold text-slate-700 truncate">{{ dev.name }}</span>
                  <span class="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                        :class="dev.type === 'win32control' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'">
                    {{ dev.type === 'win32control' ? 'Win32' : 'ADB' }}
                  </span>
                </div>
                <div class="text-[10px] text-slate-500 truncate">
                  <template v-if="dev.type === 'win32control'">
                    {{ dev.window_name || '窗口' }} ({{ dev.hwnd || 'hwnd?' }})
                  </template>
                  <template v-else>
                    {{ dev.address || '地址未知' }}
                  </template>
                </div>
                <button @click="handleAddDiscovered(idx)"
                        class="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700">
                  <PlusCircle :size="12"/> 加入配置
                </button>
              </div>
            </div>
            <div v-else class="text-[11px] text-slate-400">暂无发现设备，点击左侧搜索。</div>
          </div>

          <div v-if="editingDevices[editDevIndex]" class="flex-1 p-5 overflow-y-auto space-y-4">
          <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Name</label><input
              v-model="editingDevices[editDevIndex].name"
              class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"/>
          </div>
          <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Type</label>
            <select v-model="editingDevices[editDevIndex].type"
                    class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50">
              <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <template v-if="editingDevices[editDevIndex].type === 'win32control'">
            <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">HWND</label><input
                v-model="editingDevices[editDevIndex].hwnd"
                class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 font-mono"/>
            </div>
            <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Class Name</label><input
                v-model="editingDevices[editDevIndex].class_name"
                class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"/>
            </div>
            <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Window Name</label><input
                v-model="editingDevices[editDevIndex].window_name"
                class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"/>
            </div>
          </template>
          <template v-else>
            <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Address</label><input
                v-model="editingDevices[editDevIndex].address"
                class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 font-mono"/>
            </div>
            <div class="space-y-1 flex-1 flex flex-col"><label class="text-[10px] font-bold text-slate-400 uppercase">Config</label><textarea
                :value="JSON.stringify(editingDevices[editDevIndex].config, null, 2)"
                @input="handleConfigInput"
                :placeholder="configPlaceholder"
                class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-200 resize-none flex-1"></textarea>
            </div>
          </template>
          <button @click="handleRemoveDevice"
                  class="text-xs text-red-500 hover:underline">删除设备
          </button>
        </div>
          <div v-else class="flex-1 flex items-center justify-center text-xs text-slate-400">
            暂无已保存设备，左侧手动添加或从发现列表加入。
          </div>
        </div>
        <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button @click="$emit('close')"
                  class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-colors">取消
          </button>
          <button @click="save"
                  class="px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1">
            <Save :size="14"/>
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
