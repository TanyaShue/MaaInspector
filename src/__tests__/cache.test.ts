import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withCache, invalidateCache, invalidateCacheByPattern, clearCache, getCacheStats } from '@/services/cache'

describe('cache service', () => {
  beforeEach(() => {
    clearCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('withCache', () => {
    it('should call fetcher and return result on cache miss', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      const result = await withCache('test-key', fetcher, 5000)
      expect(result).toBe('result')
      expect(fetcher).toBeCalledTimes(1)
    })

    it('should return cached data on cache hit', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('test-key', fetcher, 5000)
      const result2 = await withCache('test-key', fetcher, 5000)
      expect(result2).toBe('result')
      expect(fetcher).toBeCalledTimes(1)
    })

    it('should deduplicate concurrent requests', async () => {
      const fetcher = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('result'), 100))
      )
      const promises = [
        withCache('test-key', fetcher, 5000),
        withCache('test-key', fetcher, 5000),
        withCache('test-key', fetcher, 5000),
      ]
      vi.advanceTimersByTime(101)
      const [r1, r2, r3] = await Promise.all(promises)
      expect(r1).toBe('result')
      expect(r2).toBe('result')
      expect(r3).toBe('result')
      expect(fetcher).toBeCalledTimes(1)
    })

    it('should expire cache after TTL', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('test-key', fetcher, 1000)
      vi.advanceTimersByTime(1001)
      const result2 = await withCache('test-key', fetcher, 1000)
      expect(result2).toBe('result')
      expect(fetcher).toBeCalledTimes(2)
    })

    it('should respect custom TTL', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('test-key', fetcher, 500)
      vi.advanceTimersByTime(501)
      await withCache('test-key', fetcher, 500)
      expect(fetcher).toBeCalledTimes(2)
    })

    it('should use default TTL when not provided', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('test-key', fetcher)
      vi.advanceTimersByTime(5001)
      await withCache('test-key', fetcher)
      expect(fetcher).toBeCalledTimes(2)
    })

    it('should preserve old cache on request failure', async () => {
      const fetcher1 = vi.fn().mockResolvedValue('cached-data')
      const fetcher2 = vi.fn().mockRejectedValue(new Error('network error'))
      const result1 = await withCache('test-key', fetcher1, 5000)
      expect(result1).toBe('cached-data')
      vi.advanceTimersByTime(5001)
      await expect(withCache('test-key', fetcher2, 5000)).rejects.toThrow('network error')
      const stats = getCacheStats()
      expect(stats.size).toBe(1)
    })

    it('should delete cache entry on first request failure', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('fail'))
      await expect(withCache('test-key', fetcher, 5000)).rejects.toThrow('fail')
      const stats = getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should handle cache size limit', async () => {
      const fetcher = vi.fn().mockImplementation((key: string) =>
        Promise.resolve(`data-${key}`)
      )
      for (let i = 0; i < 110; i++) {
        await withCache(`key-${i}`, () => fetcher(`key-${i}`), 5000)
      }
      const stats = getCacheStats()
      expect(stats.size).toBeLessThanOrEqual(100)
    })
  })

  describe('invalidateCache', () => {
    it('should remove specified cache entry', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('key-1', fetcher, 5000)
      await withCache('key-2', fetcher, 5000)
      invalidateCache('key-1')
      await withCache('key-1', fetcher, 5000)
      expect(fetcher).toBeCalledTimes(3)
    })

    it('should do nothing for non-existent key', () => {
      expect(() => invalidateCache('nonexistent')).not.toThrow()
    })
  })

  describe('invalidateCacheByPattern', () => {
    it('should remove cache entries matching string pattern', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('user:1', fetcher, 5000)
      await withCache('user:2', fetcher, 5000)
      await withCache('post:1', fetcher, 5000)
      invalidateCacheByPattern('user:')
      await withCache('user:1', fetcher, 5000)
      await withCache('user:2', fetcher, 5000)
      await withCache('post:1', fetcher, 5000)
      expect(fetcher).toBeCalledTimes(5)
    })

    it('should remove cache entries matching RegExp pattern', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('v1-api', fetcher, 5000)
      await withCache('v2-api', fetcher, 5000)
      await withCache('v3-api', fetcher, 5000)
      invalidateCacheByPattern(/^v[12]-/)
      await withCache('v1-api', fetcher, 5000)
      await withCache('v2-api', fetcher, 5000)
      await withCache('v3-api', fetcher, 5000)
      expect(fetcher).toBeCalledTimes(5)
    })

    it('should remove every matching entry when the RegExp is global', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('user:1', fetcher, 5000)
      await withCache('user:2', fetcher, 5000)
      await withCache('post:1', fetcher, 5000)

      invalidateCacheByPattern(/^user:/g)

      await withCache('user:1', fetcher, 5000)
      await withCache('user:2', fetcher, 5000)
      await withCache('post:1', fetcher, 5000)
      expect(fetcher).toBeCalledTimes(5)
    })
  })

  describe('clearCache', () => {
    it('should remove all cache entries', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('key-1', fetcher, 5000)
      await withCache('key-2', fetcher, 5000)
      await withCache('key-3', fetcher, 5000)
      clearCache()
      expect(getCacheStats().size).toBe(0)
      await withCache('key-1', fetcher, 5000)
      expect(fetcher).toBeCalledTimes(4)
    })
  })

  describe('getCacheStats', () => {
    it('should return current cache statistics', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      await withCache('key-1', fetcher, 5000)
      await withCache('key-2', fetcher, 5000)
      const stats = getCacheStats()
      expect(stats).toEqual({
        size: 2,
        maxSize: 100,
        defaultTtl: 5000,
      })
    })
  })
})
