<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { SelectionMode, VueFlow, useVueFlow, type EdgeMouseEvent, type FlowEvents, type NodeChange, type NodeDragEvent, type NodeMouseEvent, type NodeTypesObject, type XYPosition } from '@vue-flow/core'
import { Maximize2, Move, RefreshCw, Save, X } from 'lucide-vue-next'
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import ContextMenu from './ContextMenu.vue'
import NodeDetailsHost from './NodeDetailsHost.vue'
import { useEditorActions } from '@/composables/useEditorActions'
import { useResourceDocumentSession } from '@/composables/useResourceDocumentSession'
import { useFloatingPanel } from '@/composables/useFloatingPanel'
import { useLayout } from '@/composables/useLayout'
import { useViewportSync } from '@/composables/flowGraph/useViewportSync'
import { useEdgeRenderWindow } from '@/composables/flowGraph/useEdgeRenderWindow'
import { logDebug } from '@/utils/logger'
import ToolbarIconDropdown from './Common/ToolbarIconDropdown.vue'
import {
  EDGE_TYPE_OPTIONS,
  LAYOUT_ALGORITHM_OPTIONS,
  LAYOUT_DIRECTION_OPTIONS,
  SPACING_TYPE_OPTIONS
} from '@/utils/flowOptions'
import {
  collectReachableNodeIds,
  consumeSubgraphPositionChanges,
  filterSubgraphEdges,
  projectSubgraphEdge,
  projectSubgraphNode,
  resolveSubgraphNodeChanges,
  stageSubgraphPositionChanges
} from '@/utils/flowSubgraph'
import type { EdgeType } from '@/utils/flowOptions'
import type { NodeNamePrefixMode } from '@/stores/appConfig'
import {
  provideNodeDetailsController,
  useNodeDetailsController,
} from '@/composables/useNodeDetailsController'
import type {
  FlowBusinessData,
  FlowConnection,
  FlowEdge,
  FlowEdgeChange,
  FlowNode,
  LayoutAlgorithm,
  LayoutDirection,
  NodeUpdatePayload,
  SpacingKey,
  TemplateImage
} from '@/utils/flowTypes'

const DeleteImagesConfirmModal = defineAsyncComponent(
  () => import('./Modals/DeleteImagesConfirmModal.vue')
)

const props = defineProps<{
  visible: boolean
  rootNodeId: string
  contextKey?: string
  initialAlgorithm?: LayoutAlgorithm
  nodes: FlowNode[]
  edges: FlowEdge[]
  nodeTypesObject: NodeTypesObject
  currentEdgeType: EdgeType
  currentSpacing: SpacingKey
  currentAlgorithm: LayoutAlgorithm
  currentDirection: LayoutDirection
  lowMemoryMode?: boolean
  currentFilename: string
  currentSource?: string
  detached?: boolean
  nodeNamePrefixEnabled: boolean
  nodeNamePrefixMode: NodeNamePrefixMode
  nodeNameCustomPrefix: string
  isFileLoaded: boolean
  onValidateConnection: (connection: FlowConnection) => boolean
  handleConnect: (connection: FlowConnection) => void
  handleEdgesChange: (changes: FlowEdgeChange[]) => void
  handleNodeUpdate: (payload: NodeUpdatePayload) => void
  createNodeObject: (id: string, rawContent: FlowBusinessData, isMissing?: boolean, originalId?: string) => FlowNode
  removeEdges: (ids: string[]) => void
  setEdgeJumpBack: (edgeId: string, isJumpBack: boolean) => void
  markDataChanged: () => void
  imageManager: {
    getNodeImages: (nodeId: string) => TemplateImage[]
    setNodeImages: (nodeId: string, images: TemplateImage[]) => void
    removeNodeState?: (nodeId: string) => void
  }
  handleDebugNode: (nodeId: string, mode: import('@/utils/debugMode').DebugMode) => void
  handleOpenDebugPanel: (payload?: { nodeId?: string }) => void
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'root-renamed', nodeId: string): void
  (e: 'replace-nodes', nodes: FlowNode[]): void
  (e: 'open-referenced-node', node: FlowNode): void
}>()

const flowId = `sub-canvas-${Math.random().toString(36).slice(2)}`
const detachedGraph = props.detached ? useResourceDocumentSession(flowId) : null
const documentNodes = computed(() => detachedGraph?.nodes.value ?? props.nodes)
const documentEdges = computed(() => detachedGraph?.edges.value ?? props.edges)
const documentImageManager = detachedGraph?.imageManager ?? props.imageManager
const parentPipelineVersion = inject<Ref<'V1' | 'V2' | ''>>('pipelineVersion', ref(''))
const nodeDetailsController = props.detached
  ? provideNodeDetailsController()
  : useNodeDetailsController()
