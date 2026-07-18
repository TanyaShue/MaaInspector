import { computed, ref, watch, type Ref } from 'vue'

type ResizeTarget = 'preview' | 'detail'

export interface UseDebugPanelColumnsOptions {
  storageKey: string
  defaultPreviewWidth?: number
  defaultDetailWidth?: number
  minPreviewWidth?: number
  minDetailWidth?: number
  minCenterWidth?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function useDebugPanelColumns(
  totalWidth: Ref<number>,
  options: UseDebugPanelColumnsOptions
) {
  const {
    storageKey,
    defaultPreviewWidth = 220,
    defaultDetailWidth = 420,
    minPreviewWidth = 160,
    minDetailWidth = 300,
    minCenterWidth = 320,
  } = options

  const previewWidth = ref(defaultPreviewWidth)
  const detailWidth = ref(defaultDetailWidth)
  const resizeTarget = ref<ResizeTarget | null>(null)
  const resizeStart = ref({ x: 0, width: 0 })

  const maxSideWidth = computed(() =>
    Math.max(minPreviewWidth, totalWidth.value - minCenterWidth - 8)
  )
  const clampWidths = () => {
    previewWidth.value = clamp(previewWidth.value, minPreviewWidth, maxSideWidth.value)
    detailWidth.value = clamp(detailWidth.value, minDetailWidth, maxSideWidth.value)
  }
  const save = () => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          previewWidth: Math.round(previewWidth.value),
          detailWidth: Math.round(detailWidth.value),
        })
      )
    } catch {
      // Ignore storage failures.
    }
  }
  const load = () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as {
          previewWidth?: unknown
          detailWidth?: unknown
        }
        if (typeof stored.previewWidth === 'number' && Number.isFinite(stored.previewWidth)) {
          previewWidth.value = stored.previewWidth
        }
        if (typeof stored.detailWidth === 'number' && Number.isFinite(stored.detailWidth)) {
          detailWidth.value = stored.detailWidth
        }
      } catch {
        // Ignore invalid stored values.
      }
    }
    clampWidths()
  }
  const stopResize = () => {
    if (!resizeTarget.value) return
    resizeTarget.value = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResize)
    save()
  }
  function handleMouseMove(event: MouseEvent) {
    if (!resizeTarget.value) return
    const delta = event.clientX - resizeStart.value.x
    const nextWidth =
      resizeTarget.value === 'preview'
        ? resizeStart.value.width + delta
        : resizeStart.value.width - delta
    const minimum = resizeTarget.value === 'preview' ? minPreviewWidth : minDetailWidth
    const next = clamp(nextWidth, minimum, maxSideWidth.value)
    if (resizeTarget.value === 'preview') previewWidth.value = next
    else detailWidth.value = next
  }
  const startResize = (event: MouseEvent, target: ResizeTarget) => {
    event.preventDefault()
    event.stopPropagation()
    resizeTarget.value = target
    resizeStart.value = {
      x: event.clientX,
      width: target === 'preview' ? previewWidth.value : detailWidth.value,
    }
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResize)
  }

  watch(totalWidth, clampWidths)

  return {
    previewWidth,
    detailWidth,
    resizeTarget,
    previewStyle: computed(() => ({ width: `${previewWidth.value}px` })),
    detailStyle: computed(() => ({ width: `${detailWidth.value}px` })),
    load,
    save,
    startPreviewResize: (event: MouseEvent) => startResize(event, 'preview'),
    startDetailResize: (event: MouseEvent) => startResize(event, 'detail'),
    stopResize,
  }
}
