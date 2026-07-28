import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useFlowWorkspaceVm } from '@/composables/viewModels/useFlowWorkspaceVm'
import { useAppConfigStore } from '@/stores/appConfig'
import type { FlowEditorPort } from '@/composables/viewModels/types'

const createEditorPort = (): FlowEditorPort => ({
  getEditorStatus: vi.fn(() => ({
    isDirty: false,
    nodeCount: 0,
    edgeCount: 0
  })),
  loadResourceFile: vi.fn().mockResolvedValue(undefined),
  handleLoadNodesWrapper: vi.fn().mockResolvedValue(undefined),
  handleLoadImages: vi.fn(),
  handleSaveNodes: vi.fn().mockResolvedValue(undefined),
  handleDeviceConnected: vi.fn(),
  handleUpdateCanvasConfig: vi.fn(),
  handleUpdatePipelineVersion: vi.fn(),
  handleApplyLayout: vi.fn().mockResolvedValue(undefined),
  handleLocateNode: vi.fn(),
  handleDebugNodeFromPanel: vi.fn(),
  getDebugContext: vi.fn(() => ({
    nodes: [],
    currentFilename: '',
    currentSource: ''
  })),
  handleUpdateNodeStatus: vi.fn(),
  closeTransientUi: vi.fn()
})

const createDeferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useFlowWorkspaceVm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  it('adds, selects, and closes tabs through the workspace store', async () => {
    const vm = useFlowWorkspaceVm()

    vm.addTab()
    vm.addTab()
    await nextTick()

    expect(vm.tabs.value.items).toHaveLength(2)
    const firstTabId = vm.tabs.value.items[0].id
    const secondTabId = vm.tabs.value.items[1].id

    vm.selectTab(firstTabId)
    expect(vm.activeTabId.value).toBe(firstTabId)

    vm.closeTab(secondTabId)
    expect(vm.tabs.value.items).toHaveLength(1)
    expect(vm.tabs.value.items[0].id).toBe(firstTabId)
  })

  it('exposes whether resources are loaded for the workspace empty state', () => {
    const store = useAppConfigStore()
    const vm = useFlowWorkspaceVm()

    expect(vm.resourceLoaded.value).toBe(false)

    store.markResourceLoaded()

    expect(vm.resourceLoaded.value).toBe(true)
  })

  it('loads nodes into the ensured workspace tab and binds the resource file', async () => {
    const vm = useFlowWorkspaceVm()
    const tab = useAppConfigStore().ensureWorkspaceTab()
    const editor = createEditorPort()
    vm.registerEditor(tab.id, editor)

    await vm.handleLoadNodes({
      filename: 'pipeline.json',
      source: 'D:/maa',
      nodes: {
        Start: { id: 'Start', recognition: 'DirectHit' }
      },
      fileVersion: 'V1'
    })

    expect(editor.handleLoadNodesWrapper).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'pipeline.json',
      source: 'D:/maa'
    }))
    expect(vm.tabs.value.items[0].resourceFile).toBe('D:/maa|pipeline.json')
    expect(vm.tabs.value.items[0].title).toBe('pipeline.json')
  })

  it('loads nodes into the active tab instead of always updating the first tab', async () => {
    const vm = useFlowWorkspaceVm()
    vm.addTab()
    vm.addTab()
    await nextTick()

    const firstTab = vm.tabs.value.items[0]
    const secondTab = vm.tabs.value.items[1]
    const firstEditor = createEditorPort()
    const secondEditor = createEditorPort()
    vm.registerEditor(firstTab.id, firstEditor)
    vm.registerEditor(secondTab.id, secondEditor)
    vm.selectTab(secondTab.id)

    await vm.handleLoadNodes({
      filename: 'tasks.json',
      source: 'D:/maa',
      nodes: {
        Task: { id: 'Task', recognition: 'DirectHit' }
      },
      fileVersion: 'V1'
    })

    expect(firstEditor.handleLoadNodesWrapper).not.toHaveBeenCalled()
    expect(secondEditor.handleLoadNodesWrapper).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'tasks.json',
      source: 'D:/maa'
    }))
    expect(vm.tabs.value.items[0].resourceFile).toBe('')
    expect(vm.tabs.value.items[1].resourceFile).toBe('D:/maa|tasks.json')
    expect(vm.tabs.value.items[1].title).toBe('tasks.json')
  })

  it('loads nodes synchronously for an already registered editor before images can be routed', async () => {
    const vm = useFlowWorkspaceVm()
    const tab = useAppConfigStore().ensureWorkspaceTab()
    const calls: string[] = []
    const editor = createEditorPort()
    editor.handleLoadNodesWrapper = vi.fn().mockImplementation(async () => {
      calls.push('nodes')
    })
    editor.handleLoadImages = vi.fn(() => {
      calls.push('images')
    })
    vm.registerEditor(tab.id, editor)

    const loadPromise = vm.handleLoadNodes({
      filename: 'pipeline.json',
      source: 'D:/maa',
      nodes: {
        Start: { id: 'Start', recognition: 'DirectHit' }
      },
      fileVersion: 'V1'
    })
    vm.handleLoadImages({ Start: [{ path: 'a.png' }] })
    await loadPromise

    expect(calls).toEqual(['nodes', 'images'])
  })

  it('routes debug panel state and active editor actions', () => {
    const vm = useFlowWorkspaceVm()
    vm.addTab()
    const tab = vm.tabs.value.items[0]
    const editor = createEditorPort()
    vm.registerEditor(tab.id, editor)

    vm.openDebugPanel({ nodeId: 'Start', mode: 'recognition_only' })
    expect(vm.debugPanel.value).toEqual({
      visible: true,
      nodeId: 'Start',
      mode: 'recognition_only'
    })

    vm.handleDeviceConnected(true)
    expect(editor.handleDeviceConnected).toHaveBeenCalledWith(true)

    vm.closeDebugPanel()
    expect(vm.debugPanel.value).toEqual({ visible: false, nodeId: '', mode: 'direct' })

    vm.closeEditorTransientUi()
    expect(editor.closeTransientUi).toHaveBeenCalledOnce()
  })

  it('syncs canvas settings to newly registered editors without laying out hidden canvases', () => {
    const store = useAppConfigStore()
    store.updateCanvasSettings({
      edgeType: 'default',
      spacing: 'compact',
      layoutAlgorithm: 'stress',
      layoutDirection: 'LR'
    })
    const vm = useFlowWorkspaceVm()
    const tab = store.ensureWorkspaceTab()
    const editor = createEditorPort()

    vm.registerEditor(tab.id, editor)

    expect(editor.handleUpdateCanvasConfig).toHaveBeenCalledWith({
      edgeType: 'default',
      spacing: 'compact',
      layoutAlgorithm: 'stress',
      layoutDirection: 'LR'
    }, { applyLayout: false })
  })

  it('keeps repeated function-ref registration and identical status reports idempotent', () => {
    const store = useAppConfigStore()
    const vm = useFlowWorkspaceVm()
    const tab = store.ensureWorkspaceTab()
    const editor = createEditorPort()

    vm.registerEditor(tab.id, editor)
    const statusesAfterRegistration = vm.editorStatuses.value
    vm.registerEditor(tab.id, editor)
    vm.handleEditorStatusChange(tab.id, editor.getEditorStatus())

    expect(vm.editorStatuses.value).toBe(statusesAfterRegistration)
    expect(editor.handleUpdateCanvasConfig).toHaveBeenCalledTimes(1)
  })

  it('updates every editor config but only lays out the active canvas', async () => {
    const vm = useFlowWorkspaceVm()
    vm.addTab()
    vm.addTab()
    await nextTick()
    const [firstTab, secondTab] = vm.tabs.value.items
    const firstEditor = createEditorPort()
    const secondEditor = createEditorPort()
    vm.registerEditor(firstTab.id, firstEditor)
    vm.registerEditor(secondTab.id, secondEditor)
    vm.selectTab(secondTab.id)
    vi.mocked(firstEditor.handleUpdateCanvasConfig).mockClear()
    vi.mocked(secondEditor.handleUpdateCanvasConfig).mockClear()

    await vm.handleUpdateCanvasConfig({ spacing: 'compact' })

    expect(firstEditor.handleUpdateCanvasConfig).toHaveBeenCalledWith(
      { spacing: 'compact' },
      { applyLayout: false }
    )
    expect(secondEditor.handleUpdateCanvasConfig).toHaveBeenCalledWith(
      { spacing: 'compact' },
      { applyLayout: true }
    )
  })

  it('lets the restored active editor perform exactly one initial layout after loading resources', async () => {
    const vm = useFlowWorkspaceVm()
    const editor = createEditorPort()
    editor.loadResourceFile = vi.fn(async (_fileId, options) => {
      if (!options?.deferLayout) await editor.handleApplyLayout()
    })
    const tabs = [
      { id: 'tab-1', title: 'pipeline.json', resourceFile: 'D:/maa|pipeline.json' }
    ]

    const restorePromise = vm.handleRestoreTabs(tabs)
    await nextTick()
    vm.registerEditor('tab-1', editor)
    await restorePromise

    expect(editor.loadResourceFile).toHaveBeenCalledWith('D:/maa|pipeline.json', {
      deferLayout: false
    })
    expect(editor.handleApplyLayout).toHaveBeenCalledTimes(1)
    expect(vm.isRestoringWorkspace.value).toBe(false)
  })

  it('defers restored background tab layout until the tab becomes visible', async () => {
    const vm = useFlowWorkspaceVm()
    const firstEditor = createEditorPort()
    const secondEditor = createEditorPort()
    firstEditor.loadResourceFile = vi.fn(async (_fileId, options) => {
      if (!options?.deferLayout) await firstEditor.handleApplyLayout()
    })
    secondEditor.loadResourceFile = vi.fn(async (_fileId, options) => {
      if (!options?.deferLayout) await secondEditor.handleApplyLayout()
    })
    const tabs = [
      { id: 'tab-1', title: 'a.json', resourceFile: 'D:/maa|a.json' },
      { id: 'tab-2', title: 'b.json', resourceFile: 'D:/maa|b.json' }
    ]

    const restorePromise = vm.handleRestoreTabs(tabs)
    await nextTick()
    vm.registerEditor('tab-1', firstEditor)
    vm.registerEditor('tab-2', secondEditor)
    await restorePromise

    expect(firstEditor.handleApplyLayout).toHaveBeenCalledTimes(1)
    expect(secondEditor.handleApplyLayout).not.toHaveBeenCalled()
    expect(secondEditor.loadResourceFile).toHaveBeenCalledWith('D:/maa|b.json', {
      deferLayout: true
    })

    await vm.selectTab('tab-2')

    expect(secondEditor.handleApplyLayout).toHaveBeenCalledTimes(1)
  })

  it('exposes restore loading state while restored tab resources are loading', async () => {
    const vm = useFlowWorkspaceVm()
    const editor = createEditorPort()
    const deferred = createDeferred()
    editor.loadResourceFile = vi.fn(() => deferred.promise)
    const tabs = [
      { id: 'tab-1', title: 'pipeline.json', resourceFile: 'D:/maa|pipeline.json' }
    ]

    const restorePromise = vm.handleRestoreTabs(tabs)
    await nextTick()
    vm.registerEditor('tab-1', editor)
    await nextTick()

    expect(vm.isRestoringWorkspace.value).toBe(true)
    expect(vm.restoringWorkspaceCount.value).toBe(1)

    deferred.resolve()
    await restorePromise

    expect(vm.isRestoringWorkspace.value).toBe(false)
    expect(vm.restoringWorkspaceCount.value).toBe(0)
  })

  it('clears restore loading state when a restored tab fails and is closed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const vm = useFlowWorkspaceVm()
    const firstEditor = createEditorPort()
    const secondEditor = createEditorPort()
    secondEditor.loadResourceFile = vi.fn().mockRejectedValue(new Error('load failed'))
    const tabs = [
      { id: 'tab-1', title: 'a.json', resourceFile: 'D:/maa|a.json' },
      { id: 'tab-2', title: 'b.json', resourceFile: 'D:/maa|b.json' }
    ]

    const restorePromise = vm.handleRestoreTabs(tabs)
    await nextTick()
    vm.registerEditor('tab-1', firstEditor)
    vm.registerEditor('tab-2', secondEditor)
    await restorePromise

    expect(vm.isRestoringWorkspace.value).toBe(false)
    expect(vm.tabs.value.items).toHaveLength(1)
    expect(vm.tabs.value.items[0].id).toBe('tab-1')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('does not leave restore loading active when a restored tab editor is unavailable', async () => {
    const vm = useFlowWorkspaceVm()
    const tabs = [
      { id: 'tab-1', title: 'pipeline.json', resourceFile: 'D:/maa|pipeline.json' }
    ]

    await vm.handleRestoreTabs(tabs)

    expect(vm.isRestoringWorkspace.value).toBe(false)
    expect(vm.restoringWorkspaceCount.value).toBe(0)
  })

  it('tracks dirty tabs and saves every modified resource file', async () => {
    const store = useAppConfigStore()
    store.setTabs([
      { id: 'tab-1', title: 'a.json', resourceFile: 'D:/resource-a|folder/a.json' },
      { id: 'tab-2', title: 'b.json', resourceFile: 'D:/resource-b|b.json' }
    ], 'tab-1')
    const vm = useFlowWorkspaceVm()
    const firstEditor = createEditorPort()
    const secondEditor = createEditorPort()
    vi.mocked(firstEditor.getEditorStatus).mockReturnValue({
      isDirty: true,
      nodeCount: 1,
      edgeCount: 0
    })
    vi.mocked(secondEditor.getEditorStatus).mockReturnValue({
      isDirty: true,
      nodeCount: 1,
      edgeCount: 0
    })

    vm.registerEditor('tab-1', firstEditor)
    vm.registerEditor('tab-2', secondEditor)

    expect(vm.hasDirtyTabs.value).toBe(true)
    expect([...vm.dirtyTabIds.value]).toEqual(['tab-1', 'tab-2'])

    await vm.handleSaveAllNodes()

    expect(firstEditor.handleSaveNodes).toHaveBeenCalledWith({
      source: 'D:/resource-a',
      filename: 'folder/a.json'
    })
    expect(secondEditor.handleSaveNodes).toHaveBeenCalledWith({
      source: 'D:/resource-b',
      filename: 'b.json'
    })
  })

  it('reactively tracks status changes from every editor while only exposing the active status', () => {
    const store = useAppConfigStore()
    store.setTabs([
      { id: 'tab-1', title: 'a.json', resourceFile: 'D:/maa|a.json' },
      { id: 'tab-2', title: 'b.json', resourceFile: 'D:/maa|b.json' }
    ], 'tab-1')
    const vm = useFlowWorkspaceVm()
    vm.registerEditor('tab-1', createEditorPort())
    vm.registerEditor('tab-2', createEditorPort())

    vm.handleEditorStatusChange('tab-2', {
      isDirty: true,
      nodeCount: 3,
      edgeCount: 2
    })

    expect([...vm.dirtyTabIds.value]).toEqual(['tab-2'])
    expect(vm.hasDirtyTabs.value).toBe(true)
    expect(vm.activeEditorStatus.value.isDirty).toBe(false)

    vm.selectTab('tab-2')
    expect(vm.activeEditorStatus.value).toEqual({
      isDirty: true,
      nodeCount: 3,
      edgeCount: 2
    })

    vm.handleEditorStatusChange('tab-2', {
      isDirty: false,
      nodeCount: 3,
      edgeCount: 2
    })
    expect(vm.hasDirtyTabs.value).toBe(false)
  })
})
