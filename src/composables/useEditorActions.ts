import { nextTick, ref, type ComputedRef } from 'vue'
import type { EdgeMouseEvent, NodeMouseEvent } from '@vue-flow/core'
import type {
  FlowNode,
  FlowEdge,
  FlowBusinessData,
  SpacingKey,
  LayoutAlgorithm,
  LayoutDirection,
  MenuType,
  TemplateImage,
} from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import { isEdgeType, isSpacingKey, isLayoutAlgorithm, isLayoutDirection } from '@/utils/typeGuards'
import { waitForFrame, deepClone } from '@/utils/nodeHelpers'
import { useNodeClipboard } from '@/composables/useNodeClipboard'

type MenuData = FlowNode | FlowEdge | null

export interface MenuState {
  visible: boolean
  x: number
  y: number
  type: MenuType
  data: MenuData
  flowPos: { x: number; y: number } | null
}

export interface EditorActionsDeps {
  mode?: 'main' | 'subcanvas'
  nodes: { value: FlowNode[] }
  edges: { value: FlowEdge[] }
  currentEdgeType: { value: EdgeType }
  currentSpacing: { value: SpacingKey }
  currentAlgorithm: { value: LayoutAlgorithm }
  currentDirection: { value: LayoutDirection }
  isFileLoaded: { value: boolean }
  currentFilename?: { value: string }
  nodeNamePrefixEnabled?: { value: boolean }
  createNodeObject: (
    id: string,
    rawContent: FlowBusinessData,
    isMissing?: boolean,
    originalId?: string
  ) => FlowNode
  applyLayout: (
    options?: Partial<{
      algorithm: LayoutAlgorithm
      direction: LayoutDirection
      spacing: SpacingKey
    }>
  ) => Promise<void>
  removeEdges: (ids: string[]) => void
  setEdgeJumpBack: (edgeId: string, isJumpBack: boolean) => void
  layoutChainFromNode: (
    startId: string,
    spacingKey?: SpacingKey,
    algorithm?: LayoutAlgorithm
  ) => Promise<void>
  markDataChanged: () => void
  markNodeStructureChanged?: () => void
  fitView: (options?: Record<string, unknown>) => void
  getViewport?: () => { x: number; y: number; zoom: number }
  setViewport?: (
    viewport: { x: number; y: number; zoom: number },
    options?: { duration?: number }
  ) => Promise<boolean> | void
  updateNodeInternals?: (nodeIds?: string[]) => void
  screenToFlowCoordinate: (pos: { x: number; y: number }) => { x: number; y: number }
  getSelectedNodes: { value: FlowNode[] }
  imageManager: {
    getNodeImages: (nodeId: string) => TemplateImage[]
    setNodeImages: (nodeId: string, images: TemplateImage[]) => void
  }
  snapshotState?: () => void
  requestClearCanvas?: () => void
  onOpenSubCanvas?: (payload: { nodeId: string; algorithm?: LayoutAlgorithm }) => void
  onDebugNode: (nodeId: string, mode: 'standard' | 'recognition_only') => void
  onOpenDebugPanel: (payload?: { nodeId?: string }) => void
  onCloseDebugPanel: () => void
  onIncrementCloseAllDetails: () => void
}

