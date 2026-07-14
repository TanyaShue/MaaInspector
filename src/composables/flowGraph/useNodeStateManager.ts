import { perfLog, perfNow } from '@/utils/perfTrace'
import { normalizeTemplateValue } from '@/utils/templateUtils'
import type { FlowNode, FlowNodeMeta, FlowBusinessData, NodeStatus } from '@/utils/flowTypes'

export const UNKNOWN_NODE_ID_PREFIX = '__maa_unknown_node__'

const ensureNodeMeta = (node?: FlowNode | null): FlowNodeMeta | null => {
  if (!node) return null
  if (!node.data) node.data = { id: node.id, type: 'Unknown', data: {} }
  if (!node.data.data) node.data.data = {}
  return node.data
}
export const getNodesData = (nodes: FlowNode[]): Record<string, FlowBusinessData> => {
  const start = perfNow()
  const result: Record<string, FlowBusinessData> = {}
  nodes.forEach((node) => {
    if (node.data?._isMissing) return
    if (node.data?.type === 'Unknown') return

    const nodeData = { ...(node.data?.data || {}) } as FlowBusinessData
    if (node.data?.type === 'Anchor') return

    delete (nodeData as Record<string, unknown>).id
    delete (nodeData as Record<string, unknown>).interrupt
    const template = normalizeTemplateValue(nodeData.template)
    if (template === undefined) delete (nodeData as Record<string, unknown>).template
    else nodeData.template = template
    result[node.id] = nodeData
  })
  perfLog('useFlowGraph.getNodesData', start, {
    nodeCount: nodes.length,
    outputCount: Object.keys(result).length,
  })
  return result
}

export const setNodeStatus = (nodes: FlowNode[], nodeId: string, status: NodeStatus): boolean => {
  if (!nodeId || status === undefined) return false
  const nextStatus: string | undefined = status ?? undefined
  const index = nodes.findIndex((n) => {
    const dataId = (n.data?.data as FlowBusinessData | undefined)?.id
    return n.id === nodeId || dataId === nodeId
  })
  if (index < 0) return false
  const node = nodes[index]
  const meta = ensureNodeMeta(node)
  if (!meta || meta.status === nextStatus) return false
  nodes[index] = { ...node, data: { ...meta, status: nextStatus } }
  return true
}

export const selectNodeById = (
  nodesRef: { value: FlowNode[] },
  selectedNodeId: { value: string | null },
  nodeId?: string | null
): boolean => {
  const nextId = nodeId || null
  if (selectedNodeId.value === nextId) return false
  let changed = false

  if (selectedNodeId.value) {
    const prevId = selectedNodeId.value
    nodesRef.value = nodesRef.value.map((n) => (n.id === prevId ? { ...n, selected: false } : n))
    changed = true
  }

  if (nextId) {
    nodesRef.value = nodesRef.value.map((n) => (n.id === nextId ? { ...n, selected: true } : n))
    changed = true
  }

  selectedNodeId.value = nextId
  return changed
}

export const createNodeObject = (
  id: string,
  rawContent: FlowBusinessData,
  isMissing = false,
  originalId?: string
): FlowNode => {
  const sanitizedContent = { ...rawContent }
  delete (sanitizedContent as Record<string, unknown>).interrupt
  const contentId = typeof sanitizedContent.id === 'string' ? sanitizedContent.id : undefined
  const representedId = isMissing ? originalId || contentId || id : id

  let logicType = sanitizedContent.recognition || 'DirectHit'
  if (isMissing) logicType = 'Unknown'
  const isUnknown = logicType === 'Unknown'

  const node = {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    draggable: true,
    selectable: true,
    focusable: true,
    width: 280,
    height: 150,
    data: {
      id,
      type: logicType,
      data: isUnknown
        ? {
            id: representedId,
            ...(sanitizedContent.anchor ? { anchor: sanitizedContent.anchor } : {}),
          }
        : { ...sanitizedContent, id, recognition: logicType },
      _isMissing: isMissing,
      _originalId: isMissing ? representedId : originalId,
      status: 'idle',
    },
  }
  return node
}
