// src/composables/useFlowGraph.js
import { ref, markRaw, computed } from 'vue'
import { useVueFlow, MarkerType } from '@vue-flow/core'
import { useLayout } from './useLayout.js'
import CustomNode from '../components/Flow/CustomNode.vue'

export function useFlowGraph() {
  // --- 状态 ---
  const nodes = ref([])
  const edges = ref([])
  const currentEdgeType = ref('smoothstep')
  const currentSpacing = ref('normal')
  const currentFilename = ref('') // 当前打开的文件名
  const originalDataSnapshot = ref('') // 原始数据快照（JSON字符串）

  const nodeTypes = { custom: markRaw(CustomNode) }

  const SPACING_OPTIONS = {
    compact: { ranksep: 40, nodesep: 30 },
    normal:  { ranksep: 80, nodesep: 60 },
    loose:   { ranksep: 120, nodesep: 150 }
  }

  const PORT_MAPPING = {
    'source-a': { field: 'next',         type: 'array',  color: '#3b82f6' },
    'source-b': { field: 'interrupt',    type: 'array',  color: '#f59e0b' },
    'source-c': { field: 'on_error',     type: 'string', color: '#f43f5e' }
  }

  // --- Vue Flow Hooks ---
  const {
    addEdges, removeEdges, findNode, fitView
  } = useVueFlow()

  const { layout } = useLayout()

  // --- Helper: 获取当前节点数据（用于比较和保存） ---
  const getNodesData = () => {
    const result = {}

    nodes.value.forEach(node => {
      // 跳过缺失的占位节点
      if (node.data._isMissing) return
      console.log(node.data)
      const nodeData = { ...node.data.data }
      // 移除内部使用的 id 字段（key 就是 id）
      delete nodeData.id
      result[node.id] = nodeData
    })
    return result
  }

  // --- 计算属性: 通过比较数据判断是否有修改 ---
  const isDirty = computed(() => {
    if (!originalDataSnapshot.value) return false
    const currentData = JSON.stringify(getNodesData())
    return currentData !== originalDataSnapshot.value
  })

  // --- Helper: 获取连线样式 ---
  const getEdgeStyle = (handleId) => {
    const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }
    return {
      style: { stroke: config.color, strokeWidth: 2 },
      animated: true,
      type: currentEdgeType.value,
      markerEnd: MarkerType.ArrowClosed,
    }
  }

