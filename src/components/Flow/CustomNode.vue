<script setup>
import { computed, ref, inject, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import NodeDetails from './NodeDetails.vue'
import { NODE_CONFIG_MAP, ACTION_CONFIG_MAP, STATUS_ICONS } from '../../utils/nodeLogic.js'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const updateNode = inject('updateNode', () => console.warn('updateNode not provided'))
const closeAllDetailsSignal = inject('closeAllDetailsSignal', ref(0))
const currentFilename = inject('currentFilename', ref(''))

// 获取 UI 配置
const config = computed(() => NODE_CONFIG_MAP[props.data.type] || NODE_CONFIG_MAP['DirectHit'])
const availableTypes = Object.keys(NODE_CONFIG_MAP).filter(t => t !== 'Unknown')

const businessData = computed(() => props.data.data || {})

const currentActionConfig = computed(() => {
  const action = businessData.value.action
  if (!action || action === 'DoNothing') return null
  return ACTION_CONFIG_MAP[action] || ACTION_CONFIG_MAP['Custom']
})

const showDetails = ref(false)
const toggleDetails = () => showDetails.value = !showDetails.value
const getFileName = (path) => (!path || typeof path !== 'string') ? '未选择图片' : path.split('/').pop()

watch(closeAllDetailsSignal, () => showDetails.value = false)

const handleUpdateId = ({ oldId, newId }) => updateNode({ oldId, newId, newType: props.data.type })
const handleUpdateType = (newType) => updateNode({ oldId: props.id, newId: props.id, newType })
const handleUpdateData = (newData) => updateNode({
  oldId: props.id, newId: props.id, newType: newData.recognition || props.data.type, newData
})

// 状态 UI
const statusConfig = computed(() => {
  if (props.data._isMissing) return STATUS_ICONS.missing
  return STATUS_ICONS[props.data.status] || null
})

const headerStyle = computed(() => {
  if (props.data.status && STATUS_ICONS[props.data.status]) return STATUS_ICONS[props.data.status].headerClass
  return STATUS_ICONS.default.headerClass
})

// 图片逻辑
const isImageNode = computed(() => ['TemplateMatch', 'FeatureMatch'].includes(props.data.type))
const nodeImages = computed(() => {
  const template = businessData.value.template
  const paths = Array.isArray(template) ? template : (typeof template === 'string' ? [template] : [])
  if (!paths.length) return []

  const allImages = [...(props.data._images || []), ...(props.data._temp_images || [])]
  return allImages.filter(img => img.found && img.base64 && paths.includes(img.path)).slice(0, 16)
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
          <div class="font-bold text-slate-700 text-sm truncate max-w-[150px]" :title="data.id">{{ data.id }}</div>
          <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1">{{ config.label }}</div>
        </div>
      </div>
      <div v-if="statusConfig" class="flex items-center p-1 -mr-1 rounded-md">
        <component v-if="statusConfig.icon" :is="statusConfig.icon" :size="18" :class="[statusConfig.color, statusConfig.spin ? 'animate-spin' : '']"/>
      </div>
    </div>

    <div class="p-4 bg-white min-h-[80px] flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div v-if="data._isMissing" class="text-center text-slate-400 text-xs italic bg-slate-50 p-2 rounded border border-dashed border-slate-200">引用缺失</div>
        <div v-else-if="data.type === 'Unknown'" class="text-center text-slate-400 text-xs italic">未知节点</div>

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
          <div class="w-8 h-8 rounded shadow-sm border border-slate-100 ring-1 ring-slate-200" :style="{ backgroundColor: businessData.targetColor || '#000000' }"></div>
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

    <div v-if="!data._isMissing && data.type !== 'Unknown'" class="flex h-6 w-full border-t border-slate-100 divide-x divide-slate-100">
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