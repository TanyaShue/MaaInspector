// api.js
const API_BASE_URL = 'http://127.0.0.1:5000'

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
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`API Error ${response.status}: ${text || response.statusText}`)
    }
    return await response.json()
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

export const systemApi = {
  getInitialState: () => request('/system/init', { method: 'GET' }),
  saveDeviceConfig: (fullConfig) => request('/system/config/save', { method: 'POST', body: JSON.stringify(fullConfig) }),
  searchDevices: () => request('/system/devices/search', { method: 'POST' })
}

export const deviceApi = {
  connect: (deviceData) => request('/device/connect', { method: 'POST', body: JSON.stringify(deviceData) }),
  disconnect: () => request('/device/disconnect', { method: 'POST' }),
  getScreenshot: () => request('/device/screenshot', { method: 'GET' })
}

export const resourceApi = {
  load: (path) => request('/resource/load', { method: 'POST', body: JSON.stringify({ path }) }),
  getFileNodes: (source, filename) => request('/resource/file/nodes', { method: 'POST', body: JSON.stringify({ source, filename }) }),
  getTemplateImages: (source, filename) => request('/resource/file/templates', { method: 'POST', body: JSON.stringify({ source, filename }) }),
  createFile: (path, filename) => request('/resource/file/create', { method: 'POST', body: JSON.stringify({ path, filename }) }),
  saveFileNodes: (source, filename, nodes) => request('/resource/file/save', { method: 'POST', body: JSON.stringify({ source, filename, nodes }) }),
  searchGlobalNodes: (query, useRegex, currentFilename) => request('/resource/search/nodes', { method: 'POST', body: JSON.stringify({ query, use_regex: useRegex, current_filename: currentFilename }) })
}

export const agentApi = {
  connect: (socketId) => request('/agent/connect', { method: 'POST', body: JSON.stringify({ socket_id: socketId }) }),
  disconnect: () => request('/agent/disconnect', { method: 'POST' })
}