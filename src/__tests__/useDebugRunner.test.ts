import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { debugApi } from '@/services/api'
import { useDebugRunner } from '@/composables/useDebugRunner'
import type { FlowNode } from '@/utils/flowTypes'

let streamCallback: ((data: unknown) => void) | null = null

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

vi.mock('@/services/api', () => ({
  debugApi: {
    runNode: vi.fn(),
    subscribeNodeStream: vi.fn((callback: (data: unknown) => void) => {
      streamCallback = callback
      return () => {}
    }),
  },
}))

const node: FlowNode = {
  id: 'Start',
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    id: 'Start',
    type: 'DirectHit',
    data: { id: 'Start', recognition: 'DirectHit' },
  },
}

const createRunner = (dirty: boolean) => {
  const onSaveNodes = vi.fn().mockResolvedValue(undefined)
  const runner = useDebugRunner({
    findNode: () => node,
    nodes: ref([node]),
    currentSource: ref('D:/maa'),
    currentFilename: ref('pipeline.json'),
    isDirty: ref(dirty),
    onSaveNodes,
    setNodeStatus: vi.fn(),
  })
  return { runner, onSaveNodes }
}

describe('useDebugRunner save guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    streamCallback = null
    vi.mocked(debugApi.runNode).mockImplementation(async () => {
      streamCallback?.({
        type: 'node_recognition',
        name: 'Start',
        task_id: 1,
        status: 'succeeded',
      })
      return { success: true }
    })
  })

  it('asks to save a dirty resource and waits for the save before debugging', async () => {
    let finishSave: (() => void) | undefined
    vi.mocked(ElMessageBox.confirm).mockResolvedValue(undefined as never)
    const { runner, onSaveNodes } = createRunner(true)
    onSaveNodes.mockImplementation(() => new Promise<void>(resolve => { finishSave = resolve }))

    const debugging = runner.handleDebugNode('Start')
    await vi.waitFor(() => expect(onSaveNodes).toHaveBeenCalledOnce())
    expect(debugApi.runNode).not.toHaveBeenCalled()

    finishSave?.()
    await vi.waitFor(() => expect(debugApi.runNode).toHaveBeenCalledOnce())
    await debugging
  })

  it('does not save an unchanged resource before debugging', async () => {
    const { runner, onSaveNodes } = createRunner(false)

    await runner.handleDebugNode('Start')

    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(onSaveNodes).not.toHaveBeenCalled()
  })

  it('does not start debugging when save confirmation is cancelled', async () => {
    vi.mocked(ElMessageBox.confirm).mockRejectedValue('cancel')
    const { runner, onSaveNodes } = createRunner(true)

    await runner.handleDebugNode('Start')

    expect(onSaveNodes).not.toHaveBeenCalled()
    expect(debugApi.runNode).not.toHaveBeenCalled()
  })

  it.each(['direct', 'recognition_only', 'single_node'] as const)(
    'passes the %s mode to the backend',
    async mode => {
      const { runner } = createRunner(false)

      await runner.handleDebugNode('Start', mode)

      expect(debugApi.runNode).toHaveBeenCalledWith(expect.objectContaining({
        debug_mode: mode,
      }))
    }
  )
})
