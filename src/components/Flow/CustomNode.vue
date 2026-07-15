<script setup lang="ts">
import { computed, ref, inject, watch, type Ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Anchor as AnchorIcon, SlidersHorizontal } from 'lucide-vue-next'
import LazyImage from '@/components/Common/LazyImage.vue'
import { NODE_CONFIG_MAP, ACTION_CONFIG_MAP, STATUS_ICONS } from '@/utils/node-config'
import { normalizeTemplateList } from '@/utils/templateUtils'
import type { useImageManager } from '@/composables/useImageManager'
import { useNodeDetailsController } from '@/composables/useNodeDetailsController'
import type { FlowBusinessData, FlowNodeMeta, TemplateImage, NodeUpdatePayload, LayoutDirection } from '@/utils/flowTypes'

const props = defineProps<{
  id: string
  data: FlowNodeMeta
  selected?: boolean
}>()

const updateNode = inject<(payload: NodeUpdatePayload) => void>('updateNode', () => console.warn('updateNode not provided'))
const currentDirection = inject<Ref<LayoutDirection>>('currentDirection', ref('TB'))

const imageManager = inject<ReturnType<typeof useImageManager>>('imageManager')!
const nodeDetailsController = useNodeDetailsController()
const nodeRootRef = ref<HTMLElement | null>(null)

// 获取 UI 配置
const config = computed(() => NODE_CONFIG_MAP[props.data.type] || NODE_CONFIG_MAP['DirectHit'])

const businessData = computed<FlowBusinessData>(() => (props.data.data || {}) as FlowBusinessData)
const displayId = computed(() => props.data._originalId || businessData.value.id || props.id)
const isAnchor = computed(() => !!businessData.value.anchor || props.data.type === 'Anchor')
const isUnknown = computed(() => props.data.type === 'Unknown')
const isAnchorType = computed(() => props.data.type === 'Anchor')
const hasOutputs = computed(() => !isUnknown.value && !isAnchorType.value)
const canRenameInBody = computed(() => isUnknown.value || isAnchorType.value || props.data._isMissing)
const isHorizontalLayout = computed(() => currentDirection.value === 'LR')
const targetHandlePosition = computed(() => isHorizontalLayout.value ? Position.Left : Position.Top)
const sourceHandlePosition = computed(() => isHorizontalLayout.value ? Position.Right : Position.Bottom)

const editingId = ref(String(displayId.value))
watch(displayId, (val) => { editingId.value = String(val) })

const currentActionConfig = computed(() => {
  const actionKey = businessData.value.action as string | undefined
  if (!actionKey || actionKey === 'DoNothing') return null
  return ACTION_CONFIG_MAP[actionKey] || ACTION_CONFIG_MAP['Custom']
})

const toggleDetails = () => {
  if (isUnknown.value || isAnchorType.value) return
  const anchorElement = nodeRootRef.value
  if (!anchorElement) return
  nodeDetailsController?.toggle({ nodeId: props.id, updateNode, anchorElement })
}
const getFileName = (path?: string) => (!path || false) ? '未选择图片' : (path.split('/').pop() || '未选择图片')

const handleUpdateId = ({ oldId, newId }: { oldId?: string; newId: string }) =>
  updateNode({ oldId: oldId ?? props.id, newId, newType: props.data.type })
const applyIdChange = () => {
  const newId = editingId.value?.trim()
  if (!newId || newId === displayId.value) return
  
  if (props.data._isMissing && props.data._originalId && props.data._originalId !== props.id) {
    const confirmed = window.confirm(
      `这是一个重复的缺失节点（原始 ID: "${props.data._originalId}"）。` +
      `重命名仅会影响此实例。是否继续？`
    )
    if (!confirmed) {
      editingId.value = String(displayId.value)
      return
    }
  }
  
  handleUpdateId({ oldId: props.id, newId })
}

// 状态 UI
const statusConfig = computed(() => {
  if (props.data._isMissing) return STATUS_ICONS.missing
  const key = props.data.status as keyof typeof STATUS_ICONS | undefined
  return key ? (STATUS_ICONS[key] ?? null) : null
})

const headerStyle = computed(() => {
  const key = props.data.status as keyof typeof STATUS_ICONS | undefined
  if (key && STATUS_ICONS[key]) return STATUS_ICONS[key].headerClass
  return STATUS_ICONS.default.headerClass
})

// 图片逻辑
const isImageNode = computed(() => ['TemplateMatch', 'FeatureMatch'].includes(props.data.type))
const nodeImages = computed<TemplateImage[]>(() => {
  const paths = normalizeTemplateList(businessData.value.template)
  if (!paths.length) return []

  const result = imageManager.getImagesForTemplatePaths(props.id, paths, 16)
  return result
})

