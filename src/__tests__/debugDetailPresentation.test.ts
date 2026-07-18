import { describe, expect, it } from 'vitest'
import { buildDebugConfigFields, formatDebugRect } from '@/utils/debugDetailPresentation'

describe('debug detail presentation', () => {
  it('selects recognition-specific fields and gives them readable labels', () => {
    const fields = buildDebugConfigFields(
      {
        recognition: 'TemplateMatch',
        template: ['button.png'],
        roi: [10, 20, 300, 120],
        threshold: 0.82,
        duration: 999,
      },
      'recognition',
      'TemplateMatch'
    )

    expect(fields.map((field) => field.key)).toEqual(['template', 'roi', 'threshold'])
    expect(fields.find((field) => field.key === 'roi')).toMatchObject({
      label: '识别区域',
      kind: 'rect',
    })
  })

  it('selects action-specific fields independently from recognition fields', () => {
    const fields = buildDebugConfigFields(
      {
        action: 'Swipe',
        begin: [10, 20],
        end: [200, 300],
        duration: 500,
        threshold: 0.9,
        pre_delay: 100,
      },
      'action',
      'Swipe'
    )

    expect(fields.map((field) => field.key)).toEqual(['begin', 'end', 'duration', 'pre_delay'])
    expect(formatDebugRect([1, 2, 3, 4])).toBe('x 1 · y 2 · 宽 3 · 高 4')
  })
})
