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
}))

vi.mock('@/composables/useFlowGraph', () => ({
  useFlowGraph: vi.fn(() => graphMock),
}))

vi.mock('@/services/resourceDocument', () => ({
  loadResourceDocument: vi.fn(),
}))

describe('useResourceDocumentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    graphMock.loadNodes.mockResolvedValue(undefined)
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
})
