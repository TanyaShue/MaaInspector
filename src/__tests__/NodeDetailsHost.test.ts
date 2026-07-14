import { defineComponent, nextTick, ref } from 'vue'
import { mount, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CustomNode from '@/components/Flow/CustomNode.vue'
import NodeDetailsHost from '@/components/Flow/NodeDetailsHost.vue'
import {
  createNodeDetailsController,
  nodeDetailsControllerKey
} from '@/composables/useNodeDetailsController'
import type { FlowNode, NodeUpdatePayload } from '@/utils/flowTypes'

const createNode = (id: string): FlowNode => ({
  id,
  type: 'custom',
  position: { x: 0, y: 0 },
  data: {
    id,
    type: 'DirectHit',
    data: { id, recognition: 'DirectHit' }
  }
})

const NodeDetailsStub = defineComponent({
  name: 'NodeDetails',
  emits: ['close', 'update-id', 'update-type', 'update-data'],
  props: {
    visible: Boolean,
    nodeId: String,
    nodeData: Object,
    nodeType: String,
    placement: String
  },
  template: '<div class="node-details-stub" :data-node-id="nodeId" :data-placement="placement" />'
})

describe('canvas-level node details', () => {
  it('keeps CustomNode lightweight and delegates opening to the controller', async () => {
    const controller = createNodeDetailsController()
    const updateNode = vi.fn<(payload: NodeUpdatePayload) => void>()
    const node = createNode('node-a')
    const wrapper = shallowMount(CustomNode, {
      props: {
        id: node.id,
        data: node.data!
      },
      global: {
        provide: {
          [nodeDetailsControllerKey as symbol]: controller,
          updateNode,
          currentDirection: ref('TB'),
          imageManager: { getImagesForTemplatePaths: vi.fn(() => []) }
        },
        stubs: { Handle: true }
      }
    })

    expect(wrapper.find('.node-details-stub').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'NodeDetails' }).exists()).toBe(false)

    await wrapper.trigger('dblclick')
    expect(controller.activeTarget.value?.nodeId).toBe('node-a')
    expect(controller.activeTarget.value?.updateNode).toBe(updateNode)

    controller.close()
    await wrapper.get('button[title="打开节点属性"]').trigger('click')
    expect(controller.activeTarget.value?.nodeId).toBe('node-a')
  })

  it('mounts exactly one details instance for the active node only', async () => {
    const controller = createNodeDetailsController()
    const nodes = [createNode('node-a'), createNode('node-b')]
    const wrapper = mount(NodeDetailsHost, {
      props: { nodes },
      global: {
        provide: {
          [nodeDetailsControllerKey as symbol]: controller,
          currentFilename: ref('pipeline.json'),
          pipelineVersion: ref('V1')
        },
        stubs: { NodeDetails: NodeDetailsStub }
      }
    })

    expect(wrapper.findAll('.node-details-stub')).toHaveLength(0)

    controller.open({ nodeId: 'node-a', updateNode: vi.fn() })
    await nextTick()
    expect(wrapper.findAll('.node-details-stub')).toHaveLength(1)
    expect(wrapper.get('.node-details-stub').attributes('data-node-id')).toBe('node-a')
    expect(wrapper.get('.node-details-stub').attributes('data-placement')).toBe('canvas')

    controller.open({ nodeId: 'node-b', updateNode: vi.fn() })
    await nextTick()
    expect(wrapper.findAll('.node-details-stub')).toHaveLength(1)
    expect(wrapper.get('.node-details-stub').attributes('data-node-id')).toBe('node-b')

    controller.close()
    await nextTick()
    expect(wrapper.findAll('.node-details-stub')).toHaveLength(0)
  })

  it('routes edits through the updater captured from the opening canvas', async () => {
    const controller = createNodeDetailsController()
    const updateNode = vi.fn<(payload: NodeUpdatePayload) => void>()
    const wrapper = mount(NodeDetailsHost, {
      props: { nodes: [createNode('node-a')] },
      global: {
        provide: { [nodeDetailsControllerKey as symbol]: controller },
        stubs: { NodeDetails: NodeDetailsStub }
      }
    })

    controller.open({ nodeId: 'node-a', updateNode })
    await nextTick()
    const details = wrapper.getComponent(NodeDetailsStub)

    details.vm.$emit('update-type', 'OCR')
    expect(updateNode).toHaveBeenLastCalledWith({
      oldId: 'node-a',
      newId: 'node-a',
      newType: 'OCR'
    })

    details.vm.$emit('update-data', { id: 'node-a', recognition: 'TemplateMatch' })
    expect(updateNode).toHaveBeenLastCalledWith({
      oldId: 'node-a',
      newId: 'node-a',
      newType: 'TemplateMatch',
      newData: { id: 'node-a', recognition: 'TemplateMatch' }
    })
  })
})
