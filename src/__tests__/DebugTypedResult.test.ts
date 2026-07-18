import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DebugTypedResult from '@/components/Flow/DebugPanel/DebugTypedResult.vue'

describe('DebugTypedResult', () => {
  it.each([
    ['OCR', { text: '8:50', score: 0.988864, box: [13, 9, 69, 36] }, '识别文本'],
    ['TemplateMatch', { score: 0.9, box: [1, 2, 3, 4] }, '置信度'],
    ['FeatureMatch', { count: 14, box: [1, 2, 3, 4] }, '特征数量'],
    ['ColorMatch', { count: 240, box: [1, 2, 3, 4] }, '特征数量'],
    ['NeuralNetworkDetect', { label: 'button', cls_index: 2, score: 0.8 }, '分类标签'],
    ['Custom', { box: [1, 2, 3, 4], detail: { value: 1 } }, '自定义详情'],
  ])('renders type-specific recognition fields for %s', (type, value, expectedLabel) => {
    const wrapper = mount(DebugTypedResult, {
      props: { mode: 'recognition', type, value, label: '结果' },
    })

    expect(wrapper.text()).toContain(expectedLabel)
    expect(wrapper.text()).toContain(type)
  })

  it('renders action-specific execution fields and copies one field', async () => {
    const wrapper = mount(DebugTypedResult, {
      props: {
        mode: 'action',
        type: 'LongPress',
        value: { point: [10, 20], duration: 1000, contact: 0, pressure: 80 },
        label: '实际执行结果',
      },
    })

    expect(wrapper.text()).toContain('坐标')
    expect(wrapper.text()).toContain('持续时间')
    expect(wrapper.text()).toContain('1000 ms')

    await wrapper.get('[title="复制 duration"]').trigger('click')
    expect(wrapper.emitted('copy')?.[0]).toEqual(['1000'])
  })

  it('keeps confidence compact, gives the box more room and omits the progress bar', () => {
    const wrapper = mount(DebugTypedResult, {
      props: {
        mode: 'recognition',
        type: 'OCR',
        value: { text: 'Target', score: 0.98, box: [773, 271, 57, 59] },
        label: '最佳结果',
      },
    })

    const scoreCard = wrapper.get('[title="复制 score"]').element.closest('.group')
    const boxCard = wrapper.get('[title="复制 box"]').element.closest('.group')
    expect(scoreCard?.classList.contains('col-span-3')).toBe(true)
    expect(boxCard?.classList.contains('col-span-9')).toBe(true)
    expect(wrapper.find('.h-1.overflow-hidden').exists()).toBe(false)
  })
})
