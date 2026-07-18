import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import FlowTab from '@/components/Flow/NodeDetailsPanels/FlowTab.vue'

describe('FlowTab', () => {
  it('emits top and bottom moves from the extra controls', async () => {
    const wrapper = mount(FlowTab, {
      props: {
        nextList: ['A', 'B', 'C'],
        onErrorList: [],
      },
    })

    const rows = wrapper.findAll('[data-flow-link-index]')
    await rows[1].find('button[aria-label="移到顶部"]').trigger('click')
    await rows[1].find('button[aria-label="移到底部"]').trigger('click')

    expect(wrapper.emitted('move-link')).toEqual([
      [{ key: 'next', index: 1, position: 'top' }],
      [{ key: 'next', index: 1, position: 'bottom' }],
    ])
  })

  it('supports pointer-dragging links in both directions between lists', async () => {
    const wrapper = mount(FlowTab, {
      props: {
        nextList: ['A', 'B'],
        onErrorList: ['Fallback'],
      },
    })

    const nextZone = wrapper.find('[data-flow-link-drop-key="next"]')
    const errorZone = wrapper.find('[data-flow-link-drop-key="on_error"]')
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn()
        .mockReturnValueOnce(errorZone.element)
        .mockReturnValueOnce(nextZone.element),
    })

    wrapper.findAll('[data-testid="next-drag-handle"]')[0].element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 20 }))

    wrapper.find('[data-testid="on-error-drag-handle"]').element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 20,
    }))
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 10 }))

    expect(wrapper.emitted('reorder-link')).toEqual([
      [{
        sourceKey: 'next',
        sourceIndex: 0,
        targetKey: 'on_error',
        targetIndex: 1,
      }],
      [{
        sourceKey: 'on_error',
        sourceIndex: 0,
        targetKey: 'next',
        targetIndex: 2,
      }],
    ])
  })

  it('shows the exact insertion position while dragging', async () => {
    const wrapper = mount(FlowTab, {
      props: {
        nextList: ['A', 'B', 'C'],
        onErrorList: [],
      },
    })
    const targetRow = wrapper.findAll('[data-flow-link-index]')[1]
    vi.spyOn(targetRow.element, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      height: 40,
    } as DOMRect)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetRow.element),
    })

    wrapper.findAll('[data-testid="next-drag-handle"]')[0].element.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 110 }))
    await nextTick()

    const indicator = wrapper.get('[data-testid="next-drop-indicator-1"]')
    expect(indicator.text()).toContain('插入到这里')

    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 110 }))
  })
})
