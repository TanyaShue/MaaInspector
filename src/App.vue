<template>
  <!-- 整个页面容器 -->
  <div class="flex h-screen w-screen bg-gray-100 overflow-hidden">
    <FlowEditor />
  </div>
</template>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>
<script setup lang="ts">
import FlowEditor from "./components/FlowEditor.vue";
</script>