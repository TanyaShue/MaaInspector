// src/services/api.js

const API_BASE_URL = 'http://127.0.0.1:5001'

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const controller = new AbortController()

  const timeoutMs = endpoint.includes('search') ? 60000 : 10000

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

  saveDeviceConfig: (fullConfig) => request('/system/config/save', {
    method: 'POST',
    body: JSON.stringify(fullConfig)
  }),

  searchDevices: () => request('/system/devices/search', { method: 'POST' })
}

export const deviceApi = {
  connect: (deviceData) => request('/device/connect', {
    method: 'POST',
    body: JSON.stringify(deviceData)
  }),
  disconnect: () => request('/device/disconnect', { method: 'POST' })
}

// src/services/api.js 的 resourceApi 部分修改如下：

export const resourceApi = {
  load: (path) => request('/resource/load', { method: 'POST', body: JSON.stringify({ path }) }),

  getFileNodes: (source, filename) => request('/resource/file/nodes', {
    method: 'POST',
    body: JSON.stringify({ source, filename })
  }),

  // 新增创建文件接口
  createFile: (path, filename) => request('/resource/file/create', {
    method: 'POST',
    body: JSON.stringify({ path, filename })
  })
}
export const agentApi = {
  connect: (socketId) => request('/agent/connect', { method: 'POST', body: JSON.stringify({ socket_id: socketId }) }),
  disconnect: () => request('/agent/disconnect', { method: 'POST' })
}