<script setup>
import { computed, ref, reactive } from 'vue'
import {
  Layers, Network,
  Server, Database, Bot, // 模块图标
  Power, Settings, RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2, HardDrive,
  FolderInput, Link, ChevronDown, Minimize2, Maximize2, Search, Circle // UI 图标
} from 'lucide-vue-next'
import { useVueFlow } from '@vue-flow/core'
import { deviceApi, resourceApi, agentApi } from '../../services/api'

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] }
})

const emit = defineEmits(['open-settings'])

// --- 视图控制 ---
const { viewport } = useVueFlow()
const zoomPercentage = computed(() => Math.round((viewport.value.zoom || 1) * 100) + '%')
const isCollapsed = ref(false)

// --- 核心逻辑 ---
function useStatusModule(api, label, defaultInfo = {}) {
  const status = ref('disconnected')
  const message = ref(`${label}未连接`)
  const info = ref(defaultInfo)
  const inputValue = ref('')
  const resultOptions = ref([])
  const selectedOption = ref('')

  const connect = async () => {
    if (status.value === 'connecting') return
    // 资源和Agent需要输入校验
    if ((label === '资源' || label === 'Agent') && !inputValue.value) return

    status.value = 'connecting'
    message.value = '处理中...'

    try {
      const method = api.load ? api.load : api.connect
      const res = await method(inputValue.value)

      status.value = 'connected'
      message.value = res.message
      if (res.info) info.value = res.info

      if (res.list && Array.isArray(res.list)) {
        resultOptions.value = res.list
        if (res.list.length > 0) selectedOption.value = res.list[0]
      }
    } catch (e) {
      status.value = 'failed'
      message.value = '请求失败'
    }
  }

  const disconnect = async () => {
    if (!api.disconnect) {
      status.value = 'disconnected'
      message.value = '等待加载'
      resultOptions.value = []
      selectedOption.value = ''
      return
    }

    if (status.value === 'disconnecting') return
    status.value = 'disconnecting'
    message.value = '断开中...'

    try {
      await api.disconnect()
      status.value = 'disconnected'
      message.value = '已断开'
      info.value = defaultInfo
    } catch (e) {
      status.value = 'disconnected'
      message.value = '强制断开'
    }
  }

  return reactive({ status, message, info, inputValue, resultOptions, selectedOption, connect, disconnect })
}

const deviceCtrl = useStatusModule(deviceApi, '设备', { ID: '---', IP: '---' })
const resourceCtrl = useStatusModule(resourceApi, '资源', { Path: '---' })
const agentCtrl = useStatusModule(agentApi, 'Agent', { Socket: '---' })

