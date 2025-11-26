<template>
  <!-- 整个页面容器 -->
  <div class="flex h-screen w-screen bg-gray-100 overflow-hidden">

    <!-- 左侧侧边栏 -->
    <!-- 核心修改：动态宽度 + 过渡动画 -->
    <aside
      class="bg-white border-r border-gray-200 flex flex-col shadow-sm z-10 transition-all duration-300 ease-in-out relative"
      :class="isCollapsed ? 'w-16' : 'w-64'"
    >

      <!-- 1. 顶部标题区域 -->
      <div class="h-14 flex items-center justify-center border-b border-gray-100 overflow-hidden whitespace-nowrap">
        <!-- 收起时显示简单 Logo 或空，展开时显示完整标题 -->
        <h1 v-if="!isCollapsed" class="font-bold text-gray-800 text-lg transition-opacity duration-200">
          流程编辑器
        </h1>
        <h1 v-else class="font-bold text-blue-600 text-xl">F</h1>
      </div>

      <!-- 2. 中间导航菜单 -->
      <nav class="flex-1 py-4 space-y-1 px-2">

        <!-- 菜单项：设备 -->
        <div
          class="group flex items-center py-3 text-gray-600 rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"
          :class="isCollapsed ? 'justify-center px-0' : 'px-4'"
          title="设备 (Device)"
        >
          <!-- 加上 shrink-0 防止图标被压缩 -->
          <el-icon class="text-lg shrink-0 transition-transform duration-300" :class="{ 'scale-110': isCollapsed }">
            <Monitor />
          </el-icon>
          <!-- 文字部分：使用 v-show 控制显示，whitespace-nowrap 防止换行 -->
          <span v-show="!isCollapsed" class="ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300">
            设备 (Device)
          </span>
        </div>

        <!-- 菜单项：资源 -->
        <div
          class="group flex items-center py-3 text-gray-600 rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"
          :class="isCollapsed ? 'justify-center px-0' : 'px-4'"
          title="资源 (Resource)"
        >
          <el-icon class="text-lg shrink-0 transition-transform duration-300" :class="{ 'scale-110': isCollapsed }">
            <Files />
          </el-icon>
          <span v-show="!isCollapsed" class="ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-300">
            资源 (Resource)
          </span>
        </div>

      </nav>

      <!-- 3. 底部部分：设置 + 折叠按钮 -->
      <div class="border-t border-gray-200">

        <!-- 设置按钮 -->
        <div class="p-2">
           <div
            class="flex items-center py-3 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
            :class="isCollapsed ? 'justify-center px-0' : 'px-4'"
            title="设置 (Settings)"
          >
            <el-icon class="text-lg shrink-0"><Setting /></el-icon>
            <span v-show="!isCollapsed" class="ml-3 font-medium whitespace-nowrap overflow-hidden">
              设置
            </span>
          </div>
        </div>

        <!-- 折叠/展开 切换按钮 -->
        <div
          class="h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer border-t border-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
          @click="toggleSidebar"
        >
          <el-icon class="text-lg">
            <!-- 根据状态切换图标 -->
            <component :is="isCollapsed ? Expand : Fold" />
          </el-icon>
        </div>

      </div>
    </aside>

    <!-- 右侧主要内容区 -->
    <main class="flex-1 flex flex-col h-full relative bg-white overflow-hidden">
       <!-- 这里的 components/FlowEditor.vue 请根据上一步实际路径调整 -->
      <FlowEditor />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FlowEditor from './components/FlowEditor.vue'; // 确保路径正确
import { Monitor, Files, Setting, Fold, Expand } from '@element-plus/icons-vue';

// 定义侧边栏状态：false 代表展开，true 代表收起
const isCollapsed = ref(false);

// 切换状态的方法
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>