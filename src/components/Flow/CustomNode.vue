<script setup lang="ts">
import { computed, ref, inject, watch, type Ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Anchor as AnchorIcon } from 'lucide-vue-next'
import NodeDetails from './NodeDetails.vue'
import { NODE_CONFIG_MAP, ACTION_CONFIG_MAP, STATUS_ICONS } from '../../utils/nodeLogic'
import type { FlowBusinessData, FlowNodeMeta, TemplateImage, NodeUpdatePayload } from '../../utils/flowTypes'

const props = defineProps<{
  id: string
  data: FlowNodeMeta
  selected?: boolean
}>()

const updateNode = inject<(payload: NodeUpdatePayload) => void>('updateNode', () => console.warn('updateNode not provided'))
const closeAllDetailsSignal = inject<Ref<number>>('closeAllDetailsSignal', ref(0))
const currentFilename = inject<Ref<string>>('currentFilename', ref(''))

// 获取 UI 配置
const config = computed(() => NODE_CONFIG_MAP[props.data.type] || NODE_CONFIG_MAP['DirectHit'])
const availableTypes = Object.keys(NODE_CONFIG_MAP).filter(t => t !== 'Unknown')

const businessData = computed<FlowBusinessData>(() => (props.data.data || {}) as FlowBusinessData)
const isAnchor = computed(() => !!businessData.value.anchor || props.data.type === 'Anchor')
const isUnknown = computed(() => props.data.type === 'Unknown')
const isAnchorType = computed(() => props.data.type === 'Anchor')
const hasOutputs = computed(() => !isUnknown.value && !isAnchorType.value)
const canRenameInBody = computed(() => isUnknown.value || isAnchorType.value || props.data._isMissing)

const editingId = ref(props.id)
watch(() => props.id, (val) => { editingId.value = val })

const currentActionConfig = computed(() => {
  const actionKey = businessData.value.action as string | undefined
  if (!actionKey || actionKey === 'DoNothing') return null
  return ACTION_CONFIG_MAP[actionKey] || ACTION_CONFIG_MAP['Custom']
})

const showDetails = ref(false)
const toggleDetails = () => {
  if (isUnknown.value || isAnchorType.value) return
  showDetails.value = !showDetails.value
}
const getFileName = (path?: string) => (!path || typeof path !== 'string') ? '未选择图片' : (path.split('/').pop() || '未选择图片')

watch(closeAllDetailsSignal, () => showDetails.value = false)

const handleUpdateId = ({ oldId, newId }: { oldId?: string; newId: string }) =>
  updateNode({ oldId: oldId ?? props.id, newId, newType: props.data.type })
const handleUpdateType = (newType: string) => updateNode({ oldId: props.id, newId: props.id, newType })
const handleUpdateData = (newData: FlowBusinessData) => updateNode({
  oldId: props.id, newId: props.id, newType: newData.recognition || props.data.type, newData
})

