<script setup>
import { ref, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { initialNodes, initialEdges } from './flow-example/initial-elements'
import ProcessNode from './flow-example/ProcessNode.vue'
import AnimationEdge from './flow-example/AnimationEdge.vue'
import { useLayout } from './flow-example/useLayout'
import { useRunProcess } from './flow-example/useRunProcess'
import ContextMenu from './flow-example/ContextMenu.vue'

const { onPaneContextMenu, onNodeContextMenu, addNodes, removeNodes, screenToFlowCoordinate, getNodes, getEdges } = useVueFlow()

const nodes = ref(initialNodes)
const edges = ref(initialEdges)

const { layout, graph } = useLayout()
const { run, stop, reset, isRunning } = useRunProcess({ graph })

const cancelOnError = ref(true)

function updateLayout() {
  nodes.value = layout(nodes.value, edges.value, 'LR')
}

watch(
  () => [getNodes.value, getEdges.value],
  () => {
    updateLayout()
  },
  { deep: true },
)

const menuShow = ref(false)
const menuTop = ref(0)
const menuLeft = ref(0)
let menuNode = null

function showMenu(event, node) {
  event.preventDefault()
  menuShow.value = true
  menuTop.value = event.clientY
  menuLeft.value = event.clientX
  menuNode = node
}

onPaneContextMenu((event) => {
  showMenu(event)
})

onNodeContextMenu(({ event, node }) => {
  showMenu(event, node)
})

function addNode() {
  const position = screenToFlowCoordinate({
    x: menuLeft.value,
    y: menuTop.value,
  })

  const newNode = {
    id: `random_node-${Math.random()}`,
    type: 'process',
    position,
    data: { status: null, title: '新节点', properties: { prop1: 'value1', prop2: 'value2' } },
  }

  addNodes([newNode])
  menuShow.value = false
}

function deleteNode() {
  if (menuNode) {
    removeNodes([menuNode.id])
  }
  menuShow.value = false
}
</script>

<template>
  <VueFlow v-model:nodes="nodes" v-model:edges="edges" class="layout-flow" fit-view-on-init>
    <template #node-process="props">
      <ProcessNode :data="props.data" />
    </template>
    <template #edge-animation="props">
      <AnimationEdge :id="props.id" :source="props.source" :target="props.target" />
    </template>

    <Background pattern-color="#aaa" gap="8" />

    <MiniMap />

    <Controls />

    <div class="process-panel">
      <button v-if="!isRunning" title="Run" @click="run(nodes)">▶️</button>
      <button v-else class="stop-btn" title="Stop" @click="stop">
        <div class="spinner" />
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="currentColor" d="M18 18H6V6h12v12zm-2-2V8H8v8h8z" />
        </svg>
      </button>
      <button title="Reset" @click="reset(nodes)">🔄</button>
      <div class="checkbox-panel">
        <label for="cancel-on-error">Cancel on error</label>
        <input id="cancel-on-error" v-model="cancelOnError" type="checkbox" />
      </div>
    </div>
    <ContextMenu
      :show="menuShow"
      :top="menuTop"
      :left="menuLeft"
      @add="addNode"
      @delete="deleteNode"
      @update:show="val => menuShow = val"
    />
  </VueFlow>
</template>