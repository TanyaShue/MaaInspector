import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDebugLogPanelHeight } from '@/composables/useDebugLogPanelHeight'

describe('useDebugLogPanelHeight', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('resizes upward to enlarge the log panel and persists the result', () => {
    const totalHeight = ref(720)
    const panel = useDebugLogPanelHeight(totalHeight, { storageKey: 'debug-log-height-test' })

    panel.startResize(new MouseEvent('mousedown', { clientY: 400 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 340 }))
    expect(panel.height.value).toBe(280)

    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(localStorage.getItem('debug-log-height-test')).toBe('280')
    expect(document.body.style.cursor).toBe('')
  })

  it('loads and clamps a stored height when the window becomes smaller', async () => {
    localStorage.setItem('debug-log-height-test', '360')
    const totalHeight = ref(720)
    const panel = useDebugLogPanelHeight(totalHeight, { storageKey: 'debug-log-height-test' })

    panel.load()
    expect(panel.panelStyle.value.height).toBe('360px')

    totalHeight.value = 440
    await nextTick()
    expect(panel.height.value).toBe(232)
  })
})
