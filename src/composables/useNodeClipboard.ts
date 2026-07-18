import { computed, shallowRef } from 'vue'
import type { FlowBusinessData, TemplateImage } from '@/utils/flowTypes'

export interface ClipboardNode {
  key: string
  label: string
  data: FlowBusinessData
  position: { x: number; y: number }
  images: TemplateImage[]
}

const MAX_CLIPBOARD_HISTORY = 10
const latestBatch = shallowRef<ClipboardNode[]>([])
const recentNodes = shallowRef<ClipboardNode[]>([])

const createClipboardKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`

export const useNodeClipboard = () => {
  const copy = (
    nodes: Array<Omit<ClipboardNode, 'key' | 'label'> & { label?: string }>
  ) => {
    const normalized = nodes.map(node => ({
      ...node,
      key: createClipboardKey(),
      label: node.label || String(node.data.id || '未命名节点'),
    }))
    latestBatch.value = normalized
    recentNodes.value = [...normalized.slice().reverse(), ...recentNodes.value]
      .slice(0, MAX_CLIPBOARD_HISTORY)
    return normalized.length
  }

  const getBatch = () => latestBatch.value
  const getRecentNode = (key?: string | null) =>
    key
      ? recentNodes.value.find(node => node.key === key) || null
      : recentNodes.value[0] || null

  return {
    history: computed(() =>
      recentNodes.value.map(node => ({ value: node.key, label: node.label }))
    ),
    copy,
    getBatch,
    getRecentNode,
  }
}

export const resetNodeClipboardForTests = () => {
  latestBatch.value = []
  recentNodes.value = []
}
