import { nextTick, type Ref } from 'vue'
import { waitForFrame } from '@/utils/nodeHelpers'

export interface ViewportSyncDeps {
  onlyRenderVisibleElements: Ref<boolean>
  updateNodeInternals?: (nodeIds?: string[]) => void
}

export function useViewportSync(deps: ViewportSyncDeps) {
  const refreshNodeInternals = async (nodeIds?: string[]) => {
    await nextTick()
    deps.updateNodeInternals?.(nodeIds)
    await waitForFrame()
  }

  const withPreservedVisibility = async <T>(task: () => Promise<T>, nodeIds?: string[]) => {
    const renderVisibleOnly = deps.onlyRenderVisibleElements.value
    deps.onlyRenderVisibleElements.value = false
    await refreshNodeInternals(nodeIds)
    try {
      return await task()
    } finally {
      deps.onlyRenderVisibleElements.value = renderVisibleOnly
      await refreshNodeInternals(nodeIds)
    }
  }

  return {
    refreshNodeInternals,
    withPreservedVisibility,
  }
}
