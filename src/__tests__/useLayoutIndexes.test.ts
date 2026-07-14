import { describe, expect, it } from 'vitest'
import { applyElkNodePositions, createOrderedElkEdges } from '@/composables/useLayout'
import type { FlowEdge, FlowNode } from '@/utils/flowTypes'

const node = (id: string): FlowNode => ({
  id,
  type: 'custom',
  position: { x: -1, y: -1 },
  data: { id, type: 'DirectHit', data: { id } }
})

const edge = (id: string, sourceHandle?: string): FlowEdge => ({
  id,
  source: `source-${id}`,
  target: `target-${id}`,
  sourceHandle
})

describe('useLayout indexes', () => {
  it('preserves stable source-handle ordering while building ELK edges', () => {
    const result = createOrderedElkEdges([
      edge('default-1'),
      edge('error-1', 'source-c'),
      edge('next-1', 'source-a'),
      edge('default-2', 'other'),
      edge('next-2', 'source-a'),
      edge('error-2', 'source-c')
    ])

    expect(result.map(item => item.id)).toEqual([
      'next-1',
      'next-2',
      'default-1',
      'default-2',
      'error-1',
      'error-2'
    ])
  })

  it('reads each source edge field once regardless of graph size', () => {
    const reads = { id: 0, source: 0, target: 0, sourceHandle: 0 }
    const edges = Array.from({ length: 2_000 }, (_, index) => {
      const values = edge(String(index), index % 3 === 0 ? 'source-a' : index % 3 === 1 ? undefined : 'source-c')
      return Object.defineProperties({}, {
        id: { enumerable: true, get: () => { reads.id++; return values.id } },
        source: { enumerable: true, get: () => { reads.source++; return values.source } },
        target: { enumerable: true, get: () => { reads.target++; return values.target } },
        sourceHandle: { enumerable: true, get: () => { reads.sourceHandle++; return values.sourceHandle } }
      }) as FlowEdge
    })

    expect(createOrderedElkEdges(edges)).toHaveLength(edges.length)
    expect(reads).toEqual({
      id: edges.length,
      source: edges.length,
      target: edges.length,
      sourceHandle: edges.length
    })
  })

  it('indexes layout children once and keeps position results equivalent', () => {
    let childIdReads = 0
    const nodes = Array.from({ length: 2_000 }, (_, index) => node(`node-${index}`))
    const children = nodes.map((item, index) => (
      Object.defineProperties({
        x: index * 2,
        y: index * 3
      }, {
        id: {
          enumerable: true,
          get: () => { childIdReads++; return item.id }
        }
      }) as { id: string; x: number; y: number }
    ))

    const result = applyElkNodePositions(nodes, children)

    expect(childIdReads).toBe(children.length)
    expect(result[0].position).toEqual({ x: 0, y: 0 })
    expect(result[1_999].position).toEqual({ x: 3_998, y: 5_997 })
    expect(nodes[1_999].position).toEqual({ x: -1, y: -1 })
  })
})
