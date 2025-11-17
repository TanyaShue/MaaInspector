<script setup>
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const statusClass = computed(() => (props.data.status ? `status-${props.data.status}` : ''))
const hasProperties = computed(() => Object.keys(props.data.properties || {}).length > 0)
</script>

<template>
  <div :class="statusClass" class="process-node">
    <div class="title">{{ data.title || 'Process Node' }}</div>
    <div v-if="hasProperties" class="properties">
      <div v-for="(value, key) in data.properties" :key="key" class="property">
        <span class="key">{{ key }}:</span>
        <span class="value">{{ value }}</span>
      </div>
    </div>
    <div v-else class="no-properties">No properties</div>
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.process-node {
  background-color: #4a5568;
  border-radius: 8px;
  color: white;
  padding: 10px 20px;
  min-width: 150px;
  border: 2px solid #2d3748;
  text-align: left;
}
.title {
  font-weight: bold;
  font-size: 14px;
  text-align: center;
  margin-bottom: 10px;
}
.properties {
  font-size: 12px;
}
.no-properties {
  font-size: 12px;
  color: #a0aec0;
  text-align: center;
}
.property {
  display: flex;
  justify-content: space-between;
}
.key {
  font-weight: bold;
  margin-right: 5px;
}
/* Status Styles */
.status-running {
  border-color: #2563eb;
  box-shadow: 0 0 10px #2563eb;
}
.status-finished {
  border-color: #22c55e;
}
.status-error {
  border-color: #ef4444;
  animation: shake 0.5s;
}
.status-skipped,
.status-cancelled {
  border-color: #a0aec0;
  opacity: 0.7;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-5px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(5px);
  }
}
</style>