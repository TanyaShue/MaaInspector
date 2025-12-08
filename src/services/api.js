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
  // 暂停调试任务
  stop: () => request('/debug/stop', { method: 'POST' }),

  /**
   * 真实后端 SSE 调试流
   * onData 将收到:
   *  - type=node_next_list: { task_id, name, next_list, focus, timestamp }
   *  - type=node_recognition: { task_id, name, reco_id, status, focus, timestamp }
   */
  subscribeNodeStream: (onData) => {
    if (typeof onData !== 'function') return () => {}

    const es = new EventSource(`${API_BASE_URL}/debug/stream`)

    es.onmessage = (evt) => {
      if (!evt?.data) return
      try {
        const payload = JSON.parse(evt.data)
        onData(payload)
      } catch (e) {
        console.warn('[DebugStream] 无法解析消息', e)
      }
    }

    es.onerror = (err) => {
      console.warn('[DebugStream] SSE 连接异常', err)
    }

    return () => es.close()
  }
}