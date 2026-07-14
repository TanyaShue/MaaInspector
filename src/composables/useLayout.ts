import type { Ref } from 'vue'
import ELK from 'elkjs/lib/elk.bundled.js'
import { useVueFlow } from '@vue-flow/core'
import type { FlowEdge, FlowNode, SpacingKey, LayoutAlgorithm, LayoutDirection } from '@/utils/flowTypes'
import { SPACING_OPTIONS } from '@/utils/flowOptions'

export interface LayoutOptions {
  algorithm: LayoutAlgorithm
  direction: LayoutDirection
  spacing: SpacingKey
}

export const NODE_SIZE_PADDING = {
  fallbackWidth: 280,
  fallbackHeight: 150,
  extraWidth: 20,
  extraHeight: 20,
  horizontalPortWidth: 40
}

const elk = new ELK()

interface ElkEdgeDescriptor {
  id: string
  sources: string[]
  targets: string[]
}

interface ElkLayoutChild {
  id: string
  x?: number
  y?: number
}

const HANDLE_ORDER: Record<string, number> = {
  'source-a': 1,
  'source-c': 3
}

/**
 * Preserve the existing source-handle order without looking the original edge
 * up again from every sort comparison. The three buckets also keep equal
 * weights stable while visiting every input edge only once.
 */
export const createOrderedElkEdges = (edges: FlowEdge[]): ElkEdgeDescriptor[] => {
  const buckets: [ElkEdgeDescriptor[], ElkEdgeDescriptor[], ElkEdgeDescriptor[]] = [[], [], []]

  edges.forEach((edge) => {
    const descriptor = {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }
    const weight = HANDLE_ORDER[edge.sourceHandle ?? ''] ?? 2
    buckets[weight - 1].push(descriptor)
  })

  return buckets.flat()
}

/** Index ELK output once instead of scanning all layout children per node. */
export const applyElkNodePositions = (
  nodes: FlowNode[],
  children: ElkLayoutChild[] = []
): FlowNode[] => {
  const childrenById = new Map<string, ElkLayoutChild>()
  children.forEach((child) => {
    const childId = child.id
    if (!childrenById.has(childId)) childrenById.set(childId, child)
  })

  return nodes.map((node) => {
    const elkNode = childrenById.get(node.id)
    return {
      ...node,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0
      }
    }
  })
}

const getSpacingConfig = (key: SpacingKey = 'normal') =>
  SPACING_OPTIONS[key] || SPACING_OPTIONS.normal

const directionToElk = (direction: LayoutDirection): string => {
  return direction === 'LR' ? 'RIGHT' : 'DOWN'
}

