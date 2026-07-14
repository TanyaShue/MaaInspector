import type { FlowNode, FlowNodeMeta } from './flowTypes'

/**
 * Ensures a node has valid data and data.data properties, initializing them if missing.
 * Shared utility to avoid duplication across composables.
 */
export const ensureNodeMeta = (node?: FlowNode | null): FlowNodeMeta | null => {
  if (!node) return null
  if (!node.data) node.data = { id: node.id, type: 'Unknown', data: {} }
  if (!node.data.data) node.data.data = {}
  return node.data
}

/**
 * Schedules a callback on the next animation frame.
 * Shared utility to avoid duplication across composables.
 */
export const waitForFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0)
      return
    }
    window.requestAnimationFrame(() => resolve())
  })

/**
 * Deep clones a value using structuredClone with JSON fallback.
 * Faster than JSON.parse(JSON.stringify()) for large objects.
 */
export const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}
