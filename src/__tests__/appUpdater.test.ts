import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  close: vi.fn(),
  downloadAndInstall: vi.fn(),
  getVersion: vi.fn(),
  isTauri: vi.fn(),
  relaunch: vi.fn()
}))

vi.mock('@tauri-apps/api/app', () => ({ getVersion: mocks.getVersion }))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: mocks.isTauri }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))

import { appUpdater } from '@/services/appUpdater'

describe('appUpdater', () => {
  beforeEach(async () => {
    await appUpdater.dispose()
    vi.clearAllMocks()
    mocks.isTauri.mockReturnValue(true)
    mocks.getVersion.mockResolvedValue('1.2.3')
  })

  it('returns the packaged application version', async () => {
    await expect(appUpdater.getCurrentVersion()).resolves.toBe('1.2.3')
  })

  it('maps update metadata and reports download progress', async () => {
    mocks.downloadAndInstall.mockImplementation(async (listener: (event: unknown) => void) => {
      listener({ event: 'Started', data: { contentLength: 100 } })
      listener({ event: 'Progress', data: { chunkLength: 40 } })
      listener({ event: 'Progress', data: { chunkLength: 60 } })
      listener({ event: 'Finished' })
    })
    mocks.check.mockResolvedValue({
      version: '1.3.0',
      currentVersion: '1.2.3',
      date: '2026-07-16',
      body: 'New features',
      close: mocks.close,
      downloadAndInstall: mocks.downloadAndInstall
    })

    await expect(appUpdater.check()).resolves.toMatchObject({ version: '1.3.0' })
    const progress = vi.fn()
    await appUpdater.downloadAndInstall(progress)

    expect(progress).toHaveBeenLastCalledWith({ downloaded: 100, total: 100, percent: 100 })
  })

  it('returns null when GitHub has no newer release', async () => {
    mocks.check.mockResolvedValue(null)
    await expect(appUpdater.check()).resolves.toBeNull()
  })

  it('rejects update checks outside the desktop application', async () => {
    mocks.isTauri.mockReturnValue(false)
    await expect(appUpdater.check()).rejects.toThrow('桌面应用')
  })
})
