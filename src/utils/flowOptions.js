import { Activity, Move } from 'lucide-vue-next'

// 画布连线类型选项（用于菜单与状态保持）
export const EDGE_TYPE_OPTIONS = [
  { label: '直角连线 (Step)', value: 'smoothstep', icon: Activity },
  { label: '贝塞尔曲线 (Bezier)', value: 'default', icon: Activity }
]

// 布局间距选项（用于菜单与状态保持）
export const SPACING_TYPE_OPTIONS = [
  { label: '紧凑 (Compact)', value: 'compact', icon: Move },
  { label: '默认 (Normal)', value: 'normal', icon: Move },
  { label: '宽松 (Loose)', value: 'loose', icon: Move }
]

// Dagre 布局所需的间距配置
export const SPACING_OPTIONS = {
  compact: { ranksep: 40, nodesep: 30 },
  normal: { ranksep: 80, nodesep: 60 },
  loose: { ranksep: 120, nodesep: 150 }
}

