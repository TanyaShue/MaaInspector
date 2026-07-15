import { describe, expect, it } from 'vitest'
import {
  collectReachableNodeIds,
  consumeSubgraphPositionChanges,
  filterSubgraphEdges,
  projectSubgraphEdge,
  projectSubgraphNode,
  resolveSubgraphNodeChanges,
  stageSubgraphPositionChanges
} from '@/utils/flowSubgraph'
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
  it('removes geometry measured by another Vue Flow instance', () => {
    const mainCanvasNode = {
      ...positionedNode('root', 12, 24),
      computedPosition: { x: 10_000, y: 20_000, z: 0 },
      dimensions: { width: 320, height: 180 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      selected: true,
      dragging: true,
      resizing: true
    } as FlowNode

    const projected = projectSubgraphNode(mainCanvasNode)

    expect(projected.position).toEqual({ x: 12, y: 24 })
    expect(projected.position).not.toBe(mainCanvasNode.position)
    expect(projected).not.toHaveProperty('computedPosition')
    expect(projected).not.toHaveProperty('dimensions')
    expect(projected).not.toHaveProperty('handleBounds')
    expect(projected).not.toHaveProperty('isParent')
    expect(projected).not.toHaveProperty('selected')
    expect(projected).not.toHaveProperty('dragging')
    expect(projected).not.toHaveProperty('resizing')
    expect(mainCanvasNode).toHaveProperty('computedPosition')
  })

  it('projects edge rendering state without sharing it with the main canvas', () => {
    const mainCanvasEdge = {
      ...edge('root', 'child'),
      type: 'default',
      selected: true,
      style: { strokeWidth: 3 },
      data: { isJumpBack: true }
    } as unknown as FlowEdge & { selected?: boolean }

    const projected = projectSubgraphEdge(mainCanvasEdge, 'smoothstep')

    expect(projected.type).toBe('smoothstep')
    expect(projected).not.toHaveProperty('selected')
    expect(projected.style).not.toBe(mainCanvasEdge.style)
    expect(projected.data).not.toBe(mainCanvasEdge.data)
    expect(mainCanvasEdge.type).toBe('default')
    expect(mainCanvasEdge.selected).toBe(true)
  })

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

  it('indexes a large edge set once instead of rescanning it for every visited node', () => {
    const size = 2_000
    const nodes = Array.from({ length: size }, (_, index) => node(`node-${index}`))
    const reads = { source: 0, target: 0 }
    const edges = Array.from({ length: size - 1 }, (_, index) => {
      const values = edge(`node-${index}`, `node-${index + 1}`)
      return Object.defineProperties({ ...values }, {
        source: {
          enumerable: true,
          get: () => { reads.source++; return values.source }
        },
        target: {
          enumerable: true,
          get: () => { reads.target++; return values.target }
        }
      }) as FlowEdge
    })

    const reachable = collectReachableNodeIds('node-0', nodes, edges)

    expect(reachable.size).toBe(size)
    expect(reachable.has(`node-${size - 1}`)).toBe(true)
    expect(reads).toEqual({ source: edges.length, target: edges.length })
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
    expect(result.addedNodes[0]).not.toBe(newNode)
    expect(result.addedNodes[0].position).not.toBe(newNode.position)
    expect(Array.from(result.removedVisibleIds)).toEqual([])
    expect(result.nextLocalState['new-node']?.position).toEqual({ x: 24, y: 48 })
  })

  it('keeps sub-canvas position changes out of the main-canvas nodes', () => {
    const mainNode = positionedNode('root', 10, 20)
    const subNode = projectSubgraphNode(mainNode)
    subNode.position = { x: 300, y: 400 }

    const result = resolveSubgraphNodeChanges({
      mainNodes: [mainNode],
      nextNodes: [subNode],
      visibleNodeIds: new Set(['root']),
      localNodeState: {}
    })

    expect(result.nextLocalState.root?.position).toEqual({ x: 300, y: 400 })
    expect(mainNode.position).toEqual({ x: 10, y: 20 })
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

  it('stages only changed positions without reading or rebuilding the full node array', () => {
    const pending = new Map([['untouched', { x: 1, y: 2 }]])
    const position = { x: 24, y: 48 }

    const stagedCount = stageSubgraphPositionChanges([
      {
        id: 'dragged',
        type: 'position',
        position,
        from: { x: 0, y: 0 },
        dragging: true
      },
      { id: 'selected', type: 'select', selected: true }
    ], pending)

    expect(stagedCount).toBe(1)
    expect(pending.size).toBe(2)
    expect(pending.get('untouched')).toEqual({ x: 1, y: 2 })
    expect(pending.get('dragged')).toEqual(position)
    expect(pending.get('dragged')).not.toBe(position)
  })

  it('coalesces repeated drag frames and clears pending positions after commit', () => {
    const pending = new Map<string, { x: number; y: number }>()

    stageSubgraphPositionChanges([{
      id: 'dragged',
      type: 'position',
      position: { x: 10, y: 20 },
      from: { x: 0, y: 0 },
      dragging: true
    }], pending)
    stageSubgraphPositionChanges([{
      id: 'dragged',
      type: 'position',
      position: { x: 30, y: 40 },
      from: { x: 10, y: 20 },
      dragging: false
    }], pending)

    expect(consumeSubgraphPositionChanges(pending)).toEqual([
      { id: 'dragged', position: { x: 30, y: 40 } }
    ])
    expect(pending.size).toBe(0)
  })

})
