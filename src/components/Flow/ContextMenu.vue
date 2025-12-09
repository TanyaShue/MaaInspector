<script setup>
import {computed, ref} from 'vue' // computed 仅用于 menuItems
import {
  Trash2, Copy, Edit, PlusCircle, RefreshCw, XCircle, ChevronRight,
  Check, Bug, Scissors, Search, FolderClosed, Repeat, ArrowRightCircle, Move
} from 'lucide-vue-next'
import { recognitionMenuOptions } from '../../utils/nodeLogic'
import { EDGE_TYPE_OPTIONS, SPACING_TYPE_OPTIONS } from '../../utils/flowOptions'

const props = defineProps({
  x: {type: Number, required: true},
  y: {type: Number, required: true},
  type: {type: String, required: true}, // 'node' | 'edge' | 'pane'
  data: {type: Object, default: null},
  currentEdgeType: {type: String, default: 'smoothstep'},
  currentSpacing: {type: String, default: 'normal'},
  debugPanelVisible: {type: Boolean, default: false},
  searchVisible: {type: Boolean, default: false}
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

const menuItems = computed(() => {
  if (props.type === 'node') {
    return [
      {label: '调试该节点', action: 'debug_this_node', icon: Bug, color: 'text-amber-600'},
      {label: '仅识别该节点', action: 'debug_this_node_reco', icon: Bug, color: 'text-amber-600'},
      {label: '在调试窗口中调试', action: 'debug_in_panel', icon: Bug, color: 'text-amber-700'},
      {label: '重新布局任务链', action: 'layout_chain', icon: Move, color: 'text-indigo-600'},
      {type: 'divider'},
      {label: '复制节点', action: 'duplicate', icon: Copy, color: 'text-slate-600'},
      {type: 'divider'},
      {label: '删除节点', action: 'delete', icon: Trash2, color: 'text-red-500'},
    ]
  } else if (props.type === 'edge') {
    const items = []

    // 仅当 sourceHandle 为 Next (source-a) 或 Error (source-c) 时显示 JumpBack 选项
    if (props.data && (props.data.sourceHandle === 'source-a' || props.data.sourceHandle === 'source-c')) {
        const isJumpBack = props.data.data?.isJumpBack

        if (isJumpBack) {
            items.push({label: '设为普通连线', action: 'setNormalLink', icon: ArrowRightCircle, color: 'text-blue-600'})
        } else {
            items.push({label: '设为 JumpBack 连线', action: 'setJumpBack', icon: Repeat, color: 'text-purple-600'})
        }
        items.push({type: 'divider'})
    }

    items.push({label: '断开连接', action: 'delete', icon: Scissors, color: 'text-red-500'})
    return items

  } else {
    const searchMenuItem = props.searchVisible
        ? {label: '关闭搜索窗口', action: 'closeSearch', icon: Search, color: 'text-emerald-600'}
        : {label: '搜索节点', action: 'search', icon: Search, color: 'text-emerald-600'}
    const debugMenuItem = props.debugPanelVisible
        ? {label: '关闭调试窗口', action: 'closeDebugPanel', icon: Bug, color: 'text-amber-600'}
        : {label: '打开调试窗口', action: 'openDebugPanel', icon: Bug, color: 'text-amber-600'}

    return [
      {
        key: 'add-node',
        label: '添加节点',
        action: 'add',
        icon: PlusCircle,
        color: 'text-blue-600',
        submenu: recognitionMenuOptions,
        submenuAction: 'add'
      },
      {type: 'divider'},
      searchMenuItem,
      debugMenuItem,
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
        icon: SPACING_TYPE_OPTIONS[0]?.icon,
        color: 'text-slate-600',
        submenu: SPACING_TYPE_OPTIONS,
        submenuAction: 'changeSpacing'
      },
      {
        key: 'edge-type',
        label: '连线类型',
        icon: EDGE_TYPE_OPTIONS[0]?.icon,
        color: 'text-slate-600',
        submenu: EDGE_TYPE_OPTIONS,
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
              <component v-if="item.icon" :is="item.icon" :size="16" :class="item.color"/>
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