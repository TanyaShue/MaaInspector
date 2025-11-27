<script setup>
import { computed, ref, reactive, onMounted, defineComponent, h, watch } from 'vue'
import {
  Server, Database, Bot, Power, Settings, RefreshCw, CheckCircle2, XCircle, Loader2, HardDrive,
  FolderInput, Link, ChevronDown, Minimize2, Maximize2, Smartphone, Save, X, Edit3, Circle,
  Radar, Plus, Trash2, ArrowUp, ArrowDown, FileText
} from 'lucide-vue-next'
import { useVueFlow } from '@vue-flow/core'
import { deviceApi, resourceApi, agentApi, systemApi } from '../../services/api'

// --- Props 修改 ---
// 性能优化：不再接收整个 nodes/edges 数组，只接收数量
// 这样当节点位置改变（拖拽）时，不会触发此组件重渲染
const props = defineProps({
  nodeCount: { type: Number, default: 0 },
  edgeCount: { type: Number, default: 0 }
})

// --- 内部组件 ---
const StatusIndicator = defineComponent({
  props: { status: String },
  setup(props) {
    return () => {
      if (props.status === 'connected') return h(CheckCircle2, { size: 16, class: 'text-emerald-500 fill-emerald-50' })
      if (props.status === 'connecting' || props.status === 'disconnecting') return h(Loader2, { size: 16, class: 'text-blue-500 animate-spin' })
      if (props.status === 'failed') return h(XCircle, { size: 16, class: 'text-red-500' })
      return h(Circle, { size: 16, class: 'text-slate-300' })
    }
  }
})

// --- 视图状态 ---
const { viewport } = useVueFlow()
const zoomPercentage = computed(() => Math.round((viewport.value.zoom || 1) * 100) + '%')
const isCollapsed = ref(false)
const showDeviceSettings = ref(false)
const showResourceSettings = ref(false)

// --- 全局数据源 ---
const availableDevices = ref([])
const resourceProfiles = ref([])
const currentAgentSocket = ref('')

// --- 选中状态 ---
const selectedDeviceIndex = ref(0)
const selectedProfileIndex = ref(0)
const selectedResourceFile = ref('')

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
      setTimeout(() => { if(status.value === 'failed') status.value = 'disconnected' }, 3000)
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
    try { await api.disconnect() } catch(e) {}
    status.value = 'disconnected'
    message.value = '已断开'
    info.value = {}
  }

  return reactive({ status, message, info, connect, disconnect })
}

const deviceCtrl = useStatusModule(deviceApi, '设备')
const resourceCtrl = useStatusModule(resourceApi, '资源')
const agentCtrl = useStatusModule(agentApi, 'Agent')

// --- 计算属性 ---
const currentDevice = computed(() => availableDevices.value[selectedDeviceIndex.value] || {})
const currentProfile = computed(() => resourceProfiles.value[selectedProfileIndex.value] || { name: 'None', paths: [] })
const availableFiles = ref([])

// --- 动作处理 ---
const handleDeviceConnect = () => {
  deviceCtrl.connect(currentDevice.value)
}

const handleResourceLoad = async () => {
  try {
    const res = await resourceCtrl.connect(currentProfile.value)
    if (res.list) {
      availableFiles.value = res.list
      if (!availableFiles.value.find(f => f.value === selectedResourceFile.value)) {
        selectedResourceFile.value = availableFiles.value.length > 0 ? availableFiles.value[0].value : ''
      }
    }
  } catch(e) {}
}

const handleAgentConnect = () => {
  agentCtrl.connect({ socket_id: currentAgentSocket.value })
}

// --- 初始化与自动保存 ---
let isInit = true

onMounted(async () => {
  try {
    const data = await systemApi.getInitialState()
    if (data.devices) availableDevices.value = data.devices
    if (data.resource_profiles) resourceProfiles.value = data.resource_profiles

    const state = data.current_state || {}
    if (availableDevices.value[state.device_index]) selectedDeviceIndex.value = state.device_index
    if (resourceProfiles.value[state.resource_profile_index]) selectedProfileIndex.value = state.resource_profile_index
    if (state.resource_file) selectedResourceFile.value = state.resource_file
    if (state.agent_socket_id) {
      currentAgentSocket.value = state.agent_socket_id
    } else if (data.agent_socket_id) {
      currentAgentSocket.value = data.agent_socket_id
    }
  } catch (e) {
    console.error("Init failed", e)
  } finally {
    setTimeout(() => { isInit = false }, 500)
  }
})