const sessionNodeIds = ref<Set<string>>(new Set())
const localNodeState = ref<Record<string, Partial<FlowNode>>>({})
const activeAlgorithm = ref<LayoutAlgorithm>(props.initialAlgorithm || props.currentAlgorithm)
const activeSpacing = ref<SpacingKey>(props.currentSpacing)
const activeDirection = ref<LayoutDirection>(props.currentDirection)
const activeEdgeType = ref<EdgeType>(props.currentEdgeType)
const onlyRenderVisibleElements = ref(true)
const isSavingDetachedDocument = ref(false)
const pendingInitialLayout = ref(false)
const pendingNodePositions = new Map<string, XYPosition>()
let layoutRequestId = 0
let sessionRootNodeId = ''
let sessionContextKey = ''
let subCanvasDebugEnabled = false
let lastViewportDebugAt = 0
let lastPanelDebugAt = 0
let longTaskObserver: PerformanceObserver | null = null
let canvasResizeObserver: ResizeObserver | null = null

const SUB_CANVAS_DEBUG_KEY = 'maainspector.subCanvasDebug'
const DEBUG_SAMPLE_LIMIT = 100

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

const {
  fitView,
  findNode,
  getViewport,
  setViewport,
  updateNodeInternals,
  screenToFlowCoordinate,
  getSelectedNodes,
  getSelectedEdges
} = useVueFlow(flowId)
const { elkLayout } = useLayout(flowId)
const viewportSync = useViewportSync({
  onlyRenderVisibleElements,
  updateNodeInternals
})

const panel = useFloatingPanel({
  storageKey: 'maa-inspector-sub-canvas-panel',
  defaultWidth: 980,
  defaultHeight: 680,
  minWidth: 560,
  minHeight: 360,
  edgeGap: 24
})
const panelRootRef = ref<HTMLElement | null>(null)
const canvasRootRef = ref<HTMLElement | null>(null)

const baseVisibleNodeIds = ref<Set<string>>(new Set())
const edgeStructureKey = computed(() => {
  if (!props.visible) return ''
  return documentEdges.value.map(edge => `${edge.id}:${edge.source}:${edge.target}`).join('|')
})

const refreshVisibleNodeIds = () => {
  const reachableIds = collectReachableNodeIds(
    props.rootNodeId,
    documentNodes.value,
    documentEdges.value
  )
  baseVisibleNodeIds.value = reachableIds
  if (!props.visible) return

  const viewIds = new Set([...reachableIds, ...sessionNodeIds.value])
  const nextLocalState = { ...localNodeState.value }
  let seeded = false
  documentNodes.value.forEach(node => {
    if (!viewIds.has(node.id) || nextLocalState[node.id]) return
    nextLocalState[node.id] = { position: { ...node.position } }
    seeded = true
  })
  if (seeded) localNodeState.value = nextLocalState
}

const visibleNodeIds = computed(() => new Set([...baseVisibleNodeIds.value, ...sessionNodeIds.value]))
const visibleNodeIdList = computed(() => Array.from(visibleNodeIds.value))

const roundDebugNumber = (value: number) => Math.round(value * 100) / 100

const writeSubCanvasDebug = (event: string, fields: Record<string, unknown>) => {
  if (!subCanvasDebugEnabled) return
  logDebug('SubCanvasDebug', event, {
    flowId,
    rootNodeId: props.rootNodeId,
    ...fields
  })
}

const collectSubCanvasDebugSnapshot = (event: string, fields: Record<string, unknown> = {}) => {
  if (!subCanvasDebugEnabled) return

  const viewport = getViewport()
  const root = panelRootRef.value
  const panelBounds = root?.getBoundingClientRect()
  const memory = (performance as PerformanceWithMemory).memory
  const nodeSamples = subNodes.value.slice(0, DEBUG_SAMPLE_LIMIT).map(node => {
    const runtimeNode = findNode(node.id)
    return {
      id: node.id,
      sourcePosition: node.position,
      runtimePosition: runtimeNode?.position,
      computedPosition: runtimeNode?.computedPosition,
      dimensions: runtimeNode?.dimensions
    }
  })

  writeSubCanvasDebug(event, {
    viewport: {
      x: roundDebugNumber(viewport.x),
      y: roundDebugNumber(viewport.y),
      zoom: roundDebugNumber(viewport.zoom)
    },
    panel: panelBounds ? {
      x: roundDebugNumber(panelBounds.x),
      y: roundDebugNumber(panelBounds.y),
      width: roundDebugNumber(panelBounds.width),
      height: roundDebugNumber(panelBounds.height)
    } : null,
    graph: {
      nodeCount: subNodes.value.length,
      edgeCount: subEdges.value.length,
      renderedNodeCount: root?.querySelectorAll('.vue-flow__node').length ?? 0,
      renderedEdgeCount: root?.querySelectorAll('.vue-flow__edge').length ?? 0,
      sampleTruncated: subNodes.value.length > DEBUG_SAMPLE_LIMIT,
      nodes: nodeSamples
    },
    performance: {
      now: roundDebugNumber(performance.now()),
      devicePixelRatio: window.devicePixelRatio,
      usedJSHeapMB: memory ? roundDebugNumber(memory.usedJSHeapSize / 1024 / 1024) : null,
      totalJSHeapMB: memory ? roundDebugNumber(memory.totalJSHeapSize / 1024 / 1024) : null
    },
    ...fields
  })
}

