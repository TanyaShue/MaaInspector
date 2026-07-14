import { ref } from 'vue'
import type { LayoutAlgorithm } from '@/utils/flowTypes'

export interface SubCanvasState {
  visible: boolean
  nodeId: string
  algorithm?: LayoutAlgorithm
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

  const closeSubCanvas = () => {
    subCanvas.value = { visible: false, nodeId: '' }
  }

  return {
    showClearCanvasModal,
    subCanvas,
    openClearCanvasModal,
    closeClearCanvasModal,
    openSubCanvas,
    closeSubCanvas,
  }
}
