import { describe, expect, it } from 'vitest'
import { buildFlowGraph } from '@/utils/flowGraphBuilder'
import { createNodeObject } from '@/composables/flowGraph/useNodeStateManager'

describe('buildFlowGraph', () => {
  it('builds a reusable graph and keeps repeated missing targets as separate instances', () => {
    const graph = buildFlowGraph({
      root: {
        recognition: 'DirectHit',
        next: ['child', 'external', 'external'],
      },
      child: {
        recognition: 'OCR',
      },
    }, 'smoothstep', createNodeObject)

    expect(graph.nodes.filter(node => node.data?.type === 'Unknown')).toHaveLength(2)
    expect(graph.nodes.filter(node => node.data?.data?.id === 'external')).toHaveLength(2)
    expect(graph.edges).toHaveLength(3)
    expect(graph.edges.map(edge => edge.data?.linkIndex)).toEqual([0, 1, 2])
  })
})
