import { nextTick, ref } from 'vue'
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

interface ClipboardNode {
  data: FlowBusinessData
  position: { x: number; y: number }
  images: TemplateImage[]
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
  const copiedNodes = ref<ClipboardNode[]>([])

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

  const createUniqueNodeId = () => {
    let id = `N-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    while (nodes.value.some((node) => node.id === id)) {
      id = `N-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    }
    return id
  }

  const toClipboardNode = (node: FlowNode): ClipboardNode | null => {
    if (!node.data?.data || !node.position) return null
    const data = clone(node.data.data)
    delete (data as Record<string, unknown>).next
    delete (data as Record<string, unknown>).on_error
    delete (data as Record<string, unknown>).timeout_next
    return {
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
      .filter((node): node is ClipboardNode => !!node)

    copiedNodes.value = normalized
    return normalized.length
  }

  const pasteNodesFromClipboard = (position?: { x: number; y: number } | null): FlowNode[] => {
    if (!isFileLoaded.value || copiedNodes.value.length === 0) return []
    const pastePosition = position || menu.value.flowPos
    if (!pastePosition) return []
    const previousViewport = deps.getViewport?.() || null

    const minX = Math.min(...copiedNodes.value.map((node) => node.position.x))
    const minY = Math.min(...copiedNodes.value.map((node) => node.position.y))
    const nextNodes: FlowNode[] = []

    copiedNodes.value.forEach((clipboardNode) => {
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
        const newId = `N-${Date.now()}`
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
        const anchorId = `A-${Date.now()}`
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
        pasteNodesFromClipboard(menu.value.flowPos)
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
    isFlowNodeData,
  }
}
