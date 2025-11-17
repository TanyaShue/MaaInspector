<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  data: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div class="process-node">
    <div class="node-header">
      <div class="node-icon"></div>
      <div class="node-title">{{ data.title || 'Process Node' }}</div>
    </div>
    <div class="node-body">
      <div v-if="!data.properties || Object.keys(data.properties).length === 0" class="no-properties">
        无属性
      </div>
      <div v-for="(value, key) in data.properties" :key="key" class="property">
        <span class="property-key">{{ key }}:</span>
        <span class="property-value">{{ value }}</span>
      </div>
    </div>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style>
.process-node {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  width: 200px;
  font-family: 'JetBrains Mono', monospace;
  color: #2c3e50;
  text-transform: none;
  font-size: 12px;
}

.node-header {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #f0f0f0;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  border-bottom: 1px solid #ddd;
}

.node-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #2563eb;
  margin-right: 10px;
}

.node-title {
  font-weight: bold;
}

.node-body {
  padding: 10px;
}

.no-properties {
  color: #999;
  text-align: center;
}

.property {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.property-key {
  font-weight: bold;
  margin-right: 5px;
}

.property-value {
  text-align: right;
}
</style>