import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FloatingDropdownMenu from '@/components/Flow/Common/FloatingDropdownMenu.vue'

describe('FloatingDropdownMenu', () => {
  it('opens upward and keeps its content scrollable near the viewport bottom', async () => {
    const anchor = document.createElement('button')
    anchor.getBoundingClientRect = () => ({
      x: 100,
      y: 700,
      top: 700,
      right: 300,
      bottom: 730,
      left: 100,
      width: 200,
      height: 30,
      toJSON: () => ({}),
    })
    document.body.appendChild(anchor)

    const wrapper = mount(FloatingDropdownMenu, {
      attachTo: document.body,
      props: { open: true, anchor, maxHeight: 240 },
      slots: { default: '<div style="height: 500px">options</div>' },
    })
    await nextTick()
    await nextTick()

    const menu = document.body.querySelector('.overscroll-contain') as HTMLElement | null
    expect(menu).not.toBeNull()
    expect(menu?.style.bottom).not.toBe('')
    expect(menu?.style.maxHeight).toBe('240px')
    expect(menu?.classList.contains('overflow-y-auto')).toBe(true)

    wrapper.unmount()
    anchor.remove()
  })
})
