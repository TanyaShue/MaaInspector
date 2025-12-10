const DEFAULT_API_BASE_URL = 'http://127.0.0.1:38081'

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const runtimeBase = (window as any).__MAA_API_BASE as string | undefined
    if (runtimeBase) return runtimeBase
  }

  // 允许通过构建时环境变量覆盖（如 Vite dev 场景）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viteEnv = (import.meta as any)?.env?.VITE_API_BASE as string | undefined
  return viteEnv || DEFAULT_API_BASE_URL
})()

type JsonHeaders = Record<string, string>

interface RequestOptions extends RequestInit {
  timeoutMs?: number
  headers?: JsonHeaders
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  info?: Record<string, unknown>
  data?: T
  [key: string]: unknown
}

export interface DeviceInfo {
  name?: string
  [key: string]: unknown
}

export interface ResourceProfile {
  name?: string
  paths?: string[]
  [key: string]: unknown
}

export interface ResourceFileInfo {
  label: string
  value: string
  source: string
}

export interface ResourceLoadResponse extends ApiResponse {
  r?: boolean
  list?: ResourceFileInfo[]
}

export interface SystemState {
  device_index?: number
  resource_profile_index?: number
  resource_file?: string
  resource_source?: string
  agent_socket_id?: string
  edge_type?: string
  spacing?: string
}

export interface SystemInitResponse {
  devices?: DeviceInfo[]
  resource_profiles?: ResourceProfile[]
  agent_socket_id?: string
  current_state?: SystemState
}

export interface DeviceConfigPayload {
  devices: DeviceInfo[]
  resource_profiles: ResourceProfile[]
  agent_socket_id?: string
  current_state: SystemState
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

export interface DebugStreamPayload {
  type?: string
  task_id?: string
  name?: string
  next_list?: unknown
  focus?: unknown
  timestamp?: number
  status?: string
  reco_id?: string
  [key: string]: unknown
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? (endpoint.includes('search') ? 60_000 : 10_000)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`API Error ${response.status}: ${text || response.statusText}`)
    }
    return await response.json() as T
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

export const systemApi = {
  getInitialState: () => request<SystemInitResponse>('/system/init', { method: 'GET' }),
  saveDeviceConfig: (fullConfig: DeviceConfigPayload) =>
    request<ApiResponse>('/system/config/save', { method: 'POST', body: JSON.stringify(fullConfig) }),
  searchDevices: () => request<ApiResponse<{ devices?: DeviceInfo[] }>>('/system/devices/search', { method: 'POST' })
}

export const deviceApi = {
  connect: (deviceData: DeviceInfo) =>
    request<ApiResponse>('/device/connect', { method: 'POST', body: JSON.stringify(deviceData) }),
  getScreenshot: () => request<ApiResponse<string>>('/device/screenshot', { method: 'GET' })
}

export const resourceApi = {
  load: (profile: ResourceProfile | { paths?: string[] } | string) => {
    const paths = typeof profile === 'string'
      ? [profile]
      : Array.isArray((profile as ResourceProfile)?.paths)
        ? (profile as ResourceProfile).paths
        : (profile as { paths?: string[] })?.paths || []
    return request<ResourceLoadResponse>('/resource/load', {
      method: 'POST',
      body: JSON.stringify({ paths })
    })
  },
  getFileNodes: <TNodes = Record<string, unknown>>(source: string, filename: string) =>
    request<FileNodesResponse<TNodes>>('/resource/file/nodes', { method: 'POST', body: JSON.stringify({ source, filename }) }),
  getTemplateImages: (source: string, filename: string) =>
    request<TemplateImagesResponse>('/resource/file/templates', { method: 'POST', body: JSON.stringify({ source, filename }) }),
  createFile: (path: string, filename: string) =>
    request<ApiResponse>('/resource/file/create', { method: 'POST', body: JSON.stringify({ path, filename }) }),
  saveFileNodes: <TNodes = Record<string, unknown>>(source: string, filename: string, nodes: TNodes) =>
    request<ApiResponse>('/resource/file/save', { method: 'POST', body: JSON.stringify({ source, filename, nodes }) }),
  searchGlobalNodes: (query: string, useRegex: boolean, currentFilename: string, currentSource: string) =>
    request<ApiResponse>('/resource/search/nodes', { method: 'POST', body: JSON.stringify({ query, use_regex: useRegex, current_filename: currentFilename, current_source: currentSource }) }),
  checkUnusedImages: (source: string, currentFilename: string, delImages: { path: string }[]) =>
    request<ImageCheckResponse>('/resource/images/check-unused', { method: 'POST', body: JSON.stringify({ source, current_filename: currentFilename, del_images: delImages }) }),
  processImages: (source: string, deletePaths: string[], saveImages: { path: string; base64: string; nodeId?: string }[]) =>
    request<ApiResponse>('/resource/images/process', { method: 'POST', body: JSON.stringify({ source, delete_paths: deletePaths, save_images: saveImages }) })
}

export const agentApi = {
  connect: (socketId: string) =>
    request<ApiResponse>('/agent/connect', { method: 'POST', body: JSON.stringify({ socket_id: socketId }) })
}

export const debugApi = {
  runNode: (payload: Record<string, unknown>) =>
    request<DebugRunResponse>('/debug/node', { method: 'POST', body: JSON.stringify(payload) }),
  stop: () => request<ApiResponse>('/debug/stop', { method: 'POST' }),
  getRecoDetails: (recoId: string | number) =>
    request<RecoDetailResponse>('/debug/get_reco_details', { method: 'POST', body: JSON.stringify({ reco_id: recoId }) }),
  ocrText: (roi: number[]) =>
    request<ApiResponse<{ text?: string }>>('/debug/ocr_text', { method: 'POST', body: JSON.stringify({ roi }) }),
  subscribeNodeStream: (onData: (data: DebugStreamPayload) => void) => {
    if (typeof onData !== 'function') return () => {}

    const es = new EventSource(`${API_BASE_URL}/debug/stream`)

    es.onmessage = (evt) => {
      if (!evt?.data) return
      try {
        const payload = JSON.parse(evt.data) as DebugStreamPayload
        onData(payload)
      } catch (e) {
        console.warn('[DebugStream] 无法解析消息', e)
      }
    }

    es.onerror = (err) => {
      console.warn('[DebugStream] SSE 连接异常', err)
    }

    return () => es.close()
  }
}

