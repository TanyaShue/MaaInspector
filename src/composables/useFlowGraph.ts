import { ref, markRaw } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useLayout, type LayoutOptions } from './useLayout'
import { useImageManager } from './useImageManager'
import { SPACING_OPTIONS, type EdgeType } from '@/utils/flowOptions'
import { perfLog, perfNow } from '@/utils/perfTrace'
import { ElMessage } from 'element-plus'
import type {
  FlowBusinessData,
  FlowConnection,
  FlowEdge,
  FlowEdgeChange,
  FlowNode,
  ImageDataPayload,
  LoadNodesPayload,
  NodeStatus,
  NodeUpdatePayload,
  SpacingKey,
  LayoutAlgorithm,
  LayoutDirection,
} from '@/utils/flowTypes'
import CustomNode from '@/components/Flow/CustomNode.vue'
import { ensureNodeMeta } from '@/utils/nodeHelpers'
import {
  PORT_MAPPING,
  getEdgeStyle,
  updateNodeDataConnection,
  onValidateConnection,
  normalizeLinksAcrossNodes,
  isAnchorNode,
  parseLinkFlags,
  buildLinkId,
} from './flowGraph/useConnectionManager'
import {
  getNodesData,
  UNKNOWN_NODE_ID_PREFIX,
  setNodeStatus as setNodeStatusImpl,
  selectNodeById as selectNodeByIdImpl,
  createNodeObject,
} from './flowGraph/useNodeStateManager'
import {
  layoutTaskChain as layoutTaskChainImpl,
  layoutChainFromNode as layoutChainFromNodeImpl,
} from './flowGraph/useFlowLayout'
import { useFlowStateExport } from './flowGraph/useFlowStateExport'
import { handleSpecialAction as handleSpecialActionImpl } from './flowGraph/useTemplateManager'
import { useViewportSync } from './flowGraph/useViewportSync'

/**
 * Creates and manages the flow graph state, providing node/edge manipulation,
 * layout, connection handling, and state export/restore capabilities.
 */
