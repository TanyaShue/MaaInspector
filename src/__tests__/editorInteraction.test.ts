import { describe, expect, it, vi } from 'vitest'
import { isEditorActive, onlyWhenEditorActive, syncNodePositions } from '@/utils/editorInteraction'

describe('editorInteraction', () => {
  it('treats an omitted active state as active for single-editor compatibility', () => {
    expect(isEditorActive(undefined)).toBe(true)
  })

  it('reads the current activity from a getter', () => {
    let active = false
    expect(isEditorActive(() => active)).toBe(false)

    active = true
    expect(isEditorActive(() => active)).toBe(true)
  })

  it('does not forward global events to an inactive editor', () => {
    const handler = vi.fn()
    const guarded = onlyWhenEditorActive<KeyboardEvent>(() => false, handler)
    const event = new KeyboardEvent('keydown', { key: 'Delete' })

    guarded(event)

    expect(handler).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('forwards global events to the active editor', () => {
    const handler = vi.fn()
    const guarded = onlyWhenEditorActive<KeyboardEvent>(() => true, handler)
    const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })

    guarded(event)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('syncs only final dragged positions without replacing the node array', () => {
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 10, y: 20 } },
    ]

    syncNodePositions(nodes, [{ id: 'b', position: { x: 30, y: 40 } }])

    expect(nodes).toEqual([
      { id: 'a', position: { x: 0, y: 0 } },
      { id: 'b', position: { x: 30, y: 40 } },
    ])
  })
})
