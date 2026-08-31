export type NodeDetailsKind = 'recognition' | 'action'
export type NodeDetailsControl =
  | 'text' | 'textarea' | 'number' | 'checkbox' | 'select'
  | 'json' | 'textarea-json' | 'target' | 'action'
export type NodeDetailsActionType = 'picker' | 'ocr' | 'image-manager' | 'color-range'

export interface NodeDetailsFieldAction {
  type: NodeDetailsActionType
  label: string
  referenceField?: string | null
}

export interface NodeDetailsFieldConfig {
  key: string
  span: number
  rowSpan?: number
  label?: string
  control: NodeDetailsControl
  min?: number
  max?: number
  step?: number
  optional?: boolean
  forceString?: boolean
  actions?: NodeDetailsFieldAction[]
}

export interface NodeDetailsLayoutConfig {
  schemaDef: string
  renderer?: 'fields' | 'legacy'
  use?: string
  emptyText?: string
  fields?: NodeDetailsFieldConfig[]
  append?: NodeDetailsFieldConfig[]
}

export interface NodeDetailsTabConfig {
  key: string
  label: string
  icon: string
  renderer: 'basic' | 'flow' | 'focus' | 'json' | 'fields' | 'node-fields'
  layout?: string
  kind?: NodeDetailsKind
}

export interface NodeDetailsUiConfig {
  version: number
  gridColumns: number
  fieldLabels?: Record<string, string>
  tabs: NodeDetailsTabConfig[]
  layouts: Record<string, NodeDetailsLayoutConfig>
  recognition: Record<string, NodeDetailsLayoutConfig>
  action: Record<string, NodeDetailsLayoutConfig>
  presets?: Record<string, NodeDetailsFieldConfig[]>
}

export interface PipelineSchemaNode {
  title?: string
  description?: string
  markdownDescription?: string
  type?: string | string[]
  enum?: unknown[]
  default?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  properties?: Record<string, PipelineSchemaNode>
  required?: string[]
  allOf?: PipelineSchemaNode[]
  anyOf?: PipelineSchemaNode[]
  oneOf?: PipelineSchemaNode[]
  items?: boolean | PipelineSchemaNode | PipelineSchemaNode[]
  $ref?: string
  const?: unknown
}

export interface PipelineSchemaDocument extends PipelineSchemaNode {
  $defs: Record<string, PipelineSchemaNode>
}

export interface ResolvedNodeDetailsField extends NodeDetailsFieldConfig {
  label: string
  description?: string
  schema: PipelineSchemaNode
  required: boolean
  defaultValue?: unknown
  options: Array<{ value: unknown; label: string }>
}

const pointerUnescape = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~')

export const resolveSchemaPointer = (
  schema: PipelineSchemaDocument,
  ref: string
): PipelineSchemaNode | undefined => {
  if (!ref.startsWith('#/')) return undefined
  let current: unknown = schema
  for (const segment of ref.slice(2).split('/').map(pointerUnescape)) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current as PipelineSchemaNode | undefined
}

const mergeSchemaNodes = (base: PipelineSchemaNode, patch: PipelineSchemaNode): PipelineSchemaNode => ({
  ...base,
  ...patch,
  properties: { ...(base.properties || {}), ...(patch.properties || {}) },
  required: [...new Set([...(base.required || []), ...(patch.required || [])])]
})

export const dereferenceSchemaNode = (
  schema: PipelineSchemaDocument,
  node: PipelineSchemaNode | undefined,
  seen = new Set<string>()
): PipelineSchemaNode => {
  if (!node) return {}
  let resolved: PipelineSchemaNode = { ...node }
  if (node.$ref && !seen.has(node.$ref)) {
    const nextSeen = new Set(seen).add(node.$ref)
    resolved = mergeSchemaNodes(
      dereferenceSchemaNode(schema, resolveSchemaPointer(schema, node.$ref), nextSeen),
      { ...node, $ref: undefined }
    )
  }
  for (const branch of node.allOf || []) {
    resolved = mergeSchemaNodes(resolved, dereferenceSchemaNode(schema, branch, seen))
  }
  return resolved
}

const getPropertySchema = (
  schema: PipelineSchemaDocument,
  definition: PipelineSchemaNode,
  key: string
): PipelineSchemaNode => {
  const direct = definition.properties?.[key]
  if (direct) return dereferenceSchemaNode(schema, direct)
  for (const branch of definition.allOf || []) {
    const found = getPropertySchema(schema, dereferenceSchemaNode(schema, branch), key)
    if (Object.keys(found).length) return found
  }
  for (const branch of [...(definition.anyOf || []), ...(definition.oneOf || [])]) {
    const found = getPropertySchema(schema, dereferenceSchemaNode(schema, branch), key)
    if (Object.keys(found).length) return found
  }
  return {}
}

