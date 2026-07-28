import { describe, expect, it } from 'vitest'
import { useEditorModals } from '@/composables/useEditorModals'

describe('useEditorModals', () => {
  it('opens and closes the clear-canvas modal', () => {
    const modals = useEditorModals()

    modals.openClearCanvasModal()
    expect(modals.showClearCanvasModal.value).toBe(true)

    modals.closeClearCanvasModal()
    expect(modals.showClearCanvasModal.value).toBe(false)
  })

  it('opens and resets the sub-canvas state', () => {
    const modals = useEditorModals()

    modals.openSubCanvas('root-node', 'stress')
    expect(modals.subCanvas.value).toEqual({
      visible: true,
      nodeId: 'root-node',
      algorithm: 'stress',
    })

    modals.closeSubCanvas()
    expect(modals.subCanvas.value).toEqual({ visible: false, nodeId: '' })
  })

  it('opens a resource-backed sub-canvas without changing the main file', () => {
    const modals = useEditorModals()

    modals.openResourceSubCanvas({
      source: 'resource-a',
      filename: 'remote.json',
      nodeId: 'shared',
      displayId: 'shared',
    })

    expect(modals.subCanvas.value).toEqual({
      visible: true,
      nodeId: 'shared',
      source: 'resource-a',
      filename: 'remote.json',
      external: true,
    })
  })
})