export function useEditorActions(deps: EditorActionsDeps) {
  const {
    mode = 'main',
    nodes,
    edges,
    currentEdgeType,
    currentSpacing,
    currentAlgorithm,
    currentDirection,
    isFileLoaded,
    currentFilename,
    nodeNamePrefixEnabled,
    createNodeObject,
    applyLayout,
    removeEdges,
    setEdgeJumpBack,
    layoutChainFromNode,
    markDataChanged,
    markNodeStructureChanged,
    fitView,
    screenToFlowCoordinate,
    getSelectedNodes,
    imageManager,
    snapshotState,
    requestClearCanvas,
    onOpenSubCanvas,
    onDebugNode,
    onOpenDebugPanel,
    onCloseDebugPanel,
    onIncrementCloseAllDetails,
  } = deps

  const menu = ref<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: 'pane',
    data: null,
    flowPos: { x: 0, y: 0 },
  })
  const searchVisible = ref(false)
  const clipboard = useNodeClipboard()
  const clipboardHistory: ComputedRef<Array<{ value: string; label: string }>> = clipboard.history

  const closeMenu = () => {
    menu.value.visible = false
  }

  const getEvent = (params: MouseEvent | NodeMouseEvent | EdgeMouseEvent): MouseEvent => {
    if ('event' in params && params.event instanceof MouseEvent) return params.event
    return params as MouseEvent
  }

  const onPaneContextMenu = (params: MouseEvent) => {
    if (!isFileLoaded.value) return
    const event = getEvent(params)
    event.preventDefault()
    menu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'pane',
      data: null,
      flowPos: screenToFlowCoordinate({ x: event.clientX, y: event.clientY }),
    }
  }

  const onNodeContextMenu = (params: NodeMouseEvent) => {
    const event = getEvent(params)
    event.preventDefault()
    menu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'node',
      data: params.node,
      flowPos: null,
    }
  }

  const onEdgeContextMenu = (params: EdgeMouseEvent) => {
    const event = getEvent(params)
    event.preventDefault()
    menu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      type: 'edge',
      data: params.edge,
      flowPos: null,
    }
  }

  const isFlowNodeData = (value: MenuData): value is FlowNode => !!value && 'position' in value

  const clone = <T>(value: T): T => deepClone(value)

  const stabilizeViewportAfterNodeMutation = async (
    previousViewport: { x: number; y: number; zoom: number } | null,
    nodeIds?: string[]
  ) => {
    if (!previousViewport || !deps.setViewport) return

    await nextTick()
    deps.updateNodeInternals?.(nodeIds)
    await nextTick()
    await waitForFrame()
    deps.updateNodeInternals?.(nodeIds)
    await nextTick()
    await deps.setViewport(previousViewport, { duration: 0 })
  }

  const getFilenamePrefix = () => {
    if (nodeNamePrefixEnabled?.value === false || !currentFilename?.value) return ''
    const basename = currentFilename.value.split(/[\\/]/).pop() || ''
    return basename.replace(/\.json$/i, '').replace(/[^\p{L}\p{N}_-]+/gu, '_')
  }

  const createUniqueNodeId = () => {
    const prefix = getFilenamePrefix()
    const generateId = () => prefix
      ? `${prefix}_${Math.floor(100000 + Math.random() * 900000)}`
      : `N-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    let id = generateId()
    while (nodes.value.some((node) => node.id === id)) {
      id = generateId()
    }
    return id
  }

  const toClipboardNode = (node: FlowNode) => {
    if (!node.data?.data || !node.position) return null
    const data = clone(node.data.data)
    delete (data as Record<string, unknown>).next
    delete (data as Record<string, unknown>).on_error
    delete (data as Record<string, unknown>).timeout_next
    return {
      label: node.id,
      data,
      position: { ...node.position },
      images: imageManager.getNodeImages(node.id),
    }
  }

  const copyNodesToClipboard = (targetNode?: FlowNode | null): number => {
    if (!isFileLoaded.value) return 0
    const selectedNodes = getSelectedNodes.value
    const shouldCopySelection = targetNode
      ? selectedNodes.some((node) => node.id === targetNode.id)
      : selectedNodes.length > 0
    const sourceNodes = shouldCopySelection ? selectedNodes : targetNode ? [targetNode] : []
    const normalized = sourceNodes
      .filter((node) => !node.data?._isMissing)
      .map(toClipboardNode)
      .filter((node): node is NonNullable<typeof node> => !!node)

    return clipboard.copy(normalized)
  }

  const pasteNodesFromClipboard = (
    position?: { x: number; y: number } | null,
    historyKey?: string | null
  ): FlowNode[] => {
    const copiedNodes = historyKey
      ? [clipboard.getRecentNode(historyKey)].filter(
          (node): node is NonNullable<typeof node> => !!node
        )
      : clipboard.getBatch()
    if (!isFileLoaded.value || copiedNodes.length === 0) return []
    const pastePosition = position || menu.value.flowPos
    if (!pastePosition) return []
    const previousViewport = deps.getViewport?.() || null

    const minX = Math.min(...copiedNodes.map((node) => node.position.x))
    const minY = Math.min(...copiedNodes.map((node) => node.position.y))
    const nextNodes: FlowNode[] = []

    copiedNodes.forEach((clipboardNode) => {
      const nodeId = createUniqueNodeId()
      const copyData = { ...clone(clipboardNode.data), id: nodeId }
      const newNode = createNodeObject(nodeId, copyData)
      newNode.position = {
        x: pastePosition.x + (clipboardNode.position.x - minX),
        y: pastePosition.y + (clipboardNode.position.y - minY),
      }
      nextNodes.push(newNode)
      if (clipboardNode.images.length > 0) {
        imageManager.setNodeImages(nodeId, clone(clipboardNode.images))
      }
    })

    nodes.value = [
      ...nodes.value.map((node) => ({ ...node, selected: false })),
      ...nextNodes.map((node) => ({ ...node, selected: true })),
    ]
    markNodeStructureChanged?.()
    markDataChanged()
    void stabilizeViewportAfterNodeMutation(
      previousViewport,
      nextNodes.map((node) => node.id)
    )
    snapshotState?.()
    return nextNodes
  }

  type MenuAction = {
    action: string
    type: MenuType
    data: FlowNode | FlowEdge | null
    payload?: string | EdgeType | SpacingKey | LayoutAlgorithm | LayoutDirection | null
  }

  const handleMenuAction = ({ action, type, data, payload }: MenuAction) => {
    closeMenu()
    switch (action) {
      case 'add': {
        const recognition = typeof payload === 'string' ? payload : undefined
        const newId = createUniqueNodeId()
        const newNode = createNodeObject(newId, {
          id: newId,
          recognition: recognition || 'DirectHit',
        })
        const previousViewport = deps.getViewport?.() || null
        if (menu.value.flowPos) newNode.position = { ...menu.value.flowPos }
        nodes.value = [...nodes.value, newNode]
        markNodeStructureChanged?.()
        markDataChanged()
        void stabilizeViewportAfterNodeMutation(
          previousViewport,
          nodes.value.map((node) => node.id)
        )
        break
      }
      case 'add_anchor': {
        const anchorId = createUniqueNodeId()
        const anchorNode = createNodeObject(anchorId, {
          id: anchorId,
          recognition: 'Anchor',
          anchor: true,
        })
        const previousViewport = deps.getViewport?.() || null
        if (menu.value.flowPos) anchorNode.position = { ...menu.value.flowPos }
        anchorNode.data = { ...(anchorNode.data || {}), type: 'Anchor', id: anchorId }
        nodes.value = [...nodes.value, anchorNode]
        markNodeStructureChanged?.()
        markDataChanged()
        void stabilizeViewportAfterNodeMutation(
          previousViewport,
          nodes.value.map((node) => node.id)
        )
        break
      }
      case 'debug_this_node':
        if (type === 'node' && isFlowNodeData(data) && data.id)
          onDebugNode(String(data.id), 'standard')
        break
      case 'debug_this_node_reco':
        if (type === 'node' && isFlowNodeData(data) && data.id)
          onDebugNode(String(data.id), 'recognition_only')
        break
      case 'debug_in_panel':
        if (type === 'node' && isFlowNodeData(data) && data.id)
          onOpenDebugPanel({ nodeId: String(data.id) })
        break
      case 'edit':
        break
      case 'duplicate':
        if (type === 'node' && isFlowNodeData(data)) {
          copyNodesToClipboard(data)
        }
        break
      case 'paste':
        pasteNodesFromClipboard(
          menu.value.flowPos,
          typeof payload === 'string' ? payload : clipboard.history.value[0]?.value
        )
        break
      case 'delete':
        if (type === 'node' && data?.id) {
          const edgeIds = edges.value
            .filter((e) => e.source === data.id || e.target === data.id)
            .map((e) => e.id)
          removeEdges(edgeIds)
          nodes.value = nodes.value.filter((n) => n.id !== data.id)
          markNodeStructureChanged?.()
          markDataChanged()
        } else if (type === 'edge' && data?.id) {
          removeEdges([data.id])
          markDataChanged()
        }
        break
      case 'setJumpBack':
        if (type === 'edge' && data?.id) setEdgeJumpBack(data.id, true)
        break
      case 'setNormalLink':
        if (type === 'edge' && data?.id) setEdgeJumpBack(data.id, false)
        break
      case 'layout_chain':
        if (type === 'node' && isFlowNodeData(data) && data.id) {
          if (mode === 'subcanvas') {
            layoutChainFromNode(data.id, currentSpacing.value)
          } else {
            onOpenSubCanvas?.({ nodeId: String(data.id) })
          }
        }
        break
      case 'layout_chain_with_algo':
        if (type === 'node' && isFlowNodeData(data) && data.id && isLayoutAlgorithm(payload)) {
          if (mode === 'subcanvas') {
            layoutChainFromNode(data.id, currentSpacing.value, payload)
          } else {
            onOpenSubCanvas?.({ nodeId: String(data.id), algorithm: payload })
          }
        }
        break
      case 'layout':
        applyLayout()
        break
      case 'changeAlgorithm':
        if (isLayoutAlgorithm(payload)) {
          currentAlgorithm.value = payload
          applyLayout({ algorithm: payload })
        }
        break
      case 'changeDirection':
        if (isLayoutDirection(payload)) {
          currentDirection.value = payload
          applyLayout({ direction: payload })
        }
        break
      case 'changeSpacing':
        if (isSpacingKey(payload)) {
          currentSpacing.value = payload
          applyLayout({ spacing: payload })
        }
        break
      case 'changeEdgeType':
        if (isEdgeType(payload)) {
          currentEdgeType.value = payload
          edges.value = edges.value.map((e) => ({ ...e, type: payload }))
        }
        break
      case 'reset':
        fitView({ padding: 0.2, duration: 500 })
        break
      case 'clear':
        requestClearCanvas?.()
        break
      case 'search':
        searchVisible.value = true
        break
      case 'closeSearch':
        searchVisible.value = false
        break
      case 'openDebugPanel':
        onOpenDebugPanel({ nodeId: type === 'node' && isFlowNodeData(data) ? String(data.id) : '' })
        break
      case 'closeDebugPanel':
        onCloseDebugPanel()
        break
      case 'closeAllDetails':
        onIncrementCloseAllDetails()
        break
    }
    snapshotState?.()
  }

  return {
    menu,
    searchVisible,
    closeMenu,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    handleMenuAction,
    copyNodesToClipboard,
    pasteNodesFromClipboard,
    clipboardHistory,
    isFlowNodeData,
  }
}
