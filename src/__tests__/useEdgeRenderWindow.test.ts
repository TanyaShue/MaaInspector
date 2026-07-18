import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { FlowEvents } from '@vue-flow/core'
import {
  applyEdgeAnimationBudget,
  filterViewportEdges,
  MAX_ANIMATED_EDGES,
  useEdgeRenderWindow,
} from '@/composables/flowGraph/useEdgeRenderWindow'
import type { FlowEdge, FlowNode } from '@/utils/flowTypes'

const node = (id: string, x: number, y: number): FlowNode => ({
  id,
  type: 'custom',
  position: { x, y },
  width: 100,
  height: 80,
  data: { id, type: 'DirectHit', data: { id, recognition: 'DirectHit' } },
})

const edge = (id: string, source: string, target: string): FlowEdge => ({
  id,
  source,
  target,
} as FlowEdge)

const moveEvent = (x = 0, y = 0, zoom = 1) => ({
  event: {} as FlowEvents['move']['event'],
  flowTransform: { x, y, zoom },
})

describe('edge render window', () => {
  it('keeps small edge sets animated and limits animations above the budget', () => {
    const small = [{ ...edge('small', 'a', 'b'), animated: true }]
    expect(applyEdgeAnimationBudget(small)).toBe(small)

    const large = Array.from({ length: MAX_ANIMATED_EDGES + 1 }, (_, index) => ({
      ...edge(`edge-${index}`, 'a', 'b'),
      animated: true,
    }))
    const budgeted = applyEdgeAnimationBudget(large)

    expect(budgeted).not.toBe(large)
    expect(budgeted.filter(item => item.animated).length).toBe(MAX_ANIMATED_EDGES)
    expect(large.every(item => item.animated === true)).toBe(true)
  })

  it('can pause every visible edge animation', () => {
    const edges = [
      { ...edge('a', 'a', 'b'), animated: true },
      { ...edge('b', 'b', 'c'), animated: true },
    ]
    expect(applyEdgeAnimationBudget(edges, MAX_ANIMATED_EDGES, true)
      .every(item => item.animated === false)).toBe(true)
  })

  it('keeps viewport and crossing edges while excluding distant edges', () => {
    const nodes = [
      node('a', 0, 0),
      node('b', 300, 0),
      node('c', 1_500, 0),
      node('d', 1_800, 0),
    ]
    const edges = [
      edge('near', 'a', 'b'),
      edge('crossing', 'b', 'c'),
      edge('far', 'c', 'd'),
    ]

    const result = filterViewportEdges({
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      canvasSize: { width: 800, height: 600 },
      marginPx: 0,
    })

    expect(result.map(item => item.id)).toEqual(['near', 'crossing'])
  })

  it('always includes edges connected to explicitly requested nodes', () => {
    const nodes = [node('a', 0, 0), node('c', 1_500, 0), node('d', 1_800, 0)]
    const edges = [edge('far', 'c', 'd')]

    const result = filterViewportEdges({
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      canvasSize: { width: 800, height: 600 },
      marginPx: 0,
      includeNodeIds: new Set(['c']),
    })

    expect(result.map(item => item.id)).toEqual(['far'])
  })

  it('keeps edges on a pane click, hides them while panning, and restores them on stop', () => {
    const nodes = ref([node('a', 0, 0), node('b', 300, 0), node('c', 1_500, 0)])
    const edges = ref([edge('near', 'a', 'b'), edge('far', 'b', 'c')])
    const window = useEdgeRenderWindow({
      nodes,
      edges,
      nodeStructureVersion: ref(0),
      lowMemoryMode: false,
    })
    window.setCanvasSize({ width: 800, height: 600 })

    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['near', 'far'])
    window.handleMoveStart(moveEvent())
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['near', 'far'])
    window.handleMove(moveEvent(-1_200, 0, 1))
    expect(window.renderedEdges.value).toEqual([])
    window.handleMoveEnd(moveEvent(-1_200, 0, 1))
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['far'])
  })

  it('only renders edges connected to nodes being dragged', () => {
    const nodes = ref([node('a', 0, 0), node('b', 300, 0), node('c', 600, 0)])
    const edges = ref([edge('a-b', 'a', 'b'), edge('b-c', 'b', 'c')])
    const window = useEdgeRenderWindow({
      nodes,
      edges,
      nodeStructureVersion: ref(0),
      lowMemoryMode: false,
    })
    window.setCanvasSize({ width: 800, height: 600 })

    window.handleNodeDragStart({ node: nodes.value[0], nodes: [] })
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['a-b'])

    window.handleNodeDragStop()
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['a-b', 'b-c'])
  })

})
