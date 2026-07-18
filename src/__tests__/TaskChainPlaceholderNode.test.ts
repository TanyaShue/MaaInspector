import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TaskChainPlaceholderNode from '@/components/Flow/TaskChainPlaceholderNode.vue'

describe('TaskChainPlaceholderNode', () => {
  it('renders lightweight context without any connection handles', () => {
    const wrapper = mount(TaskChainPlaceholderNode, {
      props: {
        id: 'Unrelated',
        data: {
          id: 'Unrelated',
          type: 'DirectHit',
          data: { id: 'Unrelated', recognition: 'DirectHit' },
        },
      },
    })

    expect(wrapper.text()).toContain('Unrelated')
    expect(wrapper.text()).toContain('任务链外节点')
    expect(wrapper.find('.vue-flow__handle').exists()).toBe(false)
  })
})
