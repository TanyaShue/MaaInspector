import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDebugPanelColumns } from '@/composables/useDebugPanelColumns'

describe('useDebugPanelColumns', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('resizes the left preview and keeps enough width for the task list', () => {
    const totalWidth = ref(1000)
    const columns = useDebugPanelColumns(totalWidth, { storageKey: 'debug-columns-test' })

    columns.startPreviewResize(new MouseEvent('mousedown', { clientX: 220 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 320 }))
    expect(columns.previewWidth.value).toBe(320)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1200 }))
    expect(columns.previewWidth.value).toBe(672)
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(document.body.style.cursor).toBe('')
  })

  it('resizes the right detail in the opposite drag direction', () => {
    const totalWidth = ref(1120)
    const columns = useDebugPanelColumns(totalWidth, { storageKey: 'debug-columns-test' })

    columns.startDetailResize(new MouseEvent('mousedown', { clientX: 700 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 620 }))
    expect(columns.detailWidth.value).toBe(500)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1100 }))
    expect(columns.detailWidth.value).toBe(300)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('loads, clamps and persists both side widths', async () => {
    localStorage.setItem(
      'debug-columns-test',
      JSON.stringify({ previewWidth: 280, detailWidth: 510 })
    )
    const totalWidth = ref(900)
    const columns = useDebugPanelColumns(totalWidth, { storageKey: 'debug-columns-test' })

    columns.load()
    expect(columns.previewStyle.value.width).toBe('280px')
    expect(columns.detailStyle.value.width).toBe('510px')

    totalWidth.value = 680
    await nextTick()
    expect(columns.detailWidth.value).toBeLessThanOrEqual(352)
  })
})
