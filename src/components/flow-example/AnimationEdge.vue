<script setup>
import { BaseEdge, getStraightPath } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  sourceX: {
    type: Number,
    required: true,
  },
  sourceY: {
    type: Number,
    required: true,
  },
  targetX: {
    type: Number,
    required: true,
  },
  targetY: {
    type: Number,
    required: true,
  },
  sourcePosition: {
    type: String,
    required: true,
  },
  targetPosition: {
    type: String,
    required: true,
  },
})

// getStraightPath is a helper function that returns the path for a straight edge.
const path = computed(() => getStraightPath(props))
</script>

<template>
  <!-- BaseEdge is a component that renders the edge path -->
  <BaseEdge :id="id" :path="path[0]" />

  <!-- A separate path element to create the animation effect -->
  <path class="animated-path" :d="path[0]">
    <animate
      attributeName="stroke-dashoffset"
      values="100;0"
      dur="2s"
      repeatCount="indefinite"
    />
  </path>
</template>

<style>
.animated-path {
  stroke-dasharray: 5;
  stroke: #2563eb;
  stroke-width: 2;
  fill: none;
}
</style>