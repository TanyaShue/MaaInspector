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

  it('opens a submenu without executing the parent action', async () => {
    const wrapper = mount(ContextMenu, {
      global: { stubs: { Teleport: true } },
      props: {
        x: 20,
        y: 20,
        type: 'pane',
        mode: 'main'
      }
    })

    const parentItem = wrapper.findAll('.menu-item-with-submenu')
      .find(item => item.text().includes('添加节点'))
    expect(parentItem).toBeDefined()

    await parentItem!.trigger('mouseenter')
    await parentItem!.find('[data-testid="submenu-trigger"]').trigger('click')
    expect((wrapper.vm as unknown as { activeSubmenu: string | null }).activeSubmenu).toBe('add-node')

    const submenu = wrapper.find('[data-testid="submenu-panel"]')
    expect(submenu.classes()).toContain('submenu-panel-visible')
    expect(submenu.attributes('style') || '').not.toContain('display: none')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('opens the submenu to the left near the right viewport edge', async () => {
    const wrapper = mount(ContextMenu, {
      global: { stubs: { Teleport: true } },
      props: {
        x: 900,
        y: 20,
        type: 'pane',
        mode: 'main'
      }
    })

    const parentItem = wrapper.findAll('.menu-item-with-submenu')
      .find(item => item.text().includes('添加节点'))
    expect(parentItem).toBeDefined()
    await parentItem!.trigger('mouseenter')

    expect(parentItem!.classes()).toContain('submenu-opens-left')
    expect(wrapper.find('[data-testid="submenu-panel"]').classes()).toContain('right-full')
  })
})
