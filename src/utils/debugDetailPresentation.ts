import type { FlowBusinessData } from '@/utils/flowTypes'

export interface DebugDetailField {
  key: string
  label: string
  value: unknown
  text: string
  kind: 'text' | 'number' | 'boolean' | 'rect' | 'point' | 'list' | 'json'
}

const labels: Record<string, string> = {
  template: '模板图片',
  roi: '识别区域',
  roi_offset: '区域偏移',
  threshold: '阈值',
  method: '匹配方法',
  green_mask: '绿色遮罩',
  expected: '期望内容',
  model: '模型',
  replace: '文本替换',
  only_rec: '仅识别',
  count: '目标数量',
  detector: '特征检测器',
  ratio: '距离比率',
  lower: '颜色下界',
  upper: '颜色上界',
  connected: '连通区域',
  labels: '分类标签',
  all_of: '全部条件',
  any_of: '任一条件',
  box_index: '结果框索引',
  custom_recognition: '自定义识别器',
  custom_recognition_param: '识别参数',
  target: '动作目标',
  target_offset: '目标偏移',
  begin: '起点',
  begin_offset: '起点偏移',
  end: '终点',
  end_offset: '终点偏移',
  duration: '持续时间 (ms)',
  end_hold: '结束保持 (ms)',
  contact: '触点编号',
  pressure: '压力',
  dx: '水平滚动',
  dy: '垂直滚动',
  key: '按键码',
  input_text: '输入文本',
  package: '应用包名',
  exec: '程序',
  args: '参数',
  detach: '分离运行',
  cmd: 'Shell 命令',
  shell_timeout: '命令超时',
  custom_action: '自定义动作',
  custom_action_param: '动作参数',
  pre_delay: '动作前延迟',
  post_delay: '动作后延迟',
}

const recognitionKeys: Record<string, string[]> = {
  TemplateMatch: ['template', 'roi', 'roi_offset', 'threshold', 'method', 'green_mask'],
  FeatureMatch: ['template', 'roi', 'roi_offset', 'count', 'detector', 'ratio', 'green_mask'],
  ColorMatch: ['roi', 'roi_offset', 'method', 'lower', 'upper', 'count', 'connected'],
  OCR: ['roi', 'roi_offset', 'expected', 'threshold', 'model', 'replace', 'only_rec'],
  NeuralNetworkClassify: ['roi', 'roi_offset', 'model', 'expected', 'labels'],
  NeuralNetworkDetect: ['roi', 'roi_offset', 'model', 'expected', 'labels', 'threshold'],
  And: ['all_of', 'box_index'],
  Or: ['any_of', 'box_index'],
  Custom: ['custom_recognition', 'custom_recognition_param'],
}

const actionKeys: Record<string, string[]> = {
  Click: ['target', 'target_offset', 'contact'],
  LongPress: ['target', 'target_offset', 'contact', 'duration'],
  Swipe: ['begin', 'begin_offset', 'end', 'end_offset', 'duration', 'end_hold'],
  MultiSwipe: ['swipes', 'duration', 'end_hold'],
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

const stringify = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const inferKind = (key: string, value: unknown): DebugDetailField['kind'] => {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) {
    if ((key === 'roi' || key === 'roi_offset') && value.length === 4) return 'rect'
    if (/target|begin|end|offset/.test(key) && value.length >= 2 && value.length <= 4)
      return 'point'
    return 'list'
  }
  if (value && typeof value === 'object') return 'json'
  return 'text'
}

export const buildDebugConfigFields = (
  data: FlowBusinessData | undefined,
  kind: 'recognition' | 'action',
  type: string
): DebugDetailField[] => {
  if (!data) return []
  const keys = kind === 'recognition' ? recognitionKeys[type] || [] : actionKeys[type] || []
  const withTiming = kind === 'action' ? [...keys, 'pre_delay', 'post_delay'] : keys
  return [...new Set(withTiming)]
    .filter((key) => data[key] !== undefined)
    .map((key) => ({
      key,
      label: labels[key] || key,
      value: data[key],
      text: stringify(data[key]),
      kind: inferKind(key, data[key]),
    }))
}

export const formatDebugRect = (value: unknown) => {
  if (Array.isArray(value) && value.length >= 4) {
    return `x ${value[0]} · y ${value[1]} · 宽 ${value[2]} · 高 ${value[3]}`
  }
  return stringify(value)
}
