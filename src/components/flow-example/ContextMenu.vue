<script setup>
defineProps({
  show: Boolean,
  top: Number,
  left: Number,
})

const emit = defineEmits(['add-node', 'delete-node'])
</script>

<template>
  <div
    v-if="show"
    class="context-menu"
    :style="{ top: `${top}px`, left: `${left}px` }"
    @click.stop
    @contextmenu.prevent
  >
    <div class="item" @click="emit('add-node')">Add Node</div>
    <div class="item" @click="emit('delete-node')">Delete Node</div>
  </div>
</template>