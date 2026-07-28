<script setup lang="ts">
import {computed, ref, onMounted, nextTick, type Component} from 'vue'
import {
  Trash2, Copy, ClipboardPaste, PlusCircle, RefreshCw, XCircle, ChevronRight,
  Check, Bug, Scissors, Search, FolderClosed, Repeat, ArrowRightCircle, Move, Eye, ExternalLink
} from 'lucide-vue-next'
import { recognitionMenuOptions } from '@/utils/node-config'
import { 
  LAYOUT_ALGORITHM_OPTIONS, 
  type EdgeType, 
  type OptionItem 
} from '@/utils/flowOptions'
import type { SpacingKey, LayoutAlgorithm, LayoutDirection, MenuType, FlowNode, FlowEdge } from '@/utils/flowTypes'
import { isUnknownNode } from '@/utils/nodeIdentity'

type SubmenuItem = OptionItem<string | EdgeType | SpacingKey | LayoutAlgorithm | LayoutDirection> & { color?: string }

type MenuItem =
  | { type: 'divider'; key?: string }
  | {
      type: 'item'
      key?: string
      label: string
      action: string
      icon?: Component
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
  currentAlgorithm?: LayoutAlgorithm
  currentDirection?: LayoutDirection
  debugPanelVisible?: boolean
  searchVisible?: boolean
  mode?: 'main' | 'subcanvas'
  clipboardHistory?: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'action', payload: { action: string; type: MenuType; data: FlowNode | FlowEdge | null; payload?: string | EdgeType | SpacingKey | LayoutAlgorithm | LayoutDirection | null }): void
}>()

const mainMenuRef = ref<HTMLElement | null>(null)
const mainMenuHeight = ref<number>(0)
const adjustedPosition = ref<{ x: number; y: number }>({ x: props.x, y: props.y })
const activeSubmenu = ref<string | null>(null)

const getSubmenuKey = (item: Extract<MenuItem, { type: 'item' }>, index: number) =>
  item.key || `${item.action}-${index}`

const showSubmenu = (item: Extract<MenuItem, { type: 'item' }>, index: number) => {
  if (item.submenu) activeSubmenu.value = getSubmenuKey(item, index)
}

const shouldOpenSubmenuLeft = (item: Extract<MenuItem, { type: 'item' }>) => {
  const mainMenuWidth = 224
  const submenuWidth = item.key === 'add-node' ? 280 : 224
  return adjustedPosition.value.x + mainMenuWidth + 4 + submenuWidth > window.innerWidth - 8
}

