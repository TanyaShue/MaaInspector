import dagre from 'dagre'
import { useVueFlow } from '@vue-flow/core'

// 统一的间距配置（同时供右键菜单与布局函数使用）
export const SPACING_OPTIONS = {
  compact: { ranksep: 80, nodesep: 120 },
  normal: { ranksep: 120, nodesep: 180 },
  loose: { ranksep: 300, nodesep: 300 }
}

// 控制节点的“虚拟尺寸”余量，让 dagre 布局更加疏松
const NODE_SIZE_PADDING = {
  fallbackWidth: 280,   // 组件未渲染出真实尺寸时的基准宽
  fallbackHeight: 150,  // 组件未渲染出真实尺寸时的基准高
  extraWidth: 20,       // 在真实/基准宽度上额外加的留白
  extraHeight: 20       // 在真实/基准高度上额外加的留白
}

const getSpacingConfig = (key = 'normal') => SPACING_OPTIONS[key] || SPACING_OPTIONS.normal
const resolveSpacing = (spacingOrKey) => typeof spacingOrKey === 'string' ? getSpacingConfig(spacingOrKey) : (spacingOrKey || getSpacingConfig())

export function useLayout() {
  const { findNode } = useVueFlow()

  /**
   * 自动布局
   * @param {Array} nodes 节点列表
   * @param {Array} edges 连线列表
   * @param {Object} options 布局配置 { ranksep, nodesep }
   */
  const layout = (nodes, edges, options = getSpacingConfig()) => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    // 1. 设置布局参数
    dagreGraph.setGraph({
      rankdir: 'TB', // 从上到下
      ranksep: options.ranksep, // 层级间距 (垂直)
      nodesep: options.nodesep, // 节点间距 (水平)
    })

    // 2. 添加节点
    nodes.forEach((node) => {
      const nodeEl = findNode(node.id)
      // 使用可配置的虚拟尺寸留白，避免节点过于拥挤
      const width = (nodeEl?.dimensions.width || NODE_SIZE_PADDING.fallbackWidth) + NODE_SIZE_PADDING.extraWidth
      const height = (nodeEl?.dimensions.height || NODE_SIZE_PADDING.fallbackHeight) + NODE_SIZE_PADDING.extraHeight
      dagreGraph.setNode(node.id, { width, height })
    })

    // 3. 【关键优化】对连线进行排序
    // Dagre 会尝试保持添加顺序，所以我们让 A端口(左)的先加，C端口(右)的后加
    // 这样能引导 Dagre 将连接 A 端口的子节点放在左侧
    const handleOrder = {
      'source-a': 1, // 左 -> 优先
      'source-c': 3  // 右 -> 最后
    }

    const sortedEdges = [...edges].sort((a, b) => {
      // 获取权重，默认为 2 (中间)
      const weightA = handleOrder[a.sourceHandle] || 2
      const weightB = handleOrder[b.sourceHandle] || 2
      return weightA - weightB
    })

    // 4. 添加排序后的连线
    sortedEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    // 5. 计算布局
    dagre.layout(dagreGraph)

    // 6. 应用新坐标
    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWithPosition.width / 2,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
      }
    })
  }

  // 统一封装：根据间距配置（对象或 key）执行布局
  const layoutWithSpacing = (nodes, edges, spacingOrKey = 'normal') => {
    const spacing = resolveSpacing(spacingOrKey)
    return layout(nodes, edges, spacing)
  }

  // 用于直接作用在 ref 上的便捷方法（自动替换 nodesRef.value）
  const applyLayoutOnRefs = (nodesRef, edgesRef, spacingOrKey = 'normal') => {
    const spacing = resolveSpacing(spacingOrKey)
    const layouted = layout(nodesRef.value, edgesRef.value, spacing)
    nodesRef.value = layouted
    return layouted
  }

  // --- 有序任务链布局：按 next/on_error 顺序分层，链外节点右移 ---
  const normalizeChainTargets = (val) => {
    if (val === 0) return [0]
    if (!val && val !== 0) return []
    const list = Array.isArray(val) ? val : [val]
    return list
      .map(v => (typeof v === 'string' && v.startsWith('[JumpBack]')) ? v.replace('[JumpBack]', '') : v)
      .filter(Boolean)
  }

  const computeOrderedChainLayout = (rootId, nodesRef, edgesRef, spacingOrKey = 'normal') => {
    if (!rootId) return null
    const root = findNode(rootId)
    if (!root) return null
    const spacing = resolveSpacing(spacingOrKey)

    const visited = new Set([rootId])
    const levels = []
    let currentLevel = [rootId]

    // 层序遍历，严格按 next 再 on_error 的顺序推进
    while (currentLevel.length) {
      levels.push(currentLevel)
      const nextLevel = []

      currentLevel.forEach(nodeId => {
        const node = findNode(nodeId)
        const data = node?.data?.data || {}
        const orderedChildren = [
          ...normalizeChainTargets(data.next),
          ...normalizeChainTargets(data.on_error)
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

    // 链上节点位置，保证同层节点的左右顺序与定义顺序一致
    const chainPositions = {}
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

    // 其余节点单独跑一次 dagre 布局后整体右移，避免与链重叠
    const remainingNodes = nodesRef.value.filter(n => !visited.has(n.id))
    const remainingPositions = {}
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

  const applyOrderedChainLayout = (nodesRef, edgesRef, rootId, spacingOrKey = 'normal') => {
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
    layout, layoutWithSpacing, applyLayoutOnRefs,
    computeOrderedChainLayout, applyOrderedChainLayout,
    getSpacingConfig, SPACING_OPTIONS, NODE_SIZE_PADDING
  }
}