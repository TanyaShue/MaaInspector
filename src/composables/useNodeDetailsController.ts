import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { NodeUpdatePayload } from '@/utils/flowTypes'

export interface NodeDetailsTarget {
  nodeId: string
  updateNode: (payload: NodeUpdatePayload) => void
}

export interface NodeDetailsController {
  activeTarget: Ref<NodeDetailsTarget | null>
  open: (target: NodeDetailsTarget) => void
  toggle: (target: NodeDetailsTarget) => void
  close: () => void
}

export const nodeDetailsControllerKey: InjectionKey<NodeDetailsController> = Symbol('nodeDetailsController')

export function createNodeDetailsController(): NodeDetailsController {
  const activeTarget = ref<NodeDetailsTarget | null>(null)

  const open = (target: NodeDetailsTarget) => {
    activeTarget.value = target
  }

  const close = () => {
    activeTarget.value = null
  }

  const toggle = (target: NodeDetailsTarget) => {
    if (activeTarget.value?.nodeId === target.nodeId) {
      close()
      return
    }
    open(target)
  }

  return { activeTarget, open, toggle, close }
}

export function provideNodeDetailsController(controller = createNodeDetailsController()): NodeDetailsController {
  provide(nodeDetailsControllerKey, controller)
  return controller
}

export function useNodeDetailsController(): NodeDetailsController | undefined {
  return inject(nodeDetailsControllerKey, undefined)
}
