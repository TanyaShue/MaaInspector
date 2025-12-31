<script setup lang="ts">
import {computed, ref, onMounted} from 'vue'
import {
  Trash2, Copy, PlusCircle, RefreshCw, XCircle, ChevronRight,
  Check, Bug, Scissors, Search, FolderClosed, Repeat, ArrowRightCircle, Move
} from 'lucide-vue-next'
import { recognitionMenuOptions } from '../../utils/nodeLogic'
import { EDGE_TYPE_OPTIONS, SPACING_TYPE_OPTIONS, type EdgeType, type OptionItem } from '../../utils/flowOptions'
import type { SpacingKey, MenuType, FlowNode, FlowEdge } from '../../utils/flowTypes'

type SubmenuItem = OptionItem<string | EdgeType | SpacingKey> & { color?: string }

type MenuItem =
  | { type: 'divider'; key?: string }
  | {
      type: 'item'
      key?: string
      label: string
      action: string
      icon?: any
      color?: string
      submenu?: SubmenuItem[]
      submenuAction?: string
    }

interface EdgeData {
  sourceHandle?: string
  data?: { isJumpBack?: boolean }
  label?: string
}

const props = defineProps<{
  x: number
  y: number
  type: MenuType
  data?: FlowNode | FlowEdge | null
  currentEdgeType?: EdgeType
  currentSpacing?: SpacingKey
  debugPanelVisible?: boolean
  searchVisible?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action', payload: { action: string; type: MenuType; data: FlowNode | FlowEdge | null; payload?: string | EdgeType | SpacingKey | null }): void
}>()

const mainMenuRef = ref<HTMLElement | null>(null)
const mainMenuHeight = ref<number>(0)

const handleAction = (action: string, payload: string | EdgeType | SpacingKey | null = null) => {
  emit('action', {action, type: props.type, data: props.data ?? null, payload})
  emit('close')
}

// 解析标签，提取主标签和备注
const parseLabel = (label: string): { main: string; note: string } => {
  const match = label.match(/^(.+?)\s*\((.+?)\)$/)
  if (match) {
    return { main: match[1].trim(), note: match[2].trim() }
  }
  return { main: label, note: '' }
}

// 计算主菜单高度
onMounted(() => {
  if (mainMenuRef.value) {
    mainMenuHeight.value = mainMenuRef.value.clientHeight
  }
})

