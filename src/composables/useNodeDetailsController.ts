import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { NodeUpdatePayload } from '@/utils/flowTypes'

export interface NodeDetailsTargetInput {
  nodeId: string
  updateNode: (payload: NodeUpdatePayload) => void
  anchorElement: HTMLElement
}

export interface NodeDetailsTarget extends NodeDetailsTargetInput {
  instanceId: number
}

export interface NodeDetailsController {
  targets: Ref<NodeDetailsTarget[]>
  activeTarget: Ref<NodeDetailsTarget | null>
  open: (target: NodeDetailsTargetInput) => void
  toggle: (target: NodeDetailsTargetInput) => void
  closeTarget: (instanceId: number) => void
  updateTarget: (instanceId: number, patch: Partial<NodeDetailsTargetInput>) => void
  close: () => void
}

export const nodeDetailsControllerKey: InjectionKey<NodeDetailsController> = Symbol('nodeDetailsController')
export const MAX_NODE_DETAILS_PANELS = 5

export function createNodeDetailsController(): NodeDetailsController {
  const targets = ref<NodeDetailsTarget[]>([])
  const activeTarget = computed(() => targets.value[targets.value.length - 1] ?? null)
  let nextInstanceId = 1

  const findTargetIndex = (target: NodeDetailsTargetInput) =>
    targets.value.findIndex(candidate => (
      candidate.nodeId === target.nodeId &&
      candidate.anchorElement === target.anchorElement
    ))

  const open = (target: NodeDetailsTargetInput) => {
    const existingIndex = findTargetIndex(target)
    if (existingIndex >= 0) {
      const existing = targets.value[existingIndex]
      targets.value = [
        ...targets.value.slice(0, existingIndex),
        ...targets.value.slice(existingIndex + 1),
        { ...existing, ...target }
      ]
      return
    }

    targets.value = [
      ...targets.value,
      { ...target, instanceId: nextInstanceId++ }
    ].slice(-MAX_NODE_DETAILS_PANELS)
  }

  const close = () => {
    targets.value = []
  }

  const closeTarget = (instanceId: number) => {
    targets.value = targets.value.filter(target => target.instanceId !== instanceId)
  }

  const updateTarget = (instanceId: number, patch: Partial<NodeDetailsTargetInput>) => {
    targets.value = targets.value.map(target => (
      target.instanceId === instanceId ? { ...target, ...patch } : target
    ))
  }

  const toggle = (target: NodeDetailsTargetInput) => {
    const existingIndex = findTargetIndex(target)
    if (existingIndex >= 0) {
      closeTarget(targets.value[existingIndex].instanceId)
      return
    }
    open(target)
  }

  return { targets, activeTarget, open, toggle, closeTarget, updateTarget, close }
}

export function provideNodeDetailsController(controller = createNodeDetailsController()): NodeDetailsController {
  provide(nodeDetailsControllerKey, controller)
  return controller
}

export function useNodeDetailsController(): NodeDetailsController | undefined {
  return inject(nodeDetailsControllerKey, undefined)
}
