<script setup>
import { computed, ref } from 'vue'
import { Trash2, Copy, Edit, PlusCircle, RefreshCw, XCircle, ChevronRight, PlayCircle, Cpu, GitBranch, Database, Mail } from 'lucide-vue-next'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { type: String, required: true },
  data: { type: Object, default: null }
})

const emit = defineEmits(['close', 'action'])
const showSubmenu = ref(false) // 控制子菜单显示

const handleAction = (action, payload = null) => {
  emit('action', { action, type: props.type, data: props.data, payload })
  emit('close')
}

// 节点类型的配置 (用于子菜单图标)
const nodeTypes = [
  { label: '触发器', value: 'trigger', icon: PlayCircle, color: 'text-blue-500' },
  { label: '数据处理', value: 'process', icon: Cpu, color: 'text-indigo-500' },
  { label: '逻辑判断', value: 'decision', icon: GitBranch, color: 'text-amber-500' },
  { label: '数据存储', value: 'storage', icon: Database, color: 'text-emerald-500' },
  { label: '消息通知', value: 'notify', icon: Mail, color: 'text-rose-500' },
]

const menuItems = computed(() => {
  if (props.type === 'node') {
    return [
      { label: '编辑数据', action: 'edit', icon: Edit, color: 'text-slate-600' },
      { label: '复制节点', action: 'duplicate', icon: Copy, color: 'text-slate-600' },
      { type: 'divider' },
      { label: '删除节点', action: 'delete', icon: Trash2, color: 'text-red-500' },
    ]
  } else {
    // 画布菜单 - 注意 "添加节点" 现在有 submenu 逻辑
    return [
      {
        label: '添加节点',
        action: 'add',
        icon: PlusCircle,
        color: 'text-blue-600',
        hasSubmenu: true
      },
      { label: '重置视图', action: 'reset', icon: RefreshCw, color: 'text-slate-600' },
      { label: '清除画布', action: 'clear', icon: XCircle, color: 'text-red-500' },
    ]
  }
})
</script>

<template>
  <div
    class="fixed z-50 w-44 bg-white rounded-lg shadow-xl border border-slate-100 text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-left font-sans select-none"
    :style="{ top: `${y}px`, left: `${x}px` }"
    @contextmenu.prevent
  >
    <!-- 头部信息 -->
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
          @mouseenter="item.hasSubmenu ? showSubmenu = true : null"
          @mouseleave="item.hasSubmenu ? showSubmenu = false : null"
        >
          <!-- 主菜单项 -->
          <div
            class="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100"
            @click="handleAction(item.action)"
          >
            <div class="flex items-center gap-2">
              <component :is="item.icon" :size="16" :class="item.color" />
              <span :class="['font-medium text-slate-600', item.label === '删除节点' ? 'text-red-500' : '']">{{ item.label }}</span>
            </div>
            <!-- 子菜单箭头 -->
            <ChevronRight v-if="item.hasSubmenu" :size="14" class="text-slate-400" />
          </div>

          <!-- 子菜单 (悬停显示) -->
          <div
            v-if="item.hasSubmenu && showSubmenu"
            class="absolute left-full top-0 ml-1 w-40 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-left-2 duration-150"
          >
            <ul class="py-1">
              <li
                v-for="sub in nodeTypes"
                :key="sub.value"
                class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50"
                @click.stop="handleAction('add', sub.value)"
              >
                <component :is="sub.icon" :size="14" :class="sub.color" />
                <span class="text-slate-600 font-medium">{{ sub.label }}</span>
              </li>
            </ul>
          </div>

        </li>
      </template>
    </ul>
  </div>
</template>