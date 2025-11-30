<script setup>
import { ref, provide } from 'vue'
import { VueFlow, useVueFlow, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import ContextMenu from './Flow/ContextMenu.vue'
import NodeEditorModal from './Flow/NodeEditorModal.vue'
import InfoPanel from './Flow/InfoPanel.vue'
import { useFlowGraph } from '../utils/useFlowGraph.js'

// --- 引入逻辑 Hook ---
const {
  nodes, edges, nodeTypes, currentEdgeType, currentSpacing,
  onValidateConnection, handleConnect, handleEdgesChange, handleNodeUpdate,
  loadNodes, createNodeObject, applyLayout
} = useFlowGraph()

const { fitView, removeEdges, findNode, screenToFlowCoordinate } = useVueFlow()

// --- 提供更新方法给子组件 (CustomNode) ---
provide('updateNode', handleNodeUpdate)

// --- 菜单与弹窗状态 ---
const menu = ref({ visible: false, x: 0, y: 0, type: null, data: null, flowPos: { x: 0, y: 0 } })
const editor = ref({ visible: false, nodeId: null, nodeData: null })

const closeMenu = () => { menu.value.visible = false }
const getEvent = (params) => params.event || params

const onPaneContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'pane', data: null, flowPos }
}

const onNodeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'node', data: params.node }
}

const onEdgeContextMenu = (params) => {
  const event = getEvent(params)
  event.preventDefault()
  menu.value = { visible: true, x: event.clientX, y: event.clientY, type: 'edge', data: params.edge }
}

// --- 菜单动作处理 ---
const handleMenuAction = ({ action, type, data, payload }) => {
  closeMenu()

  switch (action) {
    case 'add':
      const newId = `N-${Date.now()}`
      nodes.value.push(createNodeObject(newId, { id: newId, recognition: payload || 'DirectHit' }))
      if (menu.value.flowPos) {
        nodes.value[nodes.value.length - 1].position = { ...menu.value.flowPos }
      }
      break

    case 'debug':
      if (type === 'node') {
        const node = findNode(data.id)
        if (node) {
          console.log(`[Debug] Running node: ${data.id}`, node.data.data)
          node.data.status = 'running'
          setTimeout(() => { node.data.status = 'success' }, 1500)
        }
      }
      break

    case 'edit':
      editor.value = { visible: true, nodeId: data.id, nodeData: JSON.parse(JSON.stringify(data.data.data)) }
      break

    case 'duplicate':
      if (data) {
        const copyId = `N-${Date.now()}`
        const copyData = JSON.parse(JSON.stringify(data.data.data))
        copyData.id = copyId
        const copyNode = createNodeObject(copyId, copyData)
        copyNode.position = { x: data.position.x + 50, y: data.position.y + 50 }
        nodes.value.push(copyNode)
      }
      break

    case 'delete':
      if (type === 'node') {
        removeEdges(edges.value.filter(e => e.source === data.id || e.target === data.id))
        nodes.value = nodes.value.filter(n => n.id !== data.id)
      } else if (type === 'edge') {
        removeEdges([data.id])
      }
      break

    case 'layout':
      applyLayout(currentSpacing.value)
      break

    case 'changeSpacing':
      if (payload) {
        currentSpacing.value = payload
        applyLayout(payload)
      }
      break

    case 'changeEdgeType':
      if (payload) {
        currentEdgeType.value = payload
        edges.value = edges.value.map(edge => ({ ...edge, type: payload }))
      }
      break

    case 'reset':
      fitView({ padding: 0.2, duration: 500 })
      break

    case 'clear':
      nodes.value = []; edges.value = [];
      break
  }
}

const handleEditorSave = (newBusinessData) => {
  const targetNode = findNode(editor.value.nodeId)
  if (targetNode) {
    targetNode.data.data = { ...newBusinessData, id: targetNode.id }
    if (newBusinessData.recognition) targetNode.data.type = newBusinessData.recognition
    nodes.value = [...nodes.value]
  }
  editor.value.visible = false
}
</script>

<template>
  <div class="w-full h-full min-h-[500px] bg-slate-50 relative">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-zoom="1"
      :min-zoom="0.1"
      :max-zoom="4"
      fit-view-on-init
      :is-valid-connection="onValidateConnection"
      @connect="handleConnect"
      @edges-change="handleEdgesChange"
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      @edge-context-menu="onEdgeContextMenu"
      @pane-click="closeMenu"
      @node-click="closeMenu"
      @edge-click="closeMenu"
      @move-start="closeMenu"
    >
      <Background pattern-color="#cbd5e1" :gap="20" />
      <Controls />

      <Panel position="top-right" class="m-4 pointer-events-none">
        <InfoPanel
          :node-count="nodes.length"
          :edge-count="edges.length"
          @load-nodes="loadNodes"
        />
      </Panel>

      <ContextMenu
        v-if="menu.visible"
        v-bind="menu"
        :currentEdgeType="currentEdgeType"
        :currentSpacing="currentSpacing"
        @close="closeMenu"
        @action="handleMenuAction"
      />
    </VueFlow>
    <NodeEditorModal :visible="editor.visible" :nodeData="editor.nodeData" @close="editor.visible = false" @save="handleEditorSave" />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
.vue-flow__panel { pointer-events: none; }
</style>