const saveAllConfig = async () => {
  if (isInit) return
  try {
    const payload = {
      devices: availableDevices.value,
      resource_profiles: resourceProfiles.value,
      agent_socket_id: currentAgentSocket.value,
      current_state: {
        device_index: selectedDeviceIndex.value,
        resource_profile_index: selectedProfileIndex.value,
        resource_file: selectedResourceFile.value,
        agent_socket_id: currentAgentSocket.value
      }
    }
    await systemApi.saveDeviceConfig(payload)
  } catch (e) {
    console.error("Auto save failed", e)
  }
}

watch([selectedDeviceIndex, selectedProfileIndex, selectedResourceFile, currentAgentSocket], () => {
  saveAllConfig()
}, { deep: false })

// --- 弹窗编辑逻辑 ---
const editingDevices = ref([])
const editDevIndex = ref(0)
const isSearching = ref(false)

const openDeviceSettings = () => {
  editingDevices.value = JSON.parse(JSON.stringify(availableDevices.value))
  editDevIndex.value = selectedDeviceIndex.value
  showDeviceSettings.value = true
}

const handleSearch = async () => {
  isSearching.value = true
  try {
    const res = await systemApi.searchDevices()
    if (res.devices) {
      let count = 0
      res.devices.forEach(d => {
        if (!editingDevices.value.find(ed => ed.address === d.address)) {
          editingDevices.value.push(d)
          count++
        }
      })
      if (count > 0) editDevIndex.value = editingDevices.value.length - 1
    }
  } catch(e) { alert(e.message) }
  finally { isSearching.value = false }
}

const saveDeviceSettings = async () => {
  availableDevices.value = editingDevices.value
  if (selectedDeviceIndex.value >= availableDevices.value.length) selectedDeviceIndex.value = 0
  showDeviceSettings.value = false
  saveAllConfig()
}

// 资源编辑
const editingProfiles = ref([])
const editProfIndex = ref(0)

const openResourceSettings = () => {
  editingProfiles.value = JSON.parse(JSON.stringify(resourceProfiles.value))
  editProfIndex.value = selectedProfileIndex.value
  showResourceSettings.value = true
}

const addPathToProfile = () => {
  if (!editingProfiles.value[editProfIndex.value]) return
  editingProfiles.value[editProfIndex.value].paths.push("D:/New/Path")
}
const removePath = (pIndex) => {
  editingProfiles.value[editProfIndex.value].paths.splice(pIndex, 1)
}
const movePath = (pIndex, direction) => {
  const paths = editingProfiles.value[editProfIndex.value].paths
  if (direction === -1 && pIndex > 0) {
    [paths[pIndex], paths[pIndex-1]] = [paths[pIndex-1], paths[pIndex]]
  } else if (direction === 1 && pIndex < paths.length - 1) {
    [paths[pIndex], paths[pIndex+1]] = [paths[pIndex+1], paths[pIndex]]
  }
}

const saveResourceSettings = async () => {
  resourceProfiles.value = editingProfiles.value
  if (selectedProfileIndex.value >= resourceProfiles.value.length) selectedProfileIndex.value = 0
  showResourceSettings.value = false
  saveAllConfig()
}
</script>

