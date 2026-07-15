import { describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useViewportSync } from '@/composables/flowGraph/useViewportSync'

describe('useViewportSync', () => {
  it('refreshes node internals once per refresh request', async () => {
    const updateNodeInternals = vi.fn()
    const sync = useViewportSync({
      onlyRenderVisibleElements: ref(true),
      updateNodeInternals,
    })

    await sync.refreshNodeInternals(['a', 'b'])

    expect(updateNodeInternals).toHaveBeenCalledOnce()
    expect(updateNodeInternals).toHaveBeenCalledWith(['a', 'b'])
  })

  it('temporarily renders every node while synchronizing a layout task', async () => {
    const onlyRenderVisibleElements = ref(true)
    const updateNodeInternals = vi.fn().mockResolvedValue(undefined)
    const sync = useViewportSync({
      onlyRenderVisibleElements,
      updateNodeInternals,
    })

    await sync.withPreservedVisibility(async () => {
      expect(onlyRenderVisibleElements.value).toBe(false)
      await nextTick()
    }, ['a', 'b'])

    expect(updateNodeInternals).toHaveBeenCalledTimes(2)
    expect(onlyRenderVisibleElements.value).toBe(true)
  })

  it('restores visible-only rendering when the layout task fails', async () => {
    const onlyRenderVisibleElements = ref(true)
    const sync = useViewportSync({
      onlyRenderVisibleElements,
      updateNodeInternals: vi.fn(),
    })

    await expect(sync.withPreservedVisibility(async () => {
      expect(onlyRenderVisibleElements.value).toBe(false)
      throw new Error('layout failed')
    }, ['a'])).rejects.toThrow('layout failed')

    expect(onlyRenderVisibleElements.value).toBe(true)
  })
})