const recordViewportMove = ({ flowTransform }: FlowEvents['move']) => {
  if (!subCanvasDebugEnabled) return
  const now = performance.now()
  if (now - lastViewportDebugAt < 250) return
  lastViewportDebugAt = now
  writeSubCanvasDebug('viewport-move', {
    viewport: {
      x: roundDebugNumber(flowTransform.x),
      y: roundDebugNumber(flowTransform.y),
      zoom: roundDebugNumber(flowTransform.zoom)
    }
  })
}

const recordViewportMoveEnd = () => {
  collectSubCanvasDebugSnapshot('viewport-move-end')
}

const markDocumentChanged = () => {
  if (detachedGraph) detachedGraph.markDataChanged()
  else props.markDataChanged()
}

const replaceDocumentNodes = (nodes: FlowNode[]) => {
  if (detachedGraph) {
    detachedGraph.nodes.value = nodes
    detachedGraph.markNodeStructureChanged()
  } else {
    emit('replace-nodes', nodes)
  }
}

const removeMainEdges = (edgeIds: string[]) => {
  if (!edgeIds.length) return
  if (detachedGraph) detachedGraph.removeEdges(edgeIds)
  else props.removeEdges(edgeIds)
}

const removeMainNodes = (nodeIds: Set<string>) => {
  if (nodeIds.size === 0) return

  const edgeIds = documentEdges.value
    .filter(edge => nodeIds.has(edge.source) || nodeIds.has(edge.target))
    .map(edge => edge.id)
  removeMainEdges(edgeIds)
  replaceDocumentNodes(documentNodes.value.filter(node => !nodeIds.has(node.id)))
  nodeIds.forEach(id => documentImageManager.removeNodeState?.(id))
  sessionNodeIds.value = new Set([...sessionNodeIds.value].filter(id => !nodeIds.has(id)))

  const nextLocalState = { ...localNodeState.value }
  nodeIds.forEach(id => { delete nextLocalState[id] })
  localNodeState.value = nextLocalState
  refreshVisibleNodeIds()
}

const refreshSubCanvasRenderWindow = async (nodeIds: string[]) => {
  const previousViewport = getViewport()
  await viewportSync.withPreservedVisibility(async () => {
    await nextTick()
  }, nodeIds)
  await setViewport(previousViewport, { duration: 0 })
}

const subNodes = computed<FlowNode[]>({
  get: () => documentNodes.value
    .filter(node => visibleNodeIds.value.has(node.id))
    .map(node => {
      const local = localNodeState.value[node.id] || {}
      const projected = projectSubgraphNode(node)
      return {
        ...projected,
        ...local,
        data: node.data,
        position: local.position ? { ...local.position } : projected.position
      }
    }),
  set: (nextNodes) => {
    const { addedNodes, removedVisibleIds, nextLocalState } = resolveSubgraphNodeChanges({
      mainNodes: documentNodes.value,
      nextNodes,
      visibleNodeIds: visibleNodeIds.value,
      localNodeState: localNodeState.value
    })

    if (removedVisibleIds.size > 0) {
      removeMainNodes(removedVisibleIds)
    }

    if (addedNodes.length > 0) {
      sessionNodeIds.value = new Set([...sessionNodeIds.value, ...addedNodes.map(node => node.id)])
      const mergedNodes = [...documentNodes.value, ...addedNodes]
      replaceDocumentNodes(mergedNodes)
      markDocumentChanged()
    }
    localNodeState.value = nextLocalState
    if (addedNodes.length > 0) {
      void refreshSubCanvasRenderWindow(visibleNodeIdList.value)
    }
  }
})

const subEdges = computed<FlowEdge[]>(() => filterSubgraphEdges(documentEdges.value, visibleNodeIds.value)
  .map(edge => projectSubgraphEdge(edge, activeEdgeType.value)))
