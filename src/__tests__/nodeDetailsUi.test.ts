import { describe, expect, it } from 'vitest'
import uiConfigJson from '../../public/node-details.ui.json'
import pipelineSchemaJson from '../../public/pipeline.schema.json'
import {
  removeConfiguredNodeTypeProperties,
  resolveLayoutFields,
  validateNodeDetailsUiConfig,
  type NodeDetailsUiConfig,
  type PipelineSchemaDocument
} from '@/utils/nodeDetailsUi'

const uiConfig = uiConfigJson as NodeDetailsUiConfig
const pipelineSchema = pipelineSchemaJson as unknown as PipelineSchemaDocument

describe('node details UI configuration', () => {
  it('has valid grid spans and preset references', () => {
    expect(validateNodeDetailsUiConfig(uiConfig)).toEqual([])
  })

  it('uses pipeline schema as the source of field types and defaults', () => {
    const fields = resolveLayoutFields(pipelineSchema, uiConfig, uiConfig.recognition.OCR)
    const threshold = fields.find(field => field.key === 'threshold')
    const orderBy = fields.find(field => field.key === 'order_by')

    expect(threshold).toMatchObject({ defaultValue: 0.3 })
    expect(threshold?.schema.description).toContain('模型置信度阈值')
    expect(orderBy?.options.map(option => option.value)).toContain('Expected')
  })

  it('keeps configured order, width and row span', () => {
    const fields = resolveLayoutFields(pipelineSchema, uiConfig, uiConfig.layouts.common)

    expect(fields.slice(0, 4).map(field => field.key)).toEqual([
      'rate_limit', 'timeout', 'inverse', 'enabled'
    ])
    expect(fields.find(field => field.key === 'attach')).toMatchObject({ span: 10, rowSpan: 2 })
  })

  it('removes fields belonging only to the previous node type', () => {
    const result = removeConfiguredNodeTypeProperties({
      recognition: 'TemplateMatch',
      template: 'a.png',
      threshold: 0.8,
      roi: [1, 2, 3, 4],
      next: ['Done']
    }, 'recognition', 'TemplateMatch', 'OCR', uiConfig)

    expect(result).not.toHaveProperty('template')
    expect(result).toMatchObject({
      recognition: 'OCR',
      threshold: 0.8,
      roi: [1, 2, 3, 4],
      next: ['Done']
    })
  })
})
