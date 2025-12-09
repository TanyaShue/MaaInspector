import type { Connection, Edge, EdgeChange, Node } from '@vue-flow/core'

export type SpacingKey = 'compact' | 'normal' | 'loose'

export interface SpacingOption {
  ranksep: number
  nodesep: number
}

export interface TemplateImage {
  path: string
  base64?: string
  found?: boolean
  nodeId?: string
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
  status?: 'idle' | 'running' | 'error' | 'success' | string
  _result?: unknown
  _images?: TemplateImage[]
  _del_images?: TemplateImage[]
  _temp_images?: TemplateImage[]
}

export type FlowNode = Node<FlowNodeMeta>
export type FlowEdge = Edge<{ isJumpBack?: boolean }>
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
}

export interface ImageDataPayload {
  delImages: { path: string; nodeId: string }[]
  tempImages: { path: string; base64: string; nodeId: string }[]
}

