import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  flushFrontendLogs,
  installFrontendLogger,
  serializeForLog,
  uninstallFrontendLogger
} from '@/utils/logger'

const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args)
}))

describe('frontend logger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    invokeMock.mockResolvedValue({ success: true })
    uninstallFrontendLogger()
  })

  afterEach(() => {
    uninstallFrontendLogger()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps original console output and flushes a batched log entry', async () => {
    const originalWarn = vi.fn()
    console.warn = originalWarn

    installFrontendLogger()
    console.warn('hello', { value: 1 })

    expect(originalWarn).toHaveBeenCalledWith('hello', { value: 1 })
    await vi.advanceTimersByTimeAsync(250)

    expect(invokeMock).toHaveBeenCalledWith('log_frontend_batch', {
      entries: [
        expect.objectContaining({
          level: 'warn',
          target: 'console',
          message: 'hello {"value":1}'
        })
      ]
    })
  })

  it('serializes errors and circular objects without throwing', () => {
    const circular: Record<string, unknown> = { name: 'root' }
    circular.self = circular

    expect(() => serializeForLog(new Error('boom'))).not.toThrow()
    expect(serializeForLog(circular)).toEqual({
      name: 'root',
      self: '[Circular]'
    })
  })

  it('drops logging failures without surfacing errors', async () => {
    invokeMock.mockRejectedValue(new Error('backend unavailable'))
    console.error = vi.fn()
    installFrontendLogger()

    console.error('failed')
    await expect(flushFrontendLogs()).resolves.toBeUndefined()
  })

  it('suppresses the benign stale callback warning produced by a Tauri dev reload', () => {
    const originalWarn = vi.fn()
    console.warn = originalWarn
    installFrontendLogger()

    console.warn("[TAURI] Couldn't find callback id 123. This might happen when the app is reloaded while Rust is running an asynchronous operation.")

    expect(originalWarn).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalled()
  })
})
