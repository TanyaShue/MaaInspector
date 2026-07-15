import { describe, expect, it } from 'vitest'
import { ref, shallowRef } from 'vue'
import { selectNodeById } from '@/composables/flowGraph/useNodeStateManager'
import type { FlowNode } from '@/utils/flowTypes'

const makeNode = (id: string, selected = false): FlowNode =>
  ({
    id,
    selected,
    position: { x: 0, y: 0 },
    data: { id, type: 'DirectHit', data: {} },
  }) as FlowNode
const isSelected = (node: FlowNode): boolean | undefined =>
  (node as FlowNode & { selected?: boolean }).selected

describe('selectNodeById', () => {
  it('updates only the previous and next node objects in one array replacement', () => {
    const original = [makeNode('A', true), makeNode('B'), makeNode('C')]
    const nodes = shallowRef(original)
    const selectedNodeId = ref<string | null>('A')

    expect(selectNodeById(nodes, selectedNodeId, 'C')).toBe(true)
    expect(selectedNodeId.value).toBe('C')
    expect(nodes.value).not.toBe(original)
    expect(nodes.value[0]).not.toBe(original[0])
    expect(isSelected(nodes.value[0])).toBe(false)
    expect(nodes.value[1]).toBe(original[1])
    expect(nodes.value[2]).not.toBe(original[2])
    expect(isSelected(nodes.value[2])).toBe(true)
  })

  it('does not replace the node array when the selection is unchanged', () => {
    const original = [makeNode('A', true), makeNode('B')]
    const nodes = shallowRef(original)
    const selectedNodeId = ref<string | null>('A')

    expect(selectNodeById(nodes, selectedNodeId, 'A')).toBe(false)
    expect(nodes.value).toBe(original)
  })

  it('clears the previous node when the requested id is not currently rendered', () => {
    const original = [makeNode('A', true), makeNode('B')]
    const nodes = shallowRef(original)
    const selectedNodeId = ref<string | null>('A')

    expect(selectNodeById(nodes, selectedNodeId, 'deferred-node')).toBe(true)
    expect(selectedNodeId.value).toBe('deferred-node')
    expect(isSelected(nodes.value[0])).toBe(false)
    expect(nodes.value[1]).toBe(original[1])
  })
})
