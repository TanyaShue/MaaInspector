<script setup lang="ts">
import { computed, inject, ref, shallowRef, watch, type Ref } from 'vue'
import NodeDetails from './NodeDetails.vue'
import { NODE_CONFIG_MAP } from '@/utils/node-config'
import { useNodeDetailsController } from '@/composables/useNodeDetailsController'
import type { NodeDetailsTarget } from '@/composables/useNodeDetailsController'
import type { FlowBusinessData, FlowNode, FlowNodeMeta } from '@/utils/flowTypes'

const props = withDefaults(defineProps<{
  nodes: FlowNode[]
  nodeStructureVersion?: number
}>(), {
  nodeStructureVersion: 0,
})

const controller = useNodeDetailsController()
const currentFilename = inject<Ref<string>>('currentFilename', ref(''))
const pipelineVersion = inject<Ref<'V1' | 'V2'>>('pipelineVersion', ref('V1'))
const availableTypes = Object.keys(NODE_CONFIG_MAP).filter(type => type !== 'Unknown')
type ActiveFlowNode = FlowNode & { data: FlowNodeMeta }
interface NodeDetailsEntry {
  target: NodeDetailsTarget
  node: ActiveFlowNode
}

const nodeIndexes = shallowRef<Map<string, number>>(new Map())

const rebuildNodeIndexes = () => {
  nodeIndexes.value = new Map(props.nodes.map((node, index) => [node.id, index]))
}

const detailsEntries = computed<NodeDetailsEntry[]>(() => {
  if (!controller || controller.targets.value.length === 0) return []
  return controller.targets.value.flatMap(target => {
    const index = nodeIndexes.value.get(target.nodeId)
    const node = index === undefined ? undefined : props.nodes[index]
    return node?.data ? [{ target, node: node as ActiveFlowNode }] : []
  })
})

watch(() => props.nodeStructureVersion, () => {
  rebuildNodeIndexes()
  if (!controller) return
  const availableIds = new Set(nodeIndexes.value.keys())
  controller.targets.value
    .filter(target => !availableIds.has(target.nodeId))
    .forEach(target => controller.closeTarget(target.instanceId))
}, { flush: 'post', immediate: true })

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
