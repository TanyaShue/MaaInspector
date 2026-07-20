import { invoke } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'
import { logWarn, serializeForLog } from '@/utils/logger'

// API Response types
export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  info?: Record<string, unknown>
  data?: T
  [key: string]: unknown
}

export interface ApiDeviceInfo {
  name?: string
  type?: string
  address?: string
  config?: Record<string, unknown>
  hwnd?: number | string
  class_name?: string
  window_name?: string
  adb_path?: string
  screencap_methods?: number
  input_methods?: number
  screencap_method?: number
  mouse_method?: number
  keyboard_method?: number
  [key: string]: unknown
}

export interface ResourceProfile {
  name?: string
  paths?: string[]
  schema_path?: string
  interface_path?: string
  agent?: AgentProfile
  [key: string]: unknown
}

export interface AgentProfile {
  child_exec: string
  child_args: string[]
  working_directory: string
  socket_id: string
  auto_start: boolean
  environment?: Record<string, string>
}

export interface InterfaceImportResponse {
  profiles: ResourceProfile[]
  interface_path: string
  project_name: string
}

export interface JsonSchemaRule {
  type?: string | string[]
  title?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  properties?: Record<string, JsonSchemaRule>
  required?: string[]
  oneOf?: JsonSchemaRule[]
  anyOf?: JsonSchemaRule[]
  minimum?: number
  maximum?: number
  pattern?: string
  [key: string]: unknown
}

export interface CustomCompletionOption {
  value: string
  title?: string
  description?: string
  param_schema?: JsonSchemaRule
}

export interface CustomCompletionRules {
  action: CustomCompletionOption[]
  recognition: CustomCompletionOption[]
}

export interface ResourceFileInfo {
  label: string
  value: string | null
  source: string
  filename: string | null
}

export interface ResourceLoadResponse extends ApiResponse {
  r?: boolean
  list?: ResourceFileInfo[]
  custom_completions?: CustomCompletionRules
}

export interface SystemState {
  device_index?: number
  resource_profile_index?: number
  resource_file?: string
  resource_source?: string
  agent_socket_id?: string
  edge_type?: string
  spacing?: string
  layout_algorithm?: string
  layout_direction?: string
  pipeline_version?: string
  node_name_prefix_enabled?: boolean
  node_name_prefix_mode?: 'random' | 'filename' | 'custom'
  node_name_custom_prefix?: string
  restore_workspace_on_start?: boolean
}

export interface CanvasSettings {
  edge_type?: string
  spacing?: string
  layout_algorithm?: string
  layout_direction?: string
  pipeline_version?: string
  node_name_prefix_enabled?: boolean
  node_name_prefix_mode?: 'random' | 'filename' | 'custom'
  node_name_custom_prefix?: string
}

export interface TabResourceInfo {
  id?: string
  title?: string
  resource_file?: string
}

export interface WorkspaceState {
  resource_index?: number
  resource_signature?: string
  tabs?: TabResourceInfo[]
  active_tab_id?: string
  restore_workspace_on_start?: boolean
}

export interface LastTabsState {
  resource_index: number
  tabs: TabResourceInfo[]
  active_tab_id?: string
}

export interface SystemInitResponse {
  resource_profiles?: ResourceProfile[]
  current_resource_index?: number
  agent_socket_id?: string
  last_device?: ApiDeviceInfo
  canvas_settings?: CanvasSettings
  restore_workspace_on_start?: boolean
  workspace_state?: WorkspaceState
  last_tabs?: LastTabsState
  storage_paths?: StoragePaths
}

export interface StoragePaths {
  log_dir: string
  config_dir: string
  default_config_dir: string
}

export interface DeviceConfigPayload {
  resource_profiles: ResourceProfile[]
  current_resource_index?: number
  agent_socket_id?: string
  last_device?: ApiDeviceInfo
  canvas_settings?: CanvasSettings
  restore_workspace_on_start?: boolean
  workspace_state?: WorkspaceState
  last_tabs?: LastTabsState
}

export interface FileNodesResponse<TNodes = Record<string, unknown>> {
  nodes?: TNodes
  list?: ResourceFileInfo[]
}

export interface TemplateImagesResponse<TResult = Record<string, unknown>> {
  results?: TResult
}

export interface ImageCheckResponse {
  unused_images?: string[]
  used_images?: string[]
}

export interface DebugRunResponse {
  success?: boolean
  error?: string
  [key: string]: unknown
}

export interface RecoDetailResponse extends ApiResponse {
  detail?: unknown
}

export interface ActionDetailResponse extends ApiResponse {
  detail?: unknown
}

export interface DebugStreamPayload {
  type?: string
  attempt_id?: string
  task_id?: number
  name?: string
  next_list?: unknown
  focus?: unknown
  timestamp?: number
  status?: string
  reco_id?: number
  action_id?: number
  node_id?: number
  [key: string]: unknown
}