export function useFlowGraph() {
  const nodes = ref<FlowNode[]>([])
  const edges = ref<FlowEdge[]>([])
  const currentEdgeType = ref<EdgeType>('smoothstep')
  const currentSpacing = ref<SpacingKey>('normal')
  const currentAlgorithm = ref<LayoutAlgorithm>('layered')
  const currentDirection = ref<LayoutDirection>('TB')
  const currentFilename = ref('')
  const currentSource = ref('')
  const originalDataSnapshot = ref('')
  const dataSnapshot = ref('')
  const selectedNodeId = ref<string | null>(null)

  const nodeTypes = { custom: markRaw(CustomNode) }

  const imageManager = useImageManager()

  const { addEdges, removeEdges, findNode, fitView, updateNodeInternals } = useVueFlow()
  const onlyRenderVisibleElements = ref(true)
  const viewportSync = useViewportSync({
    onlyRenderVisibleElements,
    updateNodeInternals,
  })
  const { elkLayout, applyLayoutOnRefs, applyOrderedChainLayout } = useLayout()

  const { isDirty, exportState, restoreState, markDataChanged, clearDirty } = useFlowStateExport(
    nodes,
    edges,
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    currentFilename,
    currentSource,
    originalDataSnapshot,
    dataSnapshot,
    selectedNodeId,
    imageManager,
    () => getNodesData(nodes.value)
  )

  /**
   * Updates the visual status of a node (e.g., running, success, error).
   * @param nodeId - The ID of the node to update
   * @param status - The new status to apply
   */
  const setNodeStatus = (nodeId: string, status: NodeStatus) => {
    return setNodeStatusImpl(nodes.value, nodeId, status)
  }

  /**
   * Selects a node by its ID, updating the selectedNodeId ref.
   * @param nodeId - The ID of the node to select, or null/undefined to deselect
   */
  const selectNodeById = (nodeId?: string | null) => {
    return selectNodeByIdImpl(nodes, selectedNodeId, nodeId)
  }

  /**
   * Handles new or existing connection events between nodes.
   * Toggles edge creation/removal and updates source node data accordingly.
   * @param params - Connection parameters containing source, target, and handle info
   */
  const handleConnect = (params: FlowConnection) => {
    const existingEdge = edges.value.find(
      (e) =>
        e.source === params.source &&
        e.target === params.target &&
        e.sourceHandle === params.sourceHandle
    )
    const portConfig = PORT_MAPPING[params.sourceHandle || '']
    const sourceNode = findNode(params.source)
    const targetNode = findNode(params.target)
    const isAnchorTarget = isAnchorNode(targetNode)
    let changed = false

    if (existingEdge) {
      removeEdges([existingEdge.id])
      if (sourceNode && portConfig) {
        updateNodeDataConnection(
          findNode,
          sourceNode,
          portConfig.field,
          params.target,
          portConfig.type === 'array',
          false,
          false,
          isAnchorTarget
        )
        changed = true
      }
    } else {
      addEdges({
        ...params,
        ...getEdgeStyle(params.sourceHandle || '', false, currentEdgeType.value),
        label: portConfig?.field,
      })
      if (sourceNode && portConfig) {
        updateNodeDataConnection(
          findNode,
          sourceNode,
          portConfig.field,
          params.target,
          portConfig.type === 'array',
          true,
          false,
          isAnchorTarget
        )
        changed = true
      }
    }
    if (changed) markDataChanged()
  }

  /**
   * Processes edge removal changes, cleaning up connection data from source nodes.
   * @param changes - Array of edge change events to process
   */
  const handleEdgesChange = (changes: FlowEdgeChange[]) => {
    let changed = false
    changes.forEach((change) => {
      if (change.type === 'remove') {
        const edge = edges.value.find((e) => e.id === change.id)
        if (edge) {
          const sourceNode = findNode(edge.source)
          const portConfig = PORT_MAPPING[edge.sourceHandle || '']
          if (sourceNode && portConfig) {
            const targetNode = findNode(edge.target)
            const isAnchorTarget = isAnchorNode(targetNode)
            updateNodeDataConnection(
              findNode,
              sourceNode,
              portConfig.field,
              edge.target,
              portConfig.type === 'array',
              false,
              false,
              isAnchorTarget
            )
            changed = true
          }
        }
      }
    })
    if (changed) markDataChanged()
  }

  /**
   * Toggles the jump-back flag on an edge, updating its visual style and label.
   * @param edgeId - The ID of the edge to modify
   * @param isJumpBack - Whether the edge should be marked as a jump-back connection
   */
  const setEdgeJumpBack = (edgeId: string, isJumpBack: boolean) => {
    const edge = edges.value.find((e) => e.id === edgeId)
    if (!edge) return

    const sourceNode = findNode(edge.source)
    const portConfig = PORT_MAPPING[edge.sourceHandle || '']
    const targetNode = findNode(edge.target)
    const isAnchorTarget = isAnchorNode(targetNode)

    edge.data = { ...edge.data, isJumpBack }
    edge.label = isJumpBack ? 'JumpBack' : portConfig?.field || ''

    const newStyle = getEdgeStyle(edge.sourceHandle || '', isJumpBack, currentEdgeType.value)
    edge.style = newStyle.style
    edge.animated = newStyle.animated

    if (sourceNode && portConfig) {
      updateNodeDataConnection(
        findNode,
        sourceNode,
        portConfig.field,
        edge.target,
        portConfig.type === 'array',
        true,
        isJumpBack,
        isAnchorTarget
      )
      markDataChanged()
    }
  }

  /**
   * Handles node update events including ID changes, type changes, and data updates.
   * Propagates ID changes to connected edges and cross-node link references.
   * @param payload - Object containing oldId, newId, newType, and newData
   */
  const handleNodeUpdate = ({ oldId, newId, newType, newData }: NodeUpdatePayload) => {
    const node = findNode(oldId)
    if (!node) return
    const nodeMeta = ensureNodeMeta(node)
    if (!nodeMeta) return

    if (newData && (newData as Record<string, unknown>)._action) {
      handleSpecialActionImpl(node, newData, imageManager)
      markDataChanged()
      return
    }

    if (oldId !== newId) {
      const originalId = nodeMeta._originalId
      const replaceLinkVal = (val: unknown) => {
        if (typeof val !== 'string') return val
        const flags = parseLinkFlags(val)
        const targetId = flags.id || val
        if (targetId !== oldId && targetId !== originalId) return val
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

      if (nodeMeta._isMissing) {
        const replaceOneMissingLink = (
          d: Record<string, unknown>,
          field: 'next' | 'on_error' | 'timeout_next',
          isJumpBack: boolean,
          isAnchorTarget: boolean,
          linkIndex?: number
        ) => {
          const fieldVal = d[field]
          if (Array.isArray(fieldVal)) {
            let index = -1
            if (typeof linkIndex === 'number') {
              const indexedValue = fieldVal[linkIndex]
              if (
                typeof indexedValue === 'string' &&
                (parseLinkFlags(indexedValue).id || indexedValue) === originalId
              ) {
                index = linkIndex
              }
            }
            if (index < 0) {
              index = fieldVal.findIndex((val) => {
                if (typeof val !== 'string') return false
                const flags = parseLinkFlags(val)
                return (flags.id || val) === originalId
              })
            }
            if (index >= 0) {
              const flags = parseLinkFlags(String(fieldVal[index]))
              fieldVal[index] = buildLinkId(
                newId,
                flags.anchor || isAnchorTarget,
                flags.jumpBack || isJumpBack
              )
            }
          } else if (typeof fieldVal === 'string') {
            const flags = parseLinkFlags(fieldVal)
            if ((flags.id || fieldVal) === originalId) {
              d[field] = buildLinkId(
                newId,
                flags.anchor || isAnchorTarget,
                flags.jumpBack || isJumpBack
              )
            }
          }
        }

        edges.value
          .filter((e) => e.target === oldId)
          .forEach((edge) => {
            const sourceNode = findNode(edge.source)
            const sourceMeta = ensureNodeMeta(sourceNode)
            const portConfig = PORT_MAPPING[edge.sourceHandle || '']
            if (!sourceMeta?.data || !portConfig) return
            replaceOneMissingLink(
              sourceMeta.data as Record<string, unknown>,
              portConfig.field,
              !!edge.data?.isJumpBack,
              isAnchorNode(node),
              edge.data?.linkIndex
            )
          })

        nodeMeta._originalId = newId
        nodeMeta.id = node.id
        if (nodeMeta.data) nodeMeta.data.id = newId

        normalizeLinksAcrossNodes(nodes.value)
        markDataChanged()
        return
      }

      if (findNode(newId)) {
        ElMessage.error(`ID "${newId}" already exists!`)
        return
      }

      imageManager.migrateNodeState(oldId, newId)
      node.id = newId
      nodeMeta.id = newId
      if (nodeMeta.data) nodeMeta.data.id = newId

      edges.value = edges.value.map((e) => {
        const update: Partial<FlowEdge> = {}
        if (e.source === oldId) update.source = newId
        if (e.target === oldId) update.target = newId
        return update.source || update.target
          ? { ...e, ...update, id: e.id.replace(oldId, newId) }
          : e
      })

      nodes.value.forEach((n) => {
        if (!n.data?.data) return
        const d = n.data.data as Record<string, unknown>
        ;(['next', 'on_error', 'timeout_next'] as const).forEach((f) => replaceField(d, f))
      })
    }

    nodeMeta.type = newType
    if (newData) nodeMeta.data = { ...newData, id: node.id, recognition: newType }
    else if (nodeMeta.data) nodeMeta.data.recognition = newType

    normalizeLinksAcrossNodes(nodes.value)

    markDataChanged()
  }

  /**
   * Loads nodes and edges from raw pipeline data, auto-creates missing/anchor nodes,
   * applies initial layout, and resets the dirty state.
   * @param payload - Object containing filename, source, and nodes data
   */
  const loadNodes = async (
    { filename, source, nodes: rawNodesData }: LoadNodesPayload,
    options: { applyInitialLayout?: boolean } = {}
  ) => {
    const totalStart = perfNow()
    imageManager.resetForFile({ source, filename })
    const newNodes: FlowNode[] = []
    const newEdges: FlowEdge[] = []
    const createdNodeIds = new Set<string>()
    const missingNodeCount = new Map<string, number>()
    const createMissingNodeId = (targetId: string) => {
      const count = (missingNodeCount.get(targetId) || 0) + 1
      missingNodeCount.set(targetId, count)

      let suffix = count
      let candidate = `${UNKNOWN_NODE_ID_PREFIX}${targetId}__${suffix}`
      while (createdNodeIds.has(candidate) || rawNodesData[candidate] !== undefined) {
        suffix++
        candidate = `${UNKNOWN_NODE_ID_PREFIX}${targetId}__${suffix}`
      }
      return candidate
    }

    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      newNodes.push(createNodeObject(nodeId, nodeContent))
      createdNodeIds.add(nodeId)
    }

    for (const [nodeId, nodeContent] of Object.entries(rawNodesData)) {
      const linkFields: Array<{
        key: 'next' | 'on_error' | 'timeout_next'
        handle: keyof typeof PORT_MAPPING
      }> = [
        { key: 'next', handle: 'source-a' },
        { key: 'on_error', handle: 'source-c' },
        { key: 'timeout_next', handle: 'source-c' },
      ]

      linkFields.forEach(({ key, handle }) => {
        const targetVal = (nodeContent as Record<string, unknown>)[key]
        if (targetVal) {
          const rawTargets = Array.isArray(targetVal) ? targetVal : [targetVal]

          rawTargets.forEach((rawTargetId, targetIndex) => {
            if (!rawTargetId) return
            const flags = parseLinkFlags(String(rawTargetId))
            let targetId = flags.id || String(rawTargetId)
            const isJumpBack = flags.jumpBack
            const isAnchorTarget = flags.anchor

            const isRealNode = rawNodesData[targetId] !== undefined

            if (!isRealNode) {
              const missingNodeId = createMissingNodeId(targetId)
              newNodes.push(
                createNodeObject(
                  missingNodeId,
                  isAnchorTarget
                    ? ({ id: targetId, anchor: true } as FlowBusinessData)
                    : ({ id: targetId } as FlowBusinessData),
                  true,
                  targetId
                )
              )
              createdNodeIds.add(missingNodeId)
              targetId = missingNodeId
            }

            const edgeStyle = getEdgeStyle(handle, isJumpBack, currentEdgeType.value)
            newEdges.push({
              id: `e-${nodeId}-${targetId}-${key}`,
              source: nodeId,
              target: targetId,
              sourceHandle: handle,
              targetHandle: 'in',
              label: isJumpBack ? 'JumpBack' : key,
              ...edgeStyle,
              data: {
                ...edgeStyle.data,
                linkIndex: targetIndex,
              },
            })
          })
        }
      })
    }

    normalizeLinksAcrossNodes(newNodes)

    nodes.value = newNodes
    edges.value = newEdges

    if (options.applyInitialLayout !== false) {
      const layoutOptions: LayoutOptions = {
        algorithm: currentAlgorithm.value,
        direction: currentDirection.value,
        spacing: currentSpacing.value,
      }
      const layoutedNodes = await elkLayout(newNodes, newEdges, layoutOptions)
      await viewportSync.withPausedVisibility(
        async () => {
          nodes.value = layoutedNodes
          await viewportSync.refreshNodeInternals(layoutedNodes.map((node) => node.id))
          await fitView({ padding: 0.2, duration: 800 })
        },
        layoutedNodes.map((node) => node.id)
      )
    }

    currentFilename.value = filename || ''
    currentSource.value = source || ''

    clearDirty()
    selectedNodeId.value = null
    perfLog('useFlowGraph.loadNodes.total', totalStart, {
      filename,
      nodeCount: nodes.value.length,
      edgeCount: edges.value.length,
    })
  }

  /**
   * Applies a chain layout starting from a root node, arranging connected nodes
   * in a sequential flow and fitting the viewport.
   * @param rootId - The ID of the root node to start layout from
   */
  const layoutTaskChain = async (rootId: string) => {
    return layoutTaskChainImpl(
      nodes,
      edges,
      rootId,
      applyOrderedChainLayout,
      currentAlgorithm.value,
      currentDirection.value,
      currentSpacing.value,
      fitView,
      { refreshNodeInternals: viewportSync.refreshNodeInternals }
    )
  }

  /**
   * Returns image data pending upload (deleted and temporary images).
   */
  const getImageData = (): ImageDataPayload => {
    return imageManager.getImageData()
  }

  /**
   * Clears temporary image data that has been successfully uploaded.
   */
  const clearTempImageData = () => {
    imageManager.commitPendingImageChanges()
  }

  /**
   * Applies a chain layout starting from a specific node, with optional spacing and algorithm overrides.
   * @param startId - The ID of the node to start layout from
   * @param spacingKey - Spacing preset to use (defaults to current spacing)
   * @param algorithm - Layout algorithm to use (defaults to current algorithm)
   */
  const layoutChainFromNode = async (
    startId: string,
    spacingKey: SpacingKey = currentSpacing.value,
    algorithm: LayoutAlgorithm = currentAlgorithm.value
  ) => {
    return layoutChainFromNodeImpl(
      startId,
      nodes,
      edges,
      applyOrderedChainLayout,
      currentDirection.value,
      spacingKey,
      algorithm,
      fitView,
      { refreshNodeInternals: viewportSync.refreshNodeInternals }
    )
  }

  return {
    nodes,
    edges,
    nodeTypes,
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    isDirty,
    currentFilename,
    currentSource,
    onlyRenderVisibleElements,
    SPACING_OPTIONS,
    createNodeObject,
    onValidateConnection,
    handleConnect,
    handleEdgesChange,
    handleNodeUpdate,
    loadNodes,
    getNodesData: () => getNodesData(nodes.value),
    getImageData,
    clearTempImageData,
    setEdgeJumpBack,
    layoutTaskChain,
    clearDirty,
    markDataChanged,
    setNodeStatus,
    selectNodeById,
    elkLayout,
    applyLayout: async (options?: Partial<LayoutOptions>) => {
      const layoutOptions: LayoutOptions = {
        algorithm: options?.algorithm || currentAlgorithm.value,
        direction: options?.direction || currentDirection.value,
        spacing: options?.spacing || currentSpacing.value,
      }
      await viewportSync.withPausedVisibility(
        async () => {
          await applyLayoutOnRefs(nodes, edges, layoutOptions)
          await viewportSync.refreshNodeInternals(nodes.value.map((node) => node.id))
          await fitView({ padding: 0.2, duration: 500 })
        },
        nodes.value.map((node) => node.id)
      )
    },
    layoutChainFromNode,
    imageManager,
    exportState,
    restoreState,
    refreshNodeInternals: viewportSync.refreshNodeInternals,
  }
}
