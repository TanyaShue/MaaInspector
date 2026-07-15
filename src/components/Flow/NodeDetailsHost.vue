<script setup lang="ts">
import { computed, inject, ref, watch, type Ref } from 'vue'
import NodeDetails from './NodeDetails.vue'
import { NODE_CONFIG_MAP } from '@/utils/node-config'
import { useNodeDetailsController } from '@/composables/useNodeDetailsController'
import type { NodeDetailsTarget } from '@/composables/useNodeDetailsController'
import type { FlowBusinessData, FlowNode, FlowNodeMeta } from '@/utils/flowTypes'

const props = defineProps<{
  nodes: FlowNode[]
}>()

const controller = useNodeDetailsController()
const currentFilename = inject<Ref<string>>('currentFilename', ref(''))
const pipelineVersion = inject<Ref<'V1' | 'V2'>>('pipelineVersion', ref('V1'))
const availableTypes = Object.keys(NODE_CONFIG_MAP).filter(type => type !== 'Unknown')
type ActiveFlowNode = FlowNode & { data: FlowNodeMeta }
interface NodeDetailsEntry {
  target: NodeDetailsTarget
  node: ActiveFlowNode
}

const detailsEntries = computed<NodeDetailsEntry[]>(() => {
  if (!controller) return []
  const nodesById = new Map(props.nodes.map(node => [node.id, node]))
  return controller.targets.value.flatMap(target => {
    const node = nodesById.get(target.nodeId)
    return node?.data ? [{ target, node: node as ActiveFlowNode }] : []
  })
})

watch(() => props.nodes.map(node => node.id), (nodeIds) => {
  if (!controller) return
  const availableIds = new Set(nodeIds)
  controller.targets.value
    .filter(target => !availableIds.has(target.nodeId))
    .forEach(target => controller.closeTarget(target.instanceId))
}, { flush: 'post' })

const handleUpdateId = (
  { target, node }: NodeDetailsEntry,
  { oldId, newId }: { oldId?: string; newId: string }
) => {
  target.updateNode({ oldId: oldId ?? node.id, newId, newType: node.data.type })
  controller?.updateTarget(target.instanceId, { nodeId: newId })
}

const handleUpdateType = ({ target, node }: NodeDetailsEntry, newType: string) => {
  target.updateNode({ oldId: node.id, newId: node.id, newType })
}

const handleUpdateData = ({ target, node }: NodeDetailsEntry, newData: FlowBusinessData) => {
  target.updateNode({
    oldId: node.id,
    newId: node.id,
    newType: newData.recognition || node.data.type,
    newData
  })
}
</script>

<template>
  <Teleport
    v-for="entry in detailsEntries"
    :key="entry.target.instanceId"
    :to="entry.target.anchorElement"
  >
    <NodeDetails
      :key="entry.target.instanceId"
      visible
      placement="node"
      :node-id="entry.node.id"
      :node-data="entry.node.data"
      :node-type="entry.node.data.type"
      :available-types="availableTypes"
      :type-config="NODE_CONFIG_MAP"
      :current-filename="currentFilename"
      :pipeline-version="pipelineVersion"
      @close="controller?.closeTarget(entry.target.instanceId)"
      @update-id="handleUpdateId(entry, $event)"
      @update-type="handleUpdateType(entry, $event)"
      @update-data="handleUpdateData(entry, $event)"
    />
  </Teleport>
</template>