// Grid 样式计算
const gridClass = computed(() => {
  const count = nodeImages.value.length
  if (count <= 1) return 'grid-cols-1 grid-rows-1'
  if (count === 2) return 'grid-cols-2 grid-rows-1'
  if (count <= 4) return 'grid-cols-2 grid-rows-2'
  if (count <= 6) return 'grid-cols-3 grid-rows-2'
  if (count <= 9) return 'grid-cols-3 grid-rows-3'
  if (count <= 12) return 'grid-cols-4 grid-rows-3'
  return 'grid-cols-4 grid-rows-4'
})
const gridCols = computed(() => {
  if (gridClass.value.includes('grid-cols-4')) return 4
  if (gridClass.value.includes('grid-cols-3')) return 3
  if (gridClass.value.includes('grid-cols-2')) return 2
  return 1
})
const contentHeightClass = computed(() => {
  if (isImageNode.value) {
    const count = nodeImages.value.length
    if (count === 0) return 'h-12'
    if (count <= 2) return 'h-24'
    if (count <= 6) return 'h-32'
    if (count <= 9) return 'h-40'
    return 'h-48'
  }
  return 'h-12'
})
</script>

<template>
  <div
    ref="nodeRootRef"
    class="w-[280px] bg-white rounded-xl shadow-lg border-2 transition-all duration-200 overflow-visible group relative cursor-grab active:cursor-grabbing"
    :class="[selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-500' : 'border-slate-100 hover:border-slate-300', data._isMissing ? 'opacity-80' : '']"
    @dblclick.stop="toggleDetails"
  >
    <Handle
      id="in"
      type="target"
      :position="targetHandlePosition"
      class="!rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200"
      :class="isHorizontalLayout ? '!w-3 !h-16' : '!w-16 !h-3'"
      :style="isHorizontalLayout
        ? { left: '-6px', top: '50%', transform: 'translate(0, -50%)' }
        : { top: '-6px', left: '50%', transform: 'translate(-50%, 0)' }"
    />

    <div
      class="flex items-center justify-between px-4 py-3 rounded-t-xl border-b transition-colors duration-300"
      :class="headerStyle"
    >
      <div class="flex items-center">
        <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.bg]">
          <component
            :is="config.icon"
            v-if="config.icon"
            :size="18"
          />
        </div>
        <div>
          <div
            class="font-bold text-slate-700 text-sm truncate max-w-[160px] flex items-center gap-1"
            :title="displayId"
          >
            <span class="truncate">{{ displayId }}</span>
            <AnchorIcon
              v-if="isAnchor"
              :size="12"
              class="text-amber-500 shrink-0"
              title="锚点节点"
            />
          </div>
          <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            {{ config.label }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 -mr-1">
        <div
          v-if="statusConfig"
          class="flex items-center p-1 rounded-md"
        >
          <component
            :is="statusConfig.icon"
            v-if="statusConfig.icon"
            :size="18"
            :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']"
          />
        </div>
        <button
          v-if="!isUnknown && !isAnchorType"
          type="button"
          title="打开节点属性"
          class="nodrag flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-white/70 hover:text-indigo-600"
          @click.stop="toggleDetails"
        >
          <SlidersHorizontal :size="16" />
        </button>
      </div>
    </div>

    <div class="p-4 bg-white min-h-[80px] flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div
          v-if="canRenameInBody"
          class="space-y-2"
        >
          <div
            v-if="data._isMissing"
            class="text-center text-slate-500 text-[11px] bg-slate-50 p-2 rounded border border-dashed border-slate-200"
          >
            引用缺失
          </div>
          <div class="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded px-2 py-1.5 flex items-center gap-2">
            <span
              v-if="isUnknown"
              class="text-amber-600 font-semibold"
            >未知节点</span>
            <span
              v-else-if="isAnchorType"
              class="text-amber-600 font-semibold"
            >锚点节点</span>
            <span
              v-else
              class="text-amber-600 font-semibold"
            >缺失节点</span>
            <span class="text-slate-500">可重命名以修正引用</span>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="editingId"
              class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-400"
              :placeholder="String(displayId)"
            >
            <button
              class="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!editingId || editingId === displayId"
              @click.stop="applyIdChange"
            >
              应用
            </button>
          </div>
        </div>

        <div
          v-else-if="isImageNode"
          class="space-y-1"
        >
          <div
            class="w-full bg-slate-50 rounded-lg border border-slate-200 border-dashed overflow-hidden relative transition-all duration-300"
            :class="contentHeightClass"
          >
            <div
              v-if="nodeImages.length > 0"
              class="grid w-full h-full"
              :class="gridClass"
            >
              <div
                v-for="(img, idx) in nodeImages"
                :key="img.path"
                class="relative overflow-hidden border-white/50 group/img"
                :class="{ 'border-r': (idx + 1) % gridCols !== 0, 'border-b': idx < nodeImages.length - gridCols }"
              >
                <LazyImage
                  :src="img.url"
                  class-name="w-full h-full object-fill transform hover:scale-110 transition-transform duration-300"
                />
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-center p-1 pointer-events-none">
                  <span class="text-[9px] text-white font-mono truncate w-full text-center leading-tight">{{ getFileName(img.path) }}</span>
                </div>
              </div>
            </div>
            <div
              v-else
              class="w-full h-full flex flex-col items-center justify-center gap-1"
            >
              <component
                :is="config.icon"
                v-if="config.icon"
                :size="24"
                class="text-slate-300"
              />
              <span class="text-[9px] text-slate-400">No Image</span>
            </div>
          </div>
        </div>

        <div
          v-else-if="data.type === 'ColorMatch'"
          class="flex items-center gap-2"
        >
          <div
            class="w-8 h-8 rounded shadow-sm border border-slate-100 ring-1 ring-slate-200"
            :style="{ backgroundColor: (businessData.targetColor as string) || '#000000' }"
          />
          <div class="flex flex-col overflow-hidden">
            <span class="text-[10px] text-slate-400 uppercase">Target</span>
            <span class="font-mono text-xs font-bold text-slate-700 truncate">{{ businessData.targetColor || '#N/A' }}</span>
          </div>
        </div>

        <div
          v-else-if="['OCR', 'NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(data.type)"
          class="space-y-1"
        >
          <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
            Expected / Target
          </div>
          <div class="bg-slate-50 px-2 py-1.5 rounded border border-slate-100 text-xs font-mono text-slate-700 break-all leading-tight min-h-[1.5em]">
            {{ businessData.expected || (data.type === 'OCR' ? 'Any Text' : 'Any Class') }}
          </div>
        </div>

        <div
          v-else
          class="text-center"
        >
          <div class="text-xs text-slate-500 line-clamp-2">
            {{ businessData.description || '通用逻辑处理' }}
          </div>
        </div>
      </div>

      <div
        v-if="currentActionConfig"
        class="shrink-0 flex flex-col items-center justify-center"
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-help hover:scale-105 shadow-sm border border-slate-100"
          :class="currentActionConfig.bg"
          :title="`执行动作: ${currentActionConfig.label}`"
        >
          <component
            :is="currentActionConfig.icon"
            v-if="currentActionConfig.icon"
            :size="18"
            :class="currentActionConfig.color"
          />
        </div>
      </div>
    </div>

    <div
      v-if="!data._isMissing && hasOutputs"
      class="flex border-slate-100"
      :class="isHorizontalLayout
        ? 'absolute top-0 right-0 h-full w-8 translate-x-full flex-col border-l divide-y divide-slate-100 rounded-r-xl overflow-hidden bg-white shadow-sm'
        : 'h-6 w-full border-t divide-x divide-slate-100'"
    >
      <div class="flex-1 relative group hover:bg-blue-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span class="text-[10px] font-bold text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity">Next</span>
        <Handle
          id="source-a"
          type="source"
          :position="sourceHandlePosition"
          class="!w-full !h-full !inset-0 !translate-x-0 !translate-y-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-blue-400 !transition-opacity"
        />
        <div
          class="absolute bg-blue-200 group-hover:bg-blue-500 transition-colors"
          :class="isHorizontalLayout ? 'right-0 top-0 h-full w-1' : 'bottom-0 w-full h-1 rounded-bl-xl'"
        />
      </div>
      <div class="flex-1 relative group hover:bg-rose-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span
          class="text-[10px] font-bold text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity"
          :class="isHorizontalLayout ? '-rotate-90' : ''"
        >Err.</span>
        <Handle
          id="source-c"
          type="source"
          :position="sourceHandlePosition"
          class="!w-full !h-full !inset-0 !translate-x-0 !translate-y-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-rose-400 !transition-opacity"
        />
        <div
          class="absolute bg-rose-200 group-hover:bg-rose-500 transition-colors"
          :class="isHorizontalLayout ? 'right-0 top-0 h-full w-1' : 'bottom-0 w-full h-1 rounded-br-xl'"
        />
      </div>
    </div>
  </div>
</template>

<style>
.vue-flow__node-custom .vue-flow__handle { border: none; min-width: 0; min-height: 0; }
</style>
