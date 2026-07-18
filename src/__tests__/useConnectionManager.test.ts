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
})
