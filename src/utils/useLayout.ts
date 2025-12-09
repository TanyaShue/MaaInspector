import type { Ref } from 'vue'
import dagre from 'dagre'
import { useVueFlow } from '@vue-flow/core'
import type { FlowEdge, FlowNode, SpacingKey, SpacingOption } from './flowTypes'

export const SPACING_OPTIONS: Record<SpacingKey, SpacingOption> = {
  compact: { ranksep: 80, nodesep: 120 },
  normal: { ranksep: 120, nodesep: 180 },
  loose: { ranksep: 300, nodesep: 300 }
}

export const NODE_SIZE_PADDING = {
  fallbackWidth: 280,
  fallbackHeight: 150,
  extraWidth: 20,
  extraHeight: 20
}

const getSpacingConfig = (key: SpacingKey = 'normal'): SpacingOption =>
  SPACING_OPTIONS[key] || SPACING_OPTIONS.normal

const resolveSpacing = (spacingOrKey?: SpacingKey | SpacingOption): SpacingOption =>
  typeof spacingOrKey === 'string' ? getSpacingConfig(spacingOrKey) : (spacingOrKey || getSpacingConfig())

export function useLayout() {
  const { findNode } = useVueFlow()

  const layout = (
    nodes: FlowNode[],
    edges: FlowEdge[],
    options: SpacingOption = getSpacingConfig()
  ): FlowNode[] => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    dagreGraph.setGraph({
      rankdir: 'TB',
      ranksep: options.ranksep,
      nodesep: options.nodesep
    })

    nodes.forEach((node) => {
      const nodeEl = findNode(node.id)
      const width = (nodeEl?.dimensions?.width ?? NODE_SIZE_PADDING.fallbackWidth) + NODE_SIZE_PADDING.extraWidth
      const height = (nodeEl?.dimensions?.height ?? NODE_SIZE_PADDING.fallbackHeight) + NODE_SIZE_PADDING.extraHeight
      dagreGraph.setNode(node.id, { width, height })
    })

    const handleOrder: Record<string, number> = {
      'source-a': 1,
      'source-c': 3
    }

    const sortedEdges = [...edges].sort((a, b) => {
      const weightA = handleOrder[a.sourceHandle ?? ''] ?? 2
      const weightB = handleOrder[b.sourceHandle ?? ''] ?? 2
      return weightA - weightB
    })

    sortedEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id) as dagre.Node | undefined
      const x = nodeWithPosition ? nodeWithPosition.x - nodeWithPosition.width / 2 : 0
      const y = nodeWithPosition ? nodeWithPosition.y - nodeWithPosition.height / 2 : 0
      return {
        ...node,
        position: { x, y }
      }
    })
  }

  const layoutWithSpacing = (
    nodes: FlowNode[],
    edges: FlowEdge[],
    spacingOrKey: SpacingKey | SpacingOption = 'normal'
  ): FlowNode[] => {
    const spacing = resolveSpacing(spacingOrKey)
    return layout(nodes, edges, spacing)
  }

  const applyLayoutOnRefs = (
    nodesRef: Ref<FlowNode[]>,
    edgesRef: Ref<FlowEdge[]>,
    spacingOrKey: SpacingKey | SpacingOption = 'normal'
  ) => {
    const spacing = resolveSpacing(spacingOrKey)
    const layouted = layout(nodesRef.value, edgesRef.value, spacing)
    nodesRef.value = layouted
    return layouted
  }

  const normalizeChainTargets = (val: unknown): string[] => {
    if (val === 0) return ['0']
    if (!val && val !== 0) return []
    const list = Array.isArray(val) ? val : [val]
    return list
      .map(v => (typeof v === 'string' && v.startsWith('[JumpBack]')) ? v.replace('[JumpBack]', '') : v)
      .map(v => (v !== null && v !== undefined) ? String(v) : '')
      .filter(Boolean)
  }

  const computeOrderedChainLayout = (
    rootId: string,
    nodesRef: Ref<FlowNode[]>,
    edgesRef: Ref<FlowEdge[]>,
    spacingOrKey: SpacingKey | SpacingOption = 'normal'
  ) => {
    if (!rootId) return null
    const root = findNode(rootId)
    if (!root) return null
    const spacing = resolveSpacing(spacingOrKey)

    const visited = new Set<string>([rootId])
    const levels: Array<string[]> = []
    let currentLevel: string[] = [rootId]

    while (currentLevel.length) {
      levels.push(currentLevel)
      const nextLevel: string[] = []

      currentLevel.forEach(nodeId => {
        const node = findNode(nodeId)
        const data = node?.data?.data || {}
        const orderedChildren = [
          ...normalizeChainTargets((data as Record<string, unknown>).next),
          ...normalizeChainTargets((data as Record<string, unknown>).on_error)
        ]
        orderedChildren.forEach(childId => {
          if (visited.has(childId)) return
          visited.add(childId)
          nextLevel.push(childId)
        })
      })

      currentLevel = nextLevel
    }

    if (!levels.length) return null

    const chainPositions: Record<string, { x: number; y: number }> = {}
    levels.forEach((levelNodes, depth) => {
      const totalWidth = (levelNodes.length - 1) * spacing.nodesep
      const startX = -totalWidth / 2
      levelNodes.forEach((nodeId, index) => {
        chainPositions[nodeId] = {
          x: startX + index * spacing.nodesep,
          y: depth * spacing.ranksep
        }
      })
    })

    const remainingNodes = nodesRef.value.filter(n => !visited.has(n.id))
    const remainingPositions: Record<string, { x: number; y: number }> = {}
    if (remainingNodes.length) {
      const remainingIds = new Set(remainingNodes.map(n => n.id))
      const remainingEdges = edgesRef.value.filter(e => remainingIds.has(e.source) && remainingIds.has(e.target))
      const layouted = layoutWithSpacing(remainingNodes, remainingEdges, spacing)
      const chainXs = Object.values(chainPositions).map(p => p.x)
      const offsetX = (chainXs.length ? Math.max(...chainXs) : 0) + spacing.nodesep * 2
      layouted.forEach(n => {
        remainingPositions[n.id] = {
          x: (n.position?.x || 0) + offsetX,
          y: n.position?.y || 0
        }
      })
    }

    return { chainPositions, remainingPositions, chainIds: visited }
  }

  const applyOrderedChainLayout = (
    nodesRef: Ref<FlowNode[]>,
    edgesRef: Ref<FlowEdge[]>,
    rootId: string,
    spacingOrKey: SpacingKey | SpacingOption = 'normal'
  ) => {
    const result = computeOrderedChainLayout(rootId, nodesRef, edgesRef, spacingOrKey)
    if (!result) return null

    const { chainPositions, remainingPositions } = result
    nodesRef.value = nodesRef.value.map(n => {
      if (chainPositions[n.id]) return { ...n, position: chainPositions[n.id] }
      if (remainingPositions[n.id]) return { ...n, position: remainingPositions[n.id] }
      return n
    })
    return result
  }

  return {
    layout,
    layoutWithSpacing,
    applyLayoutOnRefs,
    computeOrderedChainLayout,
    applyOrderedChainLayout,
    getSpacingConfig,
    SPACING_OPTIONS,
    NODE_SIZE_PADDING
  }
}