// --- Helper: 创建节点对象 ---
  const createNodeObject = (id, rawContent, isMissing = false) => {
    let logicType = rawContent.recognition || 'DirectHit'
    if (isMissing) logicType = 'Unknown'

    // [修改点 1] 判断是否为手动添加的未知节点
    const isUnknown = logicType === 'Unknown'

    return {
      id: id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        id: id,
        type: logicType,
        // [修改点 2] 如果是 Unknown 类型，data.data 只保留 id，丢弃其他无用属性
        data: isUnknown ? { id: id } : { ...rawContent, id: id, recognition: logicType },
        _isMissing: isMissing,
        status: 'idle'
      }
    }
  }

  // --- 核心逻辑 1: 连接校验 ---
  const onValidateConnection = (connection) => {
    return connection.targetHandle === 'in'
  }

  // --- 核心逻辑 2: 处理连线 (Toggle模式) ---
  const handleConnect = (params) => {
    const existingEdge = edges.value.find(e =>
      e.source === params.source && e.target === params.target &&
      e.sourceHandle === params.sourceHandle
    )

    const portConfig = PORT_MAPPING[params.sourceHandle]
    const sourceNode = findNode(params.source)

    // A. 断开逻辑
    if (existingEdge) {
      removeEdges([existingEdge.id])
      if (sourceNode && portConfig && sourceNode.data.data) {
        const field = portConfig.field
        const targetId = params.target

        if (portConfig.type === 'array') {
          const arr = sourceNode.data.data[field]
          if (Array.isArray(arr)) {
            const idx = arr.indexOf(targetId)
            if (idx > -1) arr.splice(idx, 1)
          }
        } else {
          if (sourceNode.data.data[field] === targetId) delete sourceNode.data.data[field]
        }
      }
      return
    }

    // B. 连接逻辑
    addEdges({
      ...params,
      ...getEdgeStyle(params.sourceHandle),
      label: portConfig ? portConfig.field : undefined
    })

    if (sourceNode && portConfig) {
      const field = portConfig.field
      const targetId = params.target
      if (!sourceNode.data.data) sourceNode.data.data = {}

      if (portConfig.type === 'array') {
        if (!Array.isArray(sourceNode.data.data[field])) sourceNode.data.data[field] = []
        if (!sourceNode.data.data[field].includes(targetId)) sourceNode.data.data[field].push(targetId)
      } else {
        sourceNode.data.data[field] = targetId
      }
    }
  }

  // --- 核心逻辑 3: 处理连线变更 (外部删除) ---
  const handleEdgesChange = (changes) => {
    changes.forEach(change => {
      if (change.type === 'remove') {
        const edge = edges.value.find(e => e.id === change.id)
        if (edge) {
          const sourceNode = findNode(edge.source)
          const targetId = edge.target
          const portConfig = PORT_MAPPING[edge.sourceHandle]

          if (sourceNode && portConfig && sourceNode.data.data) {
            const field = portConfig.field
            if (portConfig.type === 'array') {
              const arr = sourceNode.data.data[field]
              if (Array.isArray(arr)) {
                const idx = arr.indexOf(targetId)
                if (idx > -1) arr.splice(idx, 1)
              }
            } else {
              if (sourceNode.data.data[field] === targetId) delete sourceNode.data.data[field]
            }
          }
        }
      }
    })
  }

  // --- 核心逻辑 4: 节点 ID/Type/Data 更新 ---
  const handleNodeUpdate = ({ oldId, newId, newType, newData }) => {
    const node = findNode(oldId)
    if (!node) return

    // 处理特殊的 _action 操作
    if (newData && newData._action) {
      handleSpecialAction(node, newData)
      nodes.value = [...nodes.value] // Trigger reactivity
      return
    }

    if (oldId !== newId) {
      if (findNode(newId)) { alert(`ID "${newId}" already exists!`); return }

      // 更新 ID
      node.id = newId
      node.data.id = newId
      node.data.data.id = newId

      // 更新连线
      edges.value = edges.value.map(e => {
        let update = {}
        if (e.source === oldId) update.source = newId
        if (e.target === oldId) update.target = newId
        if (update.source || update.target) {
          return { ...e, ...update, id: e.id.replace(oldId, newId) }
        }
        return e
      })

      // 更新其他节点引用
      nodes.value.forEach(n => {
        if (n.id === newId) return
        const d = n.data.data
        if (!d) return
        ['next', 'interrupt'].forEach(field => {
          if (Array.isArray(d[field])) {
            const idx = d[field].indexOf(oldId)
            if (idx > -1) d[field][idx] = newId
          }
        })
        const singleFields = ['on_error', 'timeout_next']
        singleFields.forEach(field => {
          if (d[field] === oldId) d[field] = newId
        })
      })
    }

    // 更新节点类型
    node.data.type = newType
    
    // 如果有新数据，更新业务数据
    if (newData) {
      node.data.data = { ...newData, id: node.id, recognition: newType }
    } else {
      node.data.data.recognition = newType
    }
    
    nodes.value = [...nodes.value] // Trigger reactivity
  }

  // --- 处理特殊操作 (删除图片等) ---
  const handleSpecialAction = (node, actionData) => {
    const action = actionData._action

    if (action === 'delete_images' || (action === 'save_screenshot' && actionData.deletePaths?.length > 0)) {
      const deletePaths = actionData.deletePaths || []
      if (deletePaths.length === 0) return

      // 获取当前 _images 数组
      const currentImages = node.data._images || []
      
      // 初始化 _del_images（如果不存在）
      if (!node.data._del_images) {
        node.data._del_images = []
      }

      // 找出要删除的图片并移动到 _del_images
      const imagesToDelete = currentImages.filter(img => deletePaths.includes(img.path))
      const remainingImages = currentImages.filter(img => !deletePaths.includes(img.path))

      // 更新节点的 _images 和 _del_images
      node.data._images = remainingImages
      node.data._del_images = [...node.data._del_images, ...imagesToDelete]

      // 从业务数据的 template 属性中移除对应路径
      if (node.data.data && node.data.data.template) {
        const currentTemplate = node.data.data.template
        if (Array.isArray(currentTemplate)) {
          node.data.data.template = currentTemplate.filter(path => !deletePaths.includes(path))
        } else if (typeof currentTemplate === 'string') {
          if (deletePaths.includes(currentTemplate)) {
            node.data.data.template = []
          }
        }
      }

      console.log('[useFlowGraph] 图片删除操作完成:', {
        nodeId: node.id,
        deletedPaths: deletePaths,
        remainingImages: remainingImages.length,
        deletedImagesTotal: node.data._del_images.length
      })
    }

    // 处理保存截图操作（如果有）
    if (action === 'save_screenshot' && actionData.rect) {
      // 这里可以处理保存截图的逻辑
      console.log('[useFlowGraph] 保存截图:', actionData.rect)
    }
  }

  // --- 核心逻辑 5: 加载节点 ---
  const loadNodes = ({ filename, nodes: rawNodesData }) => {
    const newNodes = []
    const newEdges = []
    const createdNodeIds = new Set()

    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      newNodes.push(createNodeObject(nodeId, nodeContent))
      createdNodeIds.add(nodeId)
    }

    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      const linkFields = [
        { key: 'next',         handle: 'source-a' },
        { key: 'interrupt',    handle: 'source-b' },
        { key: 'on_error',     handle: 'source-c' },
        { key: 'timeout_next', handle: 'source-c' }
      ]

      linkFields.forEach(({ key, handle }) => {
        if (nodeContent[key]) {
          const targets = Array.isArray(nodeContent[key]) ? nodeContent[key] : [nodeContent[key]]
          targets.forEach(targetId => {
            if (!targetId) return
            if (!createdNodeIds.has(targetId)) {
              newNodes.push(createNodeObject(targetId, {}, true))
              createdNodeIds.add(targetId)
            }
            newEdges.push({
              id: `e-${nodeId}-${targetId}-${key}`,
              source: nodeId,
              target: targetId,
              sourceHandle: handle,
              targetHandle: 'in',
              label: key,
              ...getEdgeStyle(handle)
            })
          })
        }
      })
    }

    const layoutedNodes = layout(newNodes, newEdges, SPACING_OPTIONS[currentSpacing.value])
    nodes.value = layoutedNodes
    edges.value = newEdges
    
    // 记录当前文件名并保存原始数据快照
    currentFilename.value = filename || ''
    // 延迟一帧保存快照，确保 nodes 已更新
    setTimeout(() => {
      originalDataSnapshot.value = JSON.stringify(getNodesData())
    }, 0)
    
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50)
  }

  // --- 清除 dirty 状态（更新快照为当前数据） ---
  const clearDirty = () => {
    originalDataSnapshot.value = JSON.stringify(getNodesData())
  }

  // --- 暴露给组件 ---
  return {
    nodes,
    edges,
    nodeTypes,
    currentEdgeType,
    currentSpacing,
    isDirty,
    currentFilename,
    SPACING_OPTIONS,
    createNodeObject,
    onValidateConnection,
    handleConnect,
    handleEdgesChange,
    handleNodeUpdate,
    loadNodes,
    getNodesData,
    clearDirty,
    layout, // 暴露 layout 供手动调用
    // Helper to update layout explicitly
    applyLayout: (spacingKey) => {
      nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[spacingKey])
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
    }
  }
}