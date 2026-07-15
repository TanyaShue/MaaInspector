import type { NodeChange, XYPosition } from '@vue-flow/core'
import type { EdgeType } from './flowOptions'
import type { FlowEdge, FlowNode } from './flowTypes'

interface ResolveSubgraphNodeChangesOptions {
  mainNodes: FlowNode[]
  nextNodes: FlowNode[]
  visibleNodeIds: Set<string>
  localNodeState: Record<string, Partial<FlowNode>>
}

export interface SubgraphNodePositionCommit {
  id: string
  position: XYPosition
}

type VueFlowRuntimeNodeState = {
  computedPosition?: unknown
  dimensions?: unknown
  handleBounds?: unknown
  isParent?: unknown
  selected?: unknown
  dragging?: unknown
  resizing?: unknown
}

type VueFlowRuntimeEdgeState = {
  selected?: unknown
}

/** Remove geometry and interaction state measured by another Vue Flow instance. */
export const projectSubgraphNode = (node: FlowNode): FlowNode => {
  const projected = {
    ...node,
    position: { ...node.position },
    style: typeof node.style === 'object' && node.style !== null
      ? { ...node.style }
      : node.style
  } as FlowNode & VueFlowRuntimeNodeState
  delete projected.computedPosition
  delete projected.dimensions
  delete projected.handleBounds
  delete projected.isParent
  delete projected.selected
  delete projected.dragging
  delete projected.resizing
  return projected
}

/** Create an edge owned by the sub-canvas view instead of reusing Vue Flow state from the main canvas. */
export const projectSubgraphEdge = (edge: FlowEdge, type: EdgeType): FlowEdge => {
  const projected = {
    ...edge,
    type,
    style: typeof edge.style === 'object' && edge.style !== null
      ? { ...edge.style }
      : edge.style,
    data: edge.data ? { ...edge.data } : edge.data,
    markerStart: typeof edge.markerStart === 'object' && edge.markerStart !== null
      ? { ...edge.markerStart }
      : edge.markerStart,
    markerEnd: typeof edge.markerEnd === 'object' && edge.markerEnd !== null
      ? { ...edge.markerEnd }
      : edge.markerEnd
  } as FlowEdge & VueFlowRuntimeEdgeState
  delete projected.selected
  return projected
}

/**
 * Capture only positions present in a Vue Flow change batch. The map is
 * mutated in place so pointer-move events do not invalidate the computed
 * subgraph array; Vue Flow owns the live drag preview until drag-stop.
 */
export const stageSubgraphPositionChanges = (
  changes: NodeChange[],
  pendingPositions: Map<string, XYPosition>
): number => {
  let stagedCount = 0

  changes.forEach(change => {
    if (change.type !== 'position' || !change.position) return
    pendingPositions.set(change.id, { ...change.position })
    stagedCount++
  })

  return stagedCount
}

export const consumeSubgraphPositionChanges = (
  pendingPositions: Map<string, XYPosition>
): SubgraphNodePositionCommit[] => {
  const commits = Array.from(pendingPositions, ([id, position]) => ({
    id,
    position: { ...position }
  }))
  pendingPositions.clear()
  return commits
}

export const collectReachableNodeIds = (
  rootId: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
): Set<string> => {
  const nodeIds = new Set(nodes.map(node => node.id))
  const visited = new Set<string>()
  const queue: string[] = []
  const outgoingTargets = new Map<string, string[]>()

  if (!rootId || !nodeIds.has(rootId)) return visited

  edges.forEach((edge) => {
    const source = edge.source
    const target = edge.target
    if (!nodeIds.has(target)) return
    const targets = outgoingTargets.get(source)
    if (targets) {
      targets.push(target)
    } else {
      outgoingTargets.set(source, [target])
    }
  })

  visited.add(rootId)
  queue.push(rootId)

  let queueIndex = 0
  while (queueIndex < queue.length) {
    const currentId = queue[queueIndex++]
    const targets = outgoingTargets.get(currentId) ?? []
    targets.forEach((targetId) => {
      if (visited.has(targetId)) return
      visited.add(targetId)
      queue.push(targetId)
    })
  }

  return visited
}

export const filterSubgraphEdges = (
  edges: FlowEdge[],
  visibleNodeIds: Set<string>
): FlowEdge[] => edges.filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))

export const resolveSubgraphNodeChanges = ({
  mainNodes,
  nextNodes,
  visibleNodeIds,
  localNodeState
}: ResolveSubgraphNodeChangesOptions): {
  addedNodes: FlowNode[]
  removedVisibleIds: Set<string>
  nextLocalState: Record<string, Partial<FlowNode>>
} => {
  const nextById = new Map(nextNodes.map(node => [node.id, node]))
  const existingIds = new Set(mainNodes.map(node => node.id))
  const addedNodes = nextNodes
    .filter(node => !existingIds.has(node.id))
    .map(projectSubgraphNode)
  const removedVisibleIds = new Set<string>()

  if (addedNodes.length === 0) {
    mainNodes
      .filter(node => visibleNodeIds.has(node.id) && !nextById.has(node.id))
      .forEach(node => removedVisibleIds.add(node.id))
  }

  const nextLocalState = { ...localNodeState }
  removedVisibleIds.forEach(id => { delete nextLocalState[id] })
  nextNodes.forEach(node => {
    nextLocalState[node.id] = {
      ...(nextLocalState[node.id] || {}),
      position: node.position ? { ...node.position } : undefined
    }
  })

  return {
    addedNodes,
    removedVisibleIds,
    nextLocalState
  }
}
