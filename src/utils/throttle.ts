/**
 * 事件节流工具
 * 用于处理高频事件，如 SSE 推送
 */

type EventCallback<T> = (data: T) => void

interface ThrottledEventOptions {
  /** 节流间隔（毫秒） */
  throttleMs?: number
  /** 批处理大小 */
  batchSize?: number
  /** 是否启用批处理 */
  enableBatch?: boolean
}

const DEFAULT_OPTIONS: Required<ThrottledEventOptions> = {
  throttleMs: 50,
  batchSize: 10,
  enableBatch: true
}

/**
 * 创建节流事件处理器
 */
export const createThrottledHandler = <T>(
  callback: EventCallback<T>,
  options: ThrottledEventOptions = {}
) => {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastEventTime = 0
  let eventQueue: T[] = []
  let isProcessing = false
  let rafId: number | null = null

  const processQueue = () => {
    if (eventQueue.length === 0) {
      isProcessing = false
      return
    }

    const batch = eventQueue.splice(0, config.batchSize)
    batch.forEach(callback)

    if (eventQueue.length > 0) {
      rafId = requestAnimationFrame(processQueue)
    } else {
      isProcessing = false
    }
  }

  const handler = (data: T) => {
    const now = Date.now()
    
    if (now - lastEventTime < config.throttleMs) {
      // 节流期内，加入队列
      eventQueue.push(data)
      
      if (!isProcessing && config.enableBatch) {
        isProcessing = true
        rafId = requestAnimationFrame(processQueue)
      }
      return
    }

    lastEventTime = now
    
    if (config.enableBatch) {
      // 批处理模式
      eventQueue.push(data)
      if (!isProcessing) {
        isProcessing = true
        rafId = requestAnimationFrame(processQueue)
      }
    } else {
      // 直接处理模式
      callback(data)
    }
  }

  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (eventQueue.length > 0) {
      eventQueue.forEach(callback)
      eventQueue = []
    }
    isProcessing = false
  }

  const clear = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    eventQueue = []
    isProcessing = false
  }

  const getQueueSize = () => eventQueue.length

  return {
    handler,
    flush,
    clear,
    getQueueSize
  }
}

/**
 * 节流函数
 */
export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  limit: number
): ((...args: Args) => void) => {
  let inThrottle = false

  return (...args: Args) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
