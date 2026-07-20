import { computed, ref, watch, type Ref } from 'vue'

interface DebugLogPanelHeightOptions {
  storageKey: string
  defaultHeight?: number
  minHeight?: number
  minPreviewHeight?: number
  reservedHeight?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function useDebugLogPanelHeight(
  totalHeight: Ref<number>,
  options: DebugLogPanelHeightOptions
) {
  const {
    storageKey,
    defaultHeight = 220,
    minHeight = 120,
    minPreviewHeight = 160,
    reservedHeight = 48,
  } = options
  const height = ref(defaultHeight)
  const resizing = ref(false)
  const start = ref({ y: 0, height: defaultHeight })

  const maxHeight = computed(() =>
    Math.max(minHeight, totalHeight.value - minPreviewHeight - reservedHeight)
  )
  const clampHeight = () => {
    height.value = clamp(height.value, minHeight, maxHeight.value)
  }
  const save = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, String(Math.round(height.value)))
    } catch {
      // Ignore storage failures.
    }
  }
  const load = () => {
    if (typeof window !== 'undefined') {
      const stored = Number(window.localStorage.getItem(storageKey))
      if (Number.isFinite(stored) && stored > 0) height.value = stored
    }
    clampHeight()
  }
  const stopResize = () => {
    if (!resizing.value) return
    resizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
    save()
  }
  function handleMouseMove(event: MouseEvent) {
    if (!resizing.value) return
    height.value = clamp(
      start.value.height - (event.clientY - start.value.y),
      minHeight,
      maxHeight.value
    )
  }
  const startResize = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    resizing.value = true
    start.value = { y: event.clientY, height: height.value }
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
  }

  watch(totalHeight, clampHeight)

  return {
    height,
    resizing,
    panelStyle: computed(() => ({ height: `${height.value}px` })),
    load,
    startResize,
    stopResize,
  }
}
