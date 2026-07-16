import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NodeSearch from '@/components/Flow/NodeSearch.vue'
import { resourceApi } from '@/services/api'

vi.mock('@/services/api', () => ({
  resourceApi: {
    searchGlobalNodes: vi.fn()
  }
}))

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('NodeSearch', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignores a stale remote response that finishes after a newer search', async () => {
    vi.useFakeTimers()
    const first = deferred<Record<string, unknown>>()
    const second = deferred<Record<string, unknown>>()
    vi.mocked(resourceApi.searchGlobalNodes)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const wrapper = mount(NodeSearch, {
      props: { visible: true, nodes: [] }
    })
    const input = wrapper.get('input')

    await input.setValue('first')
    await vi.advanceTimersByTimeAsync(800)
    await input.setValue('second')
    await vi.advanceTimersByTimeAsync(800)

    second.resolve({
      results: [{ node_id: 'new', display_id: 'new-result', filename: 'new.json', source: 'source' }]
    })
    await flushPromises()
    first.resolve({
      results: [{ node_id: 'old', display_id: 'old-result', filename: 'old.json', source: 'source' }]
    })
    await flushPromises()

    expect(wrapper.text()).toContain('new-result')
    expect(wrapper.text()).not.toContain('old-result')
    wrapper.unmount()
  })
})
