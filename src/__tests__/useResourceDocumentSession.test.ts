import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useResourceDocumentSession } from '@/composables/useResourceDocumentSession'
import { loadResourceDocument } from '@/services/resourceDocument'

const graphMock = vi.hoisted(() => ({
  nodes: { value: [] },
  edges: { value: [] },
  loadNodes: vi.fn(),
  imageManager: {
    replaceLoadedImages: vi.fn(),
  },
  currentEdgeType: { value: 'smoothstep' },
  currentSpacing: { value: 'normal' },
  currentAlgorithm: { value: 'layered' },
  currentDirection: { value: 'TB' },
  currentFilename: { value: '' },
  currentSource: { value: '' },
  isDirty: { value: false },
  exportState: vi.fn(),
  restoreState: vi.fn(),
  getNodesData: vi.fn(),
  getImageData: vi.fn(),
  clearTempImageData: vi.fn(),
  clearDirty: vi.fn(),
}))

const saveManagerMock = vi.hoisted(() => ({
  loadedFileVersion: { value: '' },
  isDirtyCombined: { value: false },
  handleSaveNodes: vi.fn(),
}))

vi.mock('@/composables/useFlowGraph', () => ({
  useFlowGraph: vi.fn(() => graphMock),
}))

vi.mock('@/services/resourceDocument', () => ({
  loadResourceDocument: vi.fn(),
}))

vi.mock('@/composables/useSaveManager', () => ({
  useSaveManager: vi.fn(() => saveManagerMock),
}))

describe('useResourceDocumentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    graphMock.loadNodes.mockResolvedValue(undefined)
    saveManagerMock.handleSaveNodes.mockResolvedValue(undefined)
    saveManagerMock.loadedFileVersion.value = ''
    saveManagerMock.isDirtyCombined.value = false
  })

  it('hydrates graph and image state in the same isolated session', async () => {
    vi.mocked(loadResourceDocument).mockResolvedValue({
      source: 'D:/resource',
      filename: 'pipeline.json',
      nodes: { root: { recognition: 'TemplateMatch', template: 'root.png' } },
      images: { root: [{ path: 'root.png', fullPath: 'D:/resource/image/root.png' }] },
      fileVersion: 'V1',
    })
    const session = useResourceDocumentSession('sub-canvas-test')

    await expect(session.load({
      source: 'D:/resource',
      filename: 'pipeline.json',
      rootNodeId: 'root',
    })).resolves.toBe(true)

    expect(graphMock.loadNodes).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'D:/resource', filename: 'pipeline.json' }),
      { applyInitialLayout: false }
    )
    expect(graphMock.imageManager.replaceLoadedImages).toHaveBeenCalledWith({
      root: [{ path: 'root.png', fullPath: 'D:/resource/image/root.png' }],
    })
    expect(session.fileVersion.value).toBe('V1')
  })

  it('rejects a target that is not defined in the loaded document', async () => {
    vi.mocked(loadResourceDocument).mockResolvedValue({
      source: 'D:/resource',
      filename: 'pipeline.json',
      nodes: { another: { recognition: 'OCR' } },
      images: {},
      fileVersion: 'V1',
    })
    const session = useResourceDocumentSession('sub-canvas-test')

    await expect(session.load({
      source: 'D:/resource',
      filename: 'pipeline.json',
      rootNodeId: 'missing',
    })).resolves.toBe(false)

    expect(session.loadError.value).toContain('missing')
    expect(graphMock.loadNodes).not.toHaveBeenCalled()
  })

  it('saves through the shared save manager', async () => {
    graphMock.currentSource.value = 'D:/resource'
    graphMock.currentFilename.value = 'pipeline.json'
    const session = useResourceDocumentSession('sub-canvas-test')

    await expect(session.save()).resolves.toBe(true)

    expect(saveManagerMock.handleSaveNodes).toHaveBeenCalledWith({
      source: 'D:/resource',
      filename: 'pipeline.json',
    })
  })
})
