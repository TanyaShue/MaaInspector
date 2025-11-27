// src/services/api.js

const API_BASE_URL = 'http://127.0.0.1:5000'

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const controller = new AbortController()
  // 搜索可能比较慢，这里稍微把超时调大一点
  const timeoutMs = endpoint.includes('search') ? 10000 : 5000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`API Error: ${response.status}`)
    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export const systemApi = {
  // 获取所有初始状态
  getInitialState: () => request('/system/init', { method: 'GET' }),

  // 修改：保存所有配置（全量保存）
  // 注意：后端接口路径改为 /system/config/save
  saveDeviceConfig: (fullConfig) => request('/system/config/save', {
    method: 'POST',
    body: JSON.stringify(fullConfig)
  }),

  // 新增：搜索设备
  searchDevices: () => request('/system/devices/search', { method: 'POST' })
}

export const deviceApi = {
  connect: (deviceData) => request('/device/connect', {
    method: 'POST',
    body: JSON.stringify(deviceData)
  }),
  disconnect: () => request('/device/disconnect', { method: 'POST' })
}

export const resourceApi = {
  load: (path) => request('/resource/load', { method: 'POST', body: JSON.stringify({ path }) })
}

export const agentApi = {
  connect: (socketId) => request('/agent/connect', { method: 'POST', body: JSON.stringify({ socket_id: socketId }) }),
  disconnect: () => request('/agent/disconnect', { method: 'POST' })
}