const applyIdChange = () => {
  const newId = editingId.value?.trim()
  if (!newId || newId === props.id) return
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
  const template = businessData.value.template
  const paths = Array.isArray(template) ? template : (typeof template === 'string' ? [template] : [])
  if (!paths.length) return []

  const allImages = [...(props.data._images || []), ...(props.data._temp_images || [])] as TemplateImage[]
  return allImages.filter(img => img.found && img.base64 && img.path && paths.includes(img.path)).slice(0, 16)
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
      class="w-[280px] bg-white rounded-xl shadow-lg border-2 transition-all duration-200 overflow-visible group relative"
      :class="[selected ? 'ring-2 ring-offset-2 ring-blue-400 border-blue-500' : 'border-slate-100 hover:border-slate-300', data._isMissing ? 'opacity-80' : '']"
      @dblclick.stop="toggleDetails"
  >
    <NodeDetails
        :visible="showDetails" :nodeId="id" :nodeData="data" :nodeType="data.type"
        :availableTypes="availableTypes" :typeConfig="NODE_CONFIG_MAP" :currentFilename="currentFilename"
        @close="showDetails = false" @update-id="handleUpdateId" @update-type="handleUpdateType" @update-data="handleUpdateData"
    />

    <Handle id="in" type="target" :position="Position.Top" class="!w-16 !h-3 !rounded-full !bg-slate-300 hover:!bg-slate-400 transition-colors duration-200" style="top: -6px; left: 50%; transform: translate(-50%, 0);"/>

    <div class="flex items-center justify-between px-4 py-3 rounded-t-xl border-b transition-colors duration-300" :class="headerStyle">
      <div class="flex items-center">
        <div :class="['p-2 rounded-lg text-white shadow-sm mr-3', config.bg]">
          <component v-if="config.icon" :is="config.icon" :size="18"/>
        </div>
        <div>
          <div class="font-bold text-slate-700 text-sm truncate max-w-[160px] flex items-center gap-1" :title="data.id">
            <span class="truncate">{{ data.id }}</span>
            <AnchorIcon v-if="isAnchor" :size="12" class="text-amber-500 shrink-0" title="锚点节点" />
          </div>
          <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1">{{ config.label }}</div>
        </div>
      </div>
      <div v-if="statusConfig" class="flex items-center p-1 -mr-1 rounded-md">
        <component v-if="statusConfig.icon" :is="statusConfig.icon" :size="18" :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']"/>
      </div>
    </div>

    <div class="p-4 bg-white min-h-[80px] flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div v-if="canRenameInBody" class="space-y-2">
          <div v-if="data._isMissing" class="text-center text-slate-500 text-[11px] bg-slate-50 p-2 rounded border border-dashed border-slate-200">引用缺失</div>
          <div class="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded px-2 py-1.5 flex items-center gap-2">
            <span v-if="isUnknown" class="text-amber-600 font-semibold">未知节点</span>
            <span v-else-if="isAnchorType" class="text-amber-600 font-semibold">锚点节点</span>
            <span v-else class="text-amber-600 font-semibold">缺失节点</span>
            <span class="text-slate-500">可重命名以修正引用</span>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="editingId"
              class="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-400"
              :placeholder="id"
            />
            <button
              class="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!editingId || editingId === id"
              @click.stop="applyIdChange"
            >
              应用
            </button>
          </div>
        </div>

        <div v-else-if="isImageNode" class="space-y-1">
          <div class="w-full bg-slate-50 rounded-lg border border-slate-200 border-dashed overflow-hidden relative transition-all duration-300" :class="contentHeightClass">
            <div v-if="nodeImages.length > 0" class="grid w-full h-full" :class="gridClass">
              <div v-for="(img, idx) in nodeImages" :key="idx"
                  class="relative overflow-hidden border-white/50 group/img"
                  :class="{ 'border-r': (idx + 1) % gridCols !== 0, 'border-b': idx < nodeImages.length - gridCols }">
                <img :src="img.base64" class="w-full h-full object-fill transform hover:scale-110 transition-transform duration-300"/>
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-center p-1 pointer-events-none">
                  <span class="text-[9px] text-white font-mono truncate w-full text-center leading-tight">{{ getFileName(img.path) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1">
              <component v-if="config.icon" :is="config.icon" :size="24" class="text-slate-300"/>
              <span class="text-[9px] text-slate-400">No Image</span>
            </div>
          </div>
        </div>

        <div v-else-if="data.type === 'ColorMatch'" class="flex items-center gap-2">
          <div class="w-8 h-8 rounded shadow-sm border border-slate-100 ring-1 ring-slate-200" :style="{ backgroundColor: (businessData.targetColor as string) || '#000000' }"></div>
          <div class="flex flex-col overflow-hidden">
            <span class="text-[10px] text-slate-400 uppercase">Target</span>
            <span class="font-mono text-xs font-bold text-slate-700 truncate">{{ businessData.targetColor || '#N/A' }}</span>
          </div>
        </div>

        <div v-else-if="['OCR', 'NeuralNetworkClassify', 'NeuralNetworkDetect'].includes(data.type)" class="space-y-1">
          <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">Expected / Target</div>
          <div class="bg-slate-50 px-2 py-1.5 rounded border border-slate-100 text-xs font-mono text-slate-700 break-all leading-tight min-h-[1.5em]">
            {{ businessData.expected || (data.type === 'OCR' ? 'Any Text' : 'Any Class') }}
          </div>
        </div>

        <div v-else class="text-center">
          <div class="text-xs text-slate-500 line-clamp-2">{{ businessData.description || '通用逻辑处理' }}</div>
        </div>
      </div>

      <div v-if="currentActionConfig" class="shrink-0 flex flex-col items-center justify-center">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-help hover:scale-105 shadow-sm border border-slate-100"
            :class="currentActionConfig.bg" :title="`执行动作: ${currentActionConfig.label}`">
          <component v-if="currentActionConfig.icon" :is="currentActionConfig.icon" :size="18" :class="currentActionConfig.color"/>
        </div>
      </div>
    </div>

    <div v-if="!data._isMissing && hasOutputs" class="flex h-6 w-full border-t border-slate-100 divide-x divide-slate-100">
      <div class="flex-1 relative group hover:bg-blue-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span class="text-[10px] font-bold text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity">Next</span>
        <Handle id="source-a" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-blue-400 !transition-opacity"/>
        <div class="absolute bottom-0 w-full h-1 bg-blue-200 group-hover:bg-blue-500 transition-colors rounded-bl-xl"></div>
      </div>
      <div class="flex-1 relative group hover:bg-rose-50 flex justify-center items-center cursor-crosshair transition-colors">
        <span class="text-[10px] font-bold text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity">Err.</span>
        <Handle id="source-c" type="source" :position="Position.Bottom" class="!w-full !h-full !inset-0 !translate-x-0 !rounded-none !opacity-0 group-hover:!opacity-50 !bg-rose-400 !transition-opacity"/>
        <div class="absolute bottom-0 w-full h-1 bg-rose-200 group-hover:bg-rose-500 transition-colors rounded-br-xl"></div>
      </div>
    </div>
  </div>
</template>

<style>
.vue-flow__node-custom .vue-flow__handle { border: none; min-width: 0; min-height: 0; }
</style>