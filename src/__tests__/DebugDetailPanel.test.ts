import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DebugDetailPanel from '@/components/Flow/DebugPanel/DebugDetailPanel.vue'

describe('DebugDetailPanel', () => {
  it('renders recognition and action as separate type-aware sections', async () => {
    const wrapper = mount(DebugDetailPanel, {
      props: {
        detail: {
          record: {
            recordId: 'record-1',
            taskId: 42,
            name: 'Root',
            nextList: [],
            timestamp: 1
          },
          child: { name: 'Target' },
          meta: {
            algorithm: 'TemplateMatch',
            hit: true,
            box: [10, 20, 100, 50]
          },
          recognition: {
            type: 'TemplateMatch',
            status: 'succeeded',
            id: 1001,
            snapshot: { mainImage: 'data:image/png;base64,reco', drawImages: [] },
            rawFields: { algorithm: 'TemplateMatch', hit: true },
            results: {
              all: [{ score: 0.75, box: [1, 2, 3, 4] }],
              filtered: [{ score: 0.93, box: [10, 20, 100, 50] }],
              best: { score: 0.93, box: [10, 20, 100, 50] }
            },
            parameters: [
              {
                key: 'threshold',
                label: '阈值',
                value: 0.8,
                text: '0.8',
                kind: 'number'
              }
            ]
          },
          action: {
            type: 'Click',
            status: 'succeeded',
            id: 2001,
            snapshot: { mainImage: 'data:image/png;base64,action', drawImages: [] },
            rawFields: { action_id: 2001, status: 'succeeded' },
            parameters: [
              {
                key: 'target',
                label: '动作目标',
                value: [30, 40],
                text: '[30,40]',
                kind: 'point'
              }
            ]
          }
        }
      }
    })

    expect(wrapper.text()).toContain('识别 · 模板匹配')
    expect(wrapper.text()).toContain('动作 · 点击')
    expect(wrapper.text()).toContain('算法输出')
    expect(wrapper.text()).toContain('全部结果')
    expect(wrapper.text()).toContain('命中结果')
    expect(wrapper.text()).toContain('最佳结果')
    expect(wrapper.text()).toContain('识别快照')
    expect(wrapper.text()).toContain('动作快照')
    expect(wrapper.text()).toContain('识别原始字段')
    expect(wrapper.text()).toContain('动作原始字段')
    expect(wrapper.text()).toContain('动作目标')

    const details = wrapper.findAll('details')
    const recognitionSnapshot = details.find((item) => item.text().includes('识别快照'))
    const actionSnapshot = details.find((item) => item.text().includes('动作快照'))
    const recognitionRaw = details.find((item) => item.text().includes('识别原始字段'))
    const actionRaw = details.find((item) => item.text().includes('动作原始字段'))
    expect(recognitionSnapshot?.attributes('open')).toBeDefined()
    expect(actionSnapshot?.attributes('open')).toBeDefined()
    expect(recognitionRaw?.attributes('open')).toBeUndefined()
    expect(actionRaw?.attributes('open')).toBeUndefined()

    const scoreCopyButtons = wrapper.findAll('[title="复制 score"]')
    expect(scoreCopyButtons.length).toBeGreaterThan(0)
    await scoreCopyButtons[0].trigger('click')
    expect(wrapper.emitted('copy')?.[0]).toEqual(['0.75'])
  })
})
