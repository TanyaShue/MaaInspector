import type { Component } from 'vue'
import { Activity, Move } from 'lucide-vue-next'
import { SPACING_OPTIONS } from './useLayout'
import type { SpacingKey } from './flowTypes'

export interface OptionItem<TValue = string> {
  label: string
  value: TValue
  icon?: Component
}

export type EdgeType = 'smoothstep' | 'default'

export const EDGE_TYPE_OPTIONS: OptionItem<EdgeType>[] = [
  { label: '直角连线 (Step)', value: 'smoothstep', icon: Activity },
  { label: '贝塞尔曲线 (Bezier)', value: 'default', icon: Activity }
]

export const SPACING_TYPE_OPTIONS: OptionItem<SpacingKey>[] = [
  { label: '紧凑 (Compact)', value: 'compact', icon: Move },
  { label: '默认 (Normal)', value: 'normal', icon: Move },
  { label: '宽松 (Loose)', value: 'loose', icon: Move }
]

export { SPACING_OPTIONS }

