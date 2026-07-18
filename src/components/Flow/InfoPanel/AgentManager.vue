<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { Bot, Loader2, Settings2 } from 'lucide-vue-next'
  import { useAppConfigStore } from '@/stores/appConfig'
  import type { AgentProfile } from '@/services/api'
  import StatusIndicator from '@/components/Flow/Common/StatusIndicator.vue'

  const emit = defineEmits<{
    'status-change': [
      snapshot: { status: 'disconnected' | 'connecting' | 'connected' | 'failed'; message: string },
    ]
  }>()
  const appConfig = useAppConfigStore()

  // 状态
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected')
  const message = ref('Agent 未连接')
  const currentAgentSocket = ref<string>('')
  const childExec = ref('')
  const childArgs = ref('')
  const workingDirectory = ref('')
  const autoStart = ref(true)
  const showAdvanced = ref(false)

  // 按钮标签
  const agentButtonLabel = computed(() =>
    status.value === 'connected' ? '重新连接 Agent' : '启动 Agent'
  )

  // 连接 Agent
  const handleAgentConnect = async (): Promise<boolean> => {
    if (status.value === 'connecting') return false
    status.value = 'connecting'
    message.value = '连接中...'

    try {
      const original = appConfig.currentProfile.agent
      const settings: AgentProfile = {
        child_exec: childExec.value.trim(),
        child_args: childArgs.value
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        working_directory: workingDirectory.value.trim(),
        socket_id: currentAgentSocket.value.trim(),
        auto_start: autoStart.value,
        environment: { ...(original?.environment || {}) },
      }
      await appConfig.updateCurrentAgentSettings(settings)
      await appConfig.connectAgent(currentAgentSocket.value)
      status.value = 'connected'
      message.value = 'Agent 已连接'
      return true
    } catch (e: unknown) {
      status.value = 'failed'
      message.value = '连接失败: ' + (e instanceof Error ? e.message : '未知错误')
      return false
    }
  }

  const autoRestoreAgent = async (socketId: string, maxAttempts = 5): Promise<boolean> => {
    currentAgentSocket.value = socketId
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      message.value =
        attempt === 1
          ? '正在自动连接 Agent...'
          : `正在重试连接 Agent (${attempt}/${maxAttempts})...`
      if (await handleAgentConnect()) return true
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 600))
    }
    message.value = `自动连接失败，已尝试 ${maxAttempts} 次`
    return false
  }

  // 暴露方法
  defineExpose({
    currentAgentSocket,
    handleAgentConnect,
    autoRestoreAgent,
    status,
    message,
  })

  watch(
    [status, message],
    () => {
      emit('status-change', {
        status: status.value,
        message: message.value,
      })
    },
    { immediate: true }
  )

  watch(
    () => [appConfig.resource.profileIndex, appConfig.currentProfile.agent] as const,
    () => {
      const profileAgent = appConfig.currentProfile.agent
      currentAgentSocket.value = profileAgent?.socket_id || appConfig.agent.socketId || ''
      childExec.value = profileAgent?.child_exec || ''
      childArgs.value = (profileAgent?.child_args || []).join('\n')
      workingDirectory.value = profileAgent?.working_directory || ''
      autoStart.value = profileAgent?.auto_start !== false
      status.value = 'disconnected'
      message.value = profileAgent ? '已载入当前资源的 Agent 设置' : '当前资源未配置 Agent'
    },
    { immediate: true, deep: true }
  )
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between text-xs mb-1">
      <div class="flex items-center gap-1.5 font-bold text-slate-700">
        <Bot :size="14" class="text-violet-500" />
        Agent
      </div>
      <StatusIndicator :status="status" />
    </div>
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
      <input
        v-model="currentAgentSocket"
        type="text"
        placeholder="Socket ID..."
        class="input-base focus:border-violet-500 focus:ring-violet-100 w-full"
        @keyup.enter="handleAgentConnect"
      />
      <button
        type="button"
        class="flex w-full items-center justify-between text-[10px] text-slate-500 hover:text-violet-600"
        @click="showAdvanced = !showAdvanced"
      >
        <span class="flex items-center gap-1"><Settings2 :size="11" />启动设置</span>
        <span>{{ showAdvanced ? '收起' : '展开' }}</span>
      </button>
      <div
        v-if="showAdvanced"
        class="space-y-2 rounded-lg border border-violet-100 bg-violet-50/40 p-2"
      >
        <label class="block space-y-1">
          <span class="text-[10px] text-slate-500">可执行文件</span>
          <input v-model="childExec" class="input-base font-mono" placeholder="agent/agent.exe" />
        </label>
        <label class="block space-y-1">
          <span class="text-[10px] text-slate-500">工作目录</span>
          <input
            v-model="workingDirectory"
            class="input-base font-mono"
            placeholder="interface.json 所在目录"
          />
        </label>
        <label class="block space-y-1">
          <span class="text-[10px] text-slate-500">启动参数（每行一个）</span>
          <textarea v-model="childArgs" rows="3" class="input-base resize-y font-mono" />
        </label>
        <label class="flex items-center gap-2 text-[10px] text-slate-600">
          <input v-model="autoStart" type="checkbox" />
          连接时自动启动 Agent
        </label>
        <div class="text-[10px] leading-4 text-slate-400">
          Socket ID 会自动作为最后一个参数传入；进程从上面的工作目录启动。
        </div>
      </div>
      <button
        :disabled="status === 'connecting'"
        class="w-full btn-primary"
        :class="
          status === 'connected'
            ? 'bg-emerald-500 shadow-emerald-100 hover:bg-emerald-600'
            : 'bg-violet-500 shadow-violet-100 hover:bg-violet-600'
        "
        @click="handleAgentConnect"
      >
        <component
          :is="status === 'connecting' ? Loader2 : Bot"
          :size="14"
          :class="{ 'animate-spin': status === 'connecting' }"
        />
        {{ agentButtonLabel }}
      </button>
    </div>
  </section>
</template>

<style scoped>
  .input-base {
    @apply w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50;
  }

  .btn-primary {
    @apply flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed;
  }
</style>
