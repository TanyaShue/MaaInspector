// api.js
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
  searchGlobalNodes: (query, useRegex, currentFilename, currentSource) => request('/resource/search/nodes', { method: 'POST', body: JSON.stringify({ query, use_regex: useRegex, current_filename: currentFilename, current_source: currentSource }) }),
  checkUnusedImages: (source, currentFilename, delImages) => request('/resource/images/check-unused', { method: 'POST', body: JSON.stringify({ source, current_filename: currentFilename, del_images: delImages }) }),
  processImages: (source, deletePaths, saveImages) => request('/resource/images/process', { method: 'POST', body: JSON.stringify({ source, delete_paths: deletePaths, save_images: saveImages }) })
}

export const agentApi = {
  connect: (socketId) => request('/agent/connect', { method: 'POST', body: JSON.stringify({ socket_id: socketId }) }),
  disconnect: () => request('/agent/disconnect', { method: 'POST' })
}
export const debugApi = {
  // 发送节点数据进行调试
  runNode: (nodeData, context) => request('/debug/node', {
    method: 'POST',
    body: JSON.stringify({ ...nodeData, ...context })
  }),

  /**
   * 临时的后端流结果伪实现
   * onData 将收到形如 { task_id, name, next_list: [{ name, jump_back, anchor }], focus }
   */
  subscribeMockNodeStream: (onData, { initialNodeId = '' } = {}) => {
    if (typeof onData !== 'function') return () => {}

    let timer = null
    let seed = Date.now()

    const randomBool = () => Math.random() > 0.6
    const randomId = () => `N-${Math.floor(seed + Math.random() * 1_000_000)}`

    const buildPayload = () => {
      seed += 137
      const taskId = 100000000 + Math.floor(Math.random() * 6)
      const base = initialNodeId || randomId()
      const nextCount = Math.max(3, Math.floor(Math.random() * 5) + 1)
      const next_list = Array.from({ length: nextCount }).map(() => ({
        name: randomId(),
        jump_back: randomBool(),
        anchor: false
      }))

      return {
        task_id: taskId,
        name: base,
        next_list,
        focus: null
      }
    }

    timer = setInterval(() => {
      onData(buildPayload())
    }, 2500)

    return () => {
      if (timer) clearInterval(timer)
    }
  }
}