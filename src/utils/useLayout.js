import dagre from 'dagre'
import { useVueFlow } from '@vue-flow/core'

export function useLayout() {
  const { findNode } = useVueFlow()

  /**
   * 自动布局
   * @param {Array} nodes 节点列表
   * @param {Array} edges 连线列表
   * @param {Object} options 布局配置 { ranksep, nodesep }
   */
  const layout = (nodes, edges, options = { ranksep: 50, nodesep: 50 }) => {
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
      // 增加一点宽度余量，让布局不那么拥挤
      const width = (nodeEl?.dimensions.width || 280) + 20
      const height = (nodeEl?.dimensions.height || 150) + 20
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

  return { layout }
}