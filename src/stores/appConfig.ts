import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { systemApi, resourceApi, deviceApi, agentApi } from '@/services/api'
import type {
  ResourceProfile,
  SystemInitResponse,
  DeviceConfigPayload,
  ApiDeviceInfo,
  WorkspaceState,
  CustomCompletionRules,
  StoragePaths,
} from '@/services/api'
import type { AgentProfile } from '@/services/api'
import type { EdgeType } from '@/utils/flowOptions'
import type { LayoutAlgorithm, LayoutDirection, SpacingKey } from '@/utils/flowTypes'
import type { TabResourceInfo } from '@/utils/flowWorkspaceTypes'
import {
  buildResourceSignature,
  legacyTabsToWorkspaceState,
  toPersistedTabs,
  toRuntimeTabs,
} from '@/utils/workspaceState'

export type NodeNamePrefixMode = 'random' | 'filename' | 'custom'

interface CanvasSettings {
  edgeType: EdgeType
  spacing: SpacingKey
  layoutAlgorithm: LayoutAlgorithm
  layoutDirection: LayoutDirection
  pipelineVersion: 'V1' | 'V2'
  lowMemoryMode: boolean
  restoreWorkspaceOnStart: boolean
  nodeNamePrefixEnabled: boolean
  nodeNamePrefixMode: NodeNamePrefixMode
  nodeNameCustomPrefix: string
}

interface ResourceState {
  profiles: ResourceProfile[]
  profileIndex: number
  selectedFileId: string
  loaded: boolean
  signature: string
  lastWorkspace: WorkspaceState | null
  customCompletions: CustomCompletionRules
}

interface DeviceState {
  status: 'connected' | 'disconnected' | 'loading' | 'error'
  currentDevice: ApiDeviceInfo | null
  lastSearched: ApiDeviceInfo[]
  lastDevice: ApiDeviceInfo | null
}

interface AgentState {
  socketId: string | null
  status: 'connected' | 'disconnected' | 'loading' | 'error'
  message: string
}

interface TabState {
  items: TabResourceInfo[]
  activeTabId: string
}

interface SystemState {
  status: 'connected' | 'disconnected' | 'loading' | 'error'
  initialized: boolean
  isSaving: boolean
}

const DEFAULT_CANVAS: CanvasSettings = {
  edgeType: 'smoothstep',
  spacing: 'normal',
  layoutAlgorithm: 'layered',
  layoutDirection: 'TB',
  pipelineVersion: 'V1',
  lowMemoryMode: false,
  restoreWorkspaceOnStart: true,
  nodeNamePrefixEnabled: true,
  nodeNamePrefixMode: 'filename',
  nodeNameCustomPrefix: '',
}

const createEmptyWorkspace = (): TabState => ({
  items: [],
  activeTabId: '',
})

const createInitialTab = (): TabResourceInfo => ({
  id: `flow-${crypto.randomUUID()}`,
  title: '流程 1',
  resourceFile: '',
})

const cloneTab = (tab: TabResourceInfo): TabResourceInfo => ({
  id: tab.id || `flow-${crypto.randomUUID()}`,
  title: tab.title || '',
  resourceFile: tab.resourceFile || '',
})

