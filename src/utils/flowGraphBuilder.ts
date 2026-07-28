import { UNKNOWN_NODE_ID_PREFIX } from '@/composables/flowGraph/useNodeStateManager'
import {
  getEdgeStyle,
  normalizeLinksAcrossNodes,
  parseLinkFlags,
} from '@/composables/flowGraph/useConnectionManager'
import type { EdgeType } from '@/utils/flowOptions'
import type { FlowBusinessData, FlowEdge, FlowNode } from '@/utils/flowTypes'

type NodeFactory = (
  id: string,
  rawContent: FlowBusinessData,
  isMissing?: boolean,
  originalId?: string
) => FlowNode

export const buildFlowGraph = (
  rawNodesData: Record<string, FlowBusinessData>,
  currentEdgeType: EdgeType,
  createNodeObject: NodeFactory
): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const createdNodeIds = new Set<string>()
  const missingNodeCount = new Map<string, number>()
  const createMissingNodeId = (targetId: string) => {
    const count = (missingNodeCount.get(targetId) || 0) + 1
    missingNodeCount.set(targetId, count)
    let suffix = count
    let candidate = `${UNKNOWN_NODE_ID_PREFIX}${targetId}__${suffix}`
    while (createdNodeIds.has(candidate) || rawNodesData[candidate] !== undefined) {
      suffix++
      candidate = `${UNKNOWN_NODE_ID_PREFIX}${targetId}__${suffix}`
    }
    return candidate
  }

  Object.entries(rawNodesData).forEach(([nodeId, nodeContent]) => {
    nodes.push(createNodeObject(nodeId, nodeContent))
    createdNodeIds.add(nodeId)
  })

  Object.entries(rawNodesData).forEach(([nodeId, nodeContent]) => {
    const linkFields = [
      { key: 'next', handle: 'source-a' },
      { key: 'on_error', handle: 'source-c' },
      { key: 'timeout_next', handle: 'source-c' },
    ] as const

    linkFields.forEach(({ key, handle }) => {
      const targetValue = nodeContent[key]
      if (!targetValue) return
      const rawTargets = Array.isArray(targetValue) ? targetValue : [targetValue]

      rawTargets.forEach((rawTargetId, targetIndex) => {
        if (!rawTargetId) return
        const flags = parseLinkFlags(String(rawTargetId))
        let targetId = flags.id || String(rawTargetId)

        if (rawNodesData[targetId] === undefined) {
          const missingNodeId = createMissingNodeId(targetId)
          nodes.push(createNodeObject(
            missingNodeId,
            flags.anchor
              ? ({ id: targetId, anchor: true } as FlowBusinessData)
              : ({ id: targetId } as FlowBusinessData),
            true,
            targetId
          ))
          createdNodeIds.add(missingNodeId)
          targetId = missingNodeId
        }

        const edgeStyle = getEdgeStyle(handle, flags.jumpBack, currentEdgeType)
        edges.push({
          id: `e-${nodeId}-${targetId}-${key}`,
          source: nodeId,
          target: targetId,
          sourceHandle: handle,
          targetHandle: 'in',
          label: flags.jumpBack ? 'JumpBack' : key,
          ...edgeStyle,
          data: { ...edgeStyle.data, linkIndex: targetIndex },
        })
      })
    })
  })

  normalizeLinksAcrossNodes(nodes)
  return { nodes, edges }
}
