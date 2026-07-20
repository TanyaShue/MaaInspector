import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useFlowStateExport } from '@/composables/flowGraph/useFlowStateExport'
import { useImageManager } from '@/composables/useImageManager'
import type { EdgeType } from '@/utils/flowOptions'
import type { FlowEdge, FlowNode, LayoutAlgorithm, SpacingKey } from '@/utils/flowTypes'

const createStateExport = () => {
  const getNodesData = vi.fn(() => ({ Start: { recognition: 'DirectHit' } }))
  const originalDataSnapshot = ref('{}')
  const dataSnapshot = ref('{}')
  const state = useFlowStateExport(
    ref<FlowNode[]>([]),
    ref<FlowEdge[]>([]),
    ref<EdgeType>('smoothstep'),
    ref<SpacingKey>('normal'),
    ref<LayoutAlgorithm>('layered'),
    ref<'TB' | 'LR' | 'RL' | 'BT'>('TB'),
    ref('pipeline.json'),
    ref('D:/maa'),
    originalDataSnapshot,
    dataSnapshot,
    ref<string | null>(null),
    useImageManager(),
    getNodesData
  )
  return { state, getNodesData, originalDataSnapshot, dataSnapshot }
}

describe('useFlowStateExport dirty tracking', () => {
  it('tracks edits without serializing nodes on the reactive hot path', () => {
    const { state, getNodesData } = createStateExport()

    state.markDataChanged()
    state.markDataChanged()

    expect(getNodesData).not.toHaveBeenCalled()
    expect(state.isDirty.value).toBe(true)
    expect(getNodesData).not.toHaveBeenCalled()
  })

  it('keeps the revision dirty until a clean baseline is explicitly established', () => {
    const { state } = createStateExport()
    state.clearDirty()
    state.markDataChanged()

    expect(state.isDirty.value).toBe(true)

    state.clearDirty()
    expect(state.isDirty.value).toBe(false)
  })

  it('serializes once when establishing a clean baseline and clears dirty state', () => {
    const { state, getNodesData, originalDataSnapshot, dataSnapshot } = createStateExport()
    state.markDataChanged()

    state.clearDirty()

    expect(state.isDirty.value).toBe(false)
    expect(getNodesData).toHaveBeenCalledTimes(1)
    expect(dataSnapshot.value).toBe(JSON.stringify({ Start: { recognition: 'DirectHit' } }))
    expect(originalDataSnapshot.value).toBe(dataSnapshot.value)
  })
})
