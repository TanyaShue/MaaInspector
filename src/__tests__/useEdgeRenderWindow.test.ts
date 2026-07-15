import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import type { FlowEvents, NodeDragEvent } from '@vue-flow/core'
import {
  filterViewportEdges,
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

  it('hides edges while panning and restores the new viewport window on stop', () => {
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
    expect(window.renderedEdges.value).toEqual([])
    window.handleMove(moveEvent(-1_200, 0, 1))
    expect(window.renderedEdges.value).toEqual([])
    window.handleMoveEnd(moveEvent(-1_200, 0, 1))
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['far'])
  })

  it('keeps only dragged-node edges, and hides those too in low-memory mode', async () => {
    const nodes = ref([node('a', 0, 0), node('b', 300, 0), node('c', 600, 0)])
    const edges = ref([edge('ab', 'a', 'b'), edge('bc', 'b', 'c')])
    const lowMemoryMode = ref(false)
    const window = useEdgeRenderWindow({
      nodes,
      edges,
      nodeStructureVersion: ref(0),
      lowMemoryMode,
    })
    window.setCanvasSize({ width: 800, height: 600 })

    window.handleNodeDragStart({
      node: nodes.value[0],
      nodes: [nodes.value[0]],
      event: new MouseEvent('mousedown'),
    } as NodeDragEvent)
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['ab'])

    lowMemoryMode.value = true
    await nextTick()
    expect(window.renderedEdges.value).toEqual([])

    window.handleNodeDragStop()
    expect(window.renderedEdges.value.map(item => item.id)).toEqual(['ab', 'bc'])
  })
})
