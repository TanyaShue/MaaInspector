import { getVersion } from '@tauri-apps/api/app'
import { isTauri } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'

export interface AvailableUpdate {
  version: string
  currentVersion: string
  date?: string
  body?: string
}

export interface UpdateDownloadProgress {
  downloaded: number
  total: number | null
  percent: number | null
}

let pendingUpdate: Update | null = null

export const appUpdater = {
  async getCurrentVersion(): Promise<string> {
    if (!isTauri()) return __APP_VERSION__
    return getVersion()
  },

  async check(): Promise<AvailableUpdate | null> {
    if (!isTauri()) {
      throw new Error('软件更新仅在桌面应用中可用')
    }

    await pendingUpdate?.close()
    pendingUpdate = await check({ timeout: 30_000 })
    if (!pendingUpdate) return null

    return {
      version: pendingUpdate.version,
      currentVersion: pendingUpdate.currentVersion,
      date: pendingUpdate.date,
      body: pendingUpdate.body
    }
  },

  async downloadAndInstall(onProgress: (progress: UpdateDownloadProgress) => void): Promise<void> {
    if (!pendingUpdate) throw new Error('没有可安装的更新，请先检查更新')

    let downloaded = 0
    let total: number | null = null
    const handleEvent = (event: DownloadEvent) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? null
        downloaded = 0
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
      } else if (event.event === 'Finished' && total !== null) {
        downloaded = total
      }

      onProgress({
        downloaded,
        total,
        percent: total && total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : null
      })
    }

    await pendingUpdate.downloadAndInstall(handleEvent, { timeout: 10 * 60_000 })
  },

  async relaunch(): Promise<void> {
    await relaunch()
  },

  async dispose(): Promise<void> {
    await pendingUpdate?.close()
    pendingUpdate = null
  }
}
