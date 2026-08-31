import type { Connection, Edge, EdgeChange, Node } from '@vue-flow/core'

export type SpacingKey = 'very-compact' | 'compact' | 'normal' | 'loose' | 'extra-loose'
export type LayoutAlgorithm = 'layered' | 'stress' | 'mrtree'
export type LayoutDirection = 'TB' | 'LR'
export type MenuType = 'pane' | 'node' | 'edge'
export type NodeStatus = 'success' | 'error' | 'running' | 'ignored' | null

export interface SpacingOption {
  ranksep: number
  nodesep: number
}

export interface TemplateImage {
  path: string
  base64?: string
  found?: boolean
  nodeId?: string
  fullPath?: string
  url?: string
}

export interface UsedImageInfo {
  path: string
  used_by: string[]
}

export interface FlowBusinessData {
  id?: string
  recognition?: string
  next?: string | string[]
  on_error?: string | string[]
  timeout_next?: string | string[]
  template?: string | string[]
  anchor?: boolean
  [key: string]: unknown
}

export interface FlowNodeMeta {
  id: string
  type: string
  data?: FlowBusinessData
  _isMissing?: boolean
  _originalId?: string
  status?: 'idle' | 'running' | 'error' | 'success' | string
  _result?: unknown
  _images?: TemplateImage[]
  _del_images?: TemplateImage[]
  _temp_images?: TemplateImage[]
}

export type FlowNode = Node<FlowNodeMeta>
export type FlowEdge = Edge<{
  isJumpBack?: boolean
  linkIndex?: number
  linkField?: 'next' | 'on_error' | 'timeout_next'
}>
export type FlowConnection = Connection
export type FlowEdgeChange = EdgeChange

export interface NodeUpdatePayload {
  oldId: string
  newId: string
  newType: string
  newData?: FlowBusinessData & { _action?: string }
}

export interface LoadNodesPayload {
  filename: string
  source: string
  nodes: Record<string, FlowBusinessData>
  fileVersion?: 'V1' | 'V2'
}

export interface ImageDataPayload {
  delImages: { path: string; nodeId: string }[]
  tempImages: { path: string; base64: string; nodeId: string }[]
}

interface DeviceRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PickerResult {
  mode: 'device' | 'rect' | 'both'
  value?: string | DeviceRect
}

