<script setup>
defineProps({
  show: Boolean,
  top: Number,
  left: Number,
})

const emit = defineEmits(['add', 'delete', 'update:show'])
</script>

<template>
  <div
    v-if="show"
    class="context-menu"
    :style="{ top: `${top}px`, left: `${left}px` }"
    @mouseleave="$emit('update:show', false)"
  >
    <div class="item" @click="emit('add')">添加节点</div>
    <div class="item" @click="emit('delete')">删除节点</div>
  </div>
</template>