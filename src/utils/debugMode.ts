export type DebugMode = 'direct' | 'recognition_only' | 'single_node'

export const DEBUG_MODE_OPTIONS: Array<{ value: DebugMode; label: string }> = [
  { value: 'direct', label: '直接调试' },
  { value: 'recognition_only', label: '仅识别' },
  { value: 'single_node', label: '仅执行该节点' },
]
