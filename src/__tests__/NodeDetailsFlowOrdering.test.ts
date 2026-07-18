import { defineComponent } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeDetails from '@/components/Flow/NodeDetails.vue'

const FlowTabStub = defineComponent({
  name: 'FlowTab',
  emits: ['add-link', 'remove-link', 'move-link', 'reorder-link'],
  template: '<div />',
})

describe('NodeDetails flow ordering', () => {
  it('updates both flow lists atomically for ordering and cross-list moves', () => {
    const wrapper = shallowMount(NodeDetails, {
      props: {
        visible: true,
        nodeId: 'Source',
        nodeData: {
          id: 'Source',
          type: 'DirectHit',
          data: {
            id: 'Source',
            recognition: 'DirectHit',
            next: ['A', 'B', 'C'],
            on_error: ['Fallback'],
          },
        },
      },
      global: {
        provide: {
          imageManager: {
            getImagesForTemplatePaths: () => [],
          },
        },
        stubs: { FlowTab: FlowTabStub },
      },
    })
    const flowTab = wrapper.getComponent(FlowTabStub)

    flowTab.vm.$emit('reorder-link', {
      sourceKey: 'next',
      sourceIndex: 2,
      targetKey: 'next',
      targetIndex: 0,
    })
    const firstUpdates = wrapper.emitted('update-data') ?? []
    expect(firstUpdates[firstUpdates.length - 1]?.[0]).toMatchObject({
      next: ['C', 'A', 'B'],
      on_error: ['Fallback'],
    })

    flowTab.vm.$emit('reorder-link', {
      sourceKey: 'on_error',
      sourceIndex: 0,
      targetKey: 'next',
      targetIndex: 1,
    })
    const finalUpdates = wrapper.emitted('update-data') ?? []
    const finalPayload = finalUpdates[finalUpdates.length - 1]?.[0]
    expect(finalPayload).toMatchObject({
      next: ['C', 'Fallback', 'A', 'B'],
    })
    expect(finalPayload).not.toHaveProperty('on_error')
    expect(wrapper.emitted('update-data')).toHaveLength(2)
  })
})
