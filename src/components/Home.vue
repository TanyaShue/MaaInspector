<script setup lang="ts">
import { ref } from 'vue';

const backendMessage = ref('');
const isLoading = ref(false);
const error = ref('');

async function fetchMessage() {
  isLoading.value = true;
  error.value = '';
  backendMessage.value = '';
  try {
    const response = await fetch('http://127.0.0.1:5000/api/message');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    backendMessage.value = data.message;
  } catch (e: any) {
    error.value = `无法连接到后端服务: ${e.message}. 请确保Python后端正在运行.`;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="tab-content">
    <h1>欢迎来到您的应用</h1>
    <p>这是一个与Python后端交互的前端界面.</p>
    
    <el-button @click="fetchMessage" :loading="isLoading" type="primary">
      从后端获取问候
    </el-button>

    <div class="message-box" v-if="backendMessage || error">
      <p v-if="backendMessage" class="success-message">
        <strong>成功:</strong> {{ backendMessage }}
      </p>
      <p v-if="error" class="error-message">
        <strong>错误:</strong> {{ error }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.tab-content {
  padding: 20px;
  min-height: 75vh;
}
.message-box {
  margin-top: 20px;
  padding: 15px;
  border-radius: 4px;
  background-color: #f0f2f5;
}
.success-message {
  color: #67c23a;
}
.error-message {
  color: #f56c6c;
}
</style>
