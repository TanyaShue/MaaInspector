export interface ResourceNodeLocation {
  source: string
  filename: string
  nodeId: string
  displayId: string
}

interface ResourceNodeResult {
  source?: unknown
  filename?: unknown
  node_id?: unknown
  display_id?: unknown
}

export const parseResourceNodeLocations = (value: unknown): ResourceNodeLocation[] => {
  if (!value || typeof value !== 'object') return []
  const results = (value as { results?: unknown }).results
  if (!Array.isArray(results)) return []

  return results.flatMap((item: ResourceNodeResult) => {
    if (
      typeof item?.source !== 'string' ||
      typeof item.filename !== 'string' ||
      typeof item.node_id !== 'string' ||
      typeof item.display_id !== 'string'
    ) {
      return []
    }
    return [{
      source: item.source,
      filename: item.filename,
      nodeId: item.node_id,
      displayId: item.display_id,
    }]
  })
}
