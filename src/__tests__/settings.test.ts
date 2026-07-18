import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppConfigStore } from '@/stores/appConfig'

describe('useAppConfigStore canvas settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('default values', () => {
    it('should have default edgeType', () => {
      const store = useAppConfigStore()
      expect(store.canvas.edgeType).toBe('smoothstep')
    })

    it('should have default spacing', () => {
      const store = useAppConfigStore()
      expect(store.canvas.spacing).toBe('normal')
    })

    it('should have default layoutAlgorithm', () => {
      const store = useAppConfigStore()
      expect(store.canvas.layoutAlgorithm).toBe('layered')
    })

    it('should have default layoutDirection', () => {
      const store = useAppConfigStore()
      expect(store.canvas.layoutDirection).toBe('TB')
    })

    it('should have default pipelineVersion', () => {
      const store = useAppConfigStore()
      expect(store.canvas.pipelineVersion).toBe('V1')
    })

    it('should have default restoreWorkspaceOnStart', () => {
      const store = useAppConfigStore()
      expect(store.canvas.restoreWorkspaceOnStart).toBe(true)
    })

    it('should have default lowMemoryMode', () => {
      const store = useAppConfigStore()
      expect(store.canvas.lowMemoryMode).toBe(false)
    })

    it('should enable file-level node name prefixes by default', () => {
      const store = useAppConfigStore()
      expect(store.canvas.nodeNamePrefixEnabled).toBe(true)
    })
  })

  describe('updateCanvasSettings', () => {
    it('should update edgeType', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ edgeType: 'default' })
      expect(store.canvas.edgeType).toBe('default')
    })

    it('should update spacing', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ spacing: 'compact' })
      expect(store.canvas.spacing).toBe('compact')
    })

    it('should update layoutAlgorithm', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ layoutAlgorithm: 'stress' })
      expect(store.canvas.layoutAlgorithm).toBe('stress')
    })

    it('should update layoutDirection', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ layoutDirection: 'LR' })
      expect(store.canvas.layoutDirection).toBe('LR')
    })

    it('should update pipelineVersion', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ pipelineVersion: 'V2' })
      expect(store.canvas.pipelineVersion).toBe('V2')
    })

    it('should update restoreWorkspaceOnStart', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ restoreWorkspaceOnStart: false })
      expect(store.canvas.restoreWorkspaceOnStart).toBe(false)
    })

    it('should update lowMemoryMode', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ lowMemoryMode: true })
      expect(store.canvas.lowMemoryMode).toBe(true)
    })

    it('should update nodeNamePrefixEnabled', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ nodeNamePrefixEnabled: false })
      expect(store.canvas.nodeNamePrefixEnabled).toBe(false)
    })

    it('should update multiple settings at once', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({
        edgeType: 'default',
        spacing: 'compact',
        layoutAlgorithm: 'stress',
        layoutDirection: 'LR'
      })
      expect(store.canvas.edgeType).toBe('default')
      expect(store.canvas.spacing).toBe('compact')
      expect(store.canvas.layoutAlgorithm).toBe('stress')
      expect(store.canvas.layoutDirection).toBe('LR')
    })

    it('should not update undefined fields', () => {
      const store = useAppConfigStore()
      store.updateCanvasSettings({ edgeType: 'default' })
      expect(store.canvas.spacing).toBe('normal')
      expect(store.canvas.layoutAlgorithm).toBe('layered')
    })
  })
})
