import { ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { FlowEvents, ViewportTransform } from '@vue-flow/core'
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
  pauseAnimations?: MaybeRefOrGetter<boolean>
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
export const MAX_ANIMATED_EDGES = 40

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

export const applyEdgeAnimationBudget = (
  visibleEdges: FlowEdge[],
  maxAnimatedEdges = MAX_ANIMATED_EDGES,
  pauseAnimations = false
): FlowEdge[] => {
  if (!pauseAnimations && visibleEdges.length <= maxAnimatedEdges) return visibleEdges
  let animatedCount = 0
  return visibleEdges.map(edge => {
    if (!edge.animated) return edge
    animatedCount++
    return pauseAnimations || animatedCount > maxAnimatedEdges
      ? { ...edge, animated: false }
      : edge
  })
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
  pauseAnimations = false,
}: EdgeRenderWindowDeps) {
  const renderedEdges = shallowRef<FlowEdge[]>([])
  const viewport = ref<ViewportTransform>({ x: 0, y: 0, zoom: 1 })
  const canvasSize = ref<CanvasSize>({ width: 0, height: 0 })
  const viewportMoving = ref(false)
  const moveStartViewport = ref<ViewportTransform | null>(null)
  const draggedNodeIds = ref<Set<string>>(new Set())

  const refreshRenderedEdges = () => {
    if (viewportMoving.value) {
      renderedEdges.value = []
      return
    }

    if (draggedNodeIds.value.size > 0) {
      renderedEdges.value = edges.value
        .filter(edge =>
          draggedNodeIds.value.has(edge.source) || draggedNodeIds.value.has(edge.target)
        )
        .map(edge => edge.animated ? { ...edge, animated: false } : edge)
      return
    }

    renderedEdges.value = applyEdgeAnimationBudget(filterViewportEdges({
      nodes: nodes.value,
      edges: edges.value,
      viewport: viewport.value,
      canvasSize: canvasSize.value,
      marginPx: toValue(lowMemoryMode) ? LOW_MEMORY_MARGIN_PX : NORMAL_MARGIN_PX,
    }), MAX_ANIMATED_EDGES, toValue(pauseAnimations))
  }

  const setCanvasSize = (size: CanvasSize) => {
    if (canvasSize.value.width === size.width && canvasSize.value.height === size.height) return
    canvasSize.value = size
    refreshRenderedEdges()
  }

  const handleMoveStart = ({ flowTransform }: FlowEvents['moveStart']) => {
    viewport.value = flowTransform
    moveStartViewport.value = { ...flowTransform }
  }

  const handleMove = ({ flowTransform }: FlowEvents['move']) => {
    const start = moveStartViewport.value
    const didMove = start && (
      start.x !== flowTransform.x ||
      start.y !== flowTransform.y ||
      start.zoom !== flowTransform.zoom
    )
    viewport.value = flowTransform
    if (didMove && !viewportMoving.value) {
      viewportMoving.value = true
      refreshRenderedEdges()
    }
  }

  const handleMoveEnd = ({ flowTransform }: FlowEvents['moveEnd']) => {
    viewport.value = flowTransform
    viewportMoving.value = false
    moveStartViewport.value = null
    refreshRenderedEdges()
  }

  const handleNodeDragStart = ({ node, nodes: draggedNodes }: {
    node: FlowNode
    nodes: FlowNode[]
  }) => {
    const activeNodes = draggedNodes.length > 0 ? draggedNodes : [node]
    draggedNodeIds.value = new Set(activeNodes.map(item => item.id))
    refreshRenderedEdges()
  }

  const handleNodeDragStop = () => {
    draggedNodeIds.value = new Set()
    refreshRenderedEdges()
  }

  watch(
    [
      () => edges.value,
      nodeStructureVersion,
      () => toValue(lowMemoryMode),
      () => toValue(pauseAnimations),
    ],
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
