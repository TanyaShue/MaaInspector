import { MarkerType } from '@vue-flow/core'
import type { FlowEdge, FlowNode, FlowBusinessData, FlowConnection } from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import { ensureNodeMeta } from '@/utils/nodeHelpers'

type EdgeStyleResult = Pick<FlowEdge, 'style' | 'animated' | 'type' | 'markerEnd' | 'data'>

interface PortMapping {
  field: 'next' | 'on_error' | 'timeout_next'
  type: 'array'
  color: string
}

export const PORT_MAPPING: Record<string, PortMapping> = {
  'source-a': { field: 'next', type: 'array', color: '#3b82f6' },
  'source-c': { field: 'on_error', type: 'array', color: '#f43f5e' },
}

const stripPrefix = (val: string) => val.replace(/\[(Anchor|JumpBack)\]/g, '')

export const buildLinkId = (targetId: string, isAnchor: boolean, isJumpBack: boolean) => {
  let id = targetId
  if (isAnchor) id = `[Anchor]${id}`
  if (isJumpBack) id = `[JumpBack]${id}`
  return id
}

export const parseLinkFlags = (val?: string) => ({
  anchor: !!val && val.includes('[Anchor]'),
  jumpBack: !!val && val.includes('[JumpBack]'),
  id: val ? stripPrefix(val) : '',
})

export const isAnchorNode = (node?: FlowNode | null) =>
  !!(node?.data?.type === 'Anchor' || (node?.data?.data as FlowBusinessData | undefined)?.anchor)

export const getNodeLinkId = (node?: FlowNode | null, fallbackId = '') => {
  if (!node) return fallbackId
  if (node.data?._isMissing && node.data._originalId) return node.data._originalId
  const dataId = (node.data?.data as FlowBusinessData | undefined)?.id
  return typeof dataId === 'string' && dataId ? dataId : fallbackId || node.id
}
export const getEdgeStyle = (
  handleId: string,
  isJumpBack: boolean,
  currentEdgeType: EdgeType
): EdgeStyleResult => {
  const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }
  const strokeColor = isJumpBack ? '#a855f7' : config.color

  return {
    style: {
      stroke: strokeColor,
      strokeWidth: 2,
      strokeDasharray: '5 5',
    },
    animated: true,
    type: currentEdgeType,
    markerEnd: MarkerType.ArrowClosed,
    data: { isJumpBack },
  }
}

export const updateNodeDataConnection = (
  findNode: (id: string) => FlowNode | undefined,
  sourceNode: FlowNode,
  field: PortMapping['field'],
  targetId: string,
  isArrayType: boolean,
  isAdd: boolean,
  isJumpBack = false,
  isAnchorTarget = false
) => {
  const sourceMeta = ensureNodeMeta(sourceNode)
  if (!sourceMeta || !sourceMeta.data) return
  const data = sourceMeta.data as FlowBusinessData
  const targetNode = findNode(targetId)
  const actualTargetId = getNodeLinkId(targetNode, targetId)
  const storedId = buildLinkId(actualTargetId, isAnchorTarget, isJumpBack)

  if (isArrayType) {
    if (!Array.isArray(data[field])) data[field] = []

    const existingIndex = (data[field] as unknown[]).findIndex(
      (id) => typeof id === 'string' && [targetId, actualTargetId].includes(stripPrefix(id))
    )

    if (isAdd) {
      if (existingIndex === -1) {
        ;(data[field] as unknown[]).push(storedId)
      } else {
        ;(data[field] as unknown[])[existingIndex] = storedId
      }
    } else if (existingIndex > -1) {
      ;(data[field] as unknown[]).splice(existingIndex, 1)
    }
  } else {
    if (isAdd) {
      data[field] = storedId
    } else {
      const currentVal = (data as Record<string, unknown>)[field] as string | undefined
      if (typeof currentVal === 'string' && stripPrefix(currentVal) === targetId) {
        delete (data as Record<string, unknown>)[field]
      }
    }
  }
}

export const onValidateConnection = (connection: FlowConnection) => {
  if (connection.source === connection.target) return false
  if (connection.sourceHandle === 'in') return false
  return connection.targetHandle === 'in'
}

export const normalizeLinksAcrossNodes = (targetNodes: FlowNode[]) => {
  const anchorIds = new Set(
    targetNodes
      .filter((n) => isAnchorNode(n))
      .flatMap((n) => [n.id, getNodeLinkId(n)].filter(Boolean))
  )
  const normalizeItem = (item: unknown) => {
    if (typeof item !== 'string') return item
    const flags = parseLinkFlags(item)
    const targetId = flags.id || item
    const isAnchorTarget = anchorIds.has(targetId) || flags.anchor
    return buildLinkId(targetId, isAnchorTarget, flags.jumpBack)
  }
  const normalizeField = (val: unknown) => {
    if (Array.isArray(val)) return val.map(normalizeItem).filter(Boolean)
    if (typeof val === 'string') return normalizeItem(val)
    return val
  }

  targetNodes.forEach((n) => {
    const meta = ensureNodeMeta(n)
    if (!meta?.data) return
    const data = meta.data as FlowBusinessData
    ;(['next', 'on_error', 'timeout_next'] as const).forEach((field) => {
      const rawVal = (data as Record<string, unknown>)[field]
      const normalized = normalizeField(rawVal)
      if (
        normalized === undefined ||
        normalized === null ||
        (Array.isArray(normalized) && normalized.length === 0)
      ) {
        delete (data as Record<string, unknown>)[field]
      } else {
        ;(data as Record<string, unknown>)[field] = normalized as any
      }
    })
  })
}