<template>
  <div class="relative flex flex-col items-end gap-2 font-sans select-none pointer-events-auto z-50">

    <Transition name="fade-scale" mode="out-in">
      <div v-if="isCollapsed" @click="isCollapsed = false" class="bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:scale-105 transition-all duration-300 group">
        <div class="w-2.5 h-2.5 rounded-full shadow-sm" :class="deviceCtrl.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'"></div>
        <div class="w-2.5 h-2.5 rounded-full shadow-sm" :class="resourceCtrl.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'"></div>
        <div class="w-2.5 h-2.5 rounded-full shadow-sm" :class="agentCtrl.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'"></div>
        <Maximize2 :size="14" class="text-slate-400 ml-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-[-20px]" />
      </div>

      <div v-else class="w-80 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[90vh] origin-top-right transition-all">

        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div class="flex items-center gap-2">
            <Settings class="w-4 h-4 text-slate-500" />
            <span class="font-bold text-slate-700 text-sm">系统控制台</span>
          </div>
          <button @click="isCollapsed = true" class="p-1 rounded-md text-slate-400 hover:bg-slate-200"><Minimize2 :size="16" /></button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700"><Smartphone :size="14" class="text-indigo-500" /> 设备管理</div>
              <StatusIndicator :status="deviceCtrl.status" />
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm" :class="{'!bg-indigo-50/30 !border-indigo-100': deviceCtrl.status === 'connected'}">
              <div v-if="deviceCtrl.status !== 'connected'" class="relative">
                <div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><Server :size="14" /></div>
                <select v-model="selectedDeviceIndex" class="select-base pl-10">
                  <option v-for="(dev, index) in availableDevices" :key="index" :value="index">{{ dev.name }} ({{ dev.address }})</option>
                  <option v-if="availableDevices.length === 0" disabled>无可用设备...</option>
                </select>
                <div class="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><ChevronDown :size="14" /></div>
              </div>

              <div v-else class="flex items-center justify-between bg-white border border-indigo-100 rounded-lg p-2 shadow-sm">
                 <div class="flex flex-col overflow-hidden">
                    <span class="text-xs font-bold text-indigo-700 truncate">{{ currentDevice.name }}</span>
                    <span class="text-[10px] font-mono text-slate-500 truncate">{{ currentDevice.address }}</span>
                 </div>
                 <div class="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] rounded font-bold">LINKED</div>
              </div>

              <div class="flex gap-2">
                <button v-if="deviceCtrl.status !== 'connected'" @click="handleDeviceConnect" :disabled="deviceCtrl.status === 'connecting' || availableDevices.length === 0" class="btn-primary flex-1 bg-indigo-500 shadow-indigo-100"><Power :size="14" /> 连接</button>
                <button v-else @click="deviceCtrl.disconnect()" class="btn-danger flex-1"><Power :size="14" /> 断开</button>
                <button @click="openDeviceSettings" class="btn-icon"><Settings :size="16" /></button>
              </div>
            </div>
          </section>

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700"><Database :size="14" class="text-emerald-500" /> 资源配置</div>
              <StatusIndicator :status="resourceCtrl.status" />
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
              <div class="flex gap-2">
                <div class="relative flex-1">
                   <div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><FolderInput :size="14" /></div>
                   <select v-model="selectedProfileIndex" class="select-base pl-10" :disabled="resourceCtrl.status === 'connected'">
                     <option v-for="(prof, idx) in resourceProfiles" :key="idx" :value="idx">{{ prof.name }}</option>
                     <option v-if="resourceProfiles.length === 0" disabled>无配置...</option>
                   </select>
                </div>
                <button @click="openResourceSettings" class="btn-icon"><Settings :size="16" /></button>
              </div>

              <button @click="handleResourceLoad" :disabled="resourceCtrl.status === 'connecting'" class="w-full btn-primary bg-emerald-500 shadow-emerald-100">
                 <component :is="resourceCtrl.status === 'connecting' ? RefreshCw : HardDrive" :size="12" :class="{'animate-spin': resourceCtrl.status === 'connecting'}" />
                 <span>{{ resourceCtrl.status === 'connected' ? '重新加载' : '加载资源' }}</span>
              </button>

              <div v-if="resourceCtrl.status === 'connected'" class="animate-in fade-in slide-in-from-top-2">
                <div class="relative">
                  <div class="absolute left-3 top-2.5 text-emerald-600 pointer-events-none"><FileText :size="14" /></div>
                  <select v-model="selectedResourceFile" class="select-base pl-10 border-emerald-200 focus:ring-emerald-100">
                    <option v-for="file in availableFiles" :key="file.value" :value="file.value">{{ file.label }}</option>
                    <option v-if="availableFiles.length === 0" disabled>配置路径下无文件</option>
                  </select>
                  <div class="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><ChevronDown :size="14" /></div>
                </div>
              </div>
            </div>
          </section>

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
               <div class="flex items-center gap-1.5 font-bold text-slate-700"><Bot :size="14" class="text-violet-500" /> Agent</div>
               <StatusIndicator :status="agentCtrl.status" />
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
               <div class="relative group">
                  <div class="absolute left-3 top-2.5 text-slate-400 pointer-events-none"><Link :size="14" /></div>
                  <input v-model="currentAgentSocket" type="text" placeholder="Socket ID..." class="input-base pl-10 focus:border-violet-500 focus:ring-violet-100" @keyup.enter="handleAgentConnect" />
               </div>
               <button v-if="agentCtrl.status !== 'connected'" @click="handleAgentConnect" :disabled="agentCtrl.status === 'connecting'" class="w-full btn-primary bg-violet-500 shadow-violet-100">启动 Agent</button>
               <button v-else @click="agentCtrl.disconnect()" class="w-full btn-danger">停止 Agent</button>
            </div>
          </section>

        </div>

        <div class="shrink-0 px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center">
           <div class="flex gap-2"><span>{{ props.nodeCount }} Nodes</span><span>{{ props.edgeCount }} Edges</span></div>
           <span class="font-mono font-bold text-slate-300">{{ zoomPercentage }}</span>
        </div>
      </div>
    </Transition>

    <div v-if="showDeviceSettings" class="modal-backdrop">
      <div class="modal-box w-[650px] h-[500px]">
        <div class="w-[200px] bg-slate-50 border-r border-slate-100 flex flex-col">
          <div class="p-3 text-xs font-bold text-slate-500 border-b border-slate-100">设备列表</div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
             <div v-for="(dev, idx) in editingDevices" :key="idx" @click="editDevIndex = idx" class="list-item" :class="editDevIndex === idx ? 'list-item-active' : 'list-item-inactive'">{{ dev.name }}</div>
          </div>
          <div class="p-2 border-t border-slate-100 flex flex-col gap-2">
            <button @click="editingDevices.push({name:'New Device', address:'', config:{}})" class="btn-dashed"><Plus :size="12" /> 手动添加</button>
            <button @click="handleSearch" :disabled="isSearching" class="btn-soft-indigo"><component :is="isSearching ? Loader2 : Radar" :size="12" :class="{'animate-spin': isSearching}" /> {{ isSearching ? '扫描中...' : '自动搜索' }}</button>
          </div>
        </div>
        <div class="flex-1 flex flex-col bg-white">
          <div class="modal-header">
            <h3 class="font-bold text-slate-700 flex items-center gap-2"><Edit3 :size="16" /> 编辑设备</h3>
            <button @click="showDeviceSettings = false" class="close-btn"><X :size="20" /></button>
          </div>
          <div v-if="editingDevices[editDevIndex]" class="flex-1 p-5 overflow-y-auto space-y-4">
             <div class="space-y-1"><label class="label-xs">Name</label><input v-model="editingDevices[editDevIndex].name" class="input-base" /></div>
             <div class="space-y-1"><label class="label-xs">Address</label><input v-model="editingDevices[editDevIndex].address" class="input-base font-mono" /></div>
             <div class="space-y-1 flex-1 flex flex-col"><label class="label-xs">Config</label><textarea :value="JSON.stringify(editingDevices[editDevIndex].config, null, 2)" @input="e => { try{editingDevices[editDevIndex].config = JSON.parse(e.target.value)}catch(err){} }" class="textarea-code flex-1"></textarea></div>
             <button @click="editingDevices.splice(editDevIndex, 1); editDevIndex = Math.max(0, editingDevices.length-1)" class="text-xs text-red-500 hover:underline">删除设备</button>
          </div>
          <div class="modal-footer">
             <button @click="showDeviceSettings = false" class="btn-cancel">取消</button>
             <button @click="saveDeviceSettings" class="btn-save"><Save :size="14" /> 保存</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showResourceSettings" class="modal-backdrop">
      <div class="modal-box w-[700px] h-[500px]">
        <div class="w-[200px] bg-slate-50 border-r border-slate-100 flex flex-col">
          <div class="p-3 text-xs font-bold text-slate-500 border-b border-slate-100">配置列表 (Profiles)</div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
             <div v-for="(prof, idx) in editingProfiles" :key="idx" @click="editProfIndex = idx" class="list-item" :class="editProfIndex === idx ? 'list-item-active' : 'list-item-inactive'">
               {{ prof.name }}
             </div>
          </div>
          <div class="p-2 border-t border-slate-100">
            <button @click="editingProfiles.push({name:'New Profile', paths:[]}); editProfIndex = editingProfiles.length-1" class="btn-dashed w-full"><Plus :size="12" /> 新建配置</button>
          </div>
        </div>

        <div class="flex-1 flex flex-col bg-white">
          <div class="modal-header">
            <h3 class="font-bold text-slate-700 flex items-center gap-2"><Database :size="16" /> 编辑资源配置</h3>
            <button @click="showResourceSettings = false" class="close-btn"><X :size="20" /></button>
          </div>

          <div v-if="editingProfiles[editProfIndex]" class="flex-1 p-5 overflow-hidden flex flex-col gap-4">
            <div class="space-y-1">
               <label class="label-xs">Profile Name</label>
               <input v-model="editingProfiles[editProfIndex].name" type="text" class="input-base font-bold text-indigo-600" />
            </div>

            <div class="flex-1 flex flex-col min-h-0">
               <div class="flex items-center justify-between mb-1">
                 <label class="label-xs">Resource Paths (按加载顺序)</label>
                 <button @click="addPathToProfile" class="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"><Plus :size="10" /> 添加路径</button>
               </div>

               <div class="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-1 space-y-1 custom-scrollbar">
                 <div v-for="(path, pIdx) in editingProfiles[editProfIndex].paths" :key="pIdx" class="flex items-center gap-2 bg-white p-2 rounded shadow-sm border border-slate-100 group">
                    <span class="text-[10px] font-mono text-slate-400 w-4 text-center">{{ pIdx + 1 }}</span>
                    <input v-model="editingProfiles[editProfIndex].paths[pIdx]" class="flex-1 text-xs border-none outline-none p-0 text-slate-600 placeholder:text-slate-300" placeholder="Path..." />

                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button @click="movePath(pIdx, -1)" :disabled="pIdx===0" class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 disabled:opacity-30"><ArrowUp :size="12" /></button>
                      <button @click="movePath(pIdx, 1)" :disabled="pIdx===editingProfiles[editProfIndex].paths.length-1" class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 disabled:opacity-30"><ArrowDown :size="12" /></button>
                      <button @click="removePath(pIdx)" class="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><Trash2 :size="12" /></button>
                    </div>
                 </div>
                 <div v-if="editingProfiles[editProfIndex].paths.length === 0" class="text-center py-4 text-xs text-slate-400 italic">暂无路径</div>
               </div>
            </div>

            <div class="border-t border-slate-100 pt-2 flex justify-between">
               <button @click="editingProfiles.splice(editProfIndex, 1); editProfIndex = Math.max(0, editingProfiles.length-1)" class="text-xs text-red-500 hover:underline">删除此配置</button>
            </div>
          </div>

          <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-300">
             <Database :size="48" class="mb-2 opacity-50" />
             <span class="text-xs">请选择或新建资源配置</span>
          </div>

          <div class="modal-footer">
             <button @click="showResourceSettings = false" class="btn-cancel">取消</button>
             <button @click="saveResourceSettings" class="btn-save"><Save :size="14" /> 保存所有配置</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* 原子类提取，保持代码整洁 */