const menuItems = computed<MenuItem[]>(() => {
  if (props.type === 'node') {
    return [
      {type: 'item', label: '调试该节点', action: 'debug_this_node', icon: Bug, color: 'text-amber-600'},
      {type: 'item', label: '仅识别该节点', action: 'debug_this_node_reco', icon: Bug, color: 'text-amber-600'},
      {type: 'item', label: '在调试窗口中调试', action: 'debug_in_panel', icon: Bug, color: 'text-amber-700'},
      {type: 'item', label: '重新布局任务链', action: 'layout_chain', icon: Move, color: 'text-indigo-600'},
      {type: 'divider'},
      {type: 'item', label: '复制节点', action: 'duplicate', icon: Copy, color: 'text-slate-600'},
      {type: 'divider'},
      {type: 'item', label: '删除节点', action: 'delete', icon: Trash2, color: 'text-red-500'},
    ]
  } else if (props.type === 'edge') {
    const items: MenuItem[] = []

    // 仅当 sourceHandle 为 Next (source-a) 或 Error (source-c) 时显示 JumpBack 选项
    const edgeData = props.data as EdgeData | undefined
    if (edgeData && edgeData.sourceHandle && (edgeData.sourceHandle === 'source-a' || edgeData.sourceHandle === 'source-c')) {
        const isJumpBack = edgeData.data?.isJumpBack

        if (isJumpBack) {
            items.push({type: 'item', label: '设为普通连线', action: 'setNormalLink', icon: ArrowRightCircle, color: 'text-blue-600'})
        } else {
            items.push({type: 'item', label: '设为 JumpBack 连线', action: 'setJumpBack', icon: Repeat, color: 'text-purple-600'})
        }
        items.push({type: 'divider'})
    }

    items.push({type: 'item', label: '断开连接', action: 'delete', icon: Scissors, color: 'text-red-500'})
    return items

  } else {
    const searchMenuItem: MenuItem = props.searchVisible
        ? {type: 'item', label: '关闭搜索窗口', action: 'closeSearch', icon: Search, color: 'text-emerald-600'}
        : {type: 'item', label: '搜索节点', action: 'search', icon: Search, color: 'text-emerald-600'}
    const debugMenuItem: MenuItem = props.debugPanelVisible
        ? {type: 'item', label: '关闭调试窗口', action: 'closeDebugPanel', icon: Bug, color: 'text-amber-600'}
        : {type: 'item', label: '打开调试窗口', action: 'openDebugPanel', icon: Bug, color: 'text-amber-600'}

    return [
      {
        type: 'item',
        key: 'add-node',
        label: '添加节点',
        action: 'add',
        icon: PlusCircle,
        color: 'text-blue-600',
        submenu: recognitionMenuOptions,
        submenuAction: 'add'
      },
      {
        type: 'item',
        label: '添加锚点',
        action: 'add_anchor',
        icon: PlusCircle,
        color: 'text-amber-600'
      },
      {type: 'divider'},
      searchMenuItem,
      debugMenuItem,
      {type: 'item', label: '关闭所有节点面板', action: 'closeAllDetails', icon: FolderClosed, color: 'text-slate-600'},
      {type: 'divider'},
      {
        type: 'item',
        label: '自动布局 (Dagre)',
        action: 'layout',
        icon: Move,
        color: 'text-indigo-600'
      },
      {
        type: 'item',
        key: 'layout-spacing',
        label: '布局间距',
        icon: SPACING_TYPE_OPTIONS[0]?.icon,
        color: 'text-slate-600',
        action: 'changeSpacing',
        submenu: SPACING_TYPE_OPTIONS,
        submenuAction: 'changeSpacing'
      },
      {
        type: 'item',
        key: 'edge-type',
        label: '连线类型',
        icon: EDGE_TYPE_OPTIONS[0]?.icon,
        color: 'text-slate-600',
        action: 'changeEdgeType',
        submenu: EDGE_TYPE_OPTIONS,
        submenuAction: 'changeEdgeType'
      },
      {type: 'divider'},
      {type: 'item', label: '重置视图', action: 'reset', icon: RefreshCw, color: 'text-slate-600'},
      {type: 'item', label: '清除画布', action: 'clear', icon: XCircle, color: 'text-red-500'},
    ]
  }
})
</script>

