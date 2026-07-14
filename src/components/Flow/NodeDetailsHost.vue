<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue'
import NodeDetails from './NodeDetails.vue'
import { NODE_CONFIG_MAP } from '@/utils/node-config'
import { useNodeDetailsController } from '@/composables/useNodeDetailsController'
import type { FlowBusinessData, FlowNode, FlowNodeMeta } from '@/utils/flowTypes'

const props = defineProps<{
  nodes: FlowNode[]
}>()

const controller = useNodeDetailsController()
const currentFilename = inject<Ref<string>>('currentFilename', ref(''))
const pipelineVersion = inject<Ref<'V1' | 'V2'>>('pipelineVersion', ref('V1'))
const availableTypes = Object.keys(NODE_CONFIG_MAP).filter(type => type !== 'Unknown')
type ActiveFlowNode = FlowNode & { data: FlowNodeMeta }
const activeNode = computed<ActiveFlowNode | undefined>(() => {
  const nodeId = controller?.activeTarget.value?.nodeId
  const node = nodeId ? props.nodes.find(candidate => candidate.id === nodeId) : undefined
  return node?.data ? node as ActiveFlowNode : undefined
})

watch(activeNode, (node) => {
  if (controller?.activeTarget.value && !node) controller.close()
})

const handleUpdateId = ({ oldId, newId }: { oldId?: string; newId: string }) => {
  const target = controller?.activeTarget.value
  const node = activeNode.value
  if (!target || !node) return
  target.updateNode({ oldId: oldId ?? node.id, newId, newType: node.data.type })
  controller.open({ ...target, nodeId: newId })
}

const handleUpdateType = (newType: string) => {
  const target = controller?.activeTarget.value
  const node = activeNode.value
  if (!target || !node) return
  target.updateNode({ oldId: node.id, newId: node.id, newType })
}

const handleUpdateData = (newData: FlowBusinessData) => {
  const target = controller?.activeTarget.value
  const node = activeNode.value
  if (!target || !node) return
  target.updateNode({
    oldId: node.id,
    newId: node.id,
    newType: newData.recognition || node.data.type,
    newData
  })
}
</script>

<template>
  <NodeDetails
    v-if="activeNode"
    :key="activeNode.id"
    visible
    placement="canvas"
    :node-id="activeNode.id"
    :node-data="activeNode.data"
    :node-type="activeNode.data.type"
    :available-types="availableTypes"
    :type-config="NODE_CONFIG_MAP"
    :current-filename="currentFilename"
    :pipeline-version="pipelineVersion"
    @close="controller?.close()"
    @update-id="handleUpdateId"
    @update-type="handleUpdateType"
    @update-data="handleUpdateData"
  />
</template>
