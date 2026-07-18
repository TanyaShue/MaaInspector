import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useEditorActions } from '@/composables/useEditorActions'
import { resetNodeClipboardForTests } from '@/composables/useNodeClipboard'
import type { FlowBusinessData, FlowEdge, FlowNode } from '@/utils/flowTypes'
import type { NodeNamePrefixMode } from '@/stores/appConfig'

const createNode = (id: string, data: FlowBusinessData = { id, recognition: 'DirectHit' }): FlowNode => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    id,
    type: data.recognition || 'DirectHit',
    data
  }
})

const createActions = (
  filename = 'demo.json',
  prefixMode: NodeNamePrefixMode = 'filename',
  customPrefix = ''
) => {
  const nodes = ref<FlowNode[]>([createNode('Start')])
  const edges = ref<FlowEdge[]>([
    { id: 'e-Start-End-next', source: 'Start', target: 'End' }
  ] as FlowEdge[])
  const requestClearCanvas = vi.fn()
  const markDataChanged = vi.fn()
  const markNodeStructureChanged = vi.fn()
  const snapshotState = vi.fn()
  const getViewport = vi.fn(() => ({ x: 12, y: 34, zoom: 1.5 }))
  const setViewport = vi.fn().mockResolvedValue(true)
  const updateNodeInternals = vi.fn()
  const onViewTaskChain = vi.fn()

  const actions = useEditorActions({
    nodes,
    edges,
    currentEdgeType: ref('smoothstep'),
    currentSpacing: ref('normal'),
    currentAlgorithm: ref('layered'),
    currentDirection: ref('TB'),
    isFileLoaded: ref(true),
    currentFilename: ref(filename),
    nodeNamePrefixEnabled: ref(true),
    nodeNamePrefixMode: ref(prefixMode),
    nodeNameCustomPrefix: ref(customPrefix),
    createNodeObject: createNode,
    applyLayout: vi.fn().mockResolvedValue(undefined),
    removeEdges: vi.fn(),
    setEdgeJumpBack: vi.fn(),
    layoutChainFromNode: vi.fn().mockResolvedValue(undefined),
    markDataChanged,
    markNodeStructureChanged,
    fitView: vi.fn(),
    screenToFlowCoordinate: ({ x, y }) => ({ x: x + 10, y: y + 20 }),
    getSelectedNodes: ref([]),
    imageManager: {
      getNodeImages: vi.fn(() => []),
      setNodeImages: vi.fn()
    },
    snapshotState,
    requestClearCanvas,
    getViewport,
    setViewport,
    updateNodeInternals,
    onDebugNode: vi.fn(),
    onOpenDebugPanel: vi.fn(),
    onViewTaskChain,
    onCloseDebugPanel: vi.fn(),
    onIncrementCloseAllDetails: vi.fn()
  })

  return { actions, nodes, edges, requestClearCanvas, markDataChanged, markNodeStructureChanged, snapshotState, getViewport, setViewport, updateNodeInternals, onViewTaskChain }
}

describe('useEditorActions', () => {
  beforeEach(() => {
    resetNodeClipboardForTests()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  it('requests confirmation instead of clearing the canvas directly', () => {
    const { actions, nodes, edges, requestClearCanvas, markDataChanged } = createActions()

    actions.handleMenuAction({ action: 'clear', type: 'pane', data: null })

    expect(requestClearCanvas).toHaveBeenCalledTimes(1)
    expect(nodes.value).toHaveLength(1)
    expect(edges.value).toHaveLength(1)
    expect(markDataChanged).not.toHaveBeenCalled()
  })

  it('adds pane nodes at the stored flow coordinate', () => {
    const { actions, nodes, markNodeStructureChanged } = createActions()

    actions.onPaneContextMenu(new MouseEvent('contextmenu', { clientX: 30, clientY: 40 }))
    actions.handleMenuAction({ action: 'add', type: 'pane', data: null, payload: 'OCR' })

    const addedNode = nodes.value[nodes.value.length - 1]
    expect(addedNode?.position).toEqual({ x: 40, y: 60 })
    expect(addedNode?.data?.data?.recognition).toBe('OCR')
    expect(addedNode?.id).toMatch(/^demo-\d{6}$/)
    expect(markNodeStructureChanged).toHaveBeenCalledTimes(1)
  })

  it('shares copied nodes between editor instances and exposes recent node names', () => {
    const source = createActions('source.json')
    const sourceActions = source.actions
    const target = createActions('target.json')

    expect(sourceActions.copyNodesToClipboard(source.nodes.value[0])).toBe(1)
    expect(target.actions.clipboardHistory.value[0]?.label).toBe('Start')

    const pasted = target.actions.pasteNodesFromClipboard({ x: 25, y: 35 })
    expect(pasted).toHaveLength(1)
    expect(pasted[0]?.id).toMatch(/^target-\d{6}$/)
    expect(pasted[0]?.position).toEqual({ x: 25, y: 35 })
  })

  it.each([
    ['random', '', /^N-\d{6}$/],
    ['custom', 'Daily Task', /^Daily_Task-\d{6}$/],
  ] as const)('creates nodes with the %s prefix mode', (mode, customPrefix, expected) => {
    const { actions, nodes } = createActions('demo.json', mode, customPrefix)

    actions.onPaneContextMenu(new MouseEvent('contextmenu', { clientX: 1, clientY: 2 }))
    actions.handleMenuAction({ action: 'add', type: 'pane', data: null })

    expect(nodes.value[nodes.value.length - 1]?.id).toMatch(expected)
  })

  it('preserves the viewport when adding a node', async () => {
    const { actions, setViewport, updateNodeInternals } = createActions()

    actions.onPaneContextMenu(new MouseEvent('contextmenu', { clientX: 30, clientY: 40 }))
    actions.handleMenuAction({ action: 'add', type: 'pane', data: null })

    await nextTick()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(setViewport).toHaveBeenCalledWith({ x: 12, y: 34, zoom: 1.5 }, { duration: 0 })
    expect(updateNodeInternals).toHaveBeenCalled()
  })

  it('opens task-chain focus for the selected node', () => {
    const { actions, nodes, onViewTaskChain } = createActions()

    actions.handleMenuAction({
      action: 'view_task_chain',
      type: 'node',
      data: nodes.value[0],
    })

    expect(onViewTaskChain).toHaveBeenCalledWith('Start')
  })
})