<template>
  <div
      ref="mainMenuRef"
      class="fixed z-50 w-56 bg-white rounded-lg shadow-xl border border-slate-100 text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-left font-sans select-none"
      :style="{ top: `${y}px`, left: `${x}px` }"
      @contextmenu.prevent
  >
    <div v-if="type === 'node'" class="px-3 py-2 bg-slate-50 border-b border-slate-100">
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Node ID</div>
      <div class="font-mono text-xs text-slate-600 truncate">#{{ (data as any)?.id ?? '-' }}</div>
    </div>
    <div v-if="type === 'edge'" class="px-3 py-2 bg-slate-50 border-b border-slate-100">
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Link</div>
      <div class="font-mono text-xs text-slate-600 truncate">{{ (data as EdgeData | undefined)?.label || 'Edge' }}</div>
    </div>

    <ul class="py-1 m-0 list-none">
      <template v-for="(item, index) in menuItems" :key="index">
        <li v-if="item.type === 'divider'" class="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-1.5"></li>

        <li
            v-else-if="item.type === 'item'"
            class="relative menu-item-with-submenu"
        >
          <div
              class="flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100 group/main"
              @click="handleAction(item.action)"
          >
            <div class="flex items-center gap-2.5">
              <component 
                v-if="item.icon" 
                :is="item.icon" 
                :size="16" 
                :class="[item.color, 'transition-transform group-hover/main:scale-110']"
              />
              <span
                  :class="['font-medium text-[13px] transition-colors', (item.label === '删除节点' || item.label === '断开连接') ? 'text-red-500 group-hover/main:text-red-600' : 'text-slate-700 group-hover/main:text-slate-900']">{{
                  item.label
                }}</span>
            </div>
            <ChevronRight v-if="item.submenu" :size="14" class="text-slate-400 transition-transform group-hover/main:translate-x-0.5"/>
          </div>

          <div
              v-if="item.submenu"
              class="submenu-panel absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-slate-100 z-[60] overflow-hidden flex flex-col"
              :style="{ maxHeight: mainMenuHeight > 0 ? `${mainMenuHeight}px` : 'none', width: item.key === 'add-node' ? '280px' : '14rem' }"
          >
            <ul class="py-1 overflow-y-auto custom-scrollbar">
              <li
                  v-for="sub in item.submenu"
                  :key="sub.value as string"
                  class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors group/item"
                  @click.stop="handleAction(item.submenuAction || '', sub.value as string | EdgeType | SpacingKey)"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <component 
                    v-if="sub.icon" 
                    :is="sub.icon" 
                    :size="16" 
                    :class="[sub.color || 'text-slate-500', 'flex-shrink-0']"
                  />
                  <span 
                    v-if="item.key === 'add-node'"
                    class="text-slate-700 font-medium text-[13px] truncate group-hover/item:text-slate-900"
                  >
                    {{ parseLabel(sub.label).main }}
                  </span>
                  <span 
                    v-else
                    class="text-slate-700 font-medium text-[13px] truncate group-hover/item:text-slate-900"
                  >
                    {{ sub.label }}
                  </span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span 
                    v-if="item.key === 'add-node' && parseLabel(sub.label).note"
                    class="text-[10px] text-slate-400 font-mono"
                  >
                    {{ parseLabel(sub.label).note }}
                  </span>
                  <Check
                      v-if="(item.key === 'edge-type' && sub.value === currentEdgeType) || (item.key === 'layout-spacing' && sub.value === currentSpacing)"
                      :size="16"
                      class="text-blue-600"
                  />
                </div>
              </li>
            </ul>
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
/* 默认隐藏子菜单 */
.submenu-panel {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}

/* 当父菜单项悬停时显示子菜单 */
.menu-item-with-submenu:hover > .submenu-panel {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

/*
 * 隐形桥核心代码 - 双重桥接方案
 * 1. 在父菜单项上创建向右延伸的隐形区域 (after伪元素)
 * 2. 在子菜单上创建向左延伸的隐形区域 (before伪元素)
 * 3. 两个区域重叠，确保鼠标移动路径全程保持hover状态
 */

/* 父菜单项向右延伸的隐形桥 */
.menu-item-with-submenu > div::after {
  content: '';
  position: absolute;
  left: 100%;
  top: 0;
  width: 1rem; /* 覆盖到子菜单的间隙 (ml-1 = 0.25rem) 并留有余量 */
  height: 100%;
  background: transparent;
  pointer-events: auto;
  z-index: 1;
}

/* 子菜单向左延伸的隐形桥，并向上下扩展 */
.submenu-panel::before {
  content: '';
  position: absolute;
  right: 100%;
  top: -1.5rem; /* 向上延伸，增加斜向移动容错 */
  width: 1.5rem; /* 足够宽以覆盖间隙和父菜单的after区域 */
  height: calc(100% + 3rem); /* 向上下延伸，防止从边缘滑出 */
  background: transparent;
  pointer-events: auto;
  z-index: 1;
}

/* 自定义滚动条样式 */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgb(203 213 225 / 0.6) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgb(203 213 225 / 0.6);
  border-radius: 3px;
  transition: background-color 0.2s;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgb(148 163 184 / 0.8);
}

/* 子菜单项的平滑过渡 */
.submenu-panel li {
  position: relative;
}

.submenu-panel li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  background: transparent;
  transition: background-color 0.2s;
}

.submenu-panel li:hover::before {
  background: linear-gradient(to bottom, transparent, rgb(59 130 246 / 0.5), transparent);
}
</style>