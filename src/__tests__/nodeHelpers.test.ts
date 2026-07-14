import { afterEach, describe, expect, it, vi } from 'vitest'
import { deepClone, ensureNodeMeta, waitForFrame } from '@/utils/nodeHelpers'
import type { FlowNode } from '@/utils/flowTypes'

describe('nodeHelpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('ensureNodeMeta', () => {
    it('returns null for an absent node', () => {
      expect(ensureNodeMeta()).toBeNull()
      expect(ensureNodeMeta(null)).toBeNull()
    })

    it('initializes missing node metadata and business data', () => {
      const node = { id: 'node-1' } as FlowNode

      const meta = ensureNodeMeta(node)

      expect(meta).toEqual({ id: 'node-1', type: 'Unknown', data: {} })
      expect(node.data).toBe(meta)
    })

    it('preserves existing metadata while initializing missing business data', () => {
      const node = {
        id: 'node-2',
        data: { id: 'custom-id', type: 'OCR' },
      } as FlowNode

      const originalMeta = node.data
      const meta = ensureNodeMeta(node)

      expect(meta).toBe(originalMeta)
      expect(meta).toMatchObject({ id: 'custom-id', type: 'OCR', data: {} })
    })
  })

  describe('waitForFrame', () => {
    it('resolves through requestAnimationFrame when it is available', async () => {
      const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
        callback(16)
        return 1
      })
      vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

      await waitForFrame()

      expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    })

    it('falls back to a timer when requestAnimationFrame is unavailable', async () => {
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', undefined)

      const pendingFrame = waitForFrame()
      await vi.runAllTimersAsync()

      await expect(pendingFrame).resolves.toBeUndefined()
      vi.useRealTimers()
    })
  })

  describe('deepClone', () => {
    it('uses structuredClone without retaining nested references', () => {
      const structuredCloneMock = vi.fn(<T>(value: T): T => JSON.parse(JSON.stringify(value)) as T)
      vi.stubGlobal('structuredClone', structuredCloneMock)
      const source = { nested: { value: 1 } }

      const cloned = deepClone(source)

      expect(structuredCloneMock).toHaveBeenCalledWith(source)
      expect(cloned).toEqual(source)
      expect(cloned.nested).not.toBe(source.nested)
    })

    it('falls back to JSON cloning when structuredClone is unavailable', () => {
      vi.stubGlobal('structuredClone', undefined)
      const source = { items: [{ id: 1 }] }

      const cloned = deepClone(source)

      expect(cloned).toEqual(source)
      expect(cloned.items).not.toBe(source.items)
      expect(cloned.items[0]).not.toBe(source.items[0])
    })
  })
})