export function useLayout(flowId?: string) {
  const { findNode } = useVueFlow(flowId)

  const getNodeLayoutSize = (nodeId: string, direction: LayoutDirection) => {
    const nodeEl = findNode(nodeId)
    return {
      width: (nodeEl?.dimensions?.width ?? NODE_SIZE_PADDING.fallbackWidth) +
        NODE_SIZE_PADDING.extraWidth +
        (direction === 'LR' ? NODE_SIZE_PADDING.horizontalPortWidth : 0),
      height: (nodeEl?.dimensions?.height ?? NODE_SIZE_PADDING.fallbackHeight) + NODE_SIZE_PADDING.extraHeight
    }
  }

  const getStressDesiredEdgeLength = (nodeSizes: Array<{ width: number; height: number }>, options: LayoutOptions) => {
    const spacing = getSpacingConfig(options.spacing)
    if (!nodeSizes.length) return spacing.nodeSpacing

    const averageNodeSize = nodeSizes.reduce((sum, size) => {
      return sum + (options.direction === 'LR' ? size.width : size.height)
    }, 0) / nodeSizes.length

    return Math.round(averageNodeSize + spacing.nodeSpacing)
  }

  const elkLayout = async (
    nodes: FlowNode[],
    edges: FlowEdge[],
    options: LayoutOptions = { algorithm: 'layered', direction: 'TB', spacing: 'normal' }
  ): Promise<FlowNode[]> => {
    const spacing = getSpacingConfig(options.spacing)
    const elkDirection = directionToElk(options.direction)
    const nodeSizes = nodes.map((node) => getNodeLayoutSize(node.id, options.direction))

    const layoutOptions: Record<string, string> = {
      'elk.algorithm': options.algorithm,
      'elk.direction': elkDirection,
    }

    if (options.algorithm === 'stress') {
      layoutOptions['elk.stress.desiredEdgeLength'] = String(getStressDesiredEdgeLength(nodeSizes, options))
      layoutOptions['elk.spacing.nodeNode'] = String(spacing.nodeSpacing)
    } else if (options.algorithm === 'mrtree') {
      layoutOptions['elk.spacing.nodeNode'] = String(spacing.nodeSpacing)
      layoutOptions['elk.spacing.edgeEdge'] = String(spacing.edgeSpacing)
    } else {
      layoutOptions['elk.spacing.nodeNode'] = String(spacing.nodeSpacing)
      layoutOptions['elk.spacing.edgeEdge'] = String(spacing.edgeSpacing)
      layoutOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = String(spacing.nodeSpacing)
      layoutOptions['elk.edgeRouting'] = 'ORTHOGONAL'
    }

    const elkGraph = {
      id: 'root',
      layoutOptions,
      children: nodes.map((node, index) => {
        const { width, height } = nodeSizes[index]
        return {
          id: node.id,
          width,
          height
        }
      }),
      edges: createOrderedElkEdges(edges)
    }

    try {
      const layouted = await elk.layout(elkGraph)
      return applyElkNodePositions(nodes, layouted.children)
    } catch (error) {
      console.error('[useLayout] ELK layout failed:', error)
      return nodes
    }
  }

  const applyLayoutOnRefs = async (
    nodesRef: Ref<FlowNode[]>,
    edgesRef: Ref<FlowEdge[]>,
    options: LayoutOptions = { algorithm: 'layered', direction: 'TB', spacing: 'normal' }
  ): Promise<FlowNode[]> => {
    const layouted = await elkLayout(nodesRef.value, edgesRef.value, options)
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

  interface TreeNode {
    id: string
    children: TreeNode[]
    depth: number
    index: number
  }

  const buildLayoutTree = (
    rootId: string,
    _nodesRef: Ref<FlowNode[]>,
    _edgesRef: Ref<FlowEdge[]>,
    _options: LayoutOptions
  ): { root: TreeNode | null; allIds: Set<string> } => {
    const root = findNode(rootId)
    if (!root) return { root: null, allIds: new Set() }

    const visited = new Set<string>()
    const allIds = new Set<string>()

    const buildNode = (nodeId: string, depth: number, index: number): TreeNode | null => {
      if (visited.has(nodeId)) return null
      visited.add(nodeId)
      allIds.add(nodeId)

      const node = findNode(nodeId)
      if (!node) return null

      const data = node.data?.data || {}
      const nextChildren = normalizeChainTargets((data as Record<string, unknown>).next)
      const errorChildren = normalizeChainTargets((data as Record<string, unknown>).on_error)

      const children: TreeNode[] = []
      let childIndex = 0

      const addChild = (childId: string) => {
        const childNode = buildNode(childId, depth + 1, childIndex)
        if (childNode) {
          children.push(childNode)
          childIndex++
        }
      }

      nextChildren.forEach(addChild)
      errorChildren.forEach(addChild)

      return { id: nodeId, children, depth, index }
    }

    const rootNode = buildNode(rootId, 0, 0)
    return { root: rootNode, allIds: visited }
  }

  const computeSubtreeSize = (node: TreeNode, nodeSizes: Record<string, { width: number; height: number }>, spacing: { nodeSpacing: number; edgeSpacing: number }, isHorizontal: boolean): { width: number; height: number } => {
    if (!node.children.length) {
      const size = nodeSizes[node.id] || { width: 280, height: 150 }
      return { width: size.width, height: size.height }
    }

    const childSizes = node.children.map(child => computeSubtreeSize(child, nodeSizes, spacing, isHorizontal))

    if (isHorizontal) {
      const maxChildWidth = Math.max(...childSizes.map(s => s.width))
      const totalChildHeight = childSizes.reduce((sum, s) => sum + s.height, 0) + (node.children.length - 1) * spacing.nodeSpacing
      return {
        width: maxChildWidth + spacing.nodeSpacing,
        height: Math.max(nodeSizes[node.id]?.height || 150, totalChildHeight)
      }
    } else {
      const maxChildHeight = Math.max(...childSizes.map(s => s.height))
      const totalChildWidth = childSizes.reduce((sum, s) => sum + s.width, 0) + (node.children.length - 1) * spacing.nodeSpacing
      return {
        width: Math.max(nodeSizes[node.id]?.width || 280, totalChildWidth),
        height: maxChildHeight + spacing.nodeSpacing
      }
    }
  }

  const assignPositions = (
    node: TreeNode,
    nodeSizes: Record<string, { width: number; height: number }>,
    spacing: { nodeSpacing: number; edgeSpacing: number },
    isHorizontal: boolean,
    x: number,
    y: number,
    positions: Record<string, { x: number; y: number }>
  ) => {
    const size = nodeSizes[node.id] || { width: 280, height: 150 }
    positions[node.id] = { x, y }

    if (!node.children.length) return

    const childSizes = node.children.map(child => computeSubtreeSize(child, nodeSizes, spacing, isHorizontal))

    if (isHorizontal) {
      const totalHeight = childSizes.reduce((sum, s, i) => sum + s.height + (i > 0 ? spacing.nodeSpacing : 0), 0)
      let currentY = y - totalHeight / 2

      node.children.forEach((child, i) => {
        const childX = x + size.width + spacing.nodeSpacing
        const childY = currentY + childSizes[i].height / 2
        assignPositions(child, nodeSizes, spacing, isHorizontal, childX, childY, positions)
        currentY += childSizes[i].height + spacing.nodeSpacing
      })
    } else {
      const totalWidth = childSizes.reduce((sum, s, i) => sum + s.width + (i > 0 ? spacing.nodeSpacing : 0), 0)
      let currentX = x - totalWidth / 2

      node.children.forEach((child, i) => {
        const childX = currentX + childSizes[i].width / 2
        const childY = y + size.height + spacing.nodeSpacing
        assignPositions(child, nodeSizes, spacing, isHorizontal, childX, childY, positions)
        currentX += childSizes[i].width + spacing.nodeSpacing
      })
    }
  }

  const computeOrderedChainLayout = async (
    rootId: string,
    nodesRef: Ref<FlowNode[]>,
    edgesRef: Ref<FlowEdge[]>,
    options: LayoutOptions = { algorithm: 'layered', direction: 'TB', spacing: 'normal' }
  ) => {
    if (!rootId) return null

    const { root: layoutTree, allIds: visited } = buildLayoutTree(rootId, nodesRef, edgesRef, options)
    if (!layoutTree) return null

    const spacing = getSpacingConfig(options.spacing)
    const isHorizontal = options.direction === 'LR'

    const allNodeSizes: Record<string, { width: number; height: number }> = {}
    nodesRef.value.forEach(node => {
      allNodeSizes[node.id] = getNodeLayoutSize(node.id, options.direction)
    })

    const positions: Record<string, { x: number; y: number }> = {}

    if (options.algorithm === 'layered') {
      assignPositions(layoutTree, allNodeSizes, spacing, isHorizontal, 0, 0, positions)
    } else if (options.algorithm === 'stress' || options.algorithm === 'mrtree') {
      const chainNodes = nodesRef.value.filter(n => visited.has(n.id))
      const chainEdges = edgesRef.value.filter(e => visited.has(e.source) && visited.has(e.target))

      const elkOptions = {
        ...options,
        spacing: options.algorithm === 'stress' ? 'normal' : options.spacing
      }
      const layouted = await elkLayout(chainNodes, chainEdges, elkOptions)

      layouted.forEach(n => {
        positions[n.id] = n.position
      })
    }

    const remainingNodes = nodesRef.value.filter(n => !visited.has(n.id))
    const remainingPositions: Record<string, { x: number; y: number }> = {}

    if (remainingNodes.length) {
      const remainingIds = new Set(remainingNodes.map(n => n.id))
      const remainingEdges = edgesRef.value.filter(e => remainingIds.has(e.source) && remainingIds.has(e.target))

      let chainMinX = Infinity, chainMinY = Infinity, chainMaxX = -Infinity, chainMaxY = -Infinity
      Object.entries(positions).forEach(([nodeId, pos]) => {
        const size = allNodeSizes[nodeId] || { width: 280, height: 150 }
        chainMinX = Math.min(chainMinX, pos.x)
        chainMinY = Math.min(chainMinY, pos.y)
        chainMaxX = Math.max(chainMaxX, pos.x + size.width)
        chainMaxY = Math.max(chainMaxY, pos.y + size.height)
      })

      if (remainingEdges.length > 0) {
        const layouted = await elkLayout(remainingNodes, remainingEdges, options)
        let remainingMinX = Infinity, remainingMinY = Infinity, remainingMaxX = -Infinity, remainingMaxY = -Infinity
        layouted.forEach(n => {
          const size = allNodeSizes[n.id] || { width: 280, height: 150 }
          remainingMinX = Math.min(remainingMinX, n.position?.x || 0)
          remainingMinY = Math.min(remainingMinY, n.position?.y || 0)
          remainingMaxX = Math.max(remainingMaxX, (n.position?.x || 0) + size.width)
          remainingMaxY = Math.max(remainingMaxY, (n.position?.y || 0) + size.height)
        })

        const offsetX = chainMaxX + spacing.nodeSpacing * 2 - remainingMinX
        const offsetY = chainMaxY + spacing.nodeSpacing * 2 - remainingMinY

        layouted.forEach(n => {
          remainingPositions[n.id] = {
            x: (n.position?.x || 0) + offsetX,
            y: (n.position?.y || 0) + offsetY
          }
        })
      } else {
        let offsetX = chainMaxX + spacing.nodeSpacing * 2
        let offsetY = chainMinY

        remainingNodes.forEach((n, i) => {
          const size = allNodeSizes[n.id] || { width: 280, height: 150 }
          remainingPositions[n.id] = {
            x: offsetX + (i % 3) * (size.width + spacing.nodeSpacing),
            y: offsetY + Math.floor(i / 3) * (size.height + spacing.nodeSpacing)
          }
          if ((i + 1) % 3 === 0) {
            offsetX = chainMaxX + spacing.nodeSpacing * 2
            offsetY += size.height + spacing.nodeSpacing
          }
        })
      }
    }

    return { chainPositions: positions, remainingPositions, chainIds: visited }
  }

  const applyOrderedChainLayout = async (
    nodesRef: Ref<FlowNode[]>,
    edgesRef: Ref<FlowEdge[]>,
    rootId: string,
    options: LayoutOptions = { algorithm: 'layered', direction: 'TB', spacing: 'normal' }
  ) => {
    const result = await computeOrderedChainLayout(rootId, nodesRef, edgesRef, options)
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
    elkLayout,
    applyLayoutOnRefs,
    computeOrderedChainLayout,
    applyOrderedChainLayout,
    getSpacingConfig,
    SPACING_OPTIONS,
    NODE_SIZE_PADDING
  }
}