const subNodeStructureVersion = ref(0)
watch(visibleNodeIdList, () => {
  subNodeStructureVersion.value++
})

const {
  renderedEdges: renderedSubEdges,
  refreshRenderedEdges: refreshRenderedSubEdges,
  setCanvasSize,
  handleMoveStart: handleEdgeMoveStart,
  handleMove: handleEdgeMove,
  handleMoveEnd: handleEdgeMoveEnd,
} = useEdgeRenderWindow({
  nodes: subNodes,
  edges: subEdges,
  nodeStructureVersion: subNodeStructureVersion,
  lowMemoryMode: () => props.lowMemoryMode === true
})

const handleViewportMoveStart = (event: Parameters<typeof handleEdgeMoveStart>[0]) => {
  closeMenu()
  handleEdgeMoveStart(event)
}

const handleViewportMove = (event: FlowEvents['move']) => {
  handleEdgeMove(event)
  recordViewportMove(event)
}

const handleViewportMoveEnd = (event: Parameters<typeof handleEdgeMoveEnd>[0]) => {
  handleEdgeMoveEnd(event)
  recordViewportMoveEnd()
}

const handleNodeUpdate = (payload: NodeUpdatePayload) => {
  if (
    detachedGraph &&
    payload.oldId === props.rootNodeId &&
    payload.newId !== payload.oldId
  ) {
    ElMessage.warning('跨文件子画布中不能重命名根节点，以免外部引用失效')
    return
  }
  if (detachedGraph) detachedGraph.handleNodeUpdate(payload)
  else props.handleNodeUpdate(payload)
  if (payload.oldId === props.rootNodeId && payload.newId !== payload.oldId) {
    sessionRootNodeId = payload.newId
    emit('root-renamed', payload.newId)
  }
  if (payload.newId !== payload.oldId && localNodeState.value[payload.oldId]) {
    const nextLocalState = { ...localNodeState.value }
    nextLocalState[payload.newId] = nextLocalState[payload.oldId]
    delete nextLocalState[payload.oldId]
    localNodeState.value = nextLocalState
  }
  if (payload.newId !== payload.oldId && pendingNodePositions.has(payload.oldId)) {
    pendingNodePositions.set(payload.newId, pendingNodePositions.get(payload.oldId)!)
    pendingNodePositions.delete(payload.oldId)
  }
  if (sessionNodeIds.value.has(payload.oldId) && payload.newId !== payload.oldId) {
    const nextIds = new Set(sessionNodeIds.value)
    nextIds.delete(payload.oldId)
    nextIds.add(payload.newId)
    sessionNodeIds.value = nextIds
  }
  refreshVisibleNodeIds()
}

provide('currentFilename', computed(() => props.currentFilename))
provide('currentDirection', activeDirection)
provide('imageManager', documentImageManager)
provide(
  'pipelineVersion',
  detachedGraph?.saveManager.loadedFileVersion ?? parentPipelineVersion
)
provide('updateNode', handleNodeUpdate)

const performVisibleChainLayout = async (
  algorithm = activeAlgorithm.value,
  options: { preserveViewport?: boolean } = {}
) => {
  const requestId = ++layoutRequestId
  const layoutStartedAt = performance.now()
  const previousViewport = options.preserveViewport ? getViewport() : null
  collectSubCanvasDebugSnapshot('layout-start', {
    requestId,
    algorithm,
    direction: activeDirection.value,
    spacing: activeSpacing.value,
    preserveViewport: Boolean(previousViewport)
  })
  activeAlgorithm.value = algorithm
  const layouted = await elkLayout(subNodes.value, subEdges.value, {
    algorithm,
    direction: activeDirection.value,
    spacing: activeSpacing.value
  })
  if (requestId !== layoutRequestId || !props.visible) return

    const nextLocalState = { ...localNodeState.value }
    layouted.forEach(node => {
      nextLocalState[node.id] = {
        ...(nextLocalState[node.id] || {}),
        position: { ...node.position }
      }
    })
    localNodeState.value = nextLocalState
    await nextTick()
    refreshRenderedSubEdges()
    if (previousViewport) {
      await viewportSync.refreshNodeInternals(layouted.map(node => node.id))
      await setViewport(previousViewport, { duration: 0 })
      collectSubCanvasDebugSnapshot('layout-preserved-viewport', {
        requestId,
        durationMs: roundDebugNumber(performance.now() - layoutStartedAt)
      })
      return
    }

  const fallbackWidth = activeDirection.value === 'LR' ? 340 : 300
  const fallbackHeight = 170
  const bounds = layouted.reduce((result, node) => {
    const graphNode = findNode(node.id)
    const width = graphNode?.dimensions.width || fallbackWidth
    const height = graphNode?.dimensions.height || fallbackHeight
    return {
      minX: Math.min(result.minX, node.position.x),
      minY: Math.min(result.minY, node.position.y),
      maxX: Math.max(result.maxX, node.position.x + width),
      maxY: Math.max(result.maxY, node.position.y + height)
    }
  }, {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  })

  await viewportSync.refreshNodeInternals(layouted.map(node => node.id))
  if (requestId === layoutRequestId && props.visible) await fitVisibleNodes(0)
  collectSubCanvasDebugSnapshot('layout-complete', {
    requestId,
    durationMs: roundDebugNumber(performance.now() - layoutStartedAt),
    calculatedBounds: layouted.length > 0 ? bounds : null
  })
}