const handleAction = (action: string, payload: string | EdgeType | SpacingKey | LayoutAlgorithm | LayoutDirection | null = null) => {
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

// 计算主菜单高度并调整位置
onMounted(async () => {
  if (mainMenuRef.value) {
    mainMenuHeight.value = mainMenuRef.value.clientHeight
    await nextTick()
    updatePosition()
  }
})

// 更新菜单位置，确保不超出视口边界
const updatePosition = () => {
  if (!mainMenuRef.value) return
  
  const menuRect = mainMenuRef.value.getBoundingClientRect()
  const menuWidth = menuRect.width
  const menuHeight = menuRect.height
  
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let newX = props.x
  let newY = props.y
  
  // 检查右边界
  if (props.x + menuWidth > viewportWidth) {
    newX = viewportWidth - menuWidth - 8 // 8px 边距
  }
  
  // 检查下边界
  if (props.y + menuHeight > viewportHeight) {
    newY = viewportHeight - menuHeight - 8 // 8px 边距
  }
  
  // 确保不超出左边界和上边界
  newX = Math.max(8, newX)
  newY = Math.max(8, newY)
  
  adjustedPosition.value = { x: newX, y: newY }
}

const menuItems = computed<MenuItem[]>(() => {
  if (props.type === 'node') {
    if (isUnknownNode(props.data as FlowNode | null)) {
      return [{
        type: 'item',
        label: '在子画布中打开对应节点',
        action: 'open_referenced_node',
        icon: ExternalLink,
        color: 'text-indigo-600'
      }]
    }

    const items: MenuItem[] = [
      {type: 'item', label: '调试该节点', action: 'debug_this_node', icon: Bug, color: 'text-amber-600'},
      {type: 'item', label: '仅识别该节点', action: 'debug_this_node_reco', icon: Bug, color: 'text-amber-600'},
      {type: 'item', label: '仅执行该节点', action: 'debug_this_node_single', icon: Bug, color: 'text-amber-600'},
      {type: 'item', label: '在调试窗口中调试', action: 'debug_in_panel', icon: Bug, color: 'text-amber-700'},
    ]

    if (props.mode !== 'subcanvas') {
      items.push(
      {
        type: 'item',
        label: '查看任务链',
        action: 'view_task_chain',
        icon: Eye,
        color: 'text-cyan-600'
      },
      {
        type: 'item',
        key: 'layout-chain-algorithm',
        label: '在子画布中重排任务链',
        action: 'layout_chain',
        icon: Move,
        color: 'text-indigo-600',
        submenu: LAYOUT_ALGORITHM_OPTIONS,
        submenuAction: 'layout_chain_with_algo'
      })
    }

    items.push(
      {type: 'divider'},
      {type: 'item', label: '复制节点', action: 'duplicate', icon: Copy, color: 'text-slate-600'},
      {type: 'divider'},
      {type: 'item', label: '删除节点', action: 'delete', icon: Trash2, color: 'text-red-500'},
    )

    return items
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
    if (props.mode === 'subcanvas') {
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
        {
          type: 'item',
          key: 'paste-history',
          label: '粘贴节点',
          action: 'paste',
          icon: ClipboardPaste,
          color: 'text-slate-600',
          submenu: props.clipboardHistory || [],
          submenuAction: 'paste'
        },
        {type: 'divider'},
        {type: 'item', label: '关闭所有节点面板', action: 'closeAllDetails', icon: FolderClosed, color: 'text-slate-600'},
        {type: 'divider'},
        {
          type: 'item',
          label: '重新布局当前子画布',
          action: 'layout',
          icon: Move,
          color: 'text-indigo-600'
        },
        {type: 'item', label: '重置视图', action: 'reset', icon: RefreshCw, color: 'text-slate-600'},
      ]
    }

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
      {
        type: 'item',
        key: 'paste-history',
        label: '粘贴节点',
        action: 'paste',
        icon: ClipboardPaste,
        color: 'text-slate-600',
        submenu: props.clipboardHistory || [],
        submenuAction: 'paste'
      },
      {type: 'divider'},
      searchMenuItem,
      debugMenuItem,
      {type: 'item', label: '关闭所有节点面板', action: 'closeAllDetails', icon: FolderClosed, color: 'text-slate-600'},
      {type: 'divider'},
      {type: 'item', label: '重置视图', action: 'reset', icon: RefreshCw, color: 'text-slate-600'},
      {type: 'item', label: '清除画布', action: 'clear', icon: XCircle, color: 'text-red-500'},
    ]
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="mainMenuRef"
      class="context-menu-surface fixed z-50 w-56 bg-white rounded-lg shadow-xl border border-slate-100 text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-left font-sans select-none"
      :style="{ top: `${adjustedPosition.y}px`, left: `${adjustedPosition.x}px` }"
      @contextmenu.prevent
    >
    <div
      v-if="type === 'node'"
      class="px-3 py-2 bg-slate-50 border-b border-slate-100"
    >
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
        Node ID
      </div>
      <div class="font-mono text-xs text-slate-600 truncate">
        #{{ data?.id ?? '-' }}
      </div>
    </div>
    <div
      v-if="type === 'edge'"
      class="px-3 py-2 bg-slate-50 border-b border-slate-100"
    >
      <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
        Link
      </div>
      <div class="font-mono text-xs text-slate-600 truncate">
        {{ (data as EdgeData | undefined)?.label || 'Edge' }}
      </div>
    </div>

    <ul class="py-1 m-0 list-none">
      <template
        v-for="(item, index) in menuItems"
        :key="index"
      >
        <li
          v-if="item.type === 'divider'"
          class="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-1.5"
        />

        <li
          v-else-if="item.type === 'item'"
          class="relative menu-item-with-submenu"
          :class="{ 'submenu-opens-left': item.submenu && shouldOpenSubmenuLeft(item) }"
          @mouseenter="showSubmenu(item, index)"
          @mouseleave="activeSubmenu = null"
        >
          <div
            data-testid="submenu-trigger"
            class="flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100 group/main"
            @click.stop="item.action === 'paste' ? handleAction(item.action) : item.submenu ? showSubmenu(item, index) : handleAction(item.action)"
          >
            <div class="flex items-center gap-2.5">
              <component 
                :is="item.icon" 
                v-if="item.icon" 
                :size="16" 
                :class="[item.color, 'transition-transform group-hover/main:scale-110']"
              />
              <span
                :class="['font-medium text-[13px] transition-colors', (item.label === '删除节点' || item.label === '断开连接') ? 'text-red-500 group-hover/main:text-red-600' : 'text-slate-700 group-hover/main:text-slate-900']"
              >{{
                item.label
              }}</span>
            </div>
            <ChevronRight
              v-if="item.submenu"
              :size="14"
              class="text-slate-400 transition-transform group-hover/main:translate-x-0.5"
            />
          </div>

          <div
            v-if="item.submenu"
            v-show="activeSubmenu === getSubmenuKey(item, index)"
            data-testid="submenu-panel"
            class="submenu-panel absolute top-0 bg-white rounded-lg shadow-xl border border-slate-100 z-[60] overflow-hidden flex flex-col"
            :class="[
              { 'submenu-panel-visible': activeSubmenu === getSubmenuKey(item, index) },
              shouldOpenSubmenuLeft(item) ? 'right-full mr-1' : 'left-full ml-1'
            ]"
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
                    :is="sub.icon" 
                    v-if="sub.icon" 
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
                    v-if="item.key === 'layout-chain-algorithm' && sub.value === currentAlgorithm"
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
  </Teleport>
</template>

<style scoped>
.context-menu-surface {
  contain: style;
  isolation: isolate;
  will-change: transform, opacity;
}

/* 默认隐藏子菜单 */
.submenu-panel {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease, visibility 0.15s ease;
}

/* 当父菜单项悬停时显示子菜单 */
.menu-item-with-submenu:hover > .submenu-panel,
.submenu-panel-visible {
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

.menu-item-with-submenu.submenu-opens-left > div::after {
  left: auto;
  right: 100%;
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

.submenu-opens-left > .submenu-panel::before {
  right: auto;
  left: 100%;
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
