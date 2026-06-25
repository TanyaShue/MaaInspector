import { describe, expect, it } from 'vitest'
import { collectReachableNodeIds, filterSubgraphEdges, resolveSubgraphNodeChanges } from '@/utils/flowSubgraph'
import type { FlowEdge, FlowNode } from '@/utils/flowTypes'

const node = (id: string): FlowNode => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: { id, type: 'DirectHit', data: { id } }
})

const edge = (source: string, target: string, label = 'next'): FlowEdge => ({
  id: `e-${source}-${target}-${label}`,
  source,
  target,
  sourceHandle: label === 'next' ? 'source-a' : 'source-c',
  targetHandle: 'in',
  label
})

const positionedNode = (id: string, x: number, y: number): FlowNode => ({
  ...node(id),
  position: { x, y }
})

describe('flowSubgraph', () => {
  it('collects the target node, descendants, and timeout/error branches from actual outgoing edges', () => {
    const nodes = ['root', 'nextChild', 'errorChild', 'timeoutChild', 'grandChild', 'unrelated'].map(node)
    const edges = [
      edge('root', 'nextChild', 'next'),
      edge('root', 'errorChild', 'on_error'),
      edge('root', 'timeoutChild', 'timeout_next'),
      edge('nextChild', 'grandChild', 'next'),
      edge('unrelated', 'root', 'next')
    ]

    expect(Array.from(collectReachableNodeIds('root', nodes, edges)).sort()).toEqual([
      'errorChild',
      'grandChild',
      'nextChild',
      'root',
      'timeoutChild'
    ])
  })

  it('does not loop forever on cyclic chains', () => {
    const nodes = ['a', 'b', 'c'].map(node)
    const edges = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a')
    ]

    expect(Array.from(collectReachableNodeIds('a', nodes, edges)).sort()).toEqual(['a', 'b', 'c'])
  })

  it('filters edges to only connections where both endpoints are visible', () => {
    const edges = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('a', 'hidden')
    ]

    expect(filterSubgraphEdges(edges, new Set(['a', 'b', 'c'])).map(item => item.id)).toEqual([
      'e-a-b-next',
      'e-b-c-next'
    ])
  })

  it('does not treat missing visible nodes as removed while adding a new subgraph node', () => {
    const mainNodes = ['root', 'child', 'sibling'].map(node)
    const newNode = positionedNode('new-node', 24, 48)

    const result = resolveSubgraphNodeChanges({
      mainNodes,
      nextNodes: [newNode],
      visibleNodeIds: new Set(['root', 'child']),
      localNodeState: {}
    })

    expect(result.addedNodes.map(item => item.id)).toEqual(['new-node'])
    expect(Array.from(result.removedVisibleIds)).toEqual([])
    expect(result.nextLocalState['new-node']?.position).toEqual({ x: 24, y: 48 })
  })

  it('still reports removed visible nodes when no new nodes are present', () => {
    const mainNodes = ['root', 'child', 'sibling'].map(node)

    const result = resolveSubgraphNodeChanges({
      mainNodes,
      nextNodes: [positionedNode('root', 12, 16)],
      visibleNodeIds: new Set(['root', 'child']),
      localNodeState: {
        child: { position: { x: 4, y: 8 } }
      }
    })

    expect(result.addedNodes).toEqual([])
    expect(Array.from(result.removedVisibleIds)).toEqual(['child'])
    expect(result.nextLocalState.root?.position).toEqual({ x: 12, y: 16 })
    expect(result.nextLocalState.child).toBeUndefined()
  })
})