// UI 状态颜色配置 (用于卡片内部)
const getStatusUI = (status) => {
  switch (status) {
    case 'connecting':    return { text: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', icon: RefreshCw, spin: true }
    case 'disconnecting': return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', icon: Loader2, spin: true }
    case 'connected':     return { text: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2, spin: false }
    case 'failed':        return { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle, spin: false }
    default:              return { text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', icon: AlertCircle, spin: false }
  }
}
</script>

<template>
  <div class="relative flex flex-col items-end gap-2 font-sans select-none pointer-events-auto">

    <Transition name="fade-scale" mode="out-in">
      <button
        v-if="isCollapsed"
        @click="isCollapsed = false"
        class="w-10 h-10 bg-white shadow-lg border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:scale-110 transition-all duration-300"
      >
        <Maximize2 :size="18" />
      </button>

      <div
        v-else
        class="w-72 bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[85vh] origin-top-right"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div class="flex items-center gap-2">
            <Activity class="w-4 h-4 text-blue-500" />
            <span class="font-bold text-slate-700 text-sm">控制中心</span>
          </div>
          <button @click="isCollapsed = true" class="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
            <Minimize2 :size="14" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Server :size="14" class="text-indigo-500" /> 设备连接
              </div>
              <StatusIndicator :status="deviceCtrl.status" />
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm transition-all duration-300"
                 :class="{'!bg-green-50/30 !border-green-100': deviceCtrl.status === 'connected'}">
              <div class="flex items-center gap-2">
                 <div class="p-1.5 rounded-full bg-white shadow-sm shrink-0">
                    <component :is="getStatusUI(deviceCtrl.status).icon" :size="14" :class="[getStatusUI(deviceCtrl.status).text, getStatusUI(deviceCtrl.status).spin ? 'animate-spin' : '']" />
                 </div>
                 <div class="flex-1 min-w-0">
                    <div class="text-[10px] uppercase font-bold text-slate-400 leading-tight">Status</div>
                    <div class="text-xs font-bold text-slate-700 truncate">{{ deviceCtrl.message }}</div>
                 </div>
              </div>

              <div class="flex gap-2">
                <button v-if="deviceCtrl.status !== 'connected'" @click="deviceCtrl.connect()" :disabled="deviceCtrl.status === 'connecting'" class="btn-primary flex-1 bg-indigo-500 shadow-indigo-100">
                  <Power :size="14" /> 连接
                </button>
                <button v-else @click="deviceCtrl.disconnect()" class="btn-danger flex-1">
                  <Power :size="14" /> 断开
                </button>
                <button @click="emit('open-settings', 'device')" class="btn-icon"><Settings :size="16" /></button>
              </div>
            </div>
          </section>

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Database :size="14" class="text-emerald-500" /> 资源加载
              </div>
              <StatusIndicator :status="resourceCtrl.status" />
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm transition-all duration-300"
                 :class="{'!bg-green-50/30 !border-green-100': resourceCtrl.status === 'connected'}">

              <div class="relative group">
                 <div class="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
                    <FolderInput :size="14" />
                 </div>
                 <input
                   v-model="resourceCtrl.inputValue"
                   type="text"
                   placeholder="输入资源文件夹路径..."
                   class="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-600 placeholder:text-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm"
                   @keyup.enter="resourceCtrl.connect()"
                 />
              </div>

              <div v-if="resourceCtrl.status === 'connected'" class="animate-in slide-in-from-top-2 fade-in duration-300">
                 <div class="relative">
                    <div class="absolute left-3 top-2.5 text-emerald-600 pointer-events-none"><Search :size="14" /></div>
                    <select v-model="resourceCtrl.selectedOption" class="w-full appearance-none bg-white border border-emerald-200 rounded-lg py-2 pl-9 pr-8 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer shadow-sm hover:border-emerald-300">
                      <option v-for="opt in resourceCtrl.resultOptions" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <div class="absolute right-3 top-2.5 text-slate-400 pointer-events-none"><ChevronDown :size="14" /></div>
                 </div>
                 <div class="flex justify-between mt-1 px-1">
                   <span class="text-[10px] text-emerald-600">已加载 {{ resourceCtrl.resultOptions.length }} 个文件</span>
                 </div>
              </div>

              <div class="flex items-center gap-2 pt-1">
                 <button
                    @click="resourceCtrl.connect()"
                    :disabled="resourceCtrl.status === 'connecting' || !resourceCtrl.inputValue"
                    class="flex-1 rounded-lg py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 disabled:shadow-none"
                    :class="resourceCtrl.status === 'connected'
                      ? 'bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                      : 'bg-emerald-500 text-white shadow-emerald-100 hover:bg-emerald-600'"
                 >
                    <component :is="resourceCtrl.status === 'connecting' ? RefreshCw : HardDrive" :size="12" :class="{'animate-spin': resourceCtrl.status === 'connecting'}" />
                    <span>{{ resourceCtrl.status === 'connected' ? '重新加载' : '加载资源' }}</span>
                 </button>
                 <button @click="emit('open-settings', 'resource')" class="btn-icon"><Settings :size="16" /></button>
              </div>
            </div>
          </section>

          <section class="space-y-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1.5 font-bold text-slate-700">
                <Bot :size="14" class="text-violet-500" /> 智能代理
              </div>
              <StatusIndicator :status="agentCtrl.status" />
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm transition-all duration-300"
                 :class="{'!bg-green-50/30 !border-green-100': agentCtrl.status === 'connected'}">
               <div v-if="agentCtrl.status !== 'connected'" class="relative group">
                  <div class="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-violet-500 transition-colors pointer-events-none"><Link :size="14" /></div>
                  <input
                    v-model="agentCtrl.inputValue"
                    type="text"
                    placeholder="Socket ID..."
                    class="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-600 placeholder:text-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none transition-all shadow-sm"
                    @keyup.enter="agentCtrl.connect()"
                  />
               </div>
               <div v-else class="bg-violet-50 border border-violet-100 rounded-lg p-2 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                     <div class="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
                     <span class="text-xs font-mono text-violet-700 font-bold truncate">{{ agentCtrl.info.Socket || agentCtrl.inputValue }}</span>
                  </div>
                  <span class="text-[10px] text-violet-400">Active</span>
               </div>

               <button
                 v-if="agentCtrl.status !== 'connected'"
                 @click="agentCtrl.connect()"
                 :disabled="agentCtrl.status === 'connecting' || !agentCtrl.inputValue"
                 class="w-full btn-primary bg-violet-500 shadow-violet-100"
               >
                 <Power :size="14" /> 启动 Agent
               </button>
               <button
                 v-else
                 @click="agentCtrl.disconnect()"
                 class="w-full btn-danger bg-white border border-slate-200 text-slate-600 hover:text-red-500"
               >
                 <Power :size="14" /> 停止运行
               </button>
            </div>
          </section>

        </div>

        <div class="shrink-0 px-4 py-3 bg-slate-50/50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center">
          <div class="flex gap-3">
            <span class="flex items-center gap-1 hover:text-slate-600 transition-colors"><Layers :size="12" /> {{ nodes.length }}</span>
            <span class="flex items-center gap-1 hover:text-slate-600 transition-colors"><Network :size="12" /> {{ edges.length }}</span>
          </div>
          <span class="font-mono font-bold text-slate-300">{{ zoomPercentage }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { defineComponent, h } from 'vue'
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-vue-next'

const StatusIndicator = defineComponent({
  props: { status: String },
  setup(props) {
    return () => {
      // 1. 已连接 (绿色实心对勾)
      if (props.status === 'connected') {
        return h(CheckCircle2, {
          size: 18,
          class: 'text-emerald-500 fill-emerald-50 animate-in zoom-in duration-300'
        })
      }
      // 2. 加载中/断开中 (蓝色/橙色旋转)
      if (props.status === 'connecting' || props.status === 'disconnecting') {
        return h(Loader2, {
          size: 18,
          class: 'text-blue-500 animate-spin'
        })
      }
      // 3. 失败 (红色)
      if (props.status === 'failed') {
        return h(XCircle, {
          size: 18,
          class: 'text-red-500 animate-pulse'
        })
      }
      // 4. 默认/未连接 (灰色空心圆)
      return h(Circle, {
        size: 18,
        class: 'text-slate-300'
      })
    }
  }
})

export default {
  components: { StatusIndicator }
}
</script>

<style scoped>
.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.9) translateY(-10px); }

.btn-primary { @apply rounded-lg py-1.5 text-xs font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-1.5; }
.btn-danger { @apply rounded-lg py-1.5 text-xs font-bold transition-all border active:scale-95 flex items-center justify-center gap-1.5; }
.btn-danger { @apply bg-red-50 text-red-600 border-red-100 hover:bg-red-100; }
.btn-icon { @apply p-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg hover:text-slate-600 hover:border-slate-300 transition-colors shadow-sm; }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
.custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
</style>