export interface ScreenshotResponse extends ApiResponse {
  image?: string
  size?: number[]
}

export interface OcrRecognitionCandidate {
  box?: number[]
  score: number
  text: string
}

export interface OcrRecognitionResponse extends ApiResponse {
  data?: {
    text?: string
    best?: OcrRecognitionCandidate | null
    all?: OcrRecognitionCandidate[]
    filtered?: OcrRecognitionCandidate[]
  }
}

const SLOW_COMMAND_MS = 1000

const sanitizeLogValue = (value: unknown, key = '', depth = 0): unknown => {
  if (/base64|image/i.test(key)) return '[omitted]'
  if (depth > 4) return '[max-depth]'
  if (typeof value === 'string') {
    if (value.length > 300) return `${value.slice(0, 300)}...[truncated:${value.length}]`
    return value
  }
  if (Array.isArray(value)) {
    if (value.length > 20) return { type: 'array', length: value.length }
    return value.map((item) => sanitizeLogValue(item, '', depth + 1))
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
      result[innerKey] = sanitizeLogValue(innerValue, innerKey, depth + 1)
    }
    return result
  }
  return serializeForLog(value)
}

const summarizeInvokeArgs = (args?: Record<string, unknown>) => {
  if (!args) return {}
  const summary: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(args)) {
    summary[key] = sanitizeLogValue(value, key)
  }

  return summary
}

const invokeCommand = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
  try {
    const result = await invoke<T>(command, args)
    const duration =
      Math.round(
        ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start) * 10
      ) / 10
    if (duration >= SLOW_COMMAND_MS) {
      logWarn('api', `Slow invoke: ${command}`, {
        command,
        duration,
        args: summarizeInvokeArgs(args),
      })
    }
    return result
  } catch (error) {
    const duration =
      Math.round(
        ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start) * 10
      ) / 10
    logWarn('api', `Invoke failed: ${command}`, {
      command,
      duration,
      error: serializeForLog(error),
      args: summarizeInvokeArgs(args),
    })
    throw error
  }
}

// System API
export const systemApi = {
  getInitialState: async (): Promise<SystemInitResponse> => {
    return invokeCommand('system_init')
  },

  saveDeviceConfig: async (fullConfig: DeviceConfigPayload): Promise<ApiResponse> => {
    return invokeCommand('system_save_config', { configData: fullConfig })
  },

  getBackupDir: async (): Promise<string> => {
    return invokeCommand('system_get_backup_dir')
  },

  openLogDir: async (): Promise<void> => {
    return invokeCommand('system_open_log_dir')
  },

  openBackupDir: async (): Promise<void> => {
    return invokeCommand('system_open_backup_dir')
  },

  importInterface: async (): Promise<InterfaceImportResponse> => {
    return invokeCommand('system_import_interface')
  },

  searchDevices: async (
    deviceType?: string
  ): Promise<ApiResponse<{ devices?: ApiDeviceInfo[] }>> => {
    return invokeCommand('system_search_devices', { deviceType })
  },

  pickFolder: async (): Promise<string | null> => {
    return invokeCommand('system_pick_folder')
  },

  setStorage: async (logDir: string, configDir: string): Promise<ApiResponse> => {
    return invokeCommand('system_set_storage', { logDir, configDir })
  },
}

export const logApi = {
  getDir: async (): Promise<string> => {
    return invokeCommand('log_get_dir')
  },

  readTail: async (
    kind: 'maafw' | 'agent' | 'software',
    maxLines = 100
  ): Promise<string[]> => {
    return invokeCommand('log_read_tail', { kind, maxLines })
  },
}

// Device API
export const deviceApi = {
  connectAdb: async (deviceData: {
    adb_path: string
    address: string
    config?: Record<string, unknown>
    name?: string
  }): Promise<ApiResponse> => {
    return invokeCommand('device_connect_adb', {
      adbPath: deviceData.adb_path,
      address: deviceData.address,
      config: deviceData.config,
      name: deviceData.name,
    })
  },

  connectWin32: async (deviceData: {
    hwnd: number | string
    name?: string
    window_name?: string
    class_name?: string
    screencap_method?: number
    mouse_method?: number
    keyboard_method?: number
  }): Promise<ApiResponse> => {
    return invokeCommand('device_connect_win32', {
      hwnd: deviceData.hwnd,
      name: deviceData.name,
      windowName: deviceData.window_name,
      className: deviceData.class_name,
      screencapMethod: deviceData.screencap_method,
      mouseMethod: deviceData.mouse_method,
      keyboardMethod: deviceData.keyboard_method,
    })
  },

  getScreenshot: async (): Promise<ScreenshotResponse> => {
    return invokeCommand('device_screenshot')
  },

  ocrText: async (roi: number[]): Promise<OcrRecognitionResponse> => {
    return invokeCommand('debug_ocr_text', { roi })
  },
}