const getRequiredFields = (
  schema: PipelineSchemaDocument,
  definition: PipelineSchemaNode
): Set<string> => {
  const required = new Set(definition.required || [])
  for (const branch of definition.allOf || []) {
    for (const key of getRequiredFields(schema, dereferenceSchemaNode(schema, branch))) required.add(key)
  }
  return required
}

const humanizeKey = (key: string) => key
  .replace(/^\$/, '')
  .split('_')
  .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
  .join(' ')

export const resolveLayoutFields = (
  schema: PipelineSchemaDocument,
  uiConfig: NodeDetailsUiConfig,
  layout: NodeDetailsLayoutConfig
): ResolvedNodeDetailsField[] => {
  const definition = dereferenceSchemaNode(schema, schema.$defs[layout.schemaDef])
  const configured = [
    ...(layout.use ? uiConfig.presets?.[layout.use] || [] : []),
    ...(layout.fields || []),
    ...(layout.append || [])
  ]
  const deduplicated = configured.filter((field, index, list) =>
    list.findIndex(candidate => candidate.key === field.key) === index
  )
  const required = getRequiredFields(schema, definition)
  return deduplicated.map(field => {
    const property = field.key.startsWith('$') ? {} : getPropertySchema(schema, definition, field.key)
    const options = (property.enum || []).map(value => ({ value, label: String(value) }))
    return {
      ...field,
      label: field.label || uiConfig.fieldLabels?.[field.key] || property.title || humanizeKey(field.key),
      description: property.description,
      schema: property,
      required: required.has(field.key),
      defaultValue: property.default,
      options
    }
  })
}

export const getNodeLayout = (
  uiConfig: NodeDetailsUiConfig,
  kind: NodeDetailsKind,
  nodeType: string
): NodeDetailsLayoutConfig | undefined => uiConfig[kind][nodeType]

export const getLayoutPropertyKeys = (
  uiConfig: NodeDetailsUiConfig,
  layout: NodeDetailsLayoutConfig | undefined
): string[] => {
  if (!layout) return []
  return [
    ...(layout.use ? uiConfig.presets?.[layout.use] || [] : []),
    ...(layout.fields || []),
    ...(layout.append || [])
  ].map(field => field.key).filter(key => !key.startsWith('$'))
}

export const removeConfiguredNodeTypeProperties = <T extends Record<string, unknown>>(
  data: T,
  kind: NodeDetailsKind,
  previousType: string,
  nextType: string,
  uiConfig: NodeDetailsUiConfig
): T => {
  if (previousType === nextType) return { ...data }
  const next: Record<string, unknown> = { ...data }
  const previousKeys = getLayoutPropertyKeys(uiConfig, getNodeLayout(uiConfig, kind, previousType))
  const nextKeys = new Set(getLayoutPropertyKeys(uiConfig, getNodeLayout(uiConfig, kind, nextType)))
  previousKeys.forEach(key => {
    if (!nextKeys.has(key)) delete next[key]
  })
  next[kind] = nextType
  return next as T
}

export const validateNodeDetailsUiConfig = (config: NodeDetailsUiConfig): string[] => {
  const errors: string[] = []
  if (!Number.isInteger(config.gridColumns) || config.gridColumns < 1) {
    errors.push('gridColumns must be a positive integer')
  }
  const tabKeys = new Set<string>()
  config.tabs.forEach(tab => {
    if (tabKeys.has(tab.key)) errors.push(`duplicate tab key: ${tab.key}`)
    tabKeys.add(tab.key)
  })
  const layouts = [
    ...Object.entries(config.layouts),
    ...Object.entries(config.recognition),
    ...Object.entries(config.action)
  ]
  layouts.forEach(([name, layout]) => {
    const fields = [
      ...(layout.use ? config.presets?.[layout.use] || [] : []),
      ...(layout.fields || []),
      ...(layout.append || [])
    ]
    if (layout.use && !config.presets?.[layout.use]) errors.push(`${name}: unknown preset ${layout.use}`)
    fields.forEach(field => {
      if (field.span < 1 || field.span > config.gridColumns) {
        errors.push(`${name}.${field.key}: span must be between 1 and ${config.gridColumns}`)
      }
    })
  })
  return errors
}
