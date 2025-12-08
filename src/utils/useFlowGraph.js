// src/composables/useFlowGraph.js
import { ref, markRaw, computed } from 'vue'
import { useVueFlow, MarkerType } from '@vue-flow/core'
import { useLayout } from './useLayout.js'
import { SPACING_OPTIONS } from './flowOptions.js'
import CustomNode from '../components/Flow/CustomNode.vue'

export function useFlowGraph() {
  // --- 状态 ---
  const nodes = ref([])
  const edges = ref([])
  const currentEdgeType = ref('smoothstep')
  const currentSpacing = ref('normal')
  const currentFilename = ref('')
  const currentSource = ref('')
  const originalDataSnapshot = ref('')

  const nodeTypes = { custom: markRaw(CustomNode) }

  const PORT_MAPPING = {
    'source-a': { field: 'next',     type: 'array',  color: '#3b82f6' },
    'source-c': { field: 'on_error', type: 'array',  color: '#f43f5e' }
  }

  const { addEdges, removeEdges, findNode, fitView } = useVueFlow()
  const { layout } = useLayout()

  // --- Helpers ---

  // 1. 获取节点数据 (已过滤 Unknown 节点)
  const getNodesData = () => {
    const result = {}
    nodes.value.forEach(node => {
      // 过滤缺失引用和未知节点
      if (node.data._isMissing) return
      if (node.data.type === 'Unknown') return

      const nodeData = { ...node.data.data }
      delete nodeData.id
      delete nodeData.interrupt
      result[node.id] = nodeData
    })
    return result
  }

  const isDirty = computed(() => {
    if (!originalDataSnapshot.value) return false
    return JSON.stringify(getNodesData()) !== originalDataSnapshot.value
  })

  // 2. 修改：getEdgeStyle 样式逻辑
  const getEdgeStyle = (handleId, isJumpBack = false) => {
    const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }

    // 默认颜色使用端口定义颜色，如果是 JumpBack 则使用紫色
    let strokeColor = isJumpBack ? '#a855f7' : config.color

    return {
      style: {
        stroke: strokeColor,
        strokeWidth: 2,
        strokeDasharray: '5 5' // 显式设置虚线，保证视觉一致
      },
      animated: true, // 恢复：所有连线都开启动画（流动的虚线），保持和原版一致
      type: currentEdgeType.value,
      markerEnd: MarkerType.ArrowClosed,
      data: { isJumpBack }
    }
  }

  // --- 核心逻辑 1: 连接校验 ---
  const onValidateConnection = (connection) => {
    if (connection.source === connection.target) return false
    if (connection.sourceHandle === 'in') return false
    if (connection.targetHandle !== 'in') return false
    return true
  }

  // --- 核心逻辑 2: 创建节点 ---
  const createNodeObject = (id, rawContent, isMissing = false) => {
    const sanitizedContent = { ...rawContent }
    delete sanitizedContent.interrupt

    let logicType = sanitizedContent.recognition || 'DirectHit'
    if (isMissing) logicType = 'Unknown'
    const isUnknown = logicType === 'Unknown'

    return {
      id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        id,
        type: logicType,
        data: isUnknown ? { id } : { ...sanitizedContent, id, recognition: logicType },
        _isMissing: isMissing,
        status: 'idle'
      }
    }
  }

  // --- 核心逻辑 3: 处理连线 (Toggle模式) ---
  const updateNodeDataConnection = (sourceNode, field, targetId, isArrayType, isAdd, isJumpBack = false) => {
    if (!sourceNode.data.data) sourceNode.data.data = {}
    const data = sourceNode.data.data

    const storedId = isJumpBack ? `[JumpBack]${targetId}` : targetId

    if (isArrayType) {
      if (!Array.isArray(data[field])) data[field] = []

      const existingIndex = data[field].findIndex(id =>
        id === targetId || id === `[JumpBack]${targetId}`
      )

      if (isAdd) {
        if (existingIndex === -1) {
          data[field].push(storedId)
        } else {
            data[field][existingIndex] = storedId
        }
      } else if (existingIndex > -1) {
        data[field].splice(existingIndex, 1)
      }
    } else {
      if (isAdd) {
        data[field] = storedId
      } else {
        const currentVal = data[field] || ''
        if (currentVal === targetId || currentVal === `[JumpBack]${targetId}`) {
             delete data[field]
        }
      }
    }
  }

  const handleConnect = (params) => {
    const existingEdge = edges.value.find(e =>
      e.source === params.source && e.target === params.target && e.sourceHandle === params.sourceHandle
    )
    const portConfig = PORT_MAPPING[params.sourceHandle]
    const sourceNode = findNode(params.source)

    if (existingEdge) {
      removeEdges([existingEdge.id])
      if (sourceNode && portConfig) {
        updateNodeDataConnection(sourceNode, portConfig.field, params.target, portConfig.type === 'array', false)
      }
    } else {
      // 建立连接：默认为普通连接 (isJumpBack = false)
      addEdges({ ...params, ...getEdgeStyle(params.sourceHandle, false), label: portConfig?.field })
      if (sourceNode && portConfig) {
        updateNodeDataConnection(sourceNode, portConfig.field, params.target, portConfig.type === 'array', true, false)
      }
    }
  }

  const handleEdgesChange = (changes) => {
    changes.forEach(change => {
      if (change.type === 'remove') {
        const edge = edges.value.find(e => e.id === change.id)
        if (edge) {
          const sourceNode = findNode(edge.source)
          const portConfig = PORT_MAPPING[edge.sourceHandle]
          if (sourceNode && portConfig) {
            updateNodeDataConnection(sourceNode, portConfig.field, edge.target, portConfig.type === 'array', false)
          }
        }
      }
    })
  }

  // --- 4. 设置连线类型 (JumpBack) ---
  const setEdgeJumpBack = (edgeId, isJumpBack) => {
    const edge = edges.value.find(e => e.id === edgeId)
    if (!edge) return

    const sourceNode = findNode(edge.source)
    const portConfig = PORT_MAPPING[edge.sourceHandle]

    // 更新 Edge 数据和 Label
    edge.data = { ...edge.data, isJumpBack }
    edge.label = isJumpBack ? 'JumpBack' : (portConfig?.field || '')

    // 更新 Edge 样式 (颜色变化)
    const newStyle = getEdgeStyle(edge.sourceHandle, isJumpBack)
    edge.style = newStyle.style
    edge.animated = newStyle.animated // 始终为 true

    // 强制刷新
    edges.value = [...edges.value]

    // 更新 Node 数据
    if (sourceNode && portConfig) {
        updateNodeDataConnection(sourceNode, portConfig.field, edge.target, portConfig.type === 'array', true, isJumpBack)
    }
  }

  const handleNodeUpdate = ({ oldId, newId, newType, newData }) => {
    const node = findNode(oldId)
    if (!node) return

    if (newData && newData._action) {
      handleSpecialAction(node, newData)
      nodes.value = [...nodes.value]
      return
    }

    if (oldId !== newId) {
      if (findNode(newId)) { alert(`ID "${newId}" already exists!`); return }

      node.id = newId
      node.data.id = newId
      if (node.data.data) node.data.data.id = newId

      edges.value = edges.value.map(e => {
        let update = {}
        if (e.source === oldId) update.source = newId
        if (e.target === oldId) update.target = newId
        return (update.source || update.target) ? { ...e, ...update, id: e.id.replace(oldId, newId) } : e
      })

      nodes.value.forEach(n => {
        if (n.id === newId || !n.data.data) return
        const d = n.data.data
        ;['next'].forEach(f => {
          if (Array.isArray(d[f])) {
             d[f] = d[f].map(item => {
                 if (item === oldId) return newId
                 if (item === `[JumpBack]${oldId}`) return `[JumpBack]${newId}`
                 return item
             })
          }
        })
        if (Array.isArray(d.on_error)) {
          d.on_error = d.on_error.map(item => {
            if (item === oldId) return newId
            if (item === `[JumpBack]${oldId}`) return `[JumpBack]${newId}`
            return item
          })
        } else if (d.on_error) {
          if (d.on_error === oldId) d.on_error = newId
          if (d.on_error === `[JumpBack]${oldId}`) d.on_error = `[JumpBack]${newId}`
        }

        ['timeout_next'].forEach(f => {
          if (d[f] === oldId) d[f] = newId
          if (d[f] === `[JumpBack]${oldId}`) d[f] = `[JumpBack]${newId}`
        })
      })
    }

    node.data.type = newType
    if (newData) node.data.data = { ...newData, id: node.id, recognition: newType }
    else if (node.data.data) node.data.data.recognition = newType

    nodes.value = [...nodes.value]
  }

  // --- Helper: 管理 Template 路径 ---
  const modifyTemplatePath = (nodeData, path, mode = 'add') => {
    if (!nodeData.data) nodeData.data = {}
    let tpl = nodeData.data.template

    let paths = []
    if (Array.isArray(tpl)) paths = [...tpl]
    else if (typeof tpl === 'string' && tpl) paths = [tpl]

    if (mode === 'add') {
      if (!paths.includes(path)) paths.push(path)
    } else if (mode === 'remove') {
      paths = paths.filter(p => p !== path)
    }
    nodeData.data.template = paths
  }

  const handleSpecialAction = (node, actionData) => {
    const action = actionData._action

    if (action === 'delete_images' || (action === 'save_screenshot' && actionData.deletePaths?.length)) {
      const deletePaths = actionData.deletePaths || []
      if (!deletePaths.length) return
      const currentImages = node.data._images || []
      node.data._del_images = [...(node.data._del_images || []), ...currentImages.filter(img => deletePaths.includes(img.path))]
      node.data._images = currentImages.filter(img => !deletePaths.includes(img.path))
      deletePaths.forEach(path => modifyTemplatePath(node.data, path, 'remove'))
    }

    if (action === 'add_temp_image') {
      const { imagePath, imageBase64 } = actionData
      if (!imagePath || !imageBase64) return
      if (!node.data._temp_images) node.data._temp_images = []
      node.data._temp_images.push({ path: imagePath, base64: imageBase64, found: true })
      modifyTemplatePath(node.data, imagePath, 'add')
    }

    if (action === 'restore_image') {
      const { imagePath } = actionData
      const delImages = node.data._del_images || []
      const imageToRestore = delImages.find(img => img.path === imagePath)
      if (imageToRestore) {
        node.data._del_images = delImages.filter(img => img.path !== imagePath)
        if (!node.data._images) node.data._images = []
        node.data._images.push(imageToRestore)
        modifyTemplatePath(node.data, imagePath, 'add')
      }
    }

    if (action === 'save_image_changes') {
      const { validPaths, images, tempImages, deletedImages } = actionData
      node.data._images = images || []
      node.data._temp_images = tempImages || []
      node.data._del_images = deletedImages || []
      if (!node.data.data) node.data.data = {}
      node.data.data.template = validPaths && validPaths.length ? [...validPaths] : []
    }
  }

  const loadNodes = ({ filename, source, nodes: rawNodesData }) => {
    const newNodes = []
    const newEdges = []
    const createdNodeIds = new Set()

    // 1. 创建节点
    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      newNodes.push(createNodeObject(nodeId, nodeContent))
      createdNodeIds.add(nodeId)
    }

    // 2. 创建连线 & 补充缺失节点
    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      const linkFields = [
        { key: 'next', handle: 'source-a' },
        { key: 'on_error', handle: 'source-c' },
        { key: 'timeout_next', handle: 'source-c' }
      ]

      linkFields.forEach(({ key, handle }) => {
        if (nodeContent[key]) {
          const rawTargets = Array.isArray(nodeContent[key]) ? nodeContent[key] : [nodeContent[key]]

          rawTargets.forEach(rawTargetId => {
            if (!rawTargetId) return

            let targetId = rawTargetId
            let isJumpBack = false
            if (typeof targetId === 'string' && targetId.startsWith('[JumpBack]')) {
                isJumpBack = true
                targetId = targetId.replace('[JumpBack]', '')
            }

            if (!createdNodeIds.has(targetId)) {
              newNodes.push(createNodeObject(targetId, {}, true))
              createdNodeIds.add(targetId)
            }

            newEdges.push({
              id: `e-${nodeId}-${targetId}-${key}`,
              source: nodeId, target: targetId,
              sourceHandle: handle, targetHandle: 'in',
              label: isJumpBack ? 'JumpBack' : key,
              ...getEdgeStyle(handle, isJumpBack)
            })
          })
        }
      })
    }

    const layoutedNodes = layout(newNodes, newEdges, SPACING_OPTIONS[currentSpacing.value])
    nodes.value = layoutedNodes
    edges.value = newEdges

    currentFilename.value = filename || ''
    currentSource.value = source || ''

    setTimeout(() => { originalDataSnapshot.value = JSON.stringify(getNodesData()) }, 0)
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50)
  }

  /**
   * 以指定节点为根重新布局任务链
   * 1) 仅依据 next/on_error 顺序逐层铺开
   * 2) 链上节点优先布局；其余节点单独布局后右移放置
   */
  const layoutTaskChain = (rootId) => {
    if (!rootId) return
    const root = findNode(rootId)
    if (!root) return

    const spacing = SPACING_OPTIONS[currentSpacing.value] || { ranksep: 80, nodesep: 140 }
    const normalizeTargets = (val) => {
      if (!val && val !== 0) return []
      const list = Array.isArray(val) ? val : [val]
      return list
        .map(v => (typeof v === 'string' && v.startsWith('[JumpBack]')) ? v.replace('[JumpBack]', '') : v)
        .filter(Boolean)
    }

    // 收集链上节点（按层级保持顺序）
    const visited = new Set()
    const levels = []
    let currentLevel = [rootId]
    visited.add(rootId)

    while (currentLevel.length) {
      levels.push(currentLevel)
      const nextLevel = []

      currentLevel.forEach(nodeId => {
        const node = findNode(nodeId)
        const data = node?.data?.data || {}
        const orderedChildren = [
          ...normalizeTargets(data.next),
          ...normalizeTargets(data.on_error)
        ]

        orderedChildren.forEach(childId => {
          if (visited.has(childId)) return
          visited.add(childId)
          nextLevel.push(childId)
        })
      })

      currentLevel = nextLevel
    }

    // 给链上节点按层级与顺序放置位置
    const chainPositions = {}
    levels.forEach((levelNodes, depth) => {
      const count = levelNodes.length || 1
      const totalWidth = (count - 1) * spacing.nodesep
      const startX = -totalWidth / 2
      levelNodes.forEach((nodeId, index) => {
        chainPositions[nodeId] = {
          x: startX + index * spacing.nodesep,
          y: depth * spacing.ranksep
        }
      })
    })

    // 其余节点单独布局后整体右移，避免遮挡链
    const remainingNodes = nodes.value.filter(n => !visited.has(n.id))
    let remainingPositions = {}
    if (remainingNodes.length) {
      const remainingIds = new Set(remainingNodes.map(n => n.id))
      const remainingEdges = edges.value.filter(e => remainingIds.has(e.source) && remainingIds.has(e.target))
      const layouted = layout(remainingNodes, remainingEdges, spacing)
      const chainXs = Object.values(chainPositions).map(p => p.x)
      const offsetX = (chainXs.length ? Math.max(...chainXs) : 0) + spacing.nodesep * 2
      layouted.forEach(n => {
        remainingPositions[n.id] = {
          x: (n.position?.x || 0) + offsetX,
          y: n.position?.y || 0
        }
      })
    }

    // 应用新坐标
    nodes.value = nodes.value.map(n => {
      if (chainPositions[n.id]) return { ...n, position: chainPositions[n.id] }
      if (remainingPositions[n.id]) return { ...n, position: remainingPositions[n.id] }
      return n
    })

    setTimeout(() => fitView({ padding: 0.25, duration: 600 }), 50)
  }

  const getImageData = () => {
    const delImages = []
    const tempImages = []
    nodes.value.forEach(node => {
      if (node.data._isMissing) return
      node.data._del_images?.forEach(img => img.path && delImages.push({ path: img.path, nodeId: node.id }))
      node.data._temp_images?.forEach(img => img.path && img.base64 && tempImages.push({ path: img.path, base64: img.base64, nodeId: node.id }))
    })
    return { delImages, tempImages }
  }

  const clearTempImageData = () => {
    nodes.value.forEach(node => {
      if (node.data._isMissing) return
      if (node.data._temp_images?.length) {
        if (!node.data._images) node.data._images = []
        node.data._images.push(...node.data._temp_images)
        node.data._temp_images = []
      }
      node.data._del_images = []
    })
    nodes.value = [...nodes.value]
  }

  const normalizeId = (raw) => {
    if (typeof raw !== 'string') return raw
    return raw.startsWith('[JumpBack]') ? raw.replace('[JumpBack]', '') : raw
  }

  const getOrderedChildren = (nodeId) => {
    const node = findNode(nodeId)
    if (!node || !node.data?.data) return []
    const data = node.data.data
    const toArray = (val) => Array.isArray(val) ? val : (val ? [val] : [])
    const nextList = toArray(data.next)
    const onErrorList = toArray(data.on_error)
    const merged = [...nextList, ...onErrorList].map(normalizeId).filter(Boolean)
    const dedup = []
    merged.forEach(id => { if (!dedup.includes(id)) dedup.push(id) })
    return dedup
  }

  const buildComponentSet = (startId) => {
    const component = new Set()
    const queue = [startId]
    const adjacency = {}
    edges.value.forEach(e => {
      if (!adjacency[e.source]) adjacency[e.source] = new Set()
      if (!adjacency[e.target]) adjacency[e.target] = new Set()
      adjacency[e.source].add(e.target)
      adjacency[e.target].add(e.source)
    })

    while (queue.length) {
      const id = queue.shift()
      if (component.has(id)) continue
      component.add(id)
      const neighbours = adjacency[id]
      if (neighbours) {
        neighbours.forEach(n => { if (!component.has(n)) queue.push(n) })
      }
    }
    return component
  }

  const layoutChainFromNode = (startId, spacingKey = currentSpacing.value) => {
    if (!startId) return
    const targetNode = findNode(startId)
    if (!targetNode) return

    const spacing = SPACING_OPTIONS[spacingKey] || SPACING_OPTIONS.normal || { ranksep: 80, nodesep: 60 }
    const component = buildComponentSet(startId)

    // 只布局与起点同组件的节点，保持与全局自动布局一致的间距配置
    const componentNodes = nodes.value.filter(n => component.has(n.id))
    const componentEdges = edges.value.filter(e => component.has(e.source) && component.has(e.target))
    const laidOut = layout(componentNodes, componentEdges, spacing)

    const positions = {}
    const rootPos = targetNode.position || { x: 0, y: 0 }
    const rootLayoutPos = laidOut.find(n => n.id === startId)?.position || { x: 0, y: 0 }
    const offsetX = rootPos.x - rootLayoutPos.x
    const offsetY = rootPos.y - rootLayoutPos.y

    laidOut.forEach(n => {
      positions[n.id] = {
        x: (n.position?.x || 0) + offsetX,
        y: (n.position?.y || 0) + offsetY
      }
    })

    nodes.value = nodes.value.map(node => positions[node.id] ? { ...node, position: positions[node.id] } : node)
    setTimeout(() => fitView({ nodes: Array.from(component), padding: 0.2, duration: 600 }), 50)
  }

  return {
    nodes, edges, nodeTypes, currentEdgeType, currentSpacing, isDirty, currentFilename, currentSource, SPACING_OPTIONS,
    createNodeObject, onValidateConnection, handleConnect, handleEdgesChange, handleNodeUpdate,
    loadNodes, getNodesData, getImageData, clearTempImageData,
    setEdgeJumpBack, layoutTaskChain,
    clearDirty: () => originalDataSnapshot.value = JSON.stringify(getNodesData()),
    layout, applyLayout: (k) => { nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[k]); setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50) },
    layoutChainFromNode
  }
}