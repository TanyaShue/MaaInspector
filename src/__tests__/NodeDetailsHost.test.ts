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
  props: {
    visible: Boolean,
    nodeId: String,
    nodeData: Object,
    nodeType: String,
    placement: String
  },
  emits: ['close', 'update-id', 'update-type', 'update-data'],
  template: '<div class="node-details-stub" :data-node-id="nodeId" :data-placement="placement" />'
})

describe('node-anchored details panels', () => {
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
    expect(controller.activeTarget.value?.anchorElement).toBe(wrapper.element)

    controller.close()
    await wrapper.get('button[title="打开节点属性"]').trigger('click')
    expect(controller.activeTarget.value?.nodeId).toBe('node-a')
  })

  it('mounts up to five panels at their nodes and evicts the oldest panel', async () => {
    const controller = createNodeDetailsController()
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => createNode(`node-${id}`))
    const anchors = nodes.map(() => document.createElement('div'))
    document.body.append(...anchors)
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

    expect(document.querySelectorAll('.node-details-stub')).toHaveLength(0)

    nodes.forEach((node, index) => {
      controller.open({ nodeId: node.id, updateNode: vi.fn(), anchorElement: anchors[index] })
    })
    await nextTick()
    expect(controller.targets.value).toHaveLength(5)
    expect(anchors[0].querySelectorAll('.node-details-stub')).toHaveLength(0)
    anchors.slice(1).forEach((anchor, index) => {
      expect(anchor.querySelectorAll('.node-details-stub')).toHaveLength(1)
      expect(anchor.querySelector('.node-details-stub')?.getAttribute('data-node-id')).toBe(nodes[index + 1].id)
      expect(anchor.querySelector('.node-details-stub')?.getAttribute('data-placement')).toBe('node')
    })

    controller.toggle({ nodeId: nodes[2].id, updateNode: vi.fn(), anchorElement: anchors[2] })
    await nextTick()
    expect(controller.targets.value).toHaveLength(4)
    expect(anchors[2].querySelectorAll('.node-details-stub')).toHaveLength(0)
    expect(anchors[3].querySelectorAll('.node-details-stub')).toHaveLength(1)

    controller.close()
    await nextTick()
    expect(document.querySelectorAll('.node-details-stub')).toHaveLength(0)
    wrapper.unmount()
    anchors.forEach(anchor => anchor.remove())
  })

  it('routes edits through the updater captured from the opening canvas', async () => {
    const controller = createNodeDetailsController()
    const updateNode = vi.fn<(payload: NodeUpdatePayload) => void>()
    const anchorElement = document.createElement('div')
    const wrapper = mount(NodeDetailsHost, {
      props: { nodes: [createNode('node-a')] },
      global: {
        provide: { [nodeDetailsControllerKey as symbol]: controller },
        stubs: { Teleport: true, NodeDetails: NodeDetailsStub }
      }
    })

    controller.open({ nodeId: 'node-a', updateNode, anchorElement })
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
