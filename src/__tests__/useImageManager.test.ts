import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed } from 'vue'
import { useImageManager } from '@/composables/useImageManager'
import type { TemplateImage } from '@/utils/flowTypes'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://localhost${path}`)
}))

describe('useImageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createManager() {
    return useImageManager()
  }

  describe('setNodeImages', () => {
    it('should set images for a node', () => {
      const manager = createManager()
      const images: TemplateImage[] = [
        { path: 'img1.png', fullPath: '/path/img1.png' },
        { path: 'img2.png', fullPath: '/path/img2.png' }
      ]
      manager.setNodeImages('node-1', images)
      const nodeImages = manager.getNodeImages('node-1')
      expect(nodeImages).toHaveLength(2)
      expect(nodeImages[0].path).toBe('img1.png')
      expect(nodeImages[1].path).toBe('img2.png')
    })

    it('should generate url from fullPath using convertFileSrc', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png', fullPath: '/assets/test.png' }])
      const images = manager.getNodeImages('node-1')
      expect(images[0].url).toBe('tauri://localhost/assets/test.png')
    })

    it('should increment only the affected node revision on set', () => {
      const manager = createManager()
      const initialGlobalVersion = manager.version.value
      const initialNodeVersion = manager.getNodeVersion('node-1')
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      expect(manager.getNodeVersion('node-1')).toBeGreaterThan(initialNodeVersion)
      expect(manager.version.value).toBe(initialGlobalVersion)
    })
  })

  describe('file and node lifecycle', () => {
    it('should reset all image state for a new file', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'old.png' }])
      manager.addTempImage('node-1', 'temp.png', undefined, 'base64data')

      manager.resetForFile({ source: 'D:/maa', filename: 'next.json' })

      expect(manager.getNodeImages('node-1')).toHaveLength(0)
      expect(manager.getPendingImageChanges().tempImages).toHaveLength(0)
      expect(manager.currentFile.value).toEqual({ source: 'D:/maa', filename: 'next.json' })
    })

    it('should replace loaded images as a whole', () => {
      const manager = createManager()
      manager.setNodeImages('old-node', [{ path: 'old.png' }])

      manager.replaceLoadedImages({
        'node-1': [{ path: 'new.png', fullPath: '/path/new.png', found: true }]
      })

      expect(manager.getNodeImages('old-node')).toHaveLength(0)
      expect(manager.getNodeImages('node-1')[0].url).toBe('tauri://localhost/path/new.png')
    })

    it('should migrate saved, temp, and deleted state when a node is renamed', () => {
      const manager = createManager()
      manager.setNodeImages('old-id', [{ path: 'saved.png' }, { path: 'deleted.png' }])
      manager.addTempImage('old-id', 'temp.png', undefined, 'base64data')
      manager.deleteImage('old-id', 'deleted.png')

      manager.migrateNodeState('old-id', 'new-id')

      expect(manager.getNodeImages('old-id')).toHaveLength(0)
      expect(manager.getNodeSavedImages('new-id').map(img => img.path)).toEqual(['saved.png'])
      expect(manager.getNodeTempImages('new-id').map(img => img.path)).toEqual(['temp.png'])
      expect(manager.getNodeDeletedImages('new-id').map(img => img.path)).toEqual(['deleted.png'])
    })

    it('invalidates the old and new node only when image state is migrated', () => {
      const manager = createManager()
      manager.setNodeImages('old-id', [{ path: 'old.png', found: true }])
      manager.setNodeImages('new-id', [{ path: 'new.png', found: true }])
      manager.setNodeImages('other-id', [{ path: 'other.png', found: true }])

      const readOld = vi.fn(() => manager.getImagesForTemplatePaths('old-id', ['old.png']))
      const readNew = vi.fn(() => manager.getImagesForTemplatePaths('new-id', ['new.png', 'old.png']))
      const readOther = vi.fn(() => manager.getImagesForTemplatePaths('other-id', ['other.png']))
      const oldImages = computed(readOld)
      const newImages = computed(readNew)
      const otherImages = computed(readOther)
      void oldImages.value
      void newImages.value
      void otherImages.value
      const otherVersion = manager.getNodeVersion('other-id')

      manager.migrateNodeState('old-id', 'new-id')

      expect(oldImages.value).toEqual([])
      expect(newImages.value.map(image => image.path)).toEqual(['new.png', 'old.png'])
      void otherImages.value
      expect(readOld).toHaveBeenCalledTimes(2)
      expect(readNew).toHaveBeenCalledTimes(2)
      expect(readOther).toHaveBeenCalledTimes(1)
      expect(manager.getNodeVersion('other-id')).toBe(otherVersion)
    })
  })

  describe('deleteImage', () => {
    it('should move saved image to delImages', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'saved.png', fullPath: '/path/saved.png' }])
      manager.deleteImage('node-1', 'saved.png')
      expect(manager.getNodeImages('node-1')).toHaveLength(0)
      expect(manager.getNodeDeletedImages('node-1')).toHaveLength(1)
      expect(manager.getNodeDeletedImages('node-1')[0].path).toBe('saved.png')
    })

    it('should remove temp image completely', () => {
      const manager = createManager()
      manager.addTempImage('node-1', 'temp.png', '/path/temp.png', 'base64data')
      manager.deleteImage('node-1', 'temp.png')
      expect(manager.getNodeTempImages('node-1')).toHaveLength(0)
      expect(manager.getNodeDeletedImages('node-1')).toHaveLength(0)
    })

    it('should do nothing for non-existent image', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'existing.png' }])
      manager.deleteImage('node-1', 'nonexistent.png')
      expect(manager.getNodeImages('node-1')).toHaveLength(1)
    })
  })

  describe('restoreImage', () => {
    it('should restore deleted image back to images', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'deleted.png', fullPath: '/path/deleted.png' }])
      manager.deleteImage('node-1', 'deleted.png')
      manager.restoreImage('node-1', 'deleted.png')
      expect(manager.getNodeImages('node-1')).toHaveLength(1)
      expect(manager.getNodeImages('node-1')[0].path).toBe('deleted.png')
      expect(manager.getNodeDeletedImages('node-1')).toHaveLength(0)
    })

    it('should do nothing for non-deleted image', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      manager.restoreImage('node-1', 'test.png')
      expect(manager.getNodeImages('node-1')).toHaveLength(1)
    })
  })

  describe('getImageData', () => {
    it('should return delImages and tempImages across all nodes', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'saved.png' }])
      manager.deleteImage('node-1', 'saved.png')
      manager.addTempImage('node-2', 'temp.png', undefined, 'base64data')
      const data = manager.getImageData()
      expect(data.delImages).toHaveLength(1)
      expect(data.delImages[0].path).toBe('saved.png')
      expect(data.delImages[0].nodeId).toBe('node-1')
      expect(data.tempImages).toHaveLength(1)
      expect(data.tempImages[0].path).toBe('temp.png')
      expect(data.tempImages[0].base64).toBe('base64data')
      expect(data.tempImages[0].nodeId).toBe('node-2')
    })

    it('should exclude tempImages without base64', () => {
      const manager = createManager()
      manager.addTempImage('node-1', 'temp.png', '/path/temp.png')
      const data = manager.getImageData()
      expect(data.tempImages).toHaveLength(0)
    })
  })

  describe('clearTempImageData', () => {
    it('should move tempImages to images and clear delImages', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'saved.png' }])
      manager.addTempImage('node-1', 'temp.png', undefined, 'base64data')
      manager.deleteImage('node-1', 'saved.png')
      manager.clearTempImageData()
      expect(manager.getNodeTempImages('node-1')).toHaveLength(0)
      expect(manager.getNodeImages('node-1')).toHaveLength(1)
      expect(manager.getNodeDeletedImages('node-1')).toHaveLength(0)
    })

    it('should handle nodes without temp images', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      manager.clearTempImageData()
      expect(manager.getNodeImages('node-1')).toHaveLength(1)
    })
  })

  describe('exportState / restoreState', () => {
    it('should export and restore state correctly', () => {
      const manager1 = createManager()
      manager1.setNodeImages('node-1', [{ path: 'test.png', fullPath: '/path/test.png' }])
      manager1.addTempImage('node-1', 'temp.png', undefined, 'base64data')
      manager1.deleteImage('node-1', 'test.png')
      const exported = manager1.exportState()
      const manager2 = createManager()
      manager2.restoreState({ nodeImageStates: exported.nodeImageStates })
      expect(manager2.getNodeSavedImages('node-1')).toHaveLength(0)
      expect(manager2.getNodeTempImages('node-1')[0].path).toBe('temp.png')
      expect(manager2.getNodeDeletedImages('node-1')[0].path).toBe('test.png')
    })

    it('should clear all state when restoring without snapshot', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      manager.restoreState()
      expect(manager.getNodeImages('node-1')).toHaveLength(0)
    })

    it('should re-generate urls on restore', () => {
      const manager1 = createManager()
      manager1.setNodeImages('node-1', [{ path: 'test.png', fullPath: '/path/test.png' }])
      const exported = manager1.exportState()
      const manager2 = createManager()
      manager2.restoreState({ nodeImageStates: exported.nodeImageStates })
      const images = manager2.getNodeImages('node-1')
      expect(images[0].url).toBe('tauri://localhost/path/test.png')
    })
  })

  describe('addTempImage', () => {
    it('should add a new temp image', () => {
      const manager = createManager()
      manager.addTempImage('node-1', 'new.png', '/path/new.png', 'base64')
      const tempImages = manager.getNodeTempImages('node-1')
      expect(tempImages).toHaveLength(1)
      expect(tempImages[0].path).toBe('new.png')
      expect(tempImages[0].base64).toBe('base64')
    })

    it('should not duplicate existing temp image', () => {
      const manager = createManager()
      manager.addTempImage('node-1', 'test.png', '/path/test.png')
      manager.addTempImage('node-1', 'test.png', '/path/other.png')
      expect(manager.getNodeTempImages('node-1')).toHaveLength(1)
    })

    it('should update fullPath when provided for existing image', () => {
      const manager = createManager()
      manager.addTempImage('node-1', 'test.png')
      manager.addTempImage('node-1', 'test.png', '/path/test.png')
      expect(manager.getNodeTempImages('node-1')[0].fullPath).toBe('/path/test.png')
    })
  })

  describe('setNodeImageChanges', () => {
    it('should set both images and tempImages', () => {
      const manager = createManager()
      manager.setNodeImageChanges('node-1',
        [{ path: 'saved.png' }],
        [{ path: 'temp.png', base64: 'data' }]
      )
      expect(manager.getNodeSavedImages('node-1')).toHaveLength(1)
      expect(manager.getNodeTempImages('node-1')).toHaveLength(1)
      expect(manager.getNodeDeletedImages('node-1')).toHaveLength(0)
    })
  })

  describe('applyNodeImageChanges', () => {
    it('should preserve deleted saved images but drop deleted temp images from pending deletions', () => {
      const manager = createManager()

      manager.applyNodeImageChanges('node-1', {
        validPaths: ['kept.png', 'new.png'],
        images: [{ path: 'kept.png' }],
        tempImages: [{ path: 'new.png', base64: 'base64data', url: 'base64data' }],
        deletedImages: [
          { path: 'removed-saved.png' },
          { path: 'removed-temp.png', _source: 'temp' } as TemplateImage & { _source: string }
        ]
      })

      expect(manager.getNodeSavedImages('node-1').map(img => img.path)).toEqual(['kept.png'])
      expect(manager.getNodeTempImages('node-1').map(img => img.path)).toEqual(['new.png'])
      expect(manager.getNodeDeletedImages('node-1').map(img => img.path)).toEqual(['removed-saved.png'])
      expect(manager.getPendingImageChanges()).toEqual({
        delImages: [{ path: 'removed-saved.png', nodeId: 'node-1' }],
        tempImages: [{ path: 'new.png', base64: 'base64data', nodeId: 'node-1' }]
      })
    })

    it('should increment the node revision for every display-affecting change', () => {
      const manager = createManager()
      const globalVersion = manager.version.value
      const versions: number[] = [manager.getNodeVersion('node-1')]

      manager.setNodeImages('node-1', [{ path: 'a.png' }])
      versions.push(manager.getNodeVersion('node-1'))
      manager.addTempImage('node-1', 'b.png', undefined, 'base64data')
      versions.push(manager.getNodeVersion('node-1'))
      manager.deleteImage('node-1', 'a.png')
      versions.push(manager.getNodeVersion('node-1'))
      manager.restoreImage('node-1', 'a.png')
      versions.push(manager.getNodeVersion('node-1'))

      expect(versions).toEqual([...versions].sort((a, b) => a - b))
      expect(new Set(versions).size).toBe(versions.length)
      expect(manager.version.value).toBe(globalVersion)
    })

    it('should keep temp images pending when validPaths is omitted', () => {
      const manager = createManager()

      manager.applyNodeImageChanges('node-1', {
        images: [],
        tempImages: [{ path: 'new.png', base64: 'base64data', url: 'base64data' }],
        deletedImages: []
      })

      expect(manager.getPendingImageChanges().tempImages).toEqual([
        { path: 'new.png', base64: 'base64data', nodeId: 'node-1' }
      ])
    })
  })

  describe('clearNodeState / clearAll', () => {
    it('should clear single node state', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      manager.clearNodeState('node-1')
      expect(manager.getNodeImages('node-1')).toHaveLength(0)
    })

    it('should clear all states', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test1.png' }])
      manager.setNodeImages('node-2', [{ path: 'test2.png' }])
      manager.clearAll()
      expect(manager.getNodeImages('node-1')).toHaveLength(0)
      expect(manager.getNodeImages('node-2')).toHaveLength(0)
    })
  })

  describe('getImagePaths', () => {
    it('should return paths of all images', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'img1.png' }])
      manager.addTempImage('node-1', 'img2.png')
      expect(manager.getImagePaths('node-1')).toEqual(['img1.png', 'img2.png'])
    })

    it('should return empty array for non-existent node', () => {
      const manager = createManager()
      expect(manager.getImagePaths('nonexistent')).toEqual([])
    })
  })

  describe('getImagesForDisplay', () => {
    it('should filter images by templatePaths and limit to 16', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [
        { path: 'a.png', found: true },
        { path: 'b.png', found: true },
        { path: 'c.png', found: false }
      ])
      const result = manager.getImagesForDisplay('node-1', ['a.png', 'b.png', 'c.png'])
      expect(result).toHaveLength(2)
      expect(result.map(i => i.path)).toContain('a.png')
      expect(result.map(i => i.path)).toContain('b.png')
    })
  })

  describe('getImagesForTemplatePaths', () => {
    it('should follow template path order, skip missing images, and honor limit', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [
        { path: 'a.png', found: true },
        { path: 'b.png', found: true },
        { path: 'c.png', found: false }
      ])
      manager.addTempImage('node-1', 'd.png', undefined, 'base64data')

      const result = manager.getImagesForTemplatePaths('node-1', ['d.png', 'c.png', 'b.png', 'a.png'], 2)

      expect(result.map(img => img.path)).toEqual(['d.png', 'b.png'])
    })

    it('does not invalidate another node display computed for a node-local update', () => {
      const manager = createManager()
      manager.setNodeImages('node-a', [{ path: 'a.png', found: true }])
      manager.setNodeImages('node-b', [{ path: 'b.png', found: true }])

      const readA = vi.fn(() => manager.getImagesForTemplatePaths('node-a', ['a.png']))
      const readB = vi.fn(() => manager.getImagesForTemplatePaths('node-b', ['b.png']))
      const imagesA = computed(readA)
      const imagesB = computed(readB)
      expect(imagesA.value[0].path).toBe('a.png')
      expect(imagesB.value[0].path).toBe('b.png')

      const globalVersion = manager.version.value
      const nodeBVersion = manager.getNodeVersion('node-b')
      manager.addTempImage('node-a', 'a-2.png', undefined, 'base64data')

      void imagesA.value
      void imagesB.value
      expect(readA).toHaveBeenCalledTimes(2)
      expect(readB).toHaveBeenCalledTimes(1)
      expect(manager.getNodeVersion('node-b')).toBe(nodeBVersion)
      expect(manager.version.value).toBe(globalVersion)
    })

    it('globally invalidates all node display computeds when loaded images are replaced', () => {
      const manager = createManager()
      manager.setNodeImages('node-a', [{ path: 'a.png', found: true }])
      manager.setNodeImages('node-b', [{ path: 'b.png', found: true }])

      const readA = vi.fn(() => manager.getImagesForTemplatePaths('node-a', ['a.png']))
      const readB = vi.fn(() => manager.getImagesForTemplatePaths('node-b', ['b.png']))
      const imagesA = computed(readA)
      const imagesB = computed(readB)
      void imagesA.value
      void imagesB.value

      manager.replaceLoadedImages({
        'node-a': [{ path: 'a.png', found: true }],
        'node-b': [{ path: 'b.png', found: true }]
      })

      void imagesA.value
      void imagesB.value
      expect(readA).toHaveBeenCalledTimes(2)
      expect(readB).toHaveBeenCalledTimes(2)
    })
  })

  describe('hasTemplateChanged', () => {
    it('should return true when tempImages exist', () => {
      const manager = createManager()
      manager.addTempImage('node-1', 'test.png')
      expect(manager.hasTemplateChanged('node-1')).toBe(true)
    })

    it('should return true when delImages exist', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      manager.deleteImage('node-1', 'test.png')
      expect(manager.hasTemplateChanged('node-1')).toBe(true)
    })

    it('should return false when no changes', () => {
      const manager = createManager()
      manager.setNodeImages('node-1', [{ path: 'test.png' }])
      expect(manager.hasTemplateChanged('node-1')).toBe(false)
    })

    it('should return false for non-existent node', () => {
      const manager = createManager()
      expect(manager.hasTemplateChanged('nonexistent')).toBe(false)
    })
  })
})
