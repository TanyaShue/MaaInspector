import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resourceApi } from '@/services/api'
import { loadResourceDocument } from '@/services/resourceDocument'

vi.mock('@/services/api', () => ({
  resourceApi: {
    getFileNodes: vi.fn(),
    getTemplateImages: vi.fn(),
  },
}))

describe('loadResourceDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads nodes and images as one normalized V1 document payload', async () => {
    vi.mocked(resourceApi.getFileNodes).mockResolvedValue({
      nodes: { root: { recognition: 'TemplateMatch', template: 'root.png' } },
    })
    vi.mocked(resourceApi.getTemplateImages).mockResolvedValue({
      results: {
        root: [{ path: 'root.png', fullPath: 'D:/resource/image/root.png' }],
        malformed: [{ missing: true }],
      },
      base_image_path: 'D:/resource/image',
    } as never)

    await expect(loadResourceDocument('D:/resource', 'pipeline.json')).resolves.toEqual({
      source: 'D:/resource',
      filename: 'pipeline.json',
      nodes: { root: { recognition: 'TemplateMatch', template: 'root.png' } },
      images: {
        root: [{ path: 'root.png', fullPath: 'D:/resource/image/root.png' }],
        malformed: [],
      },
      imageBasePath: 'D:/resource/image',
      fileVersion: 'V1',
    })
  })

  it('normalizes V2 nodes for every document host', async () => {
    vi.mocked(resourceApi.getFileNodes).mockResolvedValue({
      nodes: {
        root: {
          recognition: { type: 'OCR', param: { expected: 'hello' } },
          action: { type: 'DoNothing' },
        },
      },
    })
    vi.mocked(resourceApi.getTemplateImages).mockResolvedValue({ results: {} })

    const document = await loadResourceDocument('D:/resource', 'v2.json')

    expect(document.fileVersion).toBe('V2')
    expect(document.nodes.root.recognition).toBe('OCR')
    expect(document.nodes.root.expected).toBe('hello')
  })
})
