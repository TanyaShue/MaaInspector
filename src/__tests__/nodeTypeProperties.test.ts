import { describe, expect, it } from 'vitest'
import { removePreviousNodeTypeProperties } from '@/utils/nodeTypeProperties'

describe('removePreviousNodeTypeProperties', () => {
  it('removes recognition-only properties while preserving common ROI fields', () => {
    const result = removePreviousNodeTypeProperties({
      recognition: 'TemplateMatch',
      template: 'image/a.png',
      green_mask: true,
      threshold: 0.8,
      roi: [1, 2, 3, 4],
      roi_offset: [5, 6, 7, 8],
    }, 'recognition', 'TemplateMatch', 'OCR')

    expect(result).toMatchObject({
      recognition: 'OCR',
      roi: [1, 2, 3, 4],
      roi_offset: [5, 6, 7, 8],
      threshold: 0.8,
    })
    expect(result).not.toHaveProperty('template')
    expect(result).not.toHaveProperty('green_mask')
  })

  it('preserves properties shared by the previous and next action types', () => {
    const result = removePreviousNodeTypeProperties({
      action: 'LongPress',
      target: 'NodeA',
      target_offset: [1, 2, 3, 4],
      contact: 2,
      duration: 1200,
    }, 'action', 'LongPress', 'Click')

    expect(result).toEqual({
      action: 'Click',
      target: 'NodeA',
      target_offset: [1, 2, 3, 4],
      contact: 2,
    })
  })
})