.input-base { @apply w-full bg-white border border-slate-200 rounded-lg py-2 pr-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50; }
.select-base { @apply w-full appearance-none bg-white border border-slate-200 rounded-lg py-2 pr-8 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer shadow-sm; }
.btn-primary { @apply rounded-lg py-1.5 text-xs font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5; }
.btn-danger { @apply rounded-lg py-1.5 text-xs font-bold transition-all border active:scale-95 flex items-center justify-center gap-1.5 bg-white border-slate-200 text-slate-600 hover:text-red-500 hover:border-red-200; }
.btn-icon { @apply p-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-sm active:scale-95; }
.btn-save { @apply px-3 py-1.5 text-xs font-bold bg-indigo-500 text-white rounded shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1; }
.btn-cancel { @apply px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded transition-colors; }
.btn-dashed { @apply border border-dashed border-slate-300 rounded-lg py-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white transition-colors flex items-center justify-center gap-1; }
.btn-soft-indigo { @apply bg-indigo-100 text-indigo-600 rounded-lg py-1.5 text-xs font-bold hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1; }
.label-xs { @apply text-[10px] font-bold text-slate-400 uppercase; }
.textarea-code { @apply w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-indigo-200 resize-none; }

/* Modal 样式 */
.modal-backdrop { @apply fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200; }
.modal-box { @apply bg-white rounded-xl shadow-2xl border border-slate-200 flex overflow-hidden; }
.modal-header { @apply flex items-center justify-between p-4 border-b border-slate-100; }
.modal-footer { @apply p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2; }
.close-btn { @apply text-slate-400 hover:text-red-500 transition-colors; }

/* List Item 样式 */
.list-item { @apply px-3 py-2 rounded-lg cursor-pointer text-xs truncate border transition-all; }
.list-item-active { @apply bg-white border-slate-200 shadow-sm text-indigo-600 font-bold; }
.list-item-inactive { @apply border-transparent text-slate-600 hover:bg-slate-100; }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
</style>