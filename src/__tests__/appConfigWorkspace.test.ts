import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppConfigStore } from '@/stores/appConfig'
import { buildResourceSignature } from '@/utils/workspaceState'
import { systemApi } from '@/services/api'

vi.mock('@/services/api', async () => {
  return {
    systemApi: {
      getInitialState: vi.fn(),
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
      connect: vi.fn()
    }
  }
})

describe('appConfig workspace state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('starts with no tabs after backend load', async () => {
    vi.mocked(systemApi.getInitialState).mockResolvedValue({
      resource_profiles: [{ name: 'default', paths: ['D:/maa'] }],
      workspace_state: {
        resource_index: 0,
        resource_signature: buildResourceSignature({ name: 'default', paths: ['D:/maa'] }),
        tabs: [{ id: 'tab-1', title: 'pipeline.json', resource_file: 'D:/maa|pipeline.json' }],
        active_tab_id: 'tab-1'
      }
    })

    const store = useAppConfigStore()
    await store.loadFromBackend()

    expect(store.tabs.items).toEqual([])
    expect(store.tabs.activeTabId).toBe('')
  })

  it('restores tabs only for the same resource profile', async () => {
    const profile = { name: 'default', paths: ['D:/maa'] }
    vi.mocked(systemApi.getInitialState).mockResolvedValue({
      resource_profiles: [profile],
      workspace_state: {
        resource_index: 0,
        resource_signature: buildResourceSignature(profile),
        tabs: [{ id: 'tab-1', title: 'pipeline.json', resource_file: 'D:/maa|pipeline.json' }],
        active_tab_id: 'tab-1'
      }
    })

    const store = useAppConfigStore()
    await store.loadFromBackend()
    store.markResourceLoaded()
    const restoredTabs = store.restoreLastWorkspace(new Set(['D:/maa|pipeline.json']))

    expect(restoredTabs).toHaveLength(1)
    expect(store.tabs.items[0].resourceFile).toBe('D:/maa|pipeline.json')
  })

  it('restores selected resource file from the active restored tab', async () => {
    const profile = { name: 'default', paths: ['D:/maa'] }
    vi.mocked(systemApi.getInitialState).mockResolvedValue({
      resource_profiles: [profile],
      workspace_state: {
        resource_index: 0,
        resource_signature: buildResourceSignature(profile),
        tabs: [
          { id: 'tab-1', title: 'a.json', resource_file: 'D:/maa|a.json' },
          { id: 'tab-2', title: 'b.json', resource_file: 'D:/maa|b.json' }
        ],
        active_tab_id: 'tab-2'
      }
    })

    const store = useAppConfigStore()
    await store.loadFromBackend()
    store.markResourceLoaded()
    store.restoreLastWorkspace(new Set(['D:/maa|a.json', 'D:/maa|b.json']))

    expect(store.tabs.activeTabId).toBe('tab-2')
    expect(store.resource.selectedFileId).toBe('D:/maa|b.json')
  })

  it('does not restore tabs for a different resource profile', async () => {
    vi.mocked(systemApi.getInitialState).mockResolvedValue({
      resource_profiles: [{ name: 'other', paths: ['D:/other'] }],
      workspace_state: {
        resource_index: 0,
        resource_signature: buildResourceSignature({ name: 'default', paths: ['D:/maa'] }),
        tabs: [{ id: 'tab-1', title: 'pipeline.json', resource_file: 'D:/maa|pipeline.json' }],
        active_tab_id: 'tab-1'
      }
    })

    const store = useAppConfigStore()
    await store.loadFromBackend()
    store.markResourceLoaded()
    const restoredTabs = store.restoreLastWorkspace(new Set(['D:/maa|pipeline.json']))

    expect(restoredTabs).toEqual([])
    expect(store.tabs.items).toEqual([])
  })

  it('saves only lightweight tab metadata in workspace_state', async () => {
    vi.mocked(systemApi.getInitialState).mockResolvedValue({
      resource_profiles: [{ name: 'default', paths: ['D:/maa'] }]
    })

    const store = useAppConfigStore()
    await store.loadFromBackend()
    store.markResourceLoaded()
    const tab = store.ensureWorkspaceTab()
    store.updateTabResourceFile(tab.id, 'D:/maa|pipeline.json', 'pipeline.json')

    expect(systemApi.saveDeviceConfig).toHaveBeenLastCalledWith(expect.objectContaining({
      workspace_state: expect.objectContaining({
        tabs: [{
          id: tab.id,
          title: 'pipeline.json',
          resource_file: 'D:/maa|pipeline.json'
        }]
      })
    }))
  })

  it('loads and persists the last connected device', async () => {
    const lastDevice = { type: 'adb', address: '127.0.0.1:5555', adb_path: 'adb.exe' }
    vi.mocked(systemApi.getInitialState).mockResolvedValue({ last_device: lastDevice })

    const store = useAppConfigStore()
    await store.loadFromBackend()
    expect(store.device.lastDevice).toEqual(lastDevice)

    const nextDevice = { type: 'win32', hwnd: 42, name: 'Game' }
    store.rememberDevice(nextDevice)
    await vi.waitFor(() => {
      expect(systemApi.saveDeviceConfig).toHaveBeenLastCalledWith(expect.objectContaining({
        last_device: nextDevice
      }))
    })
  })
})
