<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Bot, Loader2 } from 'lucide-vue-next'
import { useAppConfigStore } from '@/stores/appConfig'
import StatusIndicator from '@/components/Flow/Common/StatusIndicator.vue'

const emit = defineEmits<{
  'status-change': [snapshot: { status: 'disconnected' | 'connecting' | 'connected' | 'failed'; message: string }]
}>()
const appConfig = useAppConfigStore()

// 状态
const status = ref<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected')
const message = ref('Agent 未连接')
const currentAgentSocket = ref<string>('')

// 按钮标签
const agentButtonLabel = computed(() => status.value === 'connected' ? '重新连接 Agent' : '启动 Agent')

// 连接 Agent
const handleAgentConnect = async (): Promise<boolean> => {
  if (status.value === 'connecting') return false
  status.value = 'connecting'
  message.value = '连接中...'

  try {
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
    message.value = attempt === 1 ? '正在自动连接 Agent...' : `正在重试连接 Agent (${attempt}/${maxAttempts})...`
    if (await handleAgentConnect()) return true
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 600))
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
  message
})

watch([status, message], () => {
  emit('status-change', {
    status: status.value,
    message: message.value
  })
}, { immediate: true })
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between text-xs mb-1">
      <div class="flex items-center gap-1.5 font-bold text-slate-700">
        <Bot
          :size="14"
          class="text-violet-500"
        />
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
      >
      <button
        :disabled="status === 'connecting'"
        class="w-full btn-primary bg-violet-500 shadow-violet-100"
        @click="handleAgentConnect"
      >
        <component
          :is="status === 'connecting' ? Loader2 : Bot"
          :size="14"
          :class="{'animate-spin': status === 'connecting'}"
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
