import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CustomCompletionEditor from '@/components/Flow/NodeDetailsPanels/CustomCompletionEditor.vue'
import { useAppConfigStore } from '@/stores/appConfig'

describe('CustomCompletionEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses the styled completion menu and applies schema defaults', async () => {
    const store = useAppConfigStore()
    store.resource.customCompletions.action = [
      {
        value: 'DemoAction',
        title: '示例动作',
        param_schema: {
          type: 'object',
          properties: {
            count: { type: 'integer', default: 2 },
          },
        },
      },
    ]

    const wrapper = mount(CustomCompletionEditor, {
      attachTo: document.body,
      props: {
        kind: 'action',
        modelValue: '',
      },
    })

    expect(wrapper.find('datalist').exists()).toBe(false)
    await wrapper.find('input').trigger('focus')
    expect(document.body.textContent).toContain('示例动作')

    const option = Array.from(document.body.querySelectorAll('button')).find(button =>
      button.textContent?.includes('示例动作')
    )
    option?.click()
    await wrapper.vm.$nextTick()

    const nameEvents = wrapper.emitted('update:modelValue') || []
    const paramEvents = wrapper.emitted('update:paramValue') || []
    expect(nameEvents[nameEvents.length - 1]).toEqual(['DemoAction'])
    expect(paramEvents[paramEvents.length - 1]).toEqual([{ count: 2 }])
    wrapper.unmount()
  })
})
