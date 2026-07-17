import type { Component } from 'vue'
import type { FlowBusinessData } from './flowTypes'
import {
  Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2, HelpCircle,
  Square, MousePointer, Hand, ArrowRight, Layers, Fingerprint, Move,
  Mouse, Keyboard, Type, Play, Terminal, Wand2,
  Loader2, AlertCircle, Ban, CheckCircle2, GitMerge, GitFork
} from 'lucide-vue-next'

interface ConfigItem {
  key: string
  label: string
  icon: Component
  color: string
  bg?: string
  border?: string
}

interface StatusIcon {
  icon?: Component
  color?: string
  spin?: boolean
  headerClass?: string
}

export interface SelectOption<TValue = string> {
  value: TValue
  label: string
  icon?: Component
  color?: string
}

const RECOGNITION_CONFIG: ConfigItem[] = [
  { key: 'DirectHit', label: '直接命中', icon: Target, color: 'text-blue-600', bg: 'bg-blue-500', border: 'border-blue-200' },
  { key: 'TemplateMatch', label: '模板匹配', icon: Image, color: 'text-indigo-600', bg: 'bg-indigo-500', border: 'border-indigo-200' },
  { key: 'FeatureMatch', label: '特征匹配', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-500', border: 'border-violet-200' },
  { key: 'ColorMatch', label: '颜色识别', icon: Palette, color: 'text-pink-600', bg: 'bg-pink-500', border: 'border-pink-200' },
  { key: 'OCR', label: 'OCR识别', icon: ScanText, color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-200' },
  { key: 'NeuralNetworkClassify', label: '模型分类', icon: Brain, color: 'text-amber-600', bg: 'bg-amber-500', border: 'border-amber-200' },
  { key: 'NeuralNetworkDetect', label: '模型检测', icon: ScanEye, color: 'text-orange-600', bg: 'bg-orange-500', border: 'border-orange-200' },
  { key: 'And', label: '逻辑与', icon: GitMerge, color: 'text-teal-600', bg: 'bg-teal-500', border: 'border-teal-200' },
  { key: 'Or', label: '逻辑或', icon: GitFork, color: 'text-cyan-600', bg: 'bg-cyan-500', border: 'border-cyan-200' },
  { key: 'Custom', label: '自定义', icon: Code2, color: 'text-slate-600', bg: 'bg-slate-500', border: 'border-slate-200' },
  { key: 'Anchor', label: '锚点', icon: Target, color: 'text-amber-600', bg: 'bg-amber-500', border: 'border-amber-200' },
  { key: 'Unknown', label: '未知节点', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-400', border: 'border-gray-300' }
]

export const NODE_CONFIG_MAP: Record<string, ConfigItem> = RECOGNITION_CONFIG.reduce((acc, item) => {
  acc[item.key] = item
  return acc
}, {} as Record<string, ConfigItem>)

export const recognitionTypes: SelectOption<string>[] = RECOGNITION_CONFIG
  .filter(t => t.key !== 'Unknown')
  .map(t => ({
    value: t.key,
    label: t.label,
    icon: t.icon,
    color: t.color.replace('600', '500')
  }))

export const recognitionMenuOptions: SelectOption<string>[] = RECOGNITION_CONFIG.map(t => ({
  label: `${t.label} (${t.key})`,
  value: t.key,
  icon: t.icon,
  color: t.color.replace('600', '500')
}))

export type RecognitionType = (typeof recognitionTypes)[number]['value']

const ACTION_CONFIG: ConfigItem[] = [
  { key: 'DoNothing', label: '无动作', icon: Square, color: 'text-slate-400', bg: 'bg-slate-50' },
  { key: 'Click', label: '点击', icon: MousePointer, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'LongPress', label: '长按', icon: Hand, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'Swipe', label: '滑动', icon: ArrowRight, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { key: 'MultiSwipe', label: '多指滑动', icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { key: 'TouchDown', label: '按下', icon: Fingerprint, color: 'text-violet-500', bg: 'bg-violet-50' },
  { key: 'TouchMove', label: '移动', icon: Move, color: 'text-violet-500', bg: 'bg-violet-50' },
  { key: 'TouchUp', label: '抬起', icon: Hand, color: 'text-violet-500', bg: 'bg-violet-50' },
  { key: 'Scroll', label: '滚轮', icon: Mouse, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { key: 'Key', label: '物理按键', icon: Keyboard, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { key: 'ClickKey', label: '按键', icon: Keyboard, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { key: 'LongPressKey', label: '长按键', icon: Keyboard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'KeyDown', label: '键按下', icon: Keyboard, color: 'text-teal-500', bg: 'bg-teal-50' },
  { key: 'KeyUp', label: '键抬起', icon: Keyboard, color: 'text-teal-500', bg: 'bg-teal-50' },
  { key: 'InputText', label: '输入文本', icon: Type, color: 'text-green-500', bg: 'bg-green-50' },
  { key: 'StartApp', label: '启动应用', icon: Play, color: 'text-sky-500', bg: 'bg-sky-50' },
  { key: 'StopApp', label: '停止应用', icon: Square, color: 'text-red-500', bg: 'bg-red-50' },
  { key: 'StopTask', label: '停止任务', icon: Square, color: 'text-rose-500', bg: 'bg-rose-50' },
  { key: 'Command', label: '执行命令', icon: Terminal, color: 'text-amber-500', bg: 'bg-amber-50' },
  { key: 'Shell', label: 'Shell', icon: Terminal, color: 'text-slate-500', bg: 'bg-slate-50' },
  { key: 'Custom', label: '自定义', icon: Wand2, color: 'text-slate-500', bg: 'bg-slate-50' }
]

export const ACTION_CONFIG_MAP: Record<string, ConfigItem> = ACTION_CONFIG.reduce((acc, item) => {
  acc[item.key] = item
  return acc
}, {} as Record<string, ConfigItem>)

export const actionTypes: SelectOption<string>[] = ACTION_CONFIG.map(t => ({
  value: t.key,
  label: t.label,
  icon: t.icon,
  color: t.color
}))

export type ActionType = (typeof actionTypes)[number]['value']

export const STATUS_ICONS: Record<string, StatusIcon> = {
  running: { icon: Loader2, color: 'text-blue-500', spin: true, headerClass: 'bg-blue-100 border-blue-200' },
  error: { icon: AlertCircle, color: 'text-red-500', spin: false, headerClass: 'bg-red-100 border-red-200' },
  success: { icon: CheckCircle2, color: 'text-green-500', spin: false, headerClass: 'bg-green-100 border-green-200' },
  ignored: { icon: Ban, color: 'text-slate-400', spin: false, headerClass: 'bg-slate-100 border-slate-200' },
  missing: { icon: AlertCircle, color: 'text-gray-400', spin: false },
  default: { headerClass: 'bg-slate-50/50 border-slate-100' }
}

export const orderByOptions: Array<{ value: string; label: string }> = [
  { value: 'Horizontal', label: '水平 (Horizontal)' },
  { value: 'Vertical', label: '垂直 (Vertical)' },
  { value: 'Score', label: '分数 (Score)' },
  { value: 'Area', label: '面积 (Area)' },
  { value: 'Length', label: '长度 (Length)' },
  { value: 'Random', label: '随机 (Random)' },
  { value: 'Expected', label: '期望 (Expected)' },
]

export const detectorOptions: string[] = ['SIFT', 'KAZE', 'AKAZE', 'BRISK', 'ORB']

export const templateMatchMethodOptions = [
  { value: 1, label: 'TM_SQDIFF_NORMED (1)' },
  { value: 3, label: 'TM_CCORR_NORMED (3)' },
  { value: 5, label: 'TM_CCOEFF_NORMED (5)' }
]

export const colorMatchMethodOptions = [
  { value: 4, label: 'RGB (4)' },
  { value: 40, label: 'HSV (40)' },
  { value: 6, label: '灰度 (6)' }
]

export const focusEventTypes: string[] = [
  'Node.Recognition.Starting', 'Node.Recognition.Succeeded', 'Node.Recognition.Failed',
  'Node.Action.Starting', 'Node.Action.Succeeded', 'Node.Action.Failed'
]

export const DEFAULTS: FlowBusinessData = {
  recognition: 'DirectHit', action: 'DoNothing', next: [], on_error: [],
  rate_limit: 1000, timeout: 20000, inverse: false, enabled: true, anchor: false,
  pre_delay: 200, post_delay: 200, pre_wait_freezes: 0, post_wait_freezes: 0,
  repeat: 1, repeat_delay: 0, repeat_wait_freezes: 0,
  roi: [0, 0, 0, 0], roi_offset: [0, 0, 0, 0], index: 0, order_by: 'Horizontal',
  threshold: 0.7, method: 5, count: 4, detector: 'SIFT', ratio: 0.6,
  connected: false, only_rec: false, green_mask: false, target: true, duration: 200, contact: 0
}
