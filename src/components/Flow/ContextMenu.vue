<script setup>
import { computed, ref } from 'vue'
import {
  Trash2, Copy, Edit, PlusCircle, RefreshCw, XCircle, ChevronRight,
  PlayCircle, Cpu, GitBranch, Database, Mail,
  Layout, Activity, Check, Move, Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2, Bug // 新增 Move 图标
} from 'lucide-vue-next'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { type: String, required: true },
  data: { type: Object, default: null },
  currentEdgeType: { type: String, default: 'smoothstep' },
  // 新增：接收当前的间距模式 key
  currentSpacing: { type: String, default: 'normal' }
})

const emit = defineEmits(['close', 'action'])
const showSubmenu = ref(null)

const handleAction = (action, payload = null) => {
  emit('action', { action, type: props.type, data: props.data, payload })
  emit('close')
}

// ... (节点类型配置保持不变) ...
const nodeTypes = [
  { label: '通用匹配 (DirectHit)', value: 'DirectHit', icon: Target, color: 'text-blue-500' },
  { label: '模板匹配 (Template)', value: 'TemplateMatch', icon: Image, color: 'text-indigo-500' },
  { label: '特征匹配 (Feature)', value: 'FeatureMatch', icon: Sparkles, color: 'text-violet-500' },
  { label: '颜色识别 (Color)', value: 'ColorMatch', icon: Palette, color: 'text-pink-500' },
  { label: 'OCR识别 (Text)', value: 'OCR', icon: ScanText, color: 'text-emerald-500' },
  { label: 'AI 分类 (Classify)', value: 'NeuralNetworkClassify', icon: Brain, color: 'text-amber-500' },
  { label: 'AI 检测 (Detect)', value: 'NeuralNetworkDetect', icon: ScanEye, color: 'text-orange-500' },
  { label: '自定义 (Custom)', value: 'Custom', icon: Code2, color: 'text-slate-500' },
]

// ... (连线类型配置保持不变) ...
const edgeTypes = computed(() => [
  { label: '直角连线 (Step)', value: 'smoothstep', icon: Activity },
  { label: '贝塞尔曲线 (Bezier)', value: 'default', icon: Activity },
])

// 新增：布局间距配置
const spacingTypes = computed(() => [
  { label: '紧凑 (Compact)', value: 'compact', icon: Move }, // ranksep: 30, nodesep: 20
  { label: '默认 (Normal)', value: 'normal', icon: Move },   // ranksep: 60, nodesep: 60
  { label: '宽松 (Loose)', value: 'loose', icon: Move },     // ranksep: 100, nodesep: 100
])

const menuItems = computed(() => {
  if (props.type === 'node') {
    return [
      { label: '调试该节点', action: 'debug', icon: Bug, color: 'text-amber-600' },
      { type: 'divider' }, // 加个分割线好看点
      { label: '编辑数据', action: 'edit', icon: Edit, color: 'text-slate-600' },
      { label: '复制节点', action: 'duplicate', icon: Copy, color: 'text-slate-600' },
      { type: 'divider' },
      { label: '删除节点', action: 'delete', icon: Trash2, color: 'text-red-500' },
    ]
  } else {
    return [
      {
        key: 'add-node',
        label: '添加节点',
        action: 'add',
        icon: PlusCircle,
        color: 'text-blue-600',
        submenu: nodeTypes,
        submenuAction: 'add'
      },
      { type: 'divider' },
      {
        label: '自动布局 (Dagre)',
        action: 'layout',
        icon: Layout,
        color: 'text-indigo-600'
      },
      // 新增：布局间距子菜单
      {
        key: 'layout-spacing',
        label: '布局间距',
        icon: Move,
        color: 'text-slate-600',
        submenu: spacingTypes.value,
        submenuAction: 'changeSpacing'
      },
      {
        key: 'edge-type',
        label: '连线类型',
        icon: Activity,
        color: 'text-slate-600',
        submenu: edgeTypes.value,
        submenuAction: 'changeEdgeType'
      },
      { type: 'divider' },
      { label: '重置视图', action: 'reset', icon: RefreshCw, color: 'text-slate-600' },
      { label: '清除画布', action: 'clear', icon: XCircle, color: 'text-red-500' },
    ]
  }
})
</script>

<template>
  <div
    class="fixed z-50 w-52 bg-white rounded-lg shadow-xl border border-slate-100 text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-left font-sans select-none"
    :style="{ top: `${y}px`, left: `${x}px` }"
    @contextmenu.prevent
  >
    <!-- ... (头部保持不变) ... -->
    <div v-if="type === 'node'" class="px-3 py-2 bg-slate-50 border-b border-slate-100">
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Node ID</div>
      <div class="font-mono text-xs text-slate-600 truncate">#{{ data.id }}</div>
    </div>

    <ul class="py-1 m-0 list-none">
      <template v-for="(item, index) in menuItems" :key="index">
        <li v-if="item.type === 'divider'" class="h-px bg-slate-100 my-1 mx-2"></li>

        <li
          v-else
          class="relative group"
          @mouseenter="item.submenu ? showSubmenu = item.key : null"
          @mouseleave="item.submenu ? showSubmenu = null : null"
        >
          <div
            class="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100"
            @click="handleAction(item.action)"
          >
            <div class="flex items-center gap-2">
              <component :is="item.icon" :size="16" :class="item.color" />
              <span :class="['font-medium text-slate-600', item.label === '删除节点' ? 'text-red-500' : '']">{{ item.label }}</span>
            </div>
            <ChevronRight v-if="item.submenu" :size="14" class="text-slate-400" />
          </div>

          <!-- 子菜单 -->
          <div
            v-if="item.submenu && showSubmenu === item.key"
            class="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-left-2 duration-150"
          >
            <ul class="py-1">
              <li
                v-for="sub in item.submenu"
                :key="sub.value"
                class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50"
                @click.stop="handleAction(item.submenuAction, sub.value)"
              >
                <div class="flex items-center gap-2">
                  <component v-if="sub.icon" :is="sub.icon" :size="14" :class="sub.color || 'text-slate-500'" />
                  <span class="text-slate-600 font-medium">{{ sub.label }}</span>
                </div>

                <!-- 连线类型选中状态 -->
                <Check
                  v-if="item.key === 'edge-type' && sub.value === currentEdgeType"
                  :size="14"
                  class="text-blue-600"
                />

                <!-- 新增：布局间距选中状态 -->
                <Check
                  v-if="item.key === 'layout-spacing' && sub.value === currentSpacing"
                  :size="14"
                  class="text-blue-600"
                />
              </li>
            </ul>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>