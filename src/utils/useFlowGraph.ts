// src/composables/useFlowGraph.ts
import { ref, markRaw, computed } from 'vue'
import { useVueFlow, MarkerType } from '@vue-flow/core'
import { useLayout } from './useLayout'
import { SPACING_OPTIONS, type EdgeType } from './flowOptions'
import type {
  FlowBusinessData,
  FlowConnection,
  FlowEdge,
  FlowEdgeChange,
  FlowNode,
  FlowNodeMeta,
  ImageDataPayload,
  LoadNodesPayload,
  NodeUpdatePayload,
  SpacingKey,
  TemplateImage
} from './flowTypes'
import CustomNode from '../components/Flow/CustomNode.vue'

type EdgeStyleResult = Pick<FlowEdge, 'style' | 'animated' | 'type' | 'markerEnd' | 'data'>

interface PortMapping {
  field: 'next' | 'on_error' | 'timeout_next'
  type: 'array'
  color: string
}

export function useFlowGraph() {
  const nodes = ref<FlowNode[]>([])
  const edges = ref<FlowEdge[]>([])
  const currentEdgeType = ref<EdgeType>('smoothstep')
  const currentSpacing = ref<SpacingKey>('normal')
  const currentFilename = ref('')
  const currentSource = ref('')
  const originalDataSnapshot = ref('')

  const nodeTypes = { custom: markRaw(CustomNode) }

  const PORT_MAPPING: Record<string, PortMapping> = {
    'source-a': { field: 'next', type: 'array', color: '#3b82f6' },
    'source-c': { field: 'on_error', type: 'array', color: '#f43f5e' }
  }

  const { addEdges, removeEdges, findNode, fitView } = useVueFlow()
  const {
    layout,
    layoutWithSpacing,
    applyLayoutOnRefs,
    applyOrderedChainLayout,
    getSpacingConfig
  } = useLayout()

  const ensureNodeMeta = (node?: FlowNode | null): FlowNodeMeta | null => {
    if (!node) return null
    if (!node.data) node.data = { id: node.id, type: 'Unknown', data: {} }
    if (!node.data.data) node.data.data = {}
    return node.data
  }

  const getNodesData = (): Record<string, FlowBusinessData> => {
    const result: Record<string, FlowBusinessData> = {}
    nodes.value.forEach(node => {
      if (node.data?._isMissing) return
      if (node.data?.type === 'Unknown') return

      const nodeData = { ...(node.data?.data || {}) } as FlowBusinessData
      // 仅锚点节点类型不导出，普通节点的 anchor 属性需正常导出
      if (node.data?.type === 'Anchor') return

      delete (nodeData as Record<string, unknown>).id
      delete (nodeData as Record<string, unknown>).interrupt
      result[node.id] = nodeData
    })
    return result
  }

  const isDirty = computed(() => {
    if (!originalDataSnapshot.value) return false
    return JSON.stringify(getNodesData()) !== originalDataSnapshot.value
  })

  const getEdgeStyle = (handleId: string, isJumpBack = false): EdgeStyleResult => {
    const config = PORT_MAPPING[handleId] || { color: '#94a3b8' }
    const strokeColor = isJumpBack ? '#a855f7' : config.color

    return {
      style: {
        stroke: strokeColor,
        strokeWidth: 2,
        strokeDasharray: '5 5'
      },
      animated: true,
      type: currentEdgeType.value,
      markerEnd: MarkerType.ArrowClosed,
      data: { isJumpBack }
    }
  }

  const stripPrefix = (val: string) => val.replace(/\[(Anchor|JumpBack)\]/g, '')
  const buildLinkId = (targetId: string, isAnchor: boolean, isJumpBack: boolean) => {
    let id = targetId
    // 统一顺序：Anchor 在前，JumpBack 在后；但解析允许任意顺序
    if (isAnchor) id = `[Anchor]${id}`
    if (isJumpBack) id = `[JumpBack]${id}`
    return id
  }
  const parseLinkFlags = (val?: string) => ({
    anchor: !!val && val.includes('[Anchor]'),
    jumpBack: !!val && val.includes('[JumpBack]'),
    id: val ? stripPrefix(val) : ''
  })
  const isAnchorNode = (node?: FlowNode | null) =>
    !!(node?.data?.type === 'Anchor' || (node?.data?.data as FlowBusinessData | undefined)?.anchor)

  const normalizeLinksAcrossNodes = (targetNodes: FlowNode[]) => {
    const anchorIds = new Set(targetNodes.filter(n => isAnchorNode(n)).map(n => n.id))
    const normalizeItem = (item: unknown) => {
      if (typeof item !== 'string') return item
      const flags = parseLinkFlags(item)
      const targetId = flags.id || item
      const isAnchorTarget = anchorIds.has(targetId) || flags.anchor
      return buildLinkId(targetId, isAnchorTarget, flags.jumpBack)
    }
    const normalizeField = (val: unknown) => {
      if (Array.isArray(val)) return val.map(normalizeItem).filter(Boolean)
      if (typeof val === 'string') return normalizeItem(val)
      return val
    }

    targetNodes.forEach(n => {
      const meta = ensureNodeMeta(n)
      if (!meta?.data) return
      const data = meta.data as FlowBusinessData
      ;(['next', 'on_error', 'timeout_next'] as const).forEach(field => {
        const rawVal = (data as Record<string, unknown>)[field]
        const normalized = normalizeField(rawVal)
        if (normalized === undefined || normalized === null || (Array.isArray(normalized) && normalized.length === 0)) {
          delete (data as Record<string, unknown>)[field]
        } else {
          (data as Record<string, unknown>)[field] = normalized as any
        }
      })
    })
  }

  const onValidateConnection = (connection: FlowConnection) => {
    if (connection.source === connection.target) return false
    if (connection.sourceHandle === 'in') return false
    return connection.targetHandle === 'in'
  }

  const createNodeObject = (id: string, rawContent: FlowBusinessData, isMissing = false): FlowNode => {
    const sanitizedContent = { ...rawContent }
    delete (sanitizedContent as Record<string, unknown>).interrupt

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
        data: isUnknown
          ? { id, ...(sanitizedContent.anchor ? { anchor: sanitizedContent.anchor } : {}) }
          : { ...sanitizedContent, id, recognition: logicType },
        _isMissing: isMissing,
        status: 'idle'
      }
    }
  }

  const updateNodeDataConnection = (
    sourceNode: FlowNode,
    field: PortMapping['field'],
    targetId: string,
    isArrayType: boolean,
    isAdd: boolean,
    isJumpBack = false,
    isAnchorTarget = false
  ) => {
    const sourceMeta = ensureNodeMeta(sourceNode)
    if (!sourceMeta || !sourceMeta.data) return
    const data = sourceMeta.data as FlowBusinessData
    const storedId = buildLinkId(targetId, isAnchorTarget, isJumpBack)

    if (isArrayType) {
      if (!Array.isArray(data[field])) data[field] = []

      const existingIndex = (data[field] as unknown[]).findIndex(id =>
        typeof id === 'string' && stripPrefix(id) === targetId
      )

      if (isAdd) {
        if (existingIndex === -1) {
          (data[field] as unknown[]).push(storedId)
        } else {
          (data[field] as unknown[])[existingIndex] = storedId
        }
      } else if (existingIndex > -1) {
        (data[field] as unknown[]).splice(existingIndex, 1)
      }
    } else {
      if (isAdd) {
        data[field] = storedId
      } else {
        const currentVal = (data as Record<string, unknown>)[field] as string | undefined
        if (typeof currentVal === 'string' && stripPrefix(currentVal) === targetId) {
          delete (data as Record<string, unknown>)[field]
        }
      }
    }
  }

  const handleConnect = (params: FlowConnection) => {
    const existingEdge = edges.value.find(e =>
      e.source === params.source && e.target === params.target && e.sourceHandle === params.sourceHandle
    )
    const portConfig = PORT_MAPPING[params.sourceHandle || '']
    const sourceNode = findNode(params.source)
    const targetNode = findNode(params.target)
    const isAnchorTarget = isAnchorNode(targetNode)

    if (existingEdge) {
      removeEdges([existingEdge.id])
      if (sourceNode && portConfig) {
        updateNodeDataConnection(sourceNode, portConfig.field, params.target, portConfig.type === 'array', false, false, isAnchorTarget)
      }
    } else {
      addEdges({ ...params, ...getEdgeStyle(params.sourceHandle || '', false), label: portConfig?.field })
      if (sourceNode && portConfig) {
        updateNodeDataConnection(sourceNode, portConfig.field, params.target, portConfig.type === 'array', true, false, isAnchorTarget)
      }
    }
  }

  const handleEdgesChange = (changes: FlowEdgeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'remove') {
        const edge = edges.value.find(e => e.id === change.id)
        if (edge) {
          const sourceNode = findNode(edge.source)
          const portConfig = PORT_MAPPING[edge.sourceHandle || '']
          if (sourceNode && portConfig) {
            const targetNode = findNode(edge.target)
            const isAnchorTarget = isAnchorNode(targetNode)
            updateNodeDataConnection(sourceNode, portConfig.field, edge.target, portConfig.type === 'array', false, false, isAnchorTarget)
          }
        }
      }
    })
  }

  const setEdgeJumpBack = (edgeId: string, isJumpBack: boolean) => {
    const edge = edges.value.find(e => e.id === edgeId)
    if (!edge) return

    const sourceNode = findNode(edge.source)
    const portConfig = PORT_MAPPING[edge.sourceHandle || '']
    const targetNode = findNode(edge.target)
    const isAnchorTarget = isAnchorNode(targetNode)

    edge.data = { ...edge.data, isJumpBack }
    edge.label = isJumpBack ? 'JumpBack' : (portConfig?.field || '')

    const newStyle = getEdgeStyle(edge.sourceHandle || '', isJumpBack)
    edge.style = newStyle.style
    edge.animated = newStyle.animated

    edges.value = [...edges.value]

    if (sourceNode && portConfig) {
      updateNodeDataConnection(sourceNode, portConfig.field, edge.target, portConfig.type === 'array', true, isJumpBack, isAnchorTarget)
    }
  }

  const handleNodeUpdate = ({ oldId, newId, newType, newData }: NodeUpdatePayload) => {
    const node = findNode(oldId)
    if (!node) return
    const nodeMeta = ensureNodeMeta(node)
    if (!nodeMeta) return

    if (newData && (newData as Record<string, unknown>)._action) {
      handleSpecialAction(node, newData)
      nodes.value = [...nodes.value]
      return
    }

    if (oldId !== newId) {
      if (findNode(newId)) { alert(`ID "${newId}" already exists!`); return }

      node.id = newId
      nodeMeta.id = newId
      if (nodeMeta.data) nodeMeta.data.id = newId

      edges.value = edges.value.map(e => {
        const update: Partial<FlowEdge> = {}
        if (e.source === oldId) update.source = newId
        if (e.target === oldId) update.target = newId
        return (update.source || update.target) ? { ...e, ...update, id: e.id.replace(oldId, newId) } : e
      })

      const replaceLinkVal = (val: unknown) => {
        if (typeof val !== 'string') return val
        const flags = parseLinkFlags(val)
        const targetId = flags.id || val
        if (targetId !== oldId) return val
        return buildLinkId(newId, flags.anchor, flags.jumpBack)
      }
      const replaceField = (d: Record<string, unknown>, field: string) => {
        const fieldVal = d[field]
        if (Array.isArray(fieldVal)) {
          d[field] = fieldVal.map(replaceLinkVal) as unknown[]
        } else if (typeof fieldVal === 'string') {
          const newVal = replaceLinkVal(fieldVal)
          d[field] = newVal as unknown
        }
      }

      nodes.value.forEach(n => {
        if (!n.data?.data) return
        const d = n.data.data as Record<string, unknown>
        ;['next', 'on_error', 'timeout_next'].forEach(f => replaceField(d, f))
      })
    }

    nodeMeta.type = newType
    if (newData) nodeMeta.data = { ...newData, id: node.id, recognition: newType }
    else if (nodeMeta.data) nodeMeta.data.recognition = newType

    normalizeLinksAcrossNodes(nodes.value)
    nodes.value = [...nodes.value]
  }

  const modifyTemplatePath = (nodeData: FlowNodeMeta, path: string, mode: 'add' | 'remove' = 'add') => {
    if (!nodeData.data) nodeData.data = {}
    const tpl = (nodeData.data as FlowBusinessData).template

    let paths: Array<string> = []
    if (Array.isArray(tpl)) paths = [...tpl] as string[]
    else if (typeof tpl === 'string' && tpl) paths = [tpl]

    if (mode === 'add') {
      if (!paths.includes(path)) paths.push(path)
    } else if (mode === 'remove') {
      paths = paths.filter(p => p !== path)
    }
    ;(nodeData.data as FlowBusinessData).template = paths
  }

  const handleSpecialAction = (node: FlowNode, actionData: FlowBusinessData) => {
    const meta = ensureNodeMeta(node)
    if (!meta) return
    const action = (actionData as Record<string, unknown>)._action as string | undefined

    if (action === 'delete_images' || (action === 'save_screenshot' && Array.isArray((actionData as Record<string, unknown>).deletePaths))) {
      const deletePaths = (actionData as Record<string, unknown>).deletePaths as string[] || []
      if (!deletePaths.length) return
      const currentImages = meta._images || []
      meta._del_images = [...(meta._del_images || []), ...currentImages.filter(img => deletePaths.includes(img.path))]
      meta._images = currentImages.filter(img => !deletePaths.includes(img.path))
      deletePaths.forEach(path => modifyTemplatePath(meta, path, 'remove'))
    }

    if (action === 'add_temp_image') {
      const { imagePath, imageBase64 } = actionData as Record<string, string>
      if (!imagePath || !imageBase64) return
      if (!meta._temp_images) meta._temp_images = []
      meta._temp_images.push({ path: imagePath, base64: imageBase64, found: true })
      modifyTemplatePath(meta, imagePath, 'add')
    }

    if (action === 'restore_image') {
      const { imagePath } = actionData as Record<string, string>
      const delImages = meta._del_images || []
      const imageToRestore = delImages.find(img => img.path === imagePath)
      if (imageToRestore) {
        meta._del_images = delImages.filter(img => img.path !== imagePath)
        if (!meta._images) meta._images = []
        meta._images.push(imageToRestore)
        modifyTemplatePath(meta, imagePath, 'add')
      }
    }

    if (action === 'save_image_changes') {
      const { validPaths, images, tempImages, deletedImages } = actionData as Record<string, unknown> & {
        validPaths?: string[]
        images?: unknown[]
        tempImages?: unknown[]
        deletedImages?: unknown[]
      }
      meta._images = (images as TemplateImage[]) || []
      meta._temp_images = (tempImages as TemplateImage[]) || []
      meta._del_images = (deletedImages as TemplateImage[]) || []
      if (!meta.data) meta.data = {}
      ;(meta.data as FlowBusinessData).template = validPaths && validPaths.length ? [...validPaths] : []
    }
  }

  const loadNodes = ({ filename, source, nodes: rawNodesData }: LoadNodesPayload) => {
    const newNodes: FlowNode[] = []
    const newEdges: FlowEdge[] = []
    const createdNodeIds = new Set<string>()

    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      newNodes.push(createNodeObject(nodeId, nodeContent))
      createdNodeIds.add(nodeId)
    }

    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      const linkFields: Array<{ key: 'next' | 'on_error' | 'timeout_next'; handle: keyof typeof PORT_MAPPING }> = [
        { key: 'next', handle: 'source-a' },
        { key: 'on_error', handle: 'source-c' },
        { key: 'timeout_next', handle: 'source-c' }
      ]

      linkFields.forEach(({ key, handle }) => {
        const targetVal = (nodeContent as Record<string, unknown>)[key]
        if (targetVal) {
          const rawTargets = Array.isArray(targetVal) ? targetVal : [targetVal]

          rawTargets.forEach(rawTargetId => {
            if (!rawTargetId) return
            const flags = parseLinkFlags(String(rawTargetId))
            let targetId = flags.id || String(rawTargetId)
            const isJumpBack = flags.jumpBack
            const isAnchorTarget = flags.anchor

            if (!createdNodeIds.has(targetId)) {
              newNodes.push(createNodeObject(targetId, isAnchorTarget ? { id: targetId, anchor: true } as FlowBusinessData : {}, true))
              createdNodeIds.add(targetId)
            }

            newEdges.push({
              id: `e-${nodeId}-${targetId}-${key}`,
              source: nodeId,
              target: targetId,
              sourceHandle: handle,
              targetHandle: 'in',
              label: isJumpBack ? 'JumpBack' : key,
              ...getEdgeStyle(handle, isJumpBack)
            })
          })
        }
      })
    }

    normalizeLinksAcrossNodes(newNodes)

    const layoutedNodes = layoutWithSpacing(newNodes, newEdges, getSpacingConfig())
    nodes.value = layoutedNodes
    edges.value = newEdges

    currentFilename.value = filename || ''
    currentSource.value = source || ''

    setTimeout(() => { originalDataSnapshot.value = JSON.stringify(getNodesData()) }, 0)
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50)
  }

  const layoutTaskChain = (rootId: string) => {
    const result = applyOrderedChainLayout(nodes, edges, rootId, currentSpacing.value)
    if (!result) return

    const { chainIds } = result
    setTimeout(() => fitView({ nodes: Array.from(chainIds), padding: 0.25, duration: 600 }), 50)
  }

  const getImageData = (): ImageDataPayload => {
    const delImages: ImageDataPayload['delImages'] = []
    const tempImages: ImageDataPayload['tempImages'] = []
    nodes.value.forEach(node => {
      if (node.data?._isMissing) return
      node.data?._del_images?.forEach(img => img.path && delImages.push({ path: img.path, nodeId: node.id }))
      node.data?._temp_images?.forEach(img => img.path && img.base64 && tempImages.push({ path: img.path, base64: img.base64, nodeId: node.id }))
    })
    return { delImages, tempImages }
  }

  const clearTempImageData = () => {
    nodes.value.forEach(node => {
      const meta = ensureNodeMeta(node)
      if (!meta || meta._isMissing) return
      if (meta._temp_images?.length) {
        if (!meta._images) meta._images = []
        meta._images.push(...meta._temp_images)
        meta._temp_images = []
      }
      meta._del_images = []
    })
    nodes.value = [...nodes.value]
  }

  const layoutChainFromNode = (startId: string, spacingKey: SpacingKey = currentSpacing.value) => {
    const result = applyOrderedChainLayout(nodes, edges, startId, spacingKey)
    if (!result) return

    const { chainIds } = result
    setTimeout(() => fitView({ nodes: Array.from(chainIds), padding: 0.25, duration: 600 }), 50)
  }

  return {
    nodes,
    edges,
    nodeTypes,
    currentEdgeType,
    currentSpacing,
    isDirty,
    currentFilename,
    currentSource,
    SPACING_OPTIONS,
    createNodeObject,
    onValidateConnection,
    handleConnect,
    handleEdgesChange,
    handleNodeUpdate,
    loadNodes,
    getNodesData,
    getImageData,
    clearTempImageData,
    setEdgeJumpBack,
    layoutTaskChain,
    clearDirty: () => { originalDataSnapshot.value = JSON.stringify(getNodesData()) },
    layout,
    applyLayout: (k?: SpacingKey) => {
      applyLayoutOnRefs(nodes, edges, k || currentSpacing.value)
      setTimeout(() => fitView({ padding: 0.2, duration: 500 }), 50)
    },
    layoutChainFromNode
  }
}

