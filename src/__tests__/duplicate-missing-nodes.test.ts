import { describe, it, expect, vi } from 'vitest'
import { useFlowGraph } from '@/composables/useFlowGraph'
import { UNKNOWN_NODE_ID_PREFIX } from '@/composables/flowGraph/useNodeStateManager'

const vueFlowMockState = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string }>
}))

// Mock the dependencies
vi.mock('@vue-flow/core', () => ({
  useVueFlow: () => ({
    addEdges: vi.fn(),
    removeEdges: vi.fn(),
    findNode: vi.fn((id: string) => vueFlowMockState.nodes.find(n => n.id === id)),
    fitView: vi.fn(),
  }),
  MarkerType: {
    ArrowClosed: 'arrowclosed',
  },
}))

const setVueFlowNodes = (nodes: Array<{ id: string }>) => {
  vueFlowMockState.nodes = nodes
}

vi.mock('../composables/useLayout', () => ({
  useLayout: () => ({
    elkLayout: vi.fn().mockImplementation((nodes: unknown, _edges: unknown, _options: unknown) => {
      return Promise.resolve(nodes)
    }),
    applyLayoutOnRefs: vi.fn(),
    applyOrderedChainLayout: vi.fn(),
  }),
}))

vi.mock('../composables/useImageManager', () => ({
  useImageManager: () => ({
    getImageData: vi.fn(),
    clearTempImageData: vi.fn(),
    deleteImage: vi.fn(),
    addTempImage: vi.fn(),
    restoreImage: vi.fn(),
    setNodeImages: vi.fn(),
    resetForFile: vi.fn(),
    commitPendingImageChanges: vi.fn(),
    migrateNodeState: vi.fn(),
    removeNodeState: vi.fn(),
    exportState: vi.fn(() => ({ nodeImageStates: [] })),
    restoreState: vi.fn(),
  }),
}))

