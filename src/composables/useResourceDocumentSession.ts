import { ref } from 'vue'
import { useFlowGraph } from '@/composables/useFlowGraph'
import { loadResourceDocument } from '@/services/resourceDocument'

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

  return {
    ...graph,
    loading,
    loadError,
    fileVersion,
    load,
    invalidate,
  }
}
