import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}))

vi.mock('@/utils/logger', () => ({
  logWarn: mocks.logWarn,
  serializeForLog: (value: unknown) => value,
}))

import { debugApi } from '@/services/api'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('debugApi.subscribeNodeStream', () => {
  beforeEach(() => {
    mocks.listen.mockReset()
    mocks.logWarn.mockReset()
  })

  it('releases listeners that were registered before a later registration fails', async () => {
    const unlisten = vi.fn()
    mocks.listen
      .mockResolvedValueOnce(unlisten)
      .mockRejectedValueOnce(new Error('event bridge unavailable'))

    debugApi.subscribeNodeStream(vi.fn())
    await flushPromises()

    expect(unlisten).toHaveBeenCalledOnce()
    expect(mocks.logWarn).toHaveBeenCalledOnce()
    expect(mocks.listen).toHaveBeenCalledTimes(2)
  })

  it('releases a listener that resolves after the subscription was cancelled', async () => {
    let resolveListener!: (unlisten: () => void) => void
    mocks.listen.mockImplementationOnce(
      () =>
        new Promise<() => void>((resolve) => {
          resolveListener = resolve
        })
    )
    const unlisten = vi.fn()

    const cleanup = debugApi.subscribeNodeStream(vi.fn())
    cleanup()
    resolveListener(unlisten)
    await flushPromises()

    expect(unlisten).toHaveBeenCalledOnce()
    expect(mocks.listen).toHaveBeenCalledTimes(1)
  })

  it('releases all successful registrations exactly once', async () => {
    const unlisteners = [vi.fn(), vi.fn(), vi.fn()]
    unlisteners.forEach((unlisten) => mocks.listen.mockResolvedValueOnce(unlisten))

    const cleanup = debugApi.subscribeNodeStream(vi.fn())
    await flushPromises()
    cleanup()
    cleanup()

    unlisteners.forEach((unlisten) => expect(unlisten).toHaveBeenCalledOnce())
  })

  it('continues releasing listeners when one cleanup function throws', async () => {
    const first = vi.fn(() => {
      throw new Error('already closed')
    })
    const second = vi.fn()
    const third = vi.fn()
    ;[first, second, third].forEach((unlisten) => mocks.listen.mockResolvedValueOnce(unlisten))

    const cleanup = debugApi.subscribeNodeStream(vi.fn())
    await flushPromises()
    cleanup()

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(third).toHaveBeenCalledOnce()
    expect(mocks.logWarn).toHaveBeenCalledOnce()
  })
})
