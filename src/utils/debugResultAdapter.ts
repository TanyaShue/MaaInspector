export interface RecognitionResultGroups {
  all: unknown[]
  filtered: unknown[]
  best?: unknown
}

export interface RecognitionDetailPayload {
  algorithm?: string
  hit?: boolean
  box?: unknown
  raw_detail?: unknown
  all_results?: unknown[]
  filtered_results?: unknown[]
  best_result?: unknown
  sub_details?: unknown[]
  [key: string]: unknown
}

export interface ActionDetailPayload {
  action?: string
  box?: unknown
  success?: boolean
  raw_detail?: unknown
  [key: string]: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null) return []
  return [value]
}

const firstPresent = (source: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}

const hasAnyKey = (source: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => Object.prototype.hasOwnProperty.call(source, key))

const ALL_KEYS = ['all', 'all_results', 'results', 'candidates', 'matches', 'detections']
const FILTERED_KEYS = ['filtered', 'filtered_results', 'hits', 'matched', 'accepted']
const BEST_KEYS = ['best', 'best_result', 'result', 'selected']

/**
 * MaaFramework returns different JSON shapes for each recognizer. Some builds
 * wrap candidates in all/filtered/best, while simple and custom recognizers
 * return one result object directly. Composite recognizers use sub_details.
 */
export const normalizeRecognitionResults = (
  detail: RecognitionDetailPayload
): RecognitionResultGroups => {
  const raw = detail.raw_detail
  const rawRecord = isRecord(raw) ? raw : undefined
  const hasCandidateContainer =
    rawRecord && hasAnyKey(rawRecord, [...ALL_KEYS, ...FILTERED_KEYS, ...BEST_KEYS])

  let all = hasCandidateContainer
    ? asArray(firstPresent(rawRecord, ALL_KEYS))
    : Array.isArray(raw)
      ? raw
      : []
  let filtered = hasCandidateContainer
    ? asArray(firstPresent(rawRecord, FILTERED_KEYS))
    : []
  let best: unknown = hasCandidateContainer ? firstPresent(rawRecord, BEST_KEYS) : undefined

  // Compatibility with earlier MaaInspector responses and plugin-provided
  // recognizers that expose candidate summaries at the top level.
  if (!all.length) all = asArray(detail.all_results)
  if (!filtered.length) filtered = asArray(detail.filtered_results)
  if (best === undefined || best === null) best = detail.best_result

  // And/Or details are recursive recognition results, not plain bounding boxes.
  if (!all.length && Array.isArray(detail.sub_details)) {
    all = detail.sub_details
    filtered = detail.sub_details.filter(
      (item) => isRecord(item) && item.hit === true
    )
    best = filtered[0]
  }

  // TemplateMatch, FeatureMatch, ColorMatch, OCR, NeuralNetwork and Custom may
  // return one algorithm-specific result directly.
  if (
    !all.length &&
    raw !== undefined &&
    raw !== null &&
    (!isRecord(raw) || Object.keys(raw).length > 0)
  ) {
    all = asArray(raw)
  }

  if (!filtered.length && detail.hit) {
    filtered = best !== undefined && best !== null ? [best] : all
  }
  if ((best === undefined || best === null) && detail.hit && filtered.length) {
    best = filtered[0]
  }

  return { all, filtered, best }
}

export const normalizeActionResult = (detail: ActionDetailPayload): unknown => {
  const value = detail.raw_detail
  if (value === undefined || value === null) return {}
  return value
}

export const recognitionResultKind = (type: string) => {
  if (type === 'OCR') return 'ocr'
  if (type === 'TemplateMatch') return 'score'
  if (type === 'FeatureMatch' || type === 'ColorMatch') return 'count'
  if (type === 'NeuralNetworkClassify' || type === 'NeuralNetworkDetect') return 'neural'
  if (type === 'And' || type === 'Or') return 'composite'
  if (type === 'DirectHit') return 'direct'
  if (type === 'Custom') return 'custom'
  return 'generic'
}

export const actionResultFieldOrder: Record<string, string[]> = {
  DoNothing: [],
  Click: ['point', 'contact', 'pressure'],
  LongPress: ['point', 'duration', 'contact', 'pressure'],
  Swipe: ['begin', 'end', 'duration', 'end_hold', 'only_hover', 'starting', 'contact', 'pressure'],
  MultiSwipe: ['swipes'],
  TouchDown: ['point', 'contact', 'pressure'],
  TouchMove: ['point', 'contact', 'pressure'],
  TouchUp: ['point', 'contact', 'pressure'],
  ClickKey: ['keycode'],
  LongPressKey: ['keycode', 'duration'],
  KeyDown: ['keycode'],
  KeyUp: ['keycode'],
  InputText: ['text'],
  StartApp: ['package'],
  StopApp: ['package'],
  StopTask: [],
  Scroll: ['point', 'dx', 'dy'],
  Command: ['exec', 'args', 'detach'],
  Shell: ['cmd', 'shell_timeout', 'success', 'output'],
  Custom: ['box', 'detail'],
}

export const resultFieldLabel = (key: string) => {
  const labels: Record<string, string> = {
    text: '识别文本',
    score: '置信度',
    box: '结果区域',
    count: '特征数量',
    cls_index: '分类索引',
    label: '分类标签',
    detail: '自定义详情',
    algorithm: '识别算法',
    hit: '是否命中',
    point: '坐标',
    begin: '起点',
    end: '终点轨迹',
    duration: '持续时间',
    end_hold: '结束保持',
    only_hover: '仅悬停',
    starting: '起始延迟',
    contact: '触点编号',
    pressure: '压力',
    swipes: '滑动轨迹',
    keycode: '按键码',
    package: '应用包名',
    dx: '水平滚动',
    dy: '垂直滚动',
    cmd: 'Shell 命令',
    shell_timeout: '命令超时',
    success: '执行成功',
    output: '命令输出',
    exec: '执行程序',
    args: '启动参数',
    detach: '分离运行',
  }
  return labels[key] || key
}
