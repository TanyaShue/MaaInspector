import type { FlowNode, NodeStatus } from '@/utils/flowTypes'
import type { DebugStreamPayload } from '@/services/api'
import { debugApi } from '@/services/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isSaveCancelledError } from '@/composables/useSaveManager'

type DebugMode = 'standard' | 'recognition_only'

export interface DebugRunnerDeps {
  findNode: (id: string) => FlowNode | undefined
  nodes: { value: FlowNode[] }
  currentSource: { value: string }
  currentFilename: { value: string }
  isDirty: { value: boolean }
  onSaveNodes: (
    config: { source: string; filename: string },
    onSnapshotState?: () => void
  ) => Promise<void>
  onSnapshotState?: () => void
  setNodeStatus: (nodeId: string, status: NodeStatus) => void
}
export function useDebugRunner(deps: DebugRunnerDeps) {
  const {
    findNode,
    nodes,
    currentSource,
    currentFilename,
    isDirty,
    onSaveNodes,
    onSnapshotState,
    setNodeStatus,
  } = deps

  const handleDebugNode = async (nodeId: string, mode: DebugMode = 'standard') => {
    const node = findNode(nodeId)
    if (!node || !node.data) return

    if (isDirty.value) {
      try {
        await ElMessageBox.confirm(
          '当前资源文件有未保存的修改。调试需要先保存资源，是否保存并继续？',
          '保存后调试',
          {
            confirmButtonText: '保存并调试',
            cancelButtonText: '取消',
            type: 'warning',
          }
        )
        await onSaveNodes(
          { source: currentSource.value, filename: currentFilename.value },
          onSnapshotState
        )
      } catch (error) {
        if (!isSaveCancelledError(error) && error !== 'cancel' && error !== 'close') {
          console.error('Save before debug failed:', error)
          ElMessage.error('保存失败，未开始调试')
        }
        return
      }
    }

    node.data._result = null

    let matchedTaskId: string | number | null = null
    let resolved = false
    let streamCleanup: (() => void) | null = null

    const taskComplete = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          if (streamCleanup) streamCleanup()
          reject(new Error('Task timeout after 30s'))
        }
      }, 30000)

      streamCleanup = debugApi.subscribeNodeStream((data: unknown) => {
        const payload = data as DebugStreamPayload
        if (payload?.type === 'node_recognition' && payload?.name === nodeId) {
          if (matchedTaskId === null && payload.task_id != null) {
            matchedTaskId = payload.task_id
          }

          if (matchedTaskId !== null && payload.task_id !== matchedTaskId) {
            return
          }

          if (payload?.status === 'succeeded' || payload?.status === 'failed') {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              if (streamCleanup) streamCleanup()
              resolve()
            }
          }
        }
      })
    })

    try {
      await debugApi.runNode({
        node: node.data.data,
        debug_mode: mode,
        context: { source: currentSource.value, filename: currentFilename.value },
      })

      await taskComplete
    } catch (error: unknown) {
      const err = error as { message?: string }
      console.error('Debug failed:', error)
      node.data._result = { success: false, error: err?.message || 'Network/Server Error' }
    } finally {
      if (streamCleanup && !resolved) {
        ;(streamCleanup as () => void)()
      }
      nodes.value = [...nodes.value]
      onSnapshotState?.()
    }
  }

  const handleUpdateNodeStatus = ({ nodeId, status }: { nodeId: string; status: NodeStatus }) => {
    if (!nodeId || status === undefined) return
    setNodeStatus(nodeId, status)
    onSnapshotState?.()
  }

  const handleDebugNodeFromPanel = (nodeId: string) => handleDebugNode(nodeId, 'standard')

  return {
    handleDebugNode,
    handleUpdateNodeStatus,
    handleDebugNodeFromPanel,
  }
}