export const useAppConfigStore = defineStore('appConfig', () => {
  const canvas = ref<CanvasSettings>({ ...DEFAULT_CANVAS })
  const resource = ref<ResourceState>({
    profiles: [],
    profileIndex: 0,
    selectedFileId: '',
    loaded: false,
    signature: '',
    lastWorkspace: null,
    customCompletions: { action: [], recognition: [] },
  })
  const device = ref<DeviceState>({
    status: 'disconnected',
    currentDevice: null,
    lastSearched: [],
    lastDevice: null,
  })
  const agent = ref<AgentState>({
    socketId: null,
    status: 'disconnected',
    message: 'Agent 未连接',
  })
  const tabs = ref<TabState>(createEmptyWorkspace())
  const system = ref<SystemState>({
    status: 'disconnected',
    initialized: false,
    isSaving: false,
  })
  const storage = ref<StoragePaths>({
    log_dir: '',
    config_dir: '',
    default_config_dir: '',
  })

  const currentProfile = computed(
    () => resource.value.profiles[resource.value.profileIndex] || { name: 'None', paths: [] }
  )

  const currentWorkspace = computed<WorkspaceState | null>(() => {
    if (!resource.value.loaded && tabs.value.items.length === 0) return null
    return {
      resource_index: resource.value.profileIndex,
      resource_signature: resource.value.signature || undefined,
      tabs: toPersistedTabs(tabs.value.items),
      active_tab_id: tabs.value.activeTabId || undefined,
      restore_workspace_on_start: canvas.value.restoreWorkspaceOnStart,
    }
  })

  const cachedLastTabs = computed(() => {
    const workspace = currentWorkspace.value
    if (!workspace) return null
    return {
      resource_index: workspace.resource_index ?? 0,
      tabs: (workspace.tabs || []).map((tab) => ({
        id: tab.id || '',
        title: tab.title || '',
        resource_file: tab.resource_file || '',
      })),
      active_tab_id: workspace.active_tab_id,
    }
  })

  const isDirty = computed(() => tabs.value.items.some((t) => t.resourceFile !== ''))

  function normalizeProfiles(profiles?: ResourceProfile[]): ResourceProfile[] {
    return (profiles || []).map((p) => ({
      ...p,
      paths: Array.isArray((p as Record<string, unknown>).paths)
        ? [...((p as Record<string, unknown>).paths as string[])]
        : [],
      schema_path: typeof p.schema_path === 'string' ? p.schema_path : '',
      interface_path: typeof p.interface_path === 'string' ? p.interface_path : '',
      agent: p.agent
        ? {
            child_exec: p.agent.child_exec || '',
            child_args: Array.isArray(p.agent.child_args) ? [...p.agent.child_args] : [],
            working_directory: p.agent.working_directory || '',
            socket_id: p.agent.socket_id || '',
            auto_start: p.agent.auto_start !== false,
            environment: { ...(p.agent.environment || {}) },
          }
        : undefined,
    }))
  }

  function setTabs(items: TabResourceInfo[], activeTabId: string) {
    tabs.value.items = items.map(cloneTab)
    tabs.value.activeTabId = activeTabId
    void saveToBackend()
  }

  function ensureWorkspaceTab() {
    if (tabs.value.items.length > 0) return tabs.value.items[0]
    const tab = createInitialTab()
    tabs.value.items = [tab]
    tabs.value.activeTabId = tab.id
    return tab
  }

  async function loadFromBackend() {
    system.value.status = 'loading'
    try {
      const data: SystemInitResponse = await systemApi.getInitialState()
      if (data.storage_paths) {
        storage.value = { ...data.storage_paths }
      }

      if (data.resource_profiles) {
        resource.value.profiles = normalizeProfiles(data.resource_profiles)
        const idx = data.current_resource_index ?? 0
        if (idx >= 0 && idx < resource.value.profiles.length) {
          resource.value.profileIndex = idx
        }
      }

      if (data.canvas_settings) {
        const s = data.canvas_settings
        if (s.edge_type) canvas.value.edgeType = s.edge_type as EdgeType
        if (s.spacing) canvas.value.spacing = s.spacing as SpacingKey
        if (s.layout_algorithm) canvas.value.layoutAlgorithm = s.layout_algorithm as LayoutAlgorithm
        if (s.layout_direction) canvas.value.layoutDirection = s.layout_direction as LayoutDirection
        if (s.pipeline_version === 'V1' || s.pipeline_version === 'V2') {
          canvas.value.pipelineVersion = s.pipeline_version
        }
      }

      if (typeof data.restore_workspace_on_start === 'boolean') {
        canvas.value.restoreWorkspaceOnStart = data.restore_workspace_on_start
      }
      if (typeof data.canvas_settings?.node_name_prefix_enabled === 'boolean') {
        canvas.value.nodeNamePrefixEnabled = data.canvas_settings.node_name_prefix_enabled
        canvas.value.nodeNamePrefixMode = data.canvas_settings.node_name_prefix_enabled
          ? 'filename'
          : 'random'
      }
      if (['random', 'filename', 'custom'].includes(data.canvas_settings?.node_name_prefix_mode || '')) {
        canvas.value.nodeNamePrefixMode = data.canvas_settings?.node_name_prefix_mode as NodeNamePrefixMode
        canvas.value.nodeNamePrefixEnabled = canvas.value.nodeNamePrefixMode !== 'random'
      }
      if (typeof data.canvas_settings?.node_name_custom_prefix === 'string') {
        canvas.value.nodeNameCustomPrefix = data.canvas_settings.node_name_custom_prefix
      }

      resource.value.signature = buildResourceSignature(
        resource.value.profiles[resource.value.profileIndex]
      )

      if (data.workspace_state) {
        resource.value.lastWorkspace = data.workspace_state
      } else if (data.last_tabs) {
        resource.value.lastWorkspace = legacyTabsToWorkspaceState(
          data.last_tabs,
          buildResourceSignature(resource.value.profiles[resource.value.profileIndex]),
          canvas.value.restoreWorkspaceOnStart
        )
      }

      if (data.agent_socket_id) {
        agent.value.socketId = data.agent_socket_id
        agent.value.status = 'disconnected'
      }
      if (currentProfile.value.agent?.socket_id) {
        agent.value.socketId = currentProfile.value.agent.socket_id
      }

      device.value.lastDevice = data.last_device ?? null

      system.value.status = 'connected'
      system.value.initialized = true
    } catch (e) {
      console.error('Init failed', e)
      system.value.status = 'error'
    }
  }

  async function saveToBackend() {
    if (!system.value.initialized || system.value.status !== 'connected') return
    system.value.isSaving = true
    try {
      const workspace = currentWorkspace.value
      const workspaceToSave = workspace ?? resource.value.lastWorkspace ?? undefined
      const payload: DeviceConfigPayload = {
        resource_profiles: resource.value.profiles,
        current_resource_index: resource.value.profileIndex,
        agent_socket_id: agent.value.socketId || '',
        last_device: device.value.lastDevice ?? undefined,
        canvas_settings: {
          edge_type: canvas.value.edgeType,
          spacing: canvas.value.spacing,
          layout_algorithm: canvas.value.layoutAlgorithm,
          layout_direction: canvas.value.layoutDirection,
          pipeline_version: canvas.value.pipelineVersion,
          node_name_prefix_enabled: canvas.value.nodeNamePrefixEnabled,
          node_name_prefix_mode: canvas.value.nodeNamePrefixMode,
          node_name_custom_prefix: canvas.value.nodeNameCustomPrefix,
        },
        restore_workspace_on_start: canvas.value.restoreWorkspaceOnStart,
        workspace_state: workspaceToSave,
        last_tabs: workspaceToSave
          ? {
              resource_index: workspaceToSave.resource_index ?? 0,
              tabs: toPersistedTabs(workspaceToSave.tabs).map((tab) => ({
                id: tab.id,
                title: tab.title,
                resource_file: tab.resource_file,
              })),
              active_tab_id: workspaceToSave.active_tab_id,
            }
          : undefined,
      }
      await systemApi.saveDeviceConfig(payload)
    } catch (e) {
      console.error('Auto save failed', e)
    } finally {
      system.value.isSaving = false
    }
  }

  function updateCanvasSettings(partial: Partial<CanvasSettings>) {
    if (partial.edgeType !== undefined) canvas.value.edgeType = partial.edgeType
    if (partial.spacing !== undefined) canvas.value.spacing = partial.spacing
    if (partial.layoutAlgorithm !== undefined)
      canvas.value.layoutAlgorithm = partial.layoutAlgorithm
    if (partial.layoutDirection !== undefined)
      canvas.value.layoutDirection = partial.layoutDirection
    if (partial.pipelineVersion !== undefined)
      canvas.value.pipelineVersion = partial.pipelineVersion
    if (partial.lowMemoryMode !== undefined) canvas.value.lowMemoryMode = partial.lowMemoryMode
    if (partial.restoreWorkspaceOnStart !== undefined)
      canvas.value.restoreWorkspaceOnStart = partial.restoreWorkspaceOnStart
    if (partial.nodeNamePrefixEnabled !== undefined)
      canvas.value.nodeNamePrefixEnabled = partial.nodeNamePrefixEnabled
    if (partial.nodeNamePrefixEnabled !== undefined && partial.nodeNamePrefixMode === undefined)
      canvas.value.nodeNamePrefixMode = partial.nodeNamePrefixEnabled ? 'filename' : 'random'
    if (partial.nodeNamePrefixMode !== undefined) {
      canvas.value.nodeNamePrefixMode = partial.nodeNamePrefixMode
      canvas.value.nodeNamePrefixEnabled = partial.nodeNamePrefixMode !== 'random'
    }
    if (partial.nodeNameCustomPrefix !== undefined)
      canvas.value.nodeNameCustomPrefix = partial.nodeNameCustomPrefix
    void saveToBackend()
  }

  async function switchResourceProfile(index: number) {
    resource.value.profileIndex = index
    resource.value.loaded = false
    resource.value.selectedFileId = ''
    resource.value.customCompletions = { action: [], recognition: [] }
    resource.value.signature = buildResourceSignature(resource.value.profiles[index])
    tabs.value = createEmptyWorkspace()
    agent.value.socketId = resource.value.profiles[index]?.agent?.socket_id || null
    agent.value.status = 'disconnected'
    agent.value.message = 'Agent 未连接'
    await saveToBackend()
  }

  async function updateResourceProfiles(profiles: ResourceProfile[], index?: number) {
    resource.value.profiles = normalizeProfiles(profiles)
    if (index !== undefined && index >= 0 && index < resource.value.profiles.length) {
      resource.value.profileIndex = index
    }
    if (resource.value.profileIndex >= resource.value.profiles.length) {
      resource.value.profileIndex = 0
    }
    resource.value.signature = buildResourceSignature(
      resource.value.profiles[resource.value.profileIndex]
    )
    await saveToBackend()
  }

  function selectResourceFile(fileId: string) {
    resource.value.selectedFileId = fileId
  }

  function setResourceLoaded(loaded: boolean) {
    resource.value.loaded = loaded
  }

  function markResourceLoaded() {
    resource.value.loaded = true
    resource.value.signature = buildResourceSignature(currentProfile.value)
    void saveToBackend()
  }

  function setCustomCompletions(rules?: CustomCompletionRules) {
    resource.value.customCompletions = {
      action: [...(rules?.action || [])],
      recognition: [...(rules?.recognition || [])],
    }
  }

  async function loadResource() {
    const profile = currentProfile.value
    if (!profile.paths || profile.paths.length === 0) return
    resource.value.signature = buildResourceSignature(profile)
    const response = await resourceApi.load(profile)
    setCustomCompletions(response.custom_completions)
  }

  function setDeviceStatus(status: DeviceState['status'], deviceInfo?: ApiDeviceInfo | null) {
    device.value.status = status
    if (deviceInfo !== undefined) device.value.currentDevice = deviceInfo
  }

  function rememberDevice(deviceInfo: ApiDeviceInfo) {
    device.value.lastDevice = { ...deviceInfo }
    void saveToBackend()
  }

  function setSearchedDevices(devices: ApiDeviceInfo[]) {
    device.value.lastSearched = devices
  }

  async function connectAdb(deviceData: {
    adb_path: string
    address: string
    config?: Record<string, unknown>
    name?: string
  }) {
    device.value.status = 'loading'
    try {
      await deviceApi.connectAdb(deviceData)
      device.value.status = 'connected'
      device.value.currentDevice = deviceData as ApiDeviceInfo
    } catch (e) {
      device.value.status = 'error'
      throw e
    }
  }

  async function connectWin32(deviceData: {
    hwnd: number | string
    name?: string
    window_name?: string
    class_name?: string
    screencap_method?: number
    mouse_method?: number
    keyboard_method?: number
  }) {
    device.value.status = 'loading'
    try {
      await deviceApi.connectWin32(deviceData)
      device.value.status = 'connected'
      device.value.currentDevice = deviceData as ApiDeviceInfo
    } catch (e) {
      device.value.status = 'error'
      throw e
    }
  }

  async function searchDevices(type?: string) {
    device.value.status = 'loading'
    try {
      const res = await systemApi.searchDevices(type)
      device.value.lastSearched = (res.data?.devices || []) as ApiDeviceInfo[]
      device.value.status = 'disconnected'
    } catch (e) {
      device.value.status = 'error'
      throw e
    }
  }

  function setAgentStatus(status: AgentState['status'], message?: string) {
    agent.value.status = status
    if (message) agent.value.message = message
  }

  async function updateCurrentAgentSettings(settings: AgentProfile) {
    const profile = resource.value.profiles[resource.value.profileIndex]
    if (!profile) return
    profile.agent = {
      ...settings,
      child_args: [...settings.child_args],
      environment: { ...(settings.environment || {}) },
    }
    agent.value.socketId = settings.socket_id || null
    await saveToBackend()
  }

  async function connectAgent(socketId?: string) {
    agent.value.status = 'loading'
    try {
      const profileAgent = currentProfile.value.agent
      const resolvedSocketId = (socketId || profileAgent?.socket_id || '').trim()
      if (!resolvedSocketId) throw new Error('请先设置 Socket ID')
      if (profileAgent) {
        await agentApi.start({ ...profileAgent, socket_id: resolvedSocketId })
      }
      const response = await agentApi.connect(resolvedSocketId)
      if (response.success === false) {
        throw new Error(response.message || 'Agent 连接失败')
      }
      agent.value.socketId = resolvedSocketId
      agent.value.status = 'connected'
      agent.value.message = 'Agent 已连接'
      await saveToBackend()
    } catch (e) {
      agent.value.status = 'error'
      agent.value.message = 'Agent 连接失败'
      throw e
    }
  }

  function addTab(tab: TabResourceInfo) {
    tabs.value.items.push(cloneTab(tab))
    tabs.value.activeTabId = tab.id
    void saveToBackend()
  }

  function closeTab(tabId: string) {
    if (tabs.value.items.length <= 1) return
    const idx = tabs.value.items.findIndex((t) => t.id === tabId)
    if (idx < 0) return
    tabs.value.items.splice(idx, 1)
    if (tabs.value.activeTabId === tabId) {
      tabs.value.activeTabId =
        tabs.value.items[Math.max(0, idx - 1)]?.id || tabs.value.items[0]?.id || ''
    }
    void saveToBackend()
  }

  function selectTab(tabId: string) {
    tabs.value.activeTabId = tabId
  }

  function updateTabResourceFile(tabId: string, resourceFile: string, title?: string) {
    const tab = tabs.value.items.find((t) => t.id === tabId)
    if (!tab) return
    tab.resourceFile = resourceFile
    if (title) tab.title = title
    void saveToBackend()
  }

  function clearTabs() {
    tabs.value = createEmptyWorkspace()
    void saveToBackend()
  }

  function applyWorkspaceState(workspace?: WorkspaceState | null) {
    if (!workspace) {
      tabs.value = createEmptyWorkspace()
      return
    }

    const tabsToApply = toRuntimeTabs(workspace.tabs || [])
    const signature = workspace.resource_signature || ''
    if (signature && signature !== resource.value.signature) {
      tabs.value = createEmptyWorkspace()
      return
    }

    tabs.value.items = tabsToApply
    tabs.value.activeTabId = workspace.active_tab_id || tabsToApply[0]?.id || ''
  }

  function hydrateWorkspaceFromResource(resourceFile: string) {
    resource.value.loaded = true
    resource.value.selectedFileId = resourceFile
    ensureWorkspaceTab()
  }

  function canRestoreLastWorkspace() {
    if (!canvas.value.restoreWorkspaceOnStart) return false
    const lastWorkspace = resource.value.lastWorkspace
    if (!lastWorkspace) return false
    const currentSignature = buildResourceSignature(currentProfile.value)
    return Boolean(
      lastWorkspace.resource_signature && lastWorkspace.resource_signature === currentSignature
    )
  }

  function restoreLastWorkspace(validResourceFiles?: Set<string>) {
    if (!canRestoreLastWorkspace()) return []
    const lastWorkspace = resource.value.lastWorkspace
    const restoredTabs = toRuntimeTabs(lastWorkspace?.tabs || []).filter(
      (tab) => !validResourceFiles || validResourceFiles.has(tab.resourceFile)
    )

    if (restoredTabs.length === 0) {
      tabs.value = createEmptyWorkspace()
      return []
    }

    tabs.value.items = restoredTabs
    tabs.value.activeTabId = restoredTabs.some((tab) => tab.id === lastWorkspace?.active_tab_id)
      ? lastWorkspace?.active_tab_id || restoredTabs[0].id
      : restoredTabs[0].id
    resource.value.selectedFileId =
      restoredTabs.find((tab) => tab.id === tabs.value.activeTabId)?.resourceFile ||
      restoredTabs[0].resourceFile ||
      ''
    void saveToBackend()
    return restoredTabs
  }

  return {
    canvas,
    resource,
    device,
    agent,
    tabs,
    system,
    storage,
    currentProfile,
    isDirty,
    cachedLastTabs,
    loadFromBackend,
    saveToBackend,
    updateCanvasSettings,
    switchResourceProfile,
    updateResourceProfiles,
    selectResourceFile,
    setResourceLoaded,
    markResourceLoaded,
    setCustomCompletions,
    loadResource,
    setDeviceStatus,
    rememberDevice,
    setSearchedDevices,
    connectAdb,
    connectWin32,
    searchDevices,
    setAgentStatus,
    updateCurrentAgentSettings,
    connectAgent,
    setTabs,
    addTab,
    closeTab,
    selectTab,
    updateTabResourceFile,
    clearTabs,
    applyWorkspaceState,
    hydrateWorkspaceFromResource,
    canRestoreLastWorkspace,
    restoreLastWorkspace,
    ensureWorkspaceTab,
  }
})
