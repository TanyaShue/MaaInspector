import type { FlowBusinessData, NodeStatus, TemplateImage } from '@/utils/flowTypes'
import type { ApiDeviceInfo, ResourceFileInfo } from '@/services/api'

export interface DebugPanelState {
  visible: boolean
  nodeId: string
}

export interface FlowEditorPort {
  getEditorStatus: () => {
    isDirty: boolean
    nodeCount: number
    edgeCount: number
  }
  loadResourceFile: (fileId: string, options?: { deferLayout?: boolean }) => Promise<void>
  handleLoadNodesWrapper: (payload: {
    filename: string
    source: string
    nodes: Record<string, FlowBusinessData>
    fileVersion?: 'V1' | 'V2'
  }) => Promise<void>
  handleLoadImages: (imageDataMap: Record<string, TemplateImage[] | unknown>, basePath?: string) => void | Promise<void>
  handleSaveNodes: (payload: { source: string; filename: string }) => Promise<void>
  handleDeviceConnected: (val: boolean) => void
  handleUpdateCanvasConfig: (payload: {
    edgeType?: string
    spacing?: string
    layoutAlgorithm?: string
    layoutDirection?: string
  }, options?: { applyLayout?: boolean }) => void | Promise<void>
  handleUpdatePipelineVersion: (val: 'V1' | 'V2') => void
  handleApplyLayout: () => Promise<void>
  handleLocateNode: (nodeId: string) => void
  handleDebugNodeFromPanel: (nodeId: string) => void
  handleUpdateNodeStatus: (payload: { nodeId: string; status: NodeStatus }) => void
}

export interface InfoPanelPort {
  executeFileSwitch: (filename: string, source?: string) => Promise<void>
  handleSaveNodes: () => Promise<void>
  triggerLoadFromCache: (config: { filename: string; source: string; tabId: string }) => void
}

export type PanelConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'disconnecting'

export interface InfoPanelStatusSnapshot {
  status: PanelConnectionStatus
  message: string
}

export interface ResourcePanelSnapshot extends InfoPanelStatusSnapshot {
  fileOptions: Array<{ label: string; value: PropertyKey; disabled?: boolean }>
  availableFilesLength: number
  availableFiles: ResourceFileInfo[]
}

export interface DevicePanelSnapshot extends InfoPanelStatusSnapshot {
  deviceType: 'win32' | 'adb'
  searchedDevices: ApiDeviceInfo[]
  selectedDeviceIndex: number
  info: Record<string, unknown>
  win32ScreencapMethod: number
  win32MouseMethod: number
  win32KeyboardMethod: number
}