// Resource API
export const resourceApi = {
  load: async (
    profile: ResourceProfile | { paths?: string[] } | string
  ): Promise<ResourceLoadResponse> => {
    const paths =
      typeof profile === 'string'
        ? [profile]
        : Array.isArray((profile as ResourceProfile)?.paths)
          ? (profile as ResourceProfile).paths
          : (profile as { paths?: string[] })?.paths || []

    const schemaPath =
      typeof profile === 'string' ? undefined : (profile as ResourceProfile)?.schema_path

    return invokeCommand('resource_load', { paths, schemaPath })
  },

  getFileNodes: async <TNodes = Record<string, unknown>>(
    source: string,
    filename: string
  ): Promise<FileNodesResponse<TNodes>> => {
    return invokeCommand('resource_get_file_nodes', { source, filename })
  },

  getTemplateImages: async (source: string, filename: string): Promise<TemplateImagesResponse> => {
    return invokeCommand('resource_get_templates', { source, filename })
  },

  createFile: async (path: string, filename: string): Promise<ApiResponse> => {
    return invokeCommand('resource_create_file', { path, filename })
  },

  saveFileNodes: async <TNodes = Record<string, unknown>>(
    source: string,
    filename: string,
    nodes: TNodes
  ): Promise<ApiResponse> => {
    return invokeCommand('resource_save_file_nodes', { source, filename, nodes })
  },

  searchGlobalNodes: async (
    query: string,
    useRegex: boolean,
    currentFilename: string,
    currentSource: string
  ): Promise<ApiResponse> => {
    return invokeCommand('resource_search_nodes', {
      query,
      useRegex,
      currentFilename,
      currentSource,
    })
  },

  checkUnusedImages: async (
    source: string,
    currentFilename: string,
    delImages: { path: string }[]
  ): Promise<ImageCheckResponse> => {
    return invokeCommand('resource_check_unused_images', {
      source,
      currentFilename,
      delImages,
    })
  },

  processImages: async (
    source: string,
    deletePaths: string[],
    saveImages: { path: string; base64: string; nodeId?: string }[]
  ): Promise<ApiResponse> => {
    return invokeCommand('resource_process_images', {
      source,
      deletePaths,
      saveImages,
    })
  },
}

// Agent API
export const agentApi = {
  start: async (config: AgentProfile): Promise<ApiResponse> => {
    return invokeCommand('agent_start', { config })
  },

  connect: async (socketId: string): Promise<ApiResponse> => {
    return invokeCommand('agent_connect', { socketId })
  },

  stop: async (): Promise<ApiResponse> => {
    return invokeCommand('agent_stop')
  },
}

// Debug API
export const debugApi = {
  runNode: async (payload: Record<string, unknown>): Promise<DebugRunResponse> => {
    return invokeCommand('debug_run_node', payload)
  },

  stop: async (): Promise<ApiResponse> => {
    return invokeCommand('debug_stop')
  },

  getRecoDetails: async (recoId: string | number): Promise<RecoDetailResponse> => {
    return invokeCommand('debug_get_reco_details', { recoId })
  },

  getActionDetails: async (actionId: string | number): Promise<ActionDetailResponse> => {
    return invokeCommand('debug_get_action_details', { actionId })
  },

  subscribeNodeStream: (onData: (data: DebugStreamPayload) => void): (() => void) => {
    if (typeof onData !== 'function') return () => {}

    let unlistenFns: UnlistenFn[] = []
    let cancelled = false

    const cleanupListeners = () => {
      const listeners = unlistenFns
      unlistenFns = []
      listeners.forEach((unlisten) => {
        try {
          unlisten()
        } catch (error) {
          logWarn('api.debug', 'Failed to release a debug node stream listener', {
            error: serializeForLog(error),
          })
        }
      })
    }

    const setupListeners = async () => {
      const eventNames = [
        'debug:node_next_list',
        'debug:node_recognition',
        'debug:node_action',
      ] as const
      try {
        for (const eventName of eventNames) {
          if (cancelled) break
          const unlisten = await listen<DebugStreamPayload>(eventName, (event) => {
            if (!cancelled) onData(event.payload)
          })
          if (cancelled) {
            unlisten()
            break
          }
          unlistenFns.push(unlisten)
        }
      } catch (error) {
        cleanupListeners()
        logWarn('api.debug', 'Failed to subscribe to debug node stream', {
          error: serializeForLog(error),
        })
      }
    }

    void setupListeners()

    return () => {
      cancelled = true
      cleanupListeners()
    }
  },
}
