import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useInfoPanelVm } from '@/composables/viewModels/useInfoPanelVm'
import { useAppConfigStore } from '@/stores/appConfig'
import { resourceApi, systemApi } from '@/services/api'
import type { ResourceFileInfo } from '@/services/api'

vi.mock('@/services/api', async () => {
  return {
    systemApi: {
      getInitialState: vi.fn().mockResolvedValue({}),
      saveDeviceConfig: vi.fn(),
      searchDevices: vi.fn()
    },
    resourceApi: {
      createFile: vi.fn(),
      getFileNodes: vi.fn(),
      getTemplateImages: vi.fn(),
      load: vi.fn()
    },
    deviceApi: {
      connectAdb: vi.fn(),
      connectWin32: vi.fn(),
      getScreenshot: vi.fn()
    },
    agentApi: {
      connect: vi.fn()
    }
  }
})

const createEmit = () => vi.fn()

const createResourceManager = (files: ResourceFileInfo[]) => ({
  availableFiles: files,
  handleResourceLoad: vi.fn().mockResolvedValue(true),
  findFileById: vi.fn((id: string) => files.find(file => `${file.source}|${file.value ?? ''}` === id)),
  executeFileSwitch: vi.fn().mockResolvedValue(undefined),
  setMessage: vi.fn()
})

describe('useInfoPanelVm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(systemApi.getInitialState).mockResolvedValue({})
  })

  it('keeps collapsed panel status from explicit child status events', () => {
    const emit = createEmit()
    const vm = useInfoPanelVm({ tabs: [] }, emit)
    const file = { label: 'pipeline.json', value: 'pipeline.json', source: 'D:/maa', filename: 'pipeline.json' }

    vm.handleDeviceStatus({ status: 'connected', message: '设备已连接' })
    vm.handleAgentStatus({ status: 'failed', message: 'Agent 连接失败' })
    vm.handleResourceStatus({
      status: 'connected',
      message: '资源已就绪',
      fileOptions: [{ label: 'pipeline.json', value: 'D:/maa|pipeline.json' }],
      availableFilesLength: 1,
      availableFiles: [file]
    })

    expect(vm.deviceStatus.value).toMatchObject({ status: 'connected', message: '设备已连接' })
    expect(vm.agentStatus.value).toEqual({ status: 'failed', message: 'Agent 连接失败' })
    expect(vm.resourceStatus.value.availableFilesLength).toBe(1)
    expect(vm.resourceStatus.value.fileOptions[0].value).toBe('D:/maa|pipeline.json')
    expect(vm.resourceStatus.value.availableFiles[0]).toEqual(file)
  })

  it('saves the currently selected file through the resource manager lookup', async () => {
    const emit = createEmit()
    const vm = useInfoPanelVm({ tabs: [] }, emit)
    const store = useAppConfigStore()
    const file = { label: 'pipeline.json', value: 'pipeline.json', source: 'D:/maa', filename: 'pipeline.json' }
    vm.resourceManagerRef.value = createResourceManager([file])
    store.selectResourceFile('D:/maa|pipeline.json')

    await vm.handleSaveNodes()

    expect(emit).toHaveBeenCalledWith('save-nodes', {
      source: 'D:/maa',
      filename: 'pipeline.json'
    })
  })

  it('prefers the active tab resource file when saving', async () => {
    const emit = createEmit()
    const vm = useInfoPanelVm({ tabs: [], selectedResourceFile: 'D:/maa|active.json' }, emit)
    const store = useAppConfigStore()
    const activeFile = { label: 'active.json', value: 'active.json', source: 'D:/maa', filename: 'active.json' }
    const globalFile = { label: 'global.json', value: 'global.json', source: 'D:/maa', filename: 'global.json' }
    vm.resourceManagerRef.value = createResourceManager([activeFile, globalFile])
    store.selectResourceFile('D:/maa|global.json')

    await vm.handleSaveNodes()

    expect(emit).toHaveBeenCalledWith('save-nodes', {
      source: 'D:/maa',
      filename: 'active.json'
    })
  })

  it('switches files from the collapsed selector without polling child refs', () => {
    const emit = createEmit()
    const vm = useInfoPanelVm({ tabs: [] }, emit)
    const file = { label: 'tasks.json', value: 'tasks.json', source: 'D:/maa', filename: 'tasks.json' }
    const resourceManager = createResourceManager([file])
    vm.resourceManagerRef.value = resourceManager

    vm.handleCollapsedFileChange('D:/maa|tasks.json')

    expect(emit).toHaveBeenCalledWith('update:selected-resource-file', 'D:/maa|tasks.json')
    expect(resourceManager.executeFileSwitch).toHaveBeenCalledWith('tasks.json', 'D:/maa')
  })

  it('switches files from the collapsed selector using cached resource files after child remounts', async () => {
    const emit = createEmit()
    const vm = useInfoPanelVm({ tabs: [] }, emit)
    const file = { label: 'tasks.json', value: 'tasks.json', source: 'D:/maa', filename: 'tasks.json' }
    vi.mocked(resourceApi.getFileNodes).mockResolvedValue({ nodes: {} })
    vi.mocked(resourceApi.getTemplateImages).mockResolvedValue({ results: {} })
    vm.handleResourceStatus({
      status: 'connected',
      message: '资源已就绪',
      availableFiles: [file],
      availableFilesLength: 1
    })

    vm.handleCollapsedFileChange('D:/maa|tasks.json')

    expect(emit).toHaveBeenCalledWith('update:selected-resource-file', 'D:/maa|tasks.json')
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith('load-nodes', expect.objectContaining({
        filename: 'tasks.json',
        source: 'D:/maa'
      }))
    })
  })

  it('reloads resources after creating a file and opens the new file', async () => {
    const emit = createEmit()
    const vm = useInfoPanelVm({ tabs: [] }, emit)
    const file = { label: 'new.json', value: 'new.json', source: 'D:/maa', filename: 'new.json' }
    const resourceManager = createResourceManager([file])
    vm.resourceManagerRef.value = resourceManager
    vi.mocked(resourceApi.createFile).mockResolvedValue({ success: true })

    await vm.handleCreateFile({ path: 'D:/maa', filename: 'new' })

    expect(resourceApi.createFile).toHaveBeenCalledWith('D:/maa', 'new')
    expect(resourceManager.handleResourceLoad).toHaveBeenCalled()
    expect(resourceManager.executeFileSwitch).toHaveBeenCalledWith('new.json', 'D:/maa')
    expect(resourceManager.setMessage).toHaveBeenLastCalledWith('新建成功并已加载')
  })

  it('reloads the active resource after saving its settings', async () => {
    const vm = useInfoPanelVm({ tabs: [] }, createEmit())
    const resourceManager = createResourceManager([])
    vm.resourceManagerRef.value = resourceManager

    await vm.saveResourceSettings({
      profiles: [{ name: 'default', paths: ['D:/maa'], schema_path: '' }],
      index: 0
    })

    expect(resourceManager.handleResourceLoad).toHaveBeenCalledTimes(1)
    expect(vm.showResourceSettings.value).toBe(false)
  })
})
