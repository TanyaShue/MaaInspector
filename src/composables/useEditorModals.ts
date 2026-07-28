import { ref } from 'vue'
import type { LayoutAlgorithm } from '@/utils/flowTypes'
import type { ResourceNodeLocation } from '@/utils/resourceNode'

export interface SubCanvasState {
  visible: boolean
  nodeId: string
  algorithm?: LayoutAlgorithm
  source?: string
  filename?: string
  external?: boolean
}

/**
 * Manages modal and overlay states for the flow editor.
 * Extracted from useFlowEditorVm to reduce its complexity.
 */
export function useEditorModals() {
  const showClearCanvasModal = ref(false)
  const subCanvas = ref<SubCanvasState>({
    visible: false,
    nodeId: '',
  })

  const openClearCanvasModal = () => {
    showClearCanvasModal.value = true
  }

  const closeClearCanvasModal = () => {
    showClearCanvasModal.value = false
  }

  const openSubCanvas = (nodeId: string, algorithm?: LayoutAlgorithm) => {
    subCanvas.value = { visible: true, nodeId, algorithm }
  }

  const openResourceSubCanvas = (location: ResourceNodeLocation) => {
    subCanvas.value = {
      visible: true,
      nodeId: location.nodeId,
      source: location.source,
      filename: location.filename,
      external: true,
    }
  }

  const closeSubCanvas = () => {
    subCanvas.value = { visible: false, nodeId: '' }
  }

  return {
    showClearCanvasModal,
    subCanvas,
    openClearCanvasModal,
    closeClearCanvasModal,
    openSubCanvas,
    openResourceSubCanvas,
    closeSubCanvas,
  }
}
