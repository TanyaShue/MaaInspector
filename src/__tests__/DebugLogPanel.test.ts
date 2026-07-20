import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DebugLogPanel from '@/components/Flow/DebugPanel/DebugLogPanel.vue'

const { readTail } = vi.hoisted(() => ({
  readTail: vi.fn(async (kind: string) => [`${kind} log`]),
}))

vi.mock('@/services/api', () => ({
  logApi: { readTail },
}))

describe('DebugLogPanel', () => {
  afterEach(() => vi.clearAllMocks())
  const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

  it('switches between MaaFW, Agent and software logs', async () => {
    const wrapper = mount(DebugLogPanel, { props: { active: true } })
    await flushPromises()

    expect(readTail).toHaveBeenCalledWith('maafw', 100)
    expect(wrapper.get('[data-testid="debug-log-output"]').text()).toContain('maafw log')

    await wrapper.findAll('button').find(button => button.text() === 'Agent')!.trigger('click')
    await flushPromises()

    expect(readTail).toHaveBeenCalledWith('agent', 100)
    expect(wrapper.get('[data-testid="debug-log-output"]').text()).toContain('agent log')
    wrapper.unmount()
  })

  it('only follows the latest logs when enabled and stops after manual scrolling', async () => {
    const wrapper = mount(DebugLogPanel, { props: { active: true } })
    await flushPromises()
    const output = wrapper.get<HTMLElement>('[data-testid="debug-log-output"]')
    const followButton = wrapper.get('[data-testid="debug-log-follow"]')
    Object.defineProperty(output.element, 'scrollHeight', {
      configurable: true,
      value: 480,
    })

    expect(followButton.attributes('aria-pressed')).toBe('false')
    expect(output.element.scrollTop).toBe(0)

    await followButton.trigger('click')
    await flushPromises()
    expect(followButton.attributes('aria-pressed')).toBe('true')
    expect(output.element.scrollTop).toBe(480)

    await output.trigger('wheel')
    expect(followButton.attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('restores an independent scroll position for every log tab', async () => {
    const wrapper = mount(DebugLogPanel, { props: { active: true } })
    await flushPromises()
    await nextFrame()
    const output = wrapper.get<HTMLElement>('[data-testid="debug-log-output"]')
    const maaFwButton = wrapper.findAll('button').find(button => button.text() === 'MaaFW')!
    const agentButton = wrapper.findAll('button').find(button => button.text() === 'Agent')!

    output.element.scrollTop = 640
    await output.trigger('scroll')
    await agentButton.trigger('click')
    await flushPromises()
    await nextFrame()

    output.element.scrollTop = 120
    await output.trigger('scroll')
    await maaFwButton.trigger('click')
    await flushPromises()
    await nextFrame()

    expect(output.element.scrollTop).toBe(640)
    wrapper.unmount()
  })

  it('copies the complete unformatted log line', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(DebugLogPanel, { props: { active: true } })
    await flushPromises()
    const copyButton = wrapper.get('[aria-label="复制第 1 条原始日志"]')

    await copyButton.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('maafw log')
    expect(copyButton.attributes('title')).toBe('已复制')
    wrapper.unmount()
  })
})
