// src/services/api.js

const API_BASE_URL = 'http://127.0.0.1:5000'

// ... request 函数保持不变 ...
async function request(endpoint, options = {}) {
  // ... (保持原样)
  const url = `${API_BASE_URL}${endpoint}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  const defaultHeaders = { 'Content-Type': 'application/json' }
  // ... (fetch 逻辑保持原样)
  try {
    const response = await fetch(url, { ...options, headers: { ...defaultHeaders, ...options.headers }, signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`API Error: ${response.status}`)
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export const deviceApi = {
  connect: () => request('/device/connect', { method: 'POST' }),
  disconnect: () => request('/device/disconnect', { method: 'POST' })
}

// 修改：接收 path 参数
export const resourceApi = {
  load: (path) => request('/resource/load', {
    method: 'POST',
    body: JSON.stringify({ path })
  })
}

// 修改：接收 socketId 参数
export const agentApi = {
  connect: (socketId) => request('/agent/connect', {
    method: 'POST',
    body: JSON.stringify({ socket_id: socketId })
  }),
  disconnect: () => request('/agent/disconnect', { method: 'POST' })
}