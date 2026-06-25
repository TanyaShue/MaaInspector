import type { FlowEdge, FlowNode } from './flowTypes'

interface ResolveSubgraphNodeChangesOptions {
  mainNodes: FlowNode[]
  nextNodes: FlowNode[]
  visibleNodeIds: Set<string>
  localNodeState: Record<string, Partial<FlowNode>>
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
