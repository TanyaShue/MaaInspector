import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResourceManager from '@/components/Flow/InfoPanel/ResourceManager.vue'
import { resourceApi } from '@/services/api'

vi.mock('@/services/api', () => ({
  resourceApi: {
    load: vi.fn()
  },
  systemApi: {
    saveDeviceConfig: vi.fn()
  },
  deviceApi: {
    connectAdb: vi.fn(),
    connectWin32: vi.fn()
  },
  agentApi: {
    connect: vi.fn()
  }
}))

describe('ResourceManager', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('reloads the currently selected file after resource reload', async () => {
    vi.mocked(resourceApi.load).mockResolvedValue({
      success: true,
      list: [
        {
          label: 'pipeline.json',
          value: 'pipeline.json',
          source: 'D:/maa',
          filename: 'pipeline.json'
        }
      ]
    })

    const wrapper = mount(ResourceManager, {
      props: {
        profiles: [{ name: 'default', paths: ['D:/maa'] }],
        profileIndex: 0,
        selectedFile: 'D:/maa|pipeline.json',
        openedFileIds: ['D:/maa|pipeline.json']
      },
      global: {
        stubs: {
          Dropdown: {
            template: '<div />',
            props: ['modelValue', 'options']
          },
          StatusIndicator: {
            template: '<div />'
          }
        }
      }
    })

    await wrapper.vm.handleResourceLoad()

    expect(wrapper.emitted('file-selected')?.[0]).toEqual([
      { filename: 'pipeline.json', source: 'D:/maa' }
    ])
    expect(wrapper.emitted('update:selectedFile')?.[0]).toEqual(['D:/maa|pipeline.json'])
  })

  it('retries automatic resource loading until it succeeds', async () => {
    vi.useFakeTimers()
    vi.mocked(resourceApi.load)
      .mockRejectedValueOnce(new Error('not ready'))
      .mockRejectedValueOnce(new Error('still not ready'))
      .mockResolvedValue({ success: true, list: [] })

    const wrapper = mount(ResourceManager, {
      props: {
        profiles: [{ name: 'default', paths: ['D:/maa'] }],
        profileIndex: 0
      },
      global: { stubs: { Dropdown: true, StatusIndicator: true } }
    })

    const restoring = wrapper.vm.handleResourceLoadWithRetry(5)
    await vi.runAllTimersAsync()

    await expect(restoring).resolves.toBe(true)
    expect(resourceApi.load).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