describe('Duplicate Missing Nodes', () => {
  it('should create separate instances for duplicate missing nodes', () => {
    const { loadNodes, nodes } = useFlowGraph()
    
    const testData = {
      NodeA: { next: 'MissingNode' },
      NodeB: { next: 'MissingNode' },
      NodeC: { next: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    // Check that three separate missing nodes are created
    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    expect(missingNodes).toHaveLength(3)

    // Check that all missing nodes have unique built-in IDs
    const missingNodeIds = missingNodes.map(n => n.id)
    expect(new Set(missingNodeIds).size).toBe(3)
    missingNodeIds.forEach(id => expect(id.startsWith(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__`)).toBe(true))

    // Check that missing nodes keep the represented business ID separately
    missingNodes.forEach(node => {
      expect(node.data?._originalId).toBe('MissingNode')
      expect(node.data?.data?.id).toBe('MissingNode')
    })
  })

  it('should create edges from each source node to its corresponding missing node', () => {
    const { loadNodes, edges } = useFlowGraph()
    
    const testData = {
      NodeA: { next: 'MissingNode' },
      NodeB: { next: 'MissingNode' },
      NodeC: { next: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    // Check that edges are created correctly
    expect(edges.value).toHaveLength(3)
    
    const edgeTargets = edges.value.map(e => e.target)
    expect(new Set(edgeTargets).size).toBe(3)
    edgeTargets.forEach(id => expect(id.startsWith(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__`)).toBe(true))
  })

  it('should handle single missing node with a built-in visual id', () => {
    const { loadNodes, nodes } = useFlowGraph()
    
    const testData = {
      NodeA: { next: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    expect(missingNodes).toHaveLength(1)
    expect(missingNodes[0].id).toBe(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(missingNodes[0].data?._originalId).toBe('MissingNode')
    expect(missingNodes[0].data?.data?.id).toBe('MissingNode')
  })

  it('should handle multiple different missing nodes', () => {
    const { loadNodes, nodes } = useFlowGraph()
    
    const testData = {
      NodeA: { next: 'MissingNode1' },
      NodeB: { next: 'MissingNode2' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    expect(missingNodes).toHaveLength(2)
    
    const missingNodeIds = missingNodes.map(n => n.id)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode1__1`)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode2__1`)
    expect(missingNodes.map(n => n.data?._originalId)).toEqual(expect.arrayContaining(['MissingNode1', 'MissingNode2']))
  })

  it('should export nodes without missing nodes', () => {
    const { loadNodes, getNodesData } = useFlowGraph()
    
    const testData = {
      NodeA: { next: 'MissingNode' },
      NodeB: { next: 'MissingNode' },
      NodeC: { next: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    const exportedData = getNodesData()
    
    // Missing nodes should not be included in export
    expect(exportedData).not.toHaveProperty('MissingNode')
    expect(Object.keys(exportedData).some(id => id.startsWith(UNKNOWN_NODE_ID_PREFIX))).toBe(false)
    expect(exportedData.NodeA.next).toBe('MissingNode')
    expect(exportedData.NodeB.next).toBe('MissingNode')
    expect(exportedData.NodeC.next).toBe('MissingNode')
    
    // Original nodes should be included
    expect(exportedData).toHaveProperty('NodeA')
    expect(exportedData).toHaveProperty('NodeB')
    expect(exportedData).toHaveProperty('NodeC')
  })

  it('should create duplicate missing nodes for on_error field', () => {
    const { loadNodes, nodes, edges } = useFlowGraph()
    
    const testData = {
      NodeA: { on_error: 'MissingNode' },
      NodeB: { on_error: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    expect(missingNodes).toHaveLength(2)

    const missingNodeIds = missingNodes.map(n => n.id)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__2`)

    // Check edges point to correct targets
    const edgeTargets = edges.value.map(e => e.target)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__2`)
  })

  it('should create duplicate missing nodes for timeout_next field', () => {
    const { loadNodes, nodes, edges } = useFlowGraph()
    
    const testData = {
      NodeA: { timeout_next: 'MissingNode' },
      NodeB: { timeout_next: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    expect(missingNodes).toHaveLength(2)

    const missingNodeIds = missingNodes.map(n => n.id)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__2`)

    // Check edges point to correct targets
    const edgeTargets = edges.value.map(e => e.target)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__2`)
  })

  it('should handle array-type targets with duplicate missing nodes', () => {
    const { loadNodes, nodes, edges } = useFlowGraph()
    
    const testData = {
      NodeA: { next: ['MissingNode', 'MissingNode'] },
      NodeB: { next: 'MissingNode' },
    }

    loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    expect(missingNodes).toHaveLength(3)

    const missingNodeIds = missingNodes.map(n => n.id)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__2`)
    expect(missingNodeIds).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__3`)

    // Check edges point to correct targets
    const edgeTargets = edges.value.map(e => e.target)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__1`)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__2`)
    expect(edgeTargets).toContain(`${UNKNOWN_NODE_ID_PREFIX}MissingNode__3`)
  })

  it('should write represented business id when connecting to a missing node', async () => {
    const { loadNodes, nodes, handleConnect, getNodesData } = useFlowGraph()

    const testData = {
      NodeA: { next: 'MissingNode' },
      NodeB: {},
    }

    await loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })
    await setVueFlowNodes(nodes.value)

    const missingNode = nodes.value.find(n => n.data?._isMissing)
    expect(missingNode).toBeTruthy()

    handleConnect({
      source: 'NodeB',
      target: missingNode!.id,
      sourceHandle: 'source-a',
      targetHandle: 'in'
    })

    expect(getNodesData().NodeB.next).toEqual(['MissingNode'])
  })

  it('should update only the selected duplicate missing reference', async () => {
    const { loadNodes, nodes, handleNodeUpdate, getNodesData } = useFlowGraph()

    const testData = {
      NodeA: { next: 'MissingNode' },
      NodeB: { next: 'MissingNode' },
    }

    await loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })
    await setVueFlowNodes(nodes.value)

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    handleNodeUpdate({
      oldId: missingNodes[1].id,
      newId: 'FixedNode',
      newType: 'Unknown',
    })

    const exportedData = getNodesData()
    expect(exportedData.NodeA.next).toBe('MissingNode')
    expect(exportedData.NodeB.next).toBe('FixedNode')
    expect(missingNodes[1].id.startsWith(UNKNOWN_NODE_ID_PREFIX)).toBe(true)
  })

  it('should update the selected duplicate array reference by link index', async () => {
    const { loadNodes, nodes, handleNodeUpdate, getNodesData } = useFlowGraph()

    const testData = {
      NodeA: { next: ['MissingNode', 'MissingNode'] },
    }

    await loadNodes({
      filename: 'test.json',
      source: JSON.stringify(testData),
      nodes: testData,
    })
    setVueFlowNodes(nodes.value)

    const missingNodes = nodes.value.filter(n => n.data?._isMissing)
    handleNodeUpdate({
      oldId: missingNodes[1].id,
      newId: 'FixedNode',
      newType: 'Unknown',
    })

    expect(getNodesData().NodeA.next).toEqual(['MissingNode', 'FixedNode'])
  })

  it('should save a renamed node when Vue Flow uses a detached graph-node copy', async () => {
    const { loadNodes, nodes, handleNodeUpdate, getNodesData } = useFlowGraph()

    await loadNodes({
      filename: 'test.json',
      source: 'source',
      nodes: {
        OldName: { recognition: 'DirectHit', description: 'renamed node' },
        Parent: { next: 'OldName' },
      },
    })
    setVueFlowNodes(nodes.value.map(node => ({
      ...node,
      data: node.data
        ? { ...node.data, data: node.data.data ? { ...node.data.data } : undefined }
        : undefined,
    })))

    handleNodeUpdate({
      oldId: 'OldName',
      newId: 'NewName',
      newType: 'DirectHit',
    })

    const exportedData = getNodesData()
    expect(exportedData.OldName).toBeUndefined()
    expect(exportedData.NewName).toMatchObject({ description: 'renamed node' })
    expect(exportedData.Parent.next).toBe('NewName')
  })
})
