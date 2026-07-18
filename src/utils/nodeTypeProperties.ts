import type { FlowBusinessData } from './flowTypes'

type NodeTypeKind = 'recognition' | 'action'

const recognitionProperties: Record<string, string[]> = {
  TemplateMatch: ['template', 'green_mask', 'threshold', 'method'],
  FeatureMatch: ['template', 'green_mask', 'count', 'detector', 'ratio'],
  ColorMatch: ['method', 'lower', 'upper', 'count', 'connected'],
  OCR: ['expected', 'threshold', 'model', 'replace', 'only_rec'],
  NeuralNetworkClassify: ['model', 'expected', 'labels'],
  NeuralNetworkDetect: ['model', 'expected', 'labels', 'threshold'],
  And: ['all_of', 'box_index'],
  Or: ['any_of', 'box_index'],
  Custom: ['custom_recognition', 'custom_recognition_param'],
}

const actionProperties: Record<string, string[]> = {
  Click: ['target', 'target_offset', 'contact'],
  LongPress: ['target', 'target_offset', 'contact', 'duration'],
  Swipe: [
    'begin', 'begin_offset', 'end', 'end_offset', 'duration', 'end_hold', 'only_hover',
  ],
  MultiSwipe: [
    'swipes', 'begin', 'begin_offset', 'end', 'end_offset', 'duration', 'end_hold',
    'only_hover',
  ],
  TouchDown: ['target', 'target_offset', 'contact', 'pressure'],
  TouchMove: ['target', 'target_offset', 'contact', 'pressure'],
  TouchUp: ['target', 'target_offset', 'contact', 'pressure'],
  Scroll: ['dx', 'dy'],
  Key: ['key'],
  ClickKey: ['key'],
  LongPressKey: ['key', 'duration'],
  KeyDown: ['key'],
  KeyUp: ['key'],
  InputText: ['input_text'],
  StartApp: ['package'],
  StopApp: ['package'],
  Command: ['exec', 'args', 'detach'],
  Shell: ['cmd', 'shell_timeout'],
  Custom: ['target', 'target_offset', 'custom_action', 'custom_action_param'],
}

const propertyMaps: Record<NodeTypeKind, Record<string, string[]>> = {
  recognition: recognitionProperties,
  action: actionProperties,
}

export const removePreviousNodeTypeProperties = (
  data: FlowBusinessData,
  kind: NodeTypeKind,
  previousType: string,
  nextType: string
): FlowBusinessData => {
  if (previousType === nextType) return { ...data }

  const next = { ...data } as Record<string, unknown>
  const previousKeys = propertyMaps[kind][previousType] || []
  const nextKeys = new Set(propertyMaps[kind][nextType] || [])
  previousKeys.forEach(key => {
    if (!nextKeys.has(key)) delete next[key]
  })
  next[kind] = nextType
  return next as FlowBusinessData
}
