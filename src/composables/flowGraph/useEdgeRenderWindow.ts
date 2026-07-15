import { ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { FlowEvents, NodeDragEvent, ViewportTransform } from '@vue-flow/core'
import type { FlowEdge, FlowNode } from '@/utils/flowTypes'

interface CanvasSize {
  width: number
  height: number
}

interface FlowRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface EdgeRenderWindowDeps {
  nodes: Ref<FlowNode[]>
  edges: Ref<FlowEdge[]>
  nodeStructureVersion: Ref<number>
  lowMemoryMode: MaybeRefOrGetter<boolean>
}

interface FilterViewportEdgesOptions {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: ViewportTransform
  canvasSize: CanvasSize
  marginPx: number
  includeNodeIds?: Set<string>
}

const DEFAULT_NODE_WIDTH = 280
const DEFAULT_NODE_HEIGHT = 150
const NORMAL_MARGIN_PX = 480
const LOW_MEMORY_MARGIN_PX = 160

const intersects = (a: FlowRect, b: FlowRect) =>
  a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top

const getNodeRect = (node: FlowNode): FlowRect => {
  const runtimeNode = node as FlowNode & { dimensions?: { width?: number; height?: number } }
  const width = typeof node.width === 'number'
    ? node.width
    : runtimeNode.dimensions?.width || DEFAULT_NODE_WIDTH
  const height = typeof node.height === 'number'
    ? node.height
    : runtimeNode.dimensions?.height || DEFAULT_NODE_HEIGHT
  const left = node.position.x
  const top = node.position.y
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
  }
}

export const filterViewportEdges = ({
  nodes,
  edges,
  viewport,
  canvasSize,
  marginPx,
  includeNodeIds = new Set<string>(),
}: FilterViewportEdgesOptions): FlowEdge[] => {
  if (edges.length === 0 || canvasSize.width <= 0 || canvasSize.height <= 0) return []

  const zoom = Math.max(viewport.zoom || 1, 0.01)
  const margin = marginPx / zoom
  const viewportRect: FlowRect = {
    left: -viewport.x / zoom - margin,
    top: -viewport.y / zoom - margin,
    right: (canvasSize.width - viewport.x) / zoom + margin,
    bottom: (canvasSize.height - viewport.y) / zoom + margin,
  }
  const nodeRects = new Map(nodes.map(node => [node.id, getNodeRect(node)]))

  return edges.filter((edge) => {
    if (includeNodeIds.has(edge.source) || includeNodeIds.has(edge.target)) return true

    const source = nodeRects.get(edge.source)
    const target = nodeRects.get(edge.target)
    if (!source || !target) return true
    if (intersects(source, viewportRect) || intersects(target, viewportRect)) return true

    const edgeBounds: FlowRect = {
      left: Math.min(source.left, target.left),
      top: Math.min(source.top, target.top),
      right: Math.max(source.right, target.right),
      bottom: Math.max(source.bottom, target.bottom),
    }
    return intersects(edgeBounds, viewportRect)
  })
}

export function useEdgeRenderWindow({
  nodes,
  edges,
  nodeStructureVersion,
  lowMemoryMode,
}: EdgeRenderWindowDeps) {
  const renderedEdges = shallowRef<FlowEdge[]>([])
  const viewport = ref<ViewportTransform>({ x: 0, y: 0, zoom: 1 })
  const canvasSize = ref<CanvasSize>({ width: 0, height: 0 })
  const viewportMoving = ref(false)
  const nodeDragging = ref(false)
  const draggedNodeIds = ref<Set<string>>(new Set())

  const refreshRenderedEdges = () => {
    if (viewportMoving.value) {
      renderedEdges.value = []
      return
    }

    if (nodeDragging.value) {
      if (toValue(lowMemoryMode)) {
        renderedEdges.value = []
        return
      }
      renderedEdges.value = edges.value.filter(
        edge => draggedNodeIds.value.has(edge.source) || draggedNodeIds.value.has(edge.target)
      )
      return
    }

    renderedEdges.value = filterViewportEdges({
      nodes: nodes.value,
      edges: edges.value,
      viewport: viewport.value,
      canvasSize: canvasSize.value,
      marginPx: toValue(lowMemoryMode) ? LOW_MEMORY_MARGIN_PX : NORMAL_MARGIN_PX,
    })
  }

  const setCanvasSize = (size: CanvasSize) => {
    if (canvasSize.value.width === size.width && canvasSize.value.height === size.height) return
    canvasSize.value = size
    refreshRenderedEdges()
  }

  const handleMoveStart = ({ flowTransform }: FlowEvents['moveStart']) => {
    viewport.value = flowTransform
    viewportMoving.value = true
    refreshRenderedEdges()
  }

  const handleMove = ({ flowTransform }: FlowEvents['move']) => {
    viewport.value = flowTransform
  }

  const handleMoveEnd = ({ flowTransform }: FlowEvents['moveEnd']) => {
    viewport.value = flowTransform
    viewportMoving.value = false
    refreshRenderedEdges()
  }

  const handleNodeDragStart = ({ node, nodes: draggedNodes }: NodeDragEvent) => {
    const ids = draggedNodes.length > 0 ? draggedNodes.map(item => item.id) : [node.id]
    draggedNodeIds.value = new Set(ids)
    nodeDragging.value = true
    refreshRenderedEdges()
  }

  const handleNodeDragStop = () => {
    nodeDragging.value = false
    draggedNodeIds.value = new Set()
    refreshRenderedEdges()
  }

  watch(
    [() => edges.value, nodeStructureVersion, () => toValue(lowMemoryMode)],
    refreshRenderedEdges,
    { immediate: true }
  )

  return {
    renderedEdges,
    refreshRenderedEdges,
    setCanvasSize,
    handleMoveStart,
    handleMove,
    handleMoveEnd,
    handleNodeDragStart,
    handleNodeDragStop,
  }
}
