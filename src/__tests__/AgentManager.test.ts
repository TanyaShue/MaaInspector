import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AgentManager from '@/components/Flow/InfoPanel/AgentManager.vue'
import { agentApi } from '@/services/api'
import { useAppConfigStore } from '@/stores/appConfig'

vi.mock('@/services/api', () => ({
  systemApi: {
    saveDeviceConfig: vi.fn()
  },
  resourceApi: {
    load: vi.fn()
  },
  deviceApi: {
    connectAdb: vi.fn(),
    connectWin32: vi.fn()
  },
  agentApi: {
    start: vi.fn(),
    connect: vi.fn()
  }
}))

describe('AgentManager', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('uses the same green connected state as resource and device controls', async () => {
    const store = useAppConfigStore()
    store.resource.profiles = [{
      name: 'MaaYYs',
      paths: ['D:/MaaYYs/resource'],
      agent: {
        child_exec: 'agent/agent.exe',
        child_args: [],
        working_directory: 'D:/MaaYYs',
        socket_id: 'maa-agent',
        auto_start: true
      }
    }]
    vi.mocked(agentApi.start).mockResolvedValue({ success: true })
    vi.mocked(agentApi.connect).mockResolvedValue({ success: true })

    const wrapper = mount(AgentManager, {
      global: {
        stubs: {
          StatusIndicator: true
        }
      }
    })
    const connectButton = wrapper.get('button.btn-primary')
    await connectButton.trigger('click')
    await vi.waitFor(() => {
      expect(connectButton.classes()).toContain('bg-emerald-500')
    })

    const statusChanges = wrapper.emitted('status-change') || []
    expect(statusChanges[statusChanges.length - 1]?.[0]).toMatchObject({
      status: 'connected',
      message: 'Agent 已连接'
    })
  })
})
