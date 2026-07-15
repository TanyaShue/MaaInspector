import { computed, nextTick, ref } from 'vue'
import { useTabManager } from '@/composables/useTabManager'
import { useMainAppState } from '@/composables/useMainAppState'
import { useAppConfigStore } from '@/stores/appConfig'
import type { FlowBusinessData, LayoutAlgorithm, LayoutDirection, SpacingKey } from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import type { TabResourceInfo } from '@/utils/flowWorkspaceTypes'
import type { DebugPanelState, FlowEditorPort, InfoPanelPort } from './types'

export function useFlowWorkspaceVm() {
  const appConfig = useAppConfigStore()
  const {
    tabs,
    activeTabId,
    appSettings,
    editorRefs,
    makeTabTitle,
    selectTab: tabManagerSelectTab,
    addTab: tabManagerAddTab,
    closeTab: tabManagerCloseTab,
    updateTabResourceFile,
    restoreTabsFromResource,
    resetToInitialState,
    ensureWorkspaceTab
  } = useTabManager()

  const { updateTabs, clearTabs: clearMainTabs } = useMainAppState()

  const infoPanelRef = ref<InfoPanelPort | null>(null)
  const debugPanel = ref<DebugPanelState>({ visible: false, nodeId: '' })
  const pendingVisibleLayoutTabs = ref<Set<string>>(new Set())
  const loadingRestoredTabs = ref<Set<string>>(new Set())

  const activeTab = computed(() => tabs.value.items.find(t => t.id === activeTabId.value) || tabs.value.items[0] || null)
  const activeEditorRef = computed(() => editorRefs.value.get(activeTabId.value) || null)
  const activeEditorStatus = computed(() => activeEditorRef.value?.getEditorStatus() ?? {
    isDirty: false,
    nodeCount: 0,
    edgeCount: 0
  })
  const restoringWorkspaceCount = computed(() => loadingRestoredTabs.value.size)
  const isRestoringWorkspace = computed(() => restoringWorkspaceCount.value > 0)

  const registerEditor = (tabId: string, editor: FlowEditorPort | null) => {
    if (editor) {
      editorRefs.value.set(tabId, editor)
      void editor.handleUpdateCanvasConfig({
        edgeType: appSettings.value.edgeType,
        spacing: appSettings.value.spacing,
        layoutAlgorithm: appSettings.value.layoutAlgorithm,
        layoutDirection: appSettings.value.layoutDirection
      }, { applyLayout: false })
    } else {
      editorRefs.value.delete(tabId)
    }
  }

  const registerActiveEditor = (editor: FlowEditorPort | null) => {
    if (!activeTabId.value) return
    registerEditor(activeTabId.value, editor)
  }

  const waitForEditor = async (tabId: string, maxTicks = 5): Promise<FlowEditorPort | null> => {
    let editor = editorRefs.value.get(tabId) || null
    for (let i = 0; !editor && i < maxTicks; i++) {
      await nextTick()
      editor = editorRefs.value.get(tabId) || null
    }
    return editor
  }

  const markTabLayoutPending = (tabId: string) => {
    pendingVisibleLayoutTabs.value = new Set([...pendingVisibleLayoutTabs.value, tabId])
  }

  const markRestoredTabLoading = (tabId: string) => {
    loadingRestoredTabs.value = new Set([...loadingRestoredTabs.value, tabId])
  }

  const clearTabLayoutPending = (tabId: string) => {
    const nextPending = new Set(pendingVisibleLayoutTabs.value)
    nextPending.delete(tabId)
    pendingVisibleLayoutTabs.value = nextPending
  }

  const clearRestoredTabLoading = (tabId: string) => {
    const nextLoading = new Set(loadingRestoredTabs.value)
    nextLoading.delete(tabId)
    loadingRestoredTabs.value = nextLoading
  }

  const waitForVisibleFrame = async () => {
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }

  const applyVisibleTabLayout = async (tabId: string, options: { allowWhileLoading?: boolean } = {}) => {
    const editor = await waitForEditor(tabId)
    if (!editor || !pendingVisibleLayoutTabs.value.has(tabId)) return
    if (!options.allowWhileLoading && loadingRestoredTabs.value.has(tabId)) return
    await waitForVisibleFrame()
    await editor.handleApplyLayout()
    clearTabLayoutPending(tabId)
  }

  const selectTab = (tabId: string) => {
    tabManagerSelectTab(tabId)
    const layoutPromise = applyVisibleTabLayout(tabId)

    const targetTab = tabs.value.items.find(t => t.id === tabId)
    appConfig.selectResourceFile(targetTab?.resourceFile || '')
    if (!targetTab?.resourceFile) return layoutPromise

    const [source, filename] = targetTab.resourceFile.split('|')
    if (!source || !filename) return layoutPromise

    infoPanelRef.value?.triggerLoadFromCache?.({
      filename,
      source,
      tabId
    })
    return layoutPromise
  }

  const addTab = () => {
    tabManagerAddTab()
    appConfig.selectResourceFile('')
  }

  const closeTab = (tabId: string) => {
    tabManagerCloseTab(tabId)
    appConfig.selectResourceFile(activeTab.value?.resourceFile || '')
  }

  const handleRequestSwitchFile = async (payload: { filename: string; source: string }) => {
    await infoPanelRef.value?.executeFileSwitch?.(payload.filename, payload.source)
  }

  const openDebugPanel = (payload?: { nodeId?: string }) => {
    debugPanel.value = {
      visible: true,
      nodeId: payload?.nodeId || ''
    }
  }

  const closeDebugPanel = () => {
    debugPanel.value = { visible: false, nodeId: '' }
  }

  const handleLoadNodes = async (payload: {
    filename: string
    source: string
    nodes: Record<string, FlowBusinessData>
    fileVersion?: 'V1' | 'V2'
  }) => {
    const tab = activeTab.value || ensureWorkspaceTab()
    let targetEditor = editorRefs.value.get(tab.id)
    if (!targetEditor) {
      await nextTick()
      targetEditor = editorRefs.value.get(tab.id)
    }
    if (!targetEditor) return
    await targetEditor.handleLoadNodesWrapper(payload)
    const resourceFile = `${payload.source}|${payload.filename}`
    updateTabResourceFile(tab.id, resourceFile, payload.filename)
    appConfig.selectResourceFile(resourceFile)
  }

  const handleLoadImages = (payload: Record<string, unknown>, basePath?: string) => {
    activeEditorRef.value?.handleLoadImages(payload, basePath)
  }

  const applyActiveEditorLayout = async () => {
    await activeEditorRef.value?.handleApplyLayout()
  }

  const handleUpdateCanvasConfig = async (payload: {
    edgeType?: EdgeType
    spacing?: SpacingKey
    layoutAlgorithm?: LayoutAlgorithm
    layoutDirection?: LayoutDirection
  }) => {
    appConfig.updateCanvasSettings(payload)
    const activeId = activeTabId.value
    const updates = Array.from(editorRefs.value.entries()).map(([tabId, editor]) =>
      editor.handleUpdateCanvasConfig(payload, { applyLayout: tabId === activeId })
    )
    await Promise.all(updates)
  }

  const handleUpdatePipelineVersion = (val: 'V1' | 'V2') => {
    activeEditorRef.value?.handleUpdatePipelineVersion(val)
  }

  const handleRestoreTabs = async (lastTabs: TabResourceInfo[]) => {
    restoreTabsFromResource(lastTabs)
    lastTabs
      .filter(tab => tab.resourceFile)
      .forEach(tab => {
        markTabLayoutPending(tab.id)
        markRestoredTabLoading(tab.id)
      })

    await nextTick()
    for (let i = 0; i < lastTabs.length; i++) {
      const tab = tabs.value.items[i]
      if (tab && lastTabs[i].resourceFile) {
        const editor = await waitForEditor(tab.id)
        if (!editor) {
          clearRestoredTabLoading(tab.id)
          clearTabLayoutPending(tab.id)
          continue
        }

        try {
          const deferLayout = tab.id !== activeTabId.value
          await editor.loadResourceFile(lastTabs[i].resourceFile, { deferLayout })
          if (!deferLayout) {
            clearTabLayoutPending(tab.id)
          }
        } catch (error) {
          console.warn(`Failed to load resource for tab ${tab.title}`, error)
          clearTabLayoutPending(tab.id)
          tabManagerCloseTab(tab.id)
        } finally {
          clearRestoredTabLoading(tab.id)
        }
      }
    }

    updateTabs(tabs.value.items, activeTabId.value)
  }

  const handleClearTabs = () => {
    pendingVisibleLayoutTabs.value = new Set()
    loadingRestoredTabs.value = new Set()
    resetToInitialState()
    clearMainTabs()
  }

  const handleDeviceConnected = (val: boolean) => {
    activeEditorRef.value?.handleDeviceConnected(val)
  }

  return {
    tabs,
    activeTabId,
    appSettings,
    infoPanelRef,
    debugPanel,
    activeTab,
    activeEditorRef,
    activeEditorStatus,
    isRestoringWorkspace,
    restoringWorkspaceCount,
    makeTabTitle,
    registerEditor,
    registerActiveEditor,
    selectTab,
    addTab,
    closeTab,
    handleRequestSwitchFile,
    openDebugPanel,
    closeDebugPanel,
    applyActiveEditorLayout,
    handleLoadNodes,
    handleLoadImages,
    handleUpdateCanvasConfig,
    handleUpdatePipelineVersion,
    handleRestoreTabs,
    handleClearTabs,
    handleDeviceConnected
  }
}