const layoutVisibleChain = (
  algorithm = activeAlgorithm.value,
  options: { preserveViewport?: boolean } = {}
) => viewportSync.withPreservedVisibility(
  () => performVisibleChainLayout(algorithm, options),
  visibleNodeIdList.value
)

const handleSpacingChange = (value: PropertyKey) => {
  activeSpacing.value = value as SpacingKey
  void layoutVisibleChain(activeAlgorithm.value)
}

const handleDirectionChange = (value: PropertyKey) => {
  activeDirection.value = value as LayoutDirection
  void layoutVisibleChain(activeAlgorithm.value)
}

const handleEdgeTypeChange = (value: PropertyKey) => {
  activeEdgeType.value = value as EdgeType
  refreshRenderedSubEdges()
}

const saveDetachedDocument = async () => {
  if (!detachedGraph || isSavingDetachedDocument.value) return
  isSavingDetachedDocument.value = true
  try {
    const saved = await detachedGraph.save()
    if (saved) ElMessage.success(`已保存 ${props.currentFilename}`)
  } catch (error) {
    ElMessage.error(`保存失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isSavingDetachedDocument.value = false
  }
}

const fitVisibleNodes = (duration = 400) => {
  if (visibleNodeIdList.value.length === 0) return
  return fitView({ nodes: visibleNodeIdList.value, padding: 0.25, duration })
}

const editorActions = useEditorActions({
  mode: 'subcanvas',
  nodes: subNodes,
  edges: subEdges,
  currentEdgeType: computed({
    get: () => activeEdgeType.value,
    set: (value) => {
      handleEdgeTypeChange(value)
    }
  }),
  currentSpacing: activeSpacing,
  currentAlgorithm: activeAlgorithm,
  currentDirection: activeDirection,
  isFileLoaded: computed(() => props.isFileLoaded),
  currentFilename: computed(() => props.currentFilename),
  nodeNamePrefixEnabled: computed(() => props.nodeNamePrefixEnabled),
  nodeNamePrefixMode: computed(() => props.nodeNamePrefixMode),
  nodeNameCustomPrefix: computed(() => props.nodeNameCustomPrefix),
  createNodeObject: detachedGraph?.createNodeObject ?? props.createNodeObject,
  applyLayout: async (options) => {
    await layoutVisibleChain(options?.algorithm || activeAlgorithm.value)
  },
  removeEdges: removeMainEdges,
  setEdgeJumpBack: detachedGraph?.setEdgeJumpBack ?? props.setEdgeJumpBack,
  layoutChainFromNode: async (_startId, _spacingKey, algorithm) => {
    await layoutVisibleChain(algorithm || activeAlgorithm.value)
  },
  markDataChanged: markDocumentChanged,
  fitView,
  getViewport,
  setViewport,
  updateNodeInternals,
  screenToFlowCoordinate,
  getSelectedNodes,
  imageManager: documentImageManager,
  snapshotState: () => {},
  onDebugNode: props.handleDebugNode,
  onOpenDebugPanel: props.handleOpenDebugPanel,
  onCloseDebugPanel: () => {},
  onIncrementCloseAllDetails: () => { nodeDetailsController?.close() },
  onOpenReferencedNode: openReferencedNode
})

const {
  menu,
  closeMenu,
  onPaneContextMenu,
  onNodeContextMenu,
  onEdgeContextMenu,
  handleMenuAction,
  clipboardHistory
} = editorActions

const handleConnect = (connection: FlowConnection) => {
  if (detachedGraph) detachedGraph.handleConnect(connection)
  else props.handleConnect(connection)
  if (connection.source) sessionNodeIds.value = new Set([...sessionNodeIds.value, connection.source])
  if (connection.target) sessionNodeIds.value = new Set([...sessionNodeIds.value, connection.target])
  refreshVisibleNodeIds()
}

const handleSubCanvasEdgesChange = (changes: FlowEdgeChange[]) => {
  const removedEdgeIds = changes
    .filter(change => change.type === 'remove')
    .map(change => change.id)
  if (removedEdgeIds.length === 0) return
  removeMainEdges(removedEdgeIds)
  refreshVisibleNodeIds()
}

const handleNodesChange = (changes: NodeChange[]) => {
  stageSubgraphPositionChanges(changes, pendingNodePositions)
}

const handleNodeDragStop = (event: NodeDragEvent) => {
  const draggedNodes = event.nodes.length > 0 ? event.nodes : [event.node]
  draggedNodes.forEach(node => {
    pendingNodePositions.set(node.id, { ...node.position })
  })

  const commits = consumeSubgraphPositionChanges(pendingNodePositions)
  if (commits.length === 0) return

  const nextLocalState = { ...localNodeState.value }
  commits.forEach(({ id, position }) => {
    nextLocalState[id] = {
      ...(nextLocalState[id] || {}),
      position: { ...position }
    }
  })
  localNodeState.value = nextLocalState
  refreshRenderedSubEdges()
  collectSubCanvasDebugSnapshot('node-drag-stop', {
    changedNodes: commits
  })
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
}

const requestClose = () => {
  if (
    detachedGraph?.saveManager.isDirtyCombined.value &&
    !window.confirm(`对 ${props.currentFilename} 的修改尚未保存，确定关闭子画布吗？`)
  ) {
    return
  }
  emit('close')
}

function openReferencedNode(node: FlowNode) {
  if (
    detachedGraph?.saveManager.isDirtyCombined.value &&
    !window.confirm('当前跨文件子画布有未保存修改，继续打开其他节点将丢失这些修改。是否继续？')
  ) {
    return
  }
  emit('open-referenced-node', node)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.visible) return

  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu()
    requestClose()
    return
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditableTarget(e.target)) {
    e.preventDefault()
    const selectedNodes = getSelectedNodes.value
    const selectedEdges = getSelectedEdges.value
    if (selectedNodes.length > 0) {
      const selectedIds = new Set(selectedNodes.map(node => node.id))
      removeMainNodes(selectedIds)
      markDocumentChanged()
    } else if (selectedEdges.length > 0) {
      removeMainEdges(selectedEdges.map(edge => edge.id))
      refreshVisibleNodeIds()
      markDocumentChanged()
    }
  }
}

const loadDetachedDocument = async () => {
  if (
    !detachedGraph ||
    !props.visible ||
    !props.currentSource ||
    !props.currentFilename
  ) {
    return
  }

  const loaded = await detachedGraph.load({
    source: props.currentSource,
    filename: props.currentFilename,
    rootNodeId: props.rootNodeId,
  })
  if (!loaded) return
  refreshVisibleNodeIds()
  await nextTick()
  await layoutVisibleChain(activeAlgorithm.value)
}

watch(
  () => [
    props.visible,
    props.currentSource,
    props.currentFilename,
    props.contextKey,
  ] as const,
  () => {
    if (detachedGraph) void loadDetachedDocument()
  },
  { immediate: true }
)

watch(
  () => [props.visible, props.rootNodeId, props.contextKey] as const,
  async ([visible, rootNodeId, contextKey]) => {
  if (!visible) {
    layoutRequestId++
    pendingInitialLayout.value = false
    sessionRootNodeId = ''
    sessionContextKey = ''
    nodeDetailsController?.close()
    return
  }
  if (sessionRootNodeId === rootNodeId && sessionContextKey === contextKey) return
  sessionRootNodeId = rootNodeId
  sessionContextKey = contextKey || rootNodeId
  activeAlgorithm.value = props.initialAlgorithm || props.currentAlgorithm
  activeSpacing.value = props.currentSpacing
  activeDirection.value = props.currentDirection
  activeEdgeType.value = props.currentEdgeType
  sessionNodeIds.value = new Set()
  localNodeState.value = {}
  pendingNodePositions.clear()
  refreshVisibleNodeIds()
  panel.loadLayout()
  pendingInitialLayout.value = true
  await nextTick()
  collectSubCanvasDebugSnapshot('panel-open')
}, { immediate: true })

const runInitialLayout = async () => {
  if (!props.visible || !pendingInitialLayout.value) return
  pendingInitialLayout.value = false
  await nextTick()
  await layoutVisibleChain(activeAlgorithm.value)
}

const handleFlowInit = async () => {
  collectSubCanvasDebugSnapshot('flow-init')
}

const handlePanelAfterEnter = async () => {
  collectSubCanvasDebugSnapshot('panel-after-enter')
  await runInitialLayout()
}

watch(panel.rect, () => {
  if (!subCanvasDebugEnabled) return
  const now = performance.now()
  if (now - lastPanelDebugAt < 250) return
  lastPanelDebugAt = now
  collectSubCanvasDebugSnapshot('panel-rect-change')
}, { deep: true })

watch(() => props.rootNodeId, () => {
  if (props.visible) refreshVisibleNodeIds()
})

watch(edgeStructureKey, () => {
  if (props.visible) refreshVisibleNodeIds()
})

watch(() => props.initialAlgorithm, (algorithm) => {
  if (!props.visible && algorithm) activeAlgorithm.value = algorithm
})

watch(
  () => [
    props.currentAlgorithm,
    props.currentSpacing,
    props.currentDirection,
    props.currentEdgeType
  ] as const,
  ([algorithm, spacing, direction, edgeType]) => {
    if (props.visible) return
    activeAlgorithm.value = algorithm
    activeSpacing.value = spacing
    activeDirection.value = direction
    activeEdgeType.value = edgeType
  }
)

watch(canvasRootRef, (canvasRoot) => {
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = null
  if (!canvasRoot) return
  const updateCanvasSize = () => {
    const rect = canvasRoot.getBoundingClientRect()
    setCanvasSize({ width: rect.width, height: rect.height })
  }
  updateCanvasSize()
  canvasResizeObserver = new ResizeObserver(updateCanvasSize)
  canvasResizeObserver.observe(canvasRoot)
})

onMounted(() => {
  subCanvasDebugEnabled = window.localStorage.getItem(SUB_CANVAS_DEBUG_KEY) === 'on'
  panel.loadLayout()
  window.addEventListener('resize', panel.ensureInViewport)
  window.addEventListener('keydown', handleKeyDown)
  if (subCanvasDebugEnabled && typeof PerformanceObserver !== 'undefined') {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          writeSubCanvasDebug('long-task', {
            name: entry.name,
            startTime: roundDebugNumber(entry.startTime),
            durationMs: roundDebugNumber(entry.duration)
          })
        })
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch {
      longTaskObserver = null
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', panel.ensureInViewport)
  window.removeEventListener('keydown', handleKeyDown)
  longTaskObserver?.disconnect()
  longTaskObserver = null
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = null
  panel.stopInteraction()
})
</script>

<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition ease-out duration-150"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
      @after-enter="handlePanelAfterEnter"
    >
      <div
        v-if="visible"
        ref="panelRootRef"
        class="fixed z-[70] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        :style="panel.panelStyle.value"
      >
        <div
          class="flex h-11 cursor-move items-center justify-between border-b border-slate-200 bg-slate-50 px-3"
          @mousedown="panel.startMove"
        >
          <div class="flex min-w-0 items-center gap-2">
            <Move
              :size="16"
              class="shrink-0 text-indigo-600"
            />
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-700">
                {{ currentFilename }} · {{ rootNodeId }}
                <span
                  v-if="detachedGraph?.saveManager.isDirtyCombined.value"
                  class="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500"
                  title="有未保存的修改"
                />
              </div>
              <div class="truncate font-mono text-[10px] text-slate-400">
                {{ currentSource || '当前资源' }} · 子节点 {{ Math.max(0, visibleNodeIdList.length - 1) }} 个
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <button
              v-for="option in LAYOUT_ALGORITHM_OPTIONS"
              :key="option.value"
              type="button"
              :title="option.label"
              class="flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
              :class="activeAlgorithm === option.value ? 'border-indigo-200 bg-indigo-50 text-indigo-600' : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-800'"
              @mousedown.stop
              @click="layoutVisibleChain(option.value)"
            >
              <component
                :is="option.icon"
                v-if="option.icon"
                :size="15"
              />
            </button>
            <ToolbarIconDropdown
              title="布局间隔"
              :model-value="activeSpacing"
              :options="SPACING_TYPE_OPTIONS"
              @mousedown.stop
              @update:model-value="handleSpacingChange"
            />
            <ToolbarIconDropdown
              title="布局方向"
              :model-value="activeDirection"
              :options="LAYOUT_DIRECTION_OPTIONS"
              @mousedown.stop
              @update:model-value="handleDirectionChange"
            />
            <ToolbarIconDropdown
              title="连线类型"
              :model-value="activeEdgeType"
              :options="EDGE_TYPE_OPTIONS"
              @mousedown.stop
              @update:model-value="handleEdgeTypeChange"
            />
            <button
              v-if="detachedGraph"
              type="button"
              title="保存目标资源文件"
              class="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors"
              :class="detachedGraph.saveManager.isDirtyCombined.value
                ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                : 'text-slate-300'"
              :disabled="!detachedGraph.saveManager.isDirtyCombined.value || isSavingDetachedDocument"
              @mousedown.stop
              @click="saveDetachedDocument"
            >
              <Save :size="14" />
              保存
            </button>
            <button
              type="button"
              title="适配视图"
              class="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800"
              @mousedown.stop
              @click="fitVisibleNodes()"
            >
              <Maximize2 :size="15" />
            </button>
            <button
              type="button"
              title="重新布局"
              class="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800"
              @mousedown.stop
              @click="layoutVisibleChain(activeAlgorithm, { preserveViewport: true })"
            >
              <RefreshCw :size="15" />
            </button>
            <button
              type="button"
              title="关闭"
              class="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              @mousedown.stop
              @click="requestClose"
            >
              <X :size="16" />
            </button>
          </div>
        </div>

        <div
          ref="canvasRootRef"
          class="absolute inset-x-0 bottom-0 top-11 bg-slate-50"
        >
          <VueFlow
            :id="flowId"
            v-memo="[subNodes, renderedSubEdges, isFileLoaded, onlyRenderVisibleElements]"
            class="flow-canvas-layer"
            :nodes="subNodes"
            :edges="renderedSubEdges"
            :node-types="nodeTypesObject"
            :default-zoom="1"
            :min-zoom="0.1"
            :max-zoom="4"
            :only-render-visible-elements="onlyRenderVisibleElements"
            :is-valid-connection="onValidateConnection"
            :nodes-draggable="isFileLoaded"
            :nodes-connectable="isFileLoaded"
            :elements-selectable="isFileLoaded"
            :selection-key-code="false"
            :multi-selection-key-code="null"
            :select-nodes-on-drag="false"
            :selection-mode="SelectionMode.Partial"
            :pan-on-drag="true"
            @connect="handleConnect"
            @init="handleFlowInit"
            @edges-change="handleSubCanvasEdgesChange"
            @nodes-change="handleNodesChange"
            @node-drag-stop="handleNodeDragStop"
            @selection-drag-stop="handleNodeDragStop"
            @pane-context-menu="onPaneContextMenu"
            @node-context-menu="(params: NodeMouseEvent) => onNodeContextMenu(params)"
            @edge-context-menu="(params: EdgeMouseEvent) => onEdgeContextMenu(params)"
            @pane-click="closeMenu"
            @node-click="closeMenu"
            @edge-click="closeMenu"
            @move-start="handleViewportMoveStart"
            @move="handleViewportMove"
            @move-end="handleViewportMoveEnd"
          >
            <Background
              pattern-color="#cbd5e1"
              :gap="20"
            />
            <Controls />
          </VueFlow>
          <ContextMenu
            v-if="menu.visible"
            :x="menu.x"
            :y="menu.y"
            :type="menu.type"
            :data="menu.data"
            mode="subcanvas"
            :allow-debug="!detached"
            :current-edge-type="activeEdgeType"
            :current-spacing="activeSpacing"
            :current-algorithm="activeAlgorithm"
            :current-direction="activeDirection"
            :clipboard-history="clipboardHistory"
            @close="closeMenu"
            @action="handleMenuAction"
          />
          <NodeDetailsHost
            v-if="detachedGraph"
            :nodes="documentNodes"
            :node-structure-version="detachedGraph.nodeStructureVersion.value"
          />
          <div
            v-if="detachedGraph?.loading.value || detachedGraph?.loadError.value"
            class="absolute inset-0 z-20 flex items-center justify-center bg-slate-50/90 p-6 text-center"
          >
            <div class="max-w-md text-sm">
              <div
                v-if="detachedGraph?.loading.value"
                class="text-slate-500"
              >
                正在加载 {{ currentFilename }}…
              </div>
              <div
                v-else
                class="text-rose-600"
              >
                {{ detachedGraph?.loadError.value }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
          title="调整大小"
          @mousedown="panel.startResize"
        >
          <div class="absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-slate-300" />
        </div>
      </div>
    </transition>
    <DeleteImagesConfirmModal
      v-if="detachedGraph"
      :visible="detachedGraph.saveManager.showDeleteImagesModal.value"
      :unused-images="detachedGraph.saveManager.unusedImages.value"
      :used-images="detachedGraph.saveManager.usedImages.value"
      :is-processing="detachedGraph.saveManager.isProcessingImages.value"
      @cancel="detachedGraph.saveManager.handleCancelDeleteImages"
      @confirm="detachedGraph.saveManager.handleConfirmDeleteImages()"
      @skip="detachedGraph.saveManager.handleSkipDeleteImages()"
    />
  </Teleport>
</template>
