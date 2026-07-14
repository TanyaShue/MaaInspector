import type { NodeChange, XYPosition } from '@vue-flow/core'
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

/** Apply a completed drag batch without replacing the parent node array. */
export const applySubgraphPositionCommits = (
  nodes: FlowNode[],
  commits: SubgraphNodePositionCommit[]
): number => {
  if (commits.length === 0) return 0

  const nodesById = new Map(nodes.map(node => [node.id, node]))
  let appliedCount = 0
  commits.forEach(({ id, position }) => {
    const node = nodesById.get(id)
    if (!node) return
    node.position = { ...position }
    appliedCount++
  })
  return appliedCount
}

export const collectReachableNodeIds = (
  rootId: string,
  nodes: FlowNode[],
  edges: FlowEdge[]
): Set<string> => {
  const nodeIds = new Set(nodes.map(node => node.id))
  const visited = new Set<string>()
  const queue: string[] = []

  if (!rootId || !nodeIds.has(rootId)) return visited

  visited.add(rootId)
  queue.push(rootId)

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue

    edges
      .filter(edge => edge.source === currentId && nodeIds.has(edge.target))
      .forEach(edge => {
        if (visited.has(edge.target)) return
        visited.add(edge.target)
        queue.push(edge.target)
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
  const addedNodes = nextNodes.filter(node => !existingIds.has(node.id))
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
