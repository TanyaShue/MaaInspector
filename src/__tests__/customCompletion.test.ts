import { describe, expect, it } from 'vitest'
import {
  createDefaultCustomParams,
  getSchemaType,
  parseCustomFieldValue,
} from '@/utils/customCompletion'

describe('custom completion helpers', () => {
  it('creates parameters only from schema defaults', () => {
    expect(
      createDefaultCustomParams({
        value: 'Demo',
        param_schema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            count: { type: 'integer', default: 2 },
            name: { type: 'string' },
          },
        },
      })
    ).toEqual({ enabled: true, count: 2 })
  })

  it('converts simple field values using their schema type', () => {
    expect(parseCustomFieldValue('3', { type: 'integer' })).toBe(3)
    expect(parseCustomFieldValue('0.5', { type: 'number' })).toBe(0.5)
    expect(parseCustomFieldValue('[1,2,3]', { type: 'array' })).toEqual([1, 2, 3])
    expect(
      parseCustomFieldValue('manual', { oneOf: [{ type: 'number' }, { type: 'string' }] })
    ).toBe('manual')
  })

  it('recognizes enums as the type of their values', () => {
    expect(getSchemaType({ enum: ['in', 'out'] })).toBe('string')
  })
})
