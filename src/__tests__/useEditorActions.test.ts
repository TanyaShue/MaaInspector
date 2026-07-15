import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useEditorActions } from '@/composables/useEditorActions'
import type { FlowBusinessData, FlowEdge, FlowNode } from '@/utils/flowTypes'

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

const createActions = () => {
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

  const actions = useEditorActions({
    nodes,
    edges,
    currentEdgeType: ref('smoothstep'),
    currentSpacing: ref('normal'),
    currentAlgorithm: ref('layered'),
    currentDirection: ref('TB'),
    isFileLoaded: ref(true),
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
    onCloseDebugPanel: vi.fn(),
    onIncrementCloseAllDetails: vi.fn()
  })

  return { actions, nodes, edges, requestClearCanvas, markDataChanged, markNodeStructureChanged, snapshotState, getViewport, setViewport, updateNodeInternals }
}

describe('useEditorActions', () => {
  beforeEach(() => {
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
    expect(markNodeStructureChanged).toHaveBeenCalledTimes(1)
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
})
