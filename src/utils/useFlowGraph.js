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
  const currentFilename = ref('')
  const currentSource = ref('')
  const originalDataSnapshot = ref('')

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

  const { addEdges, removeEdges, findNode, fitView } = useVueFlow()
  const { layout } = useLayout()

  // --- Helpers ---
  const getNodesData = () => {
    const result = {}
    nodes.value.forEach(node => {
      if (node.data._isMissing) return
      const nodeData = { ...node.data.data }
      delete nodeData.id
      result[node.id] = nodeData
    })
    return result
  }

  const isDirty = computed(() => {
    if (!originalDataSnapshot.value) return false
    return JSON.stringify(getNodesData()) !== originalDataSnapshot.value
  })

  const getEdgeStyle = (handleId) => {
    const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }
    return {
      style: { stroke: config.color, strokeWidth: 2 },
      animated: true,
      type: currentEdgeType.value,
      markerEnd: MarkerType.ArrowClosed,
    }
  }

  // --- 核心逻辑 1: 连接校验 (合并了 FlowEditor 中的严格校验) ---
  const onValidateConnection = (connection) => {
    // 禁止自连
    if (connection.source === connection.target) return false
    // 禁止 输入端口 -> 输入端口
    if (connection.sourceHandle === 'in') return false
    // 目标必须是输入端口
    if (connection.targetHandle !== 'in') return false
    return true
  }

  // --- 核心逻辑 2: 创建节点 ---
  const createNodeObject = (id, rawContent, isMissing = false) => {
    let logicType = rawContent.recognition || 'DirectHit'
    if (isMissing) logicType = 'Unknown'
    const isUnknown = logicType === 'Unknown'

    return {
      id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        id,
        type: logicType,
        data: isUnknown ? { id } : { ...rawContent, id, recognition: logicType },
        _isMissing: isMissing,
        status: 'idle'
      }
    }
  }

  // --- 核心逻辑 3: 处理连线 (Toggle模式) ---
  const updateNodeDataConnection = (sourceNode, field, targetId, isArrayType, isAdd) => {
    if (!sourceNode.data.data) sourceNode.data.data = {}
    const data = sourceNode.data.data

    if (isArrayType) {
      if (!Array.isArray(data[field])) data[field] = []
      const idx = data[field].indexOf(targetId)
      if (isAdd && idx === -1) data[field].push(targetId)
      else if (!isAdd && idx > -1) data[field].splice(idx, 1)
    } else {
      if (isAdd) data[field] = targetId
      else if (data[field] === targetId) delete data[field]
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
      addEdges({ ...params, ...getEdgeStyle(params.sourceHandle), label: portConfig?.field })
      if (sourceNode && portConfig) {
        updateNodeDataConnection(sourceNode, portConfig.field, params.target, portConfig.type === 'array', true)
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

      // 更新本节点 ID
      node.id = newId
      node.data.id = newId
      if (node.data.data) node.data.data.id = newId

      // 更新连线 ID
      edges.value = edges.value.map(e => {
        let update = {}
        if (e.source === oldId) update.source = newId
        if (e.target === oldId) update.target = newId
        return (update.source || update.target) ? { ...e, ...update, id: e.id.replace(oldId, newId) } : e
      })

      // 更新其他节点对本节点的引用
      nodes.value.forEach(n => {
        if (n.id === newId || !n.data.data) return
        const d = n.data.data
        ;['next', 'interrupt'].forEach(f => {
          if (Array.isArray(d[f])) {
             const idx = d[f].indexOf(oldId); if (idx > -1) d[f][idx] = newId
          }
        })
        ;['on_error', 'timeout_next'].forEach(f => {
          if (d[f] === oldId) d[f] = newId
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

    // Normalize to array
    let paths = []
    if (Array.isArray(tpl)) paths = [...tpl]
    else if (typeof tpl === 'string' && tpl) paths = [tpl]

    if (mode === 'add') {
      if (!paths.includes(path)) paths.push(path)
    } else if (mode === 'remove') {
      paths = paths.filter(p => p !== path)
    }

    // Set back
    nodeData.data.template = paths
  }

  // --- 处理特殊操作 (重构后) ---
  const handleSpecialAction = (node, actionData) => {
    const action = actionData._action

    // 1. 删除图片
    if (action === 'delete_images' || (action === 'save_screenshot' && actionData.deletePaths?.length)) {
      const deletePaths = actionData.deletePaths || []
      if (!deletePaths.length) return

      const currentImages = node.data._images || []
      node.data._del_images = [...(node.data._del_images || []), ...currentImages.filter(img => deletePaths.includes(img.path))]
      node.data._images = currentImages.filter(img => !deletePaths.includes(img.path))

      deletePaths.forEach(path => modifyTemplatePath(node.data, path, 'remove'))
    }

    // 2. 添加临时图片
    if (action === 'add_temp_image') {
      const { imagePath, imageBase64 } = actionData
      if (!imagePath || !imageBase64) return

      if (!node.data._temp_images) node.data._temp_images = []
      node.data._temp_images.push({ path: imagePath, base64: imageBase64, found: true })
      modifyTemplatePath(node.data, imagePath, 'add')
    }

    // 3. 恢复图片
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

    // 4. 保存变更
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
        { key: 'next', handle: 'source-a' }, { key: 'interrupt', handle: 'source-b' },
        { key: 'on_error', handle: 'source-c' }, { key: 'timeout_next', handle: 'source-c' }
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
              source: nodeId, target: targetId,
              sourceHandle: handle, targetHandle: 'in',
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

    currentFilename.value = filename || ''
    currentSource.value = source || ''

    setTimeout(() => { originalDataSnapshot.value = JSON.stringify(getNodesData()) }, 0)
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50)
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

  return {
    nodes, edges, nodeTypes, currentEdgeType, currentSpacing, isDirty, currentFilename, currentSource, SPACING_OPTIONS,
    createNodeObject, onValidateConnection, handleConnect, handleEdgesChange, handleNodeUpdate,
    loadNodes, getNodesData, getImageData, clearTempImageData, clearDirty: () => originalDataSnapshot.value = JSON.stringify(getNodesData()),
    layout, applyLayout: (k) => { nodes.value = layout(nodes.value, edges.value, SPACING_OPTIONS[k]); setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50) }
  }
}