import type { FlowNode } from '@/utils/flowTypes'

export const getNodeBusinessId = (node: FlowNode): string => {
  const dataId = node.data?.data?.id
  return typeof dataId === 'string' && dataId ? dataId : node.id
}

export const isUnknownNode = (node?: FlowNode | null): boolean =>
  node?.data?.type === 'Unknown'

export const dedupeUnknownNodeInstances = (nodes: FlowNode[]): FlowNode[] => {
  const seenUnknownIds = new Set<string>()

  return nodes.filter(node => {
    if (!isUnknownNode(node)) return true

    const businessId = getNodeBusinessId(node)
    if (seenUnknownIds.has(businessId)) return false
    seenUnknownIds.add(businessId)
    return true
  })
}
