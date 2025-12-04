<script setup>
import {computed, ref} from 'vue' // computed 仅用于 menuItems
import {
  Trash2, Copy, Edit, PlusCircle, RefreshCw, XCircle, ChevronRight,
  Activity, Check, Move, Target, Image, Sparkles, Palette, ScanText, Brain, ScanEye, Code2, Bug, Scissors, HelpCircle,
  Search, FolderClosed
} from 'lucide-vue-next'

const props = defineProps({
  x: {type: Number, required: true},
  y: {type: Number, required: true},
  type: {type: String, required: true}, // 'node' | 'edge' | 'pane'
  data: {type: Object, default: null},
  currentEdgeType: {type: String, default: 'smoothstep'},
  currentSpacing: {type: String, default: 'normal'}
})

const emit = defineEmits(['close', 'action'])
const showSubmenu = ref(null)

const handleAction = (action, payload = null) => {
  emit('action', {action, type: props.type, data: props.data, payload})
  emit('close')
}

// --- 简单的交互逻辑：纯靠 CSS 桥接维持状态 ---
const handleMouseEnter = (key) => {
  showSubmenu.value = key
}

const handleMouseLeave = () => {
  showSubmenu.value = null
}

const nodeTypes = [
  {label: '通用匹配 (DirectHit)', value: 'DirectHit', icon: Target, color: 'text-blue-500'},
  {label: '模板匹配 (Template)', value: 'TemplateMatch', icon: Image, color: 'text-indigo-500'},
  {label: '特征匹配 (Feature)', value: 'FeatureMatch', icon: Sparkles, color: 'text-violet-500'},
  {label: '颜色识别 (Color)', value: 'ColorMatch', icon: Palette, color: 'text-pink-500'},
  {label: 'OCR识别 (Text)', value: 'OCR', icon: ScanText, color: 'text-emerald-500'},
  {label: '模型 分类 (Classify)', value: 'NeuralNetworkClassify', icon: Brain, color: 'text-amber-500'},
  {label: '模型 检测 (Detect)', value: 'NeuralNetworkDetect', icon: ScanEye, color: 'text-orange-500'},
  {label: '自定义 (Custom)', value: 'Custom', icon: Code2, color: 'text-slate-500'},
  {label: '未知节点 (Unknown)', value: 'Unknown', icon: HelpCircle, color: 'text-gray-500'},
]

const edgeTypes = [
  {label: '直角连线 (Step)', value: 'smoothstep', icon: Activity},
  {label: '贝塞尔曲线 (Bezier)', value: 'default', icon: Activity},
]

const spacingTypes = [
  {label: '紧凑 (Compact)', value: 'compact', icon: Move},
  {label: '默认 (Normal)', value: 'normal', icon: Move},
  {label: '宽松 (Loose)', value: 'loose', icon: Move},
]

const menuItems = computed(() => {
  if (props.type === 'node') {
    return [
      {label: '调试该节点', action: 'debug_this_node', icon: Bug, color: 'text-amber-600'},
      {label: '仅识别该节点', action: 'debug_this_reco', icon: Bug, color: 'text-amber-600'},
      {type: 'divider'},
      {label: '复制节点', action: 'duplicate', icon: Copy, color: 'text-slate-600'},
      {type: 'divider'},
      {label: '删除节点', action: 'delete', icon: Trash2, color: 'text-red-500'},
    ]
  } else if (props.type === 'edge') {
    return [
      {label: '断开连接', action: 'delete', icon: Scissors, color: 'text-red-500'}
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
      {type: 'divider'},
      {label: '搜索节点', action: 'search', icon: Search, color: 'text-emerald-600'},
      {label: '关闭所有节点面板', action: 'closeAllDetails', icon: FolderClosed, color: 'text-slate-600'},
      {type: 'divider'},
      {
        label: '自动布局 (Dagre)',
        action: 'layout',
        icon: Move,
        color: 'text-indigo-600'
      },
      {
        key: 'layout-spacing',
        label: '布局间距',
        icon: Move,
        color: 'text-slate-600',
        submenu: spacingTypes,
        submenuAction: 'changeSpacing'
      },
      {
        key: 'edge-type',
        label: '连线类型',
        icon: Activity,
        color: 'text-slate-600',
        submenu: edgeTypes,
        submenuAction: 'changeEdgeType'
      },
      {type: 'divider'},
      {label: '重置视图', action: 'reset', icon: RefreshCw, color: 'text-slate-600'},
      {label: '清除画布', action: 'clear', icon: XCircle, color: 'text-red-500'},
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
    <div v-if="type === 'node'" class="px-3 py-2 bg-slate-50 border-b border-slate-100">
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Node ID</div>
      <div class="font-mono text-xs text-slate-600 truncate">#{{ data.id }}</div>
    </div>
    <div v-if="type === 'edge'" class="px-3 py-2 bg-slate-50 border-b border-slate-100">
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Link</div>
      <div class="font-mono text-xs text-slate-600 truncate">{{ data.label || 'Edge' }}</div>
    </div>

    <ul class="py-1 m-0 list-none">
      <template v-for="(item, index) in menuItems" :key="index">
        <li v-if="item.type === 'divider'" class="h-px bg-slate-100 my-1 mx-2"></li>

        <li
            v-else
            class="relative group"
            @mouseenter="item.submenu ? handleMouseEnter(item.key) : null"
            @mouseleave="handleMouseLeave()"
        >
          <div
              class="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100"
              @click="handleAction(item.action)"
          >
            <div class="flex items-center gap-2">
              <component :is="item.icon" :size="16" :class="item.color"/>
              <span
                  :class="['font-medium text-slate-600', (item.label === '删除节点' || item.label === '断开连接') ? 'text-red-500' : '']">{{
                  item.label
                }}</span>
            </div>
            <ChevronRight v-if="item.submenu" :size="14" class="text-slate-400"/>
          </div>

          <div
              v-if="item.submenu && showSubmenu === item.key"
              class="submenu-panel absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 animate-in slide-in-from-left-2 duration-150 z-[60]"
          >
            <ul class="py-1">
              <li
                  v-for="sub in item.submenu"
                  :key="sub.value"
                  class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50"
                  @click.stop="handleAction(item.submenuAction, sub.value)"
              >
                <div class="flex items-center gap-2">
                  <component v-if="sub.icon" :is="sub.icon" :size="14" :class="sub.color || 'text-slate-500'"/>
                  <span class="text-slate-600 font-medium">{{ sub.label }}</span>
                </div>
                <Check
                    v-if="(item.key === 'edge-type' && sub.value === currentEdgeType) || (item.key === 'layout-spacing' && sub.value === currentSpacing)"
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

<style scoped>
/*
 * 隐形桥核心代码
 * before 伪元素作为桥梁，填充父菜单和子菜单之间的空隙
 * 防止鼠标从父菜单移动到子菜单时因经过空隙而触发 mouseleave
 */
.submenu-panel::before {
  content: '';
  position: absolute;
  left: -1rem; /* 向左延伸，覆盖 ml-1 的间隙并稍微重叠父菜单 */
  top: -0.5rem; /* 稍微向上延伸，增加斜向移动容错 */
  width: 1.5rem; /* 宽度足够覆盖间隙 */
  height: 110%; /* 高度稍微增加，防止从边缘滑出 */
  background: transparent; /* 透明，用户不可见 */
}
</style>