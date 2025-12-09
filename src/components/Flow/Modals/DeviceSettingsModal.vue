<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Radar, Loader2, Edit3, X, Save } from 'lucide-vue-next'
import { systemApi } from '../../../services/api'
import type { ApiResponse, DeviceInfo } from '../../../services/api'

type EditableDevice = DeviceInfo & {
  address?: string
  config?: Record<string, unknown>
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
const editDevIndex = ref<number>(0)
const isSearching = ref<boolean>(false)

const cloneDevices = (devices: EditableDevice[]): EditableDevice[] =>
  JSON.parse(JSON.stringify(devices || [])) as EditableDevice[]

const normalizeDevices = (devices: EditableDevice[]): EditableDevice[] =>
  devices.map((dev) => ({
    name: dev.name ?? 'New Device',
    address: dev.address ?? '',
    config: dev.config ?? {},
    ...dev
  }))

watch(() => props.visible, (val: boolean) => {
  if (val) {
    editingDevices.value = normalizeDevices(cloneDevices(props.devices))
    editDevIndex.value = props.currentIndex || 0
  }
})

const handleSearch = async () => {
  isSearching.value = true
  try {
    const res = await systemApi.searchDevices() as ApiResponse<{ devices?: DeviceInfo[] }> & { devices?: DeviceInfo[] }
    const found = (res.data?.devices ?? res.devices ?? []) as DeviceInfo[]
    if (found.length) {
      let added = 0
      found.forEach((d) => {
        const address = typeof (d as any).address === 'string' ? (d as any).address : ''
        const config = typeof (d as any).config === 'object' && (d as any).config !== null ? (d as any).config as Record<string, unknown> : {}
        if (!editingDevices.value.find((ed) => ed.address === address)) {
          editingDevices.value.push({ ...d, address, config })
          added++
        }
      })
      if (added > 0) editDevIndex.value = editingDevices.value.length - 1
    }
  } catch (e: unknown) {
    const err = e as { message?: string }
    alert(err?.message || '搜索设备失败')
  } finally {
    isSearching.value = false
  }
}

const handleAddDevice = () => {
  editingDevices.value.push({ name: 'New Device', address: '', config: {} })
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
  emit('save', { devices: editingDevices.value, index: editDevIndex.value })
}
</script>

<template>
  <div v-if="visible"
       class="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-white rounded-xl shadow-2xl border border-slate-200 flex overflow-hidden w-[650px] h-[500px]">
      <div class="w-[200px] bg-slate-50 border-r border-slate-100 flex flex-col">
        <div class="p-3 text-xs font-bold text-slate-500 border-b border-slate-100">设备列表</div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div v-for="(dev, idx) in editingDevices" :key="idx" @click="editDevIndex = idx"
               class="px-3 py-2 rounded-lg cursor-pointer text-xs truncate border transition-all"
               :class="editDevIndex === idx ? 'bg-white border-slate-200 shadow-sm text-indigo-600 font-bold' : 'border-transparent text-slate-600 hover:bg-slate-100'">
            {{ dev.name }}
          </div>
        </div>
        <div class="p-2 border-t border-slate-100 flex flex-col gap-2">
          <button @click="handleAddDevice"
                  class="border border-dashed border-slate-300 rounded-lg py-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white transition-colors flex items-center justify-center gap-1">
            <Plus :size="12"/>
            手动添加
          </button>
          <button @click="handleSearch" :disabled="isSearching"
                  class="bg-indigo-100 text-indigo-600 rounded-lg py-1.5 text-xs font-bold hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1">
            <component :is="isSearching ? Loader2 : Radar" :size="12" :class="{'animate-spin': isSearching}"/>
            {{ isSearching ? '扫描中...' : '自动搜索' }}
          </button>
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
        <div v-if="editingDevices[editDevIndex]" class="flex-1 p-5 overflow-y-auto space-y-4">
          <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Name</label><input
              v-model="editingDevices[editDevIndex].name"
              class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"/>
          </div>
          <div class="space-y-1"><label class="text-[10px] font-bold text-slate-400 uppercase">Address</label><input
              v-model="editingDevices[editDevIndex].address"
              class="w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 font-mono"/>
          </div>
          <div class="space-y-1 flex-1 flex flex-col"><label class="text-[10px] font-bold text-slate-400 uppercase">Config</label><textarea
              :value="JSON.stringify(editingDevices[editDevIndex].config, null, 2)"
              @input="handleConfigInput"
              class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-200 resize-none flex-1"></textarea>
          </div>
          <button @click="handleRemoveDevice"
                  class="text-xs text-red-500 hover:underline">删除设备
          </button>
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
