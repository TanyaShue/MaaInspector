/**
 * 请求缓存服务
 * 用于缓存高频请求，减少网络开销
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  promise?: Promise<T>
}

const cache = new Map<string, CacheEntry<unknown>>()

// 默认缓存 TTL（毫秒）
const DEFAULT_TTL = 5000

// 最大缓存条目数
const MAX_CACHE_SIZE = 100

/**
 * 清除过期缓存
 */
const cleanupExpiredCache = () => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > DEFAULT_TTL * 2) {
      cache.delete(key)
    }
  }
}

/**
 * 限制缓存大小
 */
const limitCacheSize = () => {
  if (cache.size > MAX_CACHE_SIZE) {
    // 删除最旧的条目
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toDelete = entries.slice(0, cache.size - MAX_CACHE_SIZE)
    toDelete.forEach(([key]) => cache.delete(key))
  }
}

/**
 * 带缓存的请求包装器
 * @param key 缓存键
 * @param fetcher 实际请求函数
 * @param ttl 缓存过期时间（毫秒）
 * @returns 请求结果
 */
export const withCache = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> => {
  const now = Date.now()
  const cached = cache.get(key) as CacheEntry<T> | undefined

  // 如果有有效缓存，直接返回
  if (cached && now - cached.timestamp < ttl) {
    return cached.data
  }

  // 如果有正在进行的请求，等待它完成
  if (cached?.promise) {
    return cached.promise
  }

  // 创建新请求
  const promise = fetcher()

  // 存储 promise 以防止重复请求
  cache.set(key, {
    data: cached?.data as T,
    timestamp: cached?.timestamp || 0,
    promise
  })

  try {
    const data = await promise
    
    // 更新缓存
    cache.set(key, {
      data,
      timestamp: Date.now()
    })

    // 定期清理
    if (cache.size > MAX_CACHE_SIZE * 0.8) {
      cleanupExpiredCache()
      limitCacheSize()
    }

    return data
  } catch (error) {
    // 请求失败时，如果有旧缓存，保留旧缓存
    if (cached) {
      cache.set(key, {
        data: cached.data,
        timestamp: cached.timestamp
      })
    } else {
      cache.delete(key)
    }
    throw error
  }
}

/**
 * 清除指定键的缓存
 */
export const invalidateCache = (key: string) => {
  cache.delete(key)
}

/**
 * 清除匹配模式的缓存
 */
export const invalidateCacheByPattern = (pattern: string | RegExp) => {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  for (const key of cache.keys()) {
    // Global and sticky regular expressions retain lastIndex between calls.
    // Reset it for every key so adjacent matches are not skipped.
    regex.lastIndex = 0
    if (regex.test(key)) {
      cache.delete(key)
    }
  }
}

/**
 * 清除所有缓存
 */
export const clearCache = () => {
  cache.clear()
}

/**
 * 获取缓存统计信息
 */
export const getCacheStats = () => {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    defaultTtl: DEFAULT_TTL
  }
}
