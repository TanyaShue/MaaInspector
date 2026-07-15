import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContextMenu from '@/components/Flow/ContextMenu.vue'
import type { FlowNode } from '@/utils/flowTypes'

const targetNode: FlowNode = {
  id: 'target',
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    id: 'target',
    type: 'DirectHit',
    data: { id: 'target', recognition: 'DirectHit' }
  }
}

describe('ContextMenu', () => {
  it('shows the sub-canvas entry on main node menus', () => {
    const wrapper = mount(ContextMenu, {
      global: { stubs: { Teleport: true } },
      props: {
        x: 20,
        y: 20,
        type: 'node',
        data: targetNode,
        mode: 'main'
      }
    })

    expect(wrapper.text()).toContain('在子画布中重排任务链')
  })

  it('hides the sub-canvas entry from sub-canvas node menus', () => {
    const wrapper = mount(ContextMenu, {
      global: { stubs: { Teleport: true } },
      props: {
        x: 20,
        y: 20,
        type: 'node',
        data: targetNode,
        mode: 'subcanvas'
      }
    })

    expect(wrapper.text()).not.toContain('在子画布中重排任务链')
  })
})
