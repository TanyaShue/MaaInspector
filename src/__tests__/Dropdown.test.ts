import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Dropdown from '@/components/Flow/Common/Dropdown.vue'

describe('Dropdown', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('teleports the options to a fixed high-level menu and selects an option', async () => {
    const wrapper = mount(Dropdown, {
      attachTo: document.body,
      props: {
        modelValue: 0,
        options: [
          { label: '配置 A', value: 0 },
          { label: '配置 B', value: 1 }
        ]
      }
    })

    await wrapper.get('button').trigger('click')
    const floatingMenu = document.body.querySelector('.fixed.z-\\[200\\]')
    expect(floatingMenu).not.toBeNull()

    const optionButtons = floatingMenu?.querySelectorAll('button')
    expect(optionButtons).toHaveLength(2)
    optionButtons?.[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([1])
    wrapper.unmount()
  })
})
