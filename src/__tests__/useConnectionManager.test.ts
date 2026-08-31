import { describe, expect, it } from 'vitest'
import {
  buildOutgoingEdges,
  getEdgeStyle,
} from '@/composables/flowGraph/useConnectionManager'
import type { FlowNode } from '@/utils/flowTypes'

describe('getEdgeStyle', () => {
  it('uses distinct styles for next and on_error JumpBack edges', () => {
    const nextJumpBack = getEdgeStyle('source-a', true, 'smoothstep')
    const errorJumpBack = getEdgeStyle('source-c', true, 'smoothstep')

    expect(nextJumpBack.style).toMatchObject({
      stroke: '#a855f7',
      strokeDasharray: '8 4',
    })
    expect(errorJumpBack.style).toMatchObject({
      stroke: '#f97316',
      strokeDasharray: '2 4',
    })
    expect(errorJumpBack.style).not.toEqual(nextJumpBack.style)
  })

  it('rebuilds ordered edges when links move between next and on_error', () => {
    const nodes = ['Source', 'A', 'B'].map(id => ({
      id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { id, type: 'DirectHit', data: { id, recognition: 'DirectHit' } },
    })) as FlowNode[]

    const edges = buildOutgoingEdges(
      'Source',
      { next: ['B'], on_error: ['A'] },
      nodes,
      'smoothstep'
    )

    expect(edges.map(edge => ({
      target: edge.target,
      handle: edge.sourceHandle,
      index: edge.data?.linkIndex,
    }))).toEqual([
      { target: 'B', handle: 'source-a', index: 0 },
      { target: 'A', handle: 'source-c', index: 0 },
    ])
  })

  it('keeps the previously connected duplicate unknown-node instance', () => {
    const source = {
      id: 'Source',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { id: 'Source', type: 'DirectHit', data: { id: 'Source', recognition: 'DirectHit' } },
    } as FlowNode
    const unknownNodes = [1, 2].map(index => ({
      id: `__maa_unknown_node__Missing__${index}`,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        id: `__maa_unknown_node__Missing__${index}`,
        type: 'Unknown',
        data: { id: 'Missing' },
        _isMissing: true,
        _originalId: 'Missing',
      },
    })) as FlowNode[]
    const previousEdges = [{
      id: 'previous-edge',
      source: 'Source',
      target: unknownNodes[1].id,
      sourceHandle: 'source-a',
      targetHandle: 'in',
      label: 'next',
      data: { linkIndex: 0, linkField: 'next' as const },
    }]

    const rebuilt = buildOutgoingEdges(
      'Source',
      { next: 'Missing' },
      [source, ...unknownNodes],
      'smoothstep',
      previousEdges
    )

    expect(rebuilt).toHaveLength(1)
    expect(rebuilt[0].target).toBe(unknownNodes[1].id)
  })
})
