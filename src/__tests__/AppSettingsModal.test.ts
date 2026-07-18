import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppSettingsModal from '@/components/Flow/Modals/AppSettingsModal.vue'

const mocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  getCurrentVersion: vi.fn().mockResolvedValue('1.2.3'),
  openLogDir: vi.fn(),
  openBackupDir: vi.fn()
}))

vi.mock('@/services/appUpdater', () => ({
  appUpdater: {
    getCurrentVersion: mocks.getCurrentVersion,
    check: vi.fn(),
    downloadAndInstall: vi.fn(),
    relaunch: vi.fn(),
    dispose: mocks.dispose
  }
}))
vi.mock('@/services/api', () => ({
  systemApi: {
    openLogDir: mocks.openLogDir,
    openBackupDir: mocks.openBackupDir
  }
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath: vi.fn(), openUrl: vi.fn() }))

describe('AppSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('renders grouped navigation and scrolls to the selected group', async () => {
    const wrapper = mount(AppSettingsModal, { props: { visible: true } })
    await flushPromises()
    const aboutButton = wrapper.findAll('nav button').find(button => button.text().includes('关于我们'))

    expect(aboutButton).toBeDefined()
    await aboutButton!.trigger('click')

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start'
    })
    expect(aboutButton!.classes()).toContain('text-indigo-600')
    expect(wrapper.text()).toContain('当前版本 v1.2.3')
  })

  it('keeps the existing settings save payload', async () => {
    const wrapper = mount(AppSettingsModal, { props: { visible: true } })
    await wrapper.findAll('button').find(button => button.text() === 'V2')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text().includes('保存设置'))!.trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      pipelineVersion: 'V2',
      restoreWorkspaceOnStart: true,
      lowMemoryMode: false,
      nodeNamePrefixMode: 'filename'
    })
  })

  it('opens log and backup directories through backend commands', async () => {
    const wrapper = mount(AppSettingsModal, { props: { visible: true } })
    await wrapper.findAll('button').find(button => button.text().includes('打开备份目录'))!.trigger('click')
    await wrapper.findAll('button').find(button => button.text().includes('打开日志目录'))!.trigger('click')

    expect(mocks.openBackupDir).toHaveBeenCalledTimes(1)
    expect(mocks.openLogDir).toHaveBeenCalledTimes(1)
  })
})
