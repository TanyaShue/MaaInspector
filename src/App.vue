<script setup lang="ts">
import { ref } from 'vue';
import Home from './components/Home.vue';
import Settings from './components/Settings.vue';
import About from './components/About.vue';

const activeTab = ref('home');
</script>

<template>
  <div class="main-container">
    <el-tabs v-model="activeTab" type="card" class="main-tabs">
      <el-tab-pane label="主页" name="home">
        <Home />
      </el-tab-pane>
      <el-tab-pane label="设置" name="settings">
        <Settings />
      </el-tab-pane>
      <el-tab-pane label="关于" name="about">
        <About />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style>
/* 全局样式 */
body, #app {
  margin: 0;
  padding: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
  background-color: #f4f5f7;
  overflow: hidden; /* 防止出现不必要的滚动条 */
}

.main-container {
  padding: 0 15px 15px 15px; /* 顶部不需要内边距 */
}

/* --- 标签页撑满宽度 --- */
.main-tabs .el-tabs__nav {
  display: flex;
  width: 100%;
}

.main-tabs .el-tabs__item {
  flex: 1;
  text-align: center;
}
/* -------------------- */

.main-tabs .el-tabs__header {
  margin-bottom: 0; /* 移除标签头和内容区的间距 */
}

/* 统一的内容区域样式 */
.el-tab-pane > div {
  padding: 20px;
  background-color: #fff;
  /* 使用 calc 计算高度, 减去标签页的高度 (约40px) 和容器的padding */
  height: calc(100vh - 40px - 15px);
  box-sizing: border-box;
  overflow-y: auto; /* 如果内容超长,则内部滚动 */
}

h1, h2 {
  color: #303133;
}

p {
  color: #606266;
  line-height: 1.6;
}
</style>