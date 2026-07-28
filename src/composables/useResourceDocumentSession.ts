import { ref } from 'vue'
import { useFlowGraph } from '@/composables/useFlowGraph'
import { loadResourceDocument } from '@/services/resourceDocument'
import { useSaveManager } from '@/composables/useSaveManager'
import { notifyResourceDocumentSaved } from '@/services/resourceDocumentEvents'
import type { TemplateImage } from '@/utils/flowTypes'

export interface ResourceDocumentTarget {
  source: string
  filename: string
  rootNodeId?: string
}

export function useResourceDocumentSession(flowId: string) {
  const graph = useFlowGraph(flowId)
  const loading = ref(false)
  const loadError = ref('')
  const fileVersion = ref<'V1' | 'V2' | ''>('')
  const saveManager = useSaveManager({
    currentEdgeType: graph.currentEdgeType,
    currentSpacing: graph.currentSpacing,
    currentAlgorithm: graph.currentAlgorithm,
    currentDirection: graph.currentDirection,
    currentFilename: graph.currentFilename,
    currentSource: graph.currentSource,
    isDirty: graph.isDirty,
    exportState: graph.exportState,
    restoreState: graph.restoreState,
    getNodesData: graph.getNodesData,
    getImageData: graph.getImageData,
    clearTempImageData: graph.clearTempImageData,
    clearDirty: graph.clearDirty,
    imageManager: graph.imageManager as {
      setNodeImages: (nodeId: string, images: TemplateImage[]) => void
      replaceLoadedImages: (imageMap: Record<string, TemplateImage[] | unknown>) => void
    },
    tabId: flowId,
  })
  let loadRequest = 0

  const load = async (target: ResourceDocumentTarget) => {
    const request = ++loadRequest
    loading.value = true
    loadError.value = ''
    try {
      const document = await loadResourceDocument(target.source, target.filename)
      if (request !== loadRequest) return false
      if (target.rootNodeId && !document.nodes[target.rootNodeId]) {
        loadError.value = `文件中不存在节点 ${target.rootNodeId}`
        return false
      }

      await graph.loadNodes(document, { applyInitialLayout: false })
      if (request !== loadRequest) return false
      graph.imageManager.replaceLoadedImages(document.images)
      fileVersion.value = document.fileVersion
      saveManager.loadedFileVersion.value = document.fileVersion
      return true
    } catch (error) {
      if (request === loadRequest) {
        loadError.value = `加载节点失败: ${error instanceof Error ? error.message : String(error)}`
      }
      return false
    } finally {
      if (request === loadRequest) loading.value = false
    }
  }

  const invalidate = () => {
    loadRequest++
  }

  const save = async () => {
    const source = graph.currentSource.value
    const filename = graph.currentFilename.value
    if (!source || !filename) return false
    await saveManager.handleSaveNodes({ source, filename })
    if (saveManager.isDirtyCombined.value) return false
    notifyResourceDocumentSaved(source, filename, flowId)
    return true
  }

  return {
    ...graph,
    loading,
    loadError,
    fileVersion,
    saveManager,
    load,
    save,
    invalidate,
  }
}
