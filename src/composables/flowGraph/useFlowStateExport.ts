import { computed, ref } from 'vue'
import { perfLog, perfNow } from '@/utils/perfTrace'
import { deepClone } from '@/utils/nodeHelpers'
import type { Ref } from 'vue'
import type { FlowNode, FlowEdge, FlowBusinessData } from '@/utils/flowTypes'
import type { EdgeType } from '@/utils/flowOptions'
import type { SpacingKey, LayoutAlgorithm } from '@/utils/flowTypes'
import type { useImageManager } from '@/composables/useImageManager'

export interface FlowGraphExportState {
  nodes: FlowNode[]
  edges: FlowEdge[]
  currentEdgeType: EdgeType
  currentSpacing: SpacingKey
  currentAlgorithm: LayoutAlgorithm
  currentDirection: 'TB' | 'LR' | 'RL' | 'BT'
  currentFilename: string
  currentSource: string
  originalDataSnapshot: string
  dataSnapshot: string
  dataRevision?: number
  cleanRevision?: number
  selectedNodeId: string | null
  imageState: ReturnType<ReturnType<typeof useImageManager>['exportState']>
}

export const useFlowStateExport = (
  nodes: Ref<FlowNode[]>,
  edges: Ref<FlowEdge[]>,
  currentEdgeType: Ref<EdgeType>,
  currentSpacing: Ref<SpacingKey>,
  currentAlgorithm: Ref<LayoutAlgorithm>,
  currentDirection: Ref<'TB' | 'LR' | 'RL' | 'BT'>,
  currentFilename: Ref<string>,
  currentSource: Ref<string>,
  originalDataSnapshot: Ref<string>,
  dataSnapshot: Ref<string>,
  selectedNodeId: Ref<string | null>,
  imageManager: ReturnType<typeof useImageManager>,
  getNodesData: () => Record<string, FlowBusinessData>
) => {
  const dataRevision = ref(0)
  const cleanRevision = ref(0)

  const isDirty = computed(() => {
    if (!originalDataSnapshot.value) return false
    return dataRevision.value !== cleanRevision.value
  })

  const recalcDataSnapshot = () => {
    const start = perfNow()
    dataSnapshot.value = JSON.stringify(getNodesData())
    perfLog('useFlowGraph.recalcDataSnapshot', start, { length: dataSnapshot.value.length })
    return dataSnapshot.value
  }

  const exportState = (): FlowGraphExportState => {
    const start = perfNow()
    const state: FlowGraphExportState = {
      nodes: deepClone(nodes.value),
      edges: deepClone(edges.value),
      currentEdgeType: currentEdgeType.value,
      currentSpacing: currentSpacing.value,
      currentAlgorithm: currentAlgorithm.value,
      currentDirection: currentDirection.value,
      currentFilename: currentFilename.value,
      currentSource: currentSource.value,
      originalDataSnapshot: originalDataSnapshot.value,
      dataSnapshot: dataSnapshot.value,
      dataRevision: dataRevision.value,
      cleanRevision: cleanRevision.value,
      selectedNodeId: selectedNodeId.value,
      imageState: imageManager.exportState(),
    }
    perfLog('useFlowGraph.exportState', start, {
      filename: currentFilename.value,
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length,
    })
    return state
  }

  const restoreState = (snapshot?: FlowGraphExportState) => {
    if (!snapshot) return
    const start = perfNow()
    nodes.value = deepClone(snapshot.nodes || [])
    edges.value = deepClone(snapshot.edges || [])
    currentEdgeType.value = snapshot.currentEdgeType || 'smoothstep'
    currentSpacing.value = snapshot.currentSpacing || 'normal'
    currentAlgorithm.value = snapshot.currentAlgorithm || 'layered'
    currentDirection.value = snapshot.currentDirection || 'TB'
    currentFilename.value = snapshot.currentFilename || ''
    currentSource.value = snapshot.currentSource || ''
    originalDataSnapshot.value = snapshot.originalDataSnapshot || ''
    dataSnapshot.value = snapshot.dataSnapshot || ''
    dataRevision.value = snapshot.dataRevision ?? (dataSnapshot.value === originalDataSnapshot.value ? 0 : 1)
    cleanRevision.value = snapshot.cleanRevision ?? 0
    selectedNodeId.value = snapshot.selectedNodeId || null
    imageManager.restoreState(snapshot.imageState)

    perfLog('useFlowGraph.restoreState', start, {
      filename: currentFilename.value,
      nodeCount: nodes.value.length,
      edgeCount: edges.value.length,
    })
  }

  const markDataChanged = () => {
    dataRevision.value++
  }

  const clearDirty = () => {
    recalcDataSnapshot()
    originalDataSnapshot.value = dataSnapshot.value
    cleanRevision.value = dataRevision.value
  }

  return {
    isDirty,
    recalcDataSnapshot,
    exportState,
    restoreState,
    markDataChanged,
    clearDirty,
  }
}
