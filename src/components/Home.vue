<script setup>
import { ref, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import dagre from '@dagrejs/dagre'

import { initialNodes, initialEdges } from './flow-example/initial-elements.js'
import { useRunProcess } from './flow-example//useRunProcess.js'
import { useLayout } from './flow-example//useLayout.js'
import { useContextMenu } from './flow-example//useContextMenu.js'

import ProcessNode from './flow-example//ProcessNode.vue'
// import AnimationEdge from './flow-example//AnimationEdge.vue'
import ContextMenu from './flow-example//ContextMenu.vue'
import Icon from './flow-example//Icon.vue'

const nodes = ref(initialNodes)
const edges = ref(initialEdges)

const { onNodesInitialized } = useVueFlow()

const { graph, layout } = useLayout()
const cancelOnError = ref(true)
const { run, stop, reset, isRunning } = useRunProcess({ graph, cancelOnError })

const { menuShow, menuTop, menuLeft, addNode, deleteNode } = useContextMenu()

function onLayout(direction) {
  nodes.value = layout(nodes.value, edges.value, direction)
}

onNodesInitialized(() => {
  onLayout('TB')
})
</script>

<template>
  <VueFlow
    v-model:nodes="nodes"
    v-model:edges="edges"
    class="layout-flow"
    :default-zoom="1.2"
    fit-view-on-init
  >
    <template #node-process="props">
      <ProcessNode :data="props.data" />
    </template>
    <template #edge-animation="props">
      <AnimationEdge
        :id="props.id"
        :source-x="props.sourceX"
        :source-y="props.sourceY"
        :target-x="props.targetX"
        :target-y="props.targetY"
        :source-position="props.sourcePosition"
        :target-position="props.targetPosition"
      />
    </template>

    <div class="process-panel">
      <button v-if="!isRunning" title="Run" @click="run(nodes)">
        <Icon name="play" />
      </button>

      <button v-else class="stop-btn" title="Stop" @click="stop">
        <div class="spinner"></div>
        <Icon name="stop" />
      </button>

      <button title="Reset" @click="reset(nodes)">
        <Icon name="reset" />
      </button>

      <div class="checkbox-panel">
        <label for="cancel-on-error">Cancel on error</label>
        <input id="cancel-on-error" v-model="cancelOnError" type="checkbox" />
      </div>

      <div class="layout-panel">
        <button @click="onLayout('TB')">vertical layout</button>
        <button @click="onLayout('LR')">horizontal layout</button>
      </div>
    </div>

    <ContextMenu
      :show="menuShow"
      :top="menuTop"
      :left="menuLeft"
      @add-node="addNode"
      @delete-node="deleteNode"
    />

    <MiniMap />
    <Controls />
  </VueFlow>
</template>