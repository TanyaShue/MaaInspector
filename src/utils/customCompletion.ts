import type { CustomCompletionOption, JsonSchemaRule } from '@/services/api'

export const getSchemaType = (schema?: JsonSchemaRule): string => {
  const type = schema?.type
  if (type === 'array' || type === 'object') return 'json'
  if (typeof type === 'string') return type
  if (Array.isArray(type) && type.length === 1) return type[0]
  if (schema?.enum?.length) return typeof schema.enum[0]
  return 'json'
}

export const createDefaultCustomParams = (
  rule?: CustomCompletionOption
): Record<string, unknown> => {
  const properties = rule?.param_schema?.properties || {}
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, schema]) => schema.default !== undefined)
      .map(([key, schema]) => [key, structuredClone(schema.default)])
  )
}

export const parseCustomFieldValue = (raw: string, schema?: JsonSchemaRule): unknown => {
  if (raw === '') return undefined
  const type = getSchemaType(schema)
  if (type === 'integer') {
    const value = Number.parseInt(raw, 10)
    return Number.isNaN(value) ? raw : value
  }
  if (type === 'number') {
    const value = Number(raw)
    return Number.isNaN(value) ? raw : value
  }
  if (type === 'json') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

export const stringifyCustomFieldValue = (value: unknown, schema?: JsonSchemaRule): string => {
  if (value === undefined || value === null) return ''
  return getSchemaType(schema) === 'json' && typeof value === 'object'
    ? JSON.stringify(value)
    : String(value)
}
