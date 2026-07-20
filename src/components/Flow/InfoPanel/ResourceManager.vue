<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { Database, HardDrive, Settings, RefreshCw } from 'lucide-vue-next'
import { resourceApi } from '@/services/api'
import { useAppConfigStore } from '@/stores/appConfig'
import { makeFileId, parseFileId, getFileObjById } from '@/utils/fileId'
import Dropdown from '@/components/Flow/Common/Dropdown.vue'
import StatusIndicator from '@/components/Flow/Common/StatusIndicator.vue'
import type { DropdownOption } from '@/components/Flow/Common/types'
import type { ResourceProfile, ResourceFileInfo } from '@/services/api'

const appConfig = useAppConfigStore()

type EditableProfile = ResourceProfile & { paths: string[] }

const props = defineProps<{
  currentFilename?: string
  profiles?: EditableProfile[]
  profileIndex?: number
  selectedFile?: string
  openedFileIds?: string[]
  restoreWorkspaceOnStart?: boolean
  initialStatus?: 'disconnected' | 'connecting' | 'connected' | 'failed'
  initialMessage?: string
  initialFiles?: ResourceFileInfo[]
}>()

const emit = defineEmits([
  'file-selected',
  'config-changed',
  'update:profiles',
  'update:profileIndex',
  'update:selectedFile',
  'open-settings',
  'open-create-file',
  'restore-tabs',
  'clear-tabs',
  'status-change'
])

// 内部状态 (当 props 未提供时使用)
const internalStatus = ref<'disconnected' | 'connecting' | 'connected' | 'failed'>(
  props.initialStatus ?? 'disconnected'
)
const internalMessage = ref(props.initialMessage ?? '资源未连接')
const internalProfiles = ref<EditableProfile[]>([])
const internalProfileIndex = ref(0)
const internalSelectedFile = ref('')

// 使用 props 或内部状态
const status = computed(() => internalStatus.value)
const message = computed(() => internalMessage.value)
const resourceProfiles = computed<EditableProfile[]>(() => props.profiles ?? internalProfiles.value)
const selectedProfileIndex = computed(() => props.profileIndex ?? internalProfileIndex.value)
const selectedResourceFile = computed(() => props.selectedFile ?? internalSelectedFile.value)

// 本地可变副本 (用于 API 调用结果)
const localProfiles = ref<EditableProfile[]>([])
const localProfileIndex = ref(0)
const localSelectedFile = ref('')
const availableFiles = ref<ResourceFileInfo[]>([...(props.initialFiles ?? [])])

const currentProfile = computed<EditableProfile>(
  () =>
    resourceProfiles.value[selectedProfileIndex.value] ||
    ({ name: 'None', paths: [] } as EditableProfile)
)

const findFileById = (id: string) => getFileObjById(id, availableFiles.value)

const handleProfileIndexUpdate = (index: PropertyKey) => {
  emit('update:profileIndex', index)
  emit('config-changed')
}

const loadFileById = (fileId: string): boolean => {
  if (!fileId) return false
  const fileObj = findFileById(fileId)
  if (!fileObj?.value) return false

  localSelectedFile.value = fileId
  emit('update:selectedFile', fileId)
  emit('file-selected', {
    filename: fileObj.value,
    source: fileObj.source
  })
  return true
}

const profileOptions = computed<DropdownOption[]>(() => {
  if (resourceProfiles.value.length === 0) {
    return [{ label: '无配置...', value: -1, disabled: true }]
  }
  return resourceProfiles.value.map((prof, idx) => ({
    label: prof.name || '未命名配置',
    value: idx
  }))
})

const fileOptions = computed<DropdownOption[]>(() => {
  if (availableFiles.value.length === 0) {
    return [{ label: '配置路径下无文件', value: '', disabled: true }]
  }
  const openedIds = new Set(props.openedFileIds || [])
  return availableFiles.value.map(file => {
    const fileId = makeFileId(file.source, file.value)
    return {
      label: file.label,
      value: fileId,
      disabled: openedIds.has(fileId)
    }
  })
})

watchEffect(() => {
  emit('status-change', {
    status: status.value,
    message: message.value,
    fileOptions: fileOptions.value,
    availableFilesLength: availableFiles.value.length,
    availableFiles: availableFiles.value
  })
})

const normalizeProfiles = (profiles?: ResourceProfile[]): EditableProfile[] =>
  (profiles || []).map(p => ({
    ...p,
    paths: Array.isArray(p.paths) ? [...p.paths] : [],
    schema_path: typeof p.schema_path === 'string' ? p.schema_path : ''
  }))

// 加载资源
const handleResourceLoad = async (): Promise<boolean> => {
  try {
    internalStatus.value = 'connecting'
    internalMessage.value = '加载中...'

    const res = await resourceApi.load(currentProfile.value)
    appConfig.setCustomCompletions(res.custom_completions)

    const ok = res.r ?? res.success ?? true
    if (!ok) {
      internalStatus.value = 'failed'
      internalMessage.value = res.message || '资源加载失败'
      return false
    }

    internalStatus.value = 'connected'
    internalMessage.value = '已就绪'

    if (res.list) {
      availableFiles.value = res.list

      appConfig.markResourceLoaded()

      if (!props.openedFileIds || props.openedFileIds.length === 0) {
        const validFileIds = new Set(
          availableFiles.value
            .filter(file => file.value)
            .map(file => makeFileId(file.source, file.value))
        )
        const restoredTabs = appConfig.restoreLastWorkspace(validFileIds)
        if (restoredTabs.length > 0) {
          const activeRestoredFile =
            appConfig.resource.selectedFileId || restoredTabs[0].resourceFile
          if (activeRestoredFile) {
            localSelectedFile.value = activeRestoredFile
            emit('update:selectedFile', activeRestoredFile)
          }
          emit('restore-tabs', restoredTabs)
          return true
        }
      }

      const selectedFileId = props.selectedFile ?? localSelectedFile.value
      if (selectedFileId) {
        loadFileById(selectedFileId)
      }
    }
    return true
  } catch (e: unknown) {
    console.error('资源加载流程异常', e)
    internalStatus.value = 'failed'
    internalMessage.value = '加载失败'
    return false
  }
}

const handleResourceLoadWithRetry = async (maxAttempts = 5): Promise<boolean> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    internalMessage.value =
      attempt === 1 ? '正在自动恢复资源...' : `正在重试加载资源 (${attempt}/${maxAttempts})...`
    if (await handleResourceLoad()) return true
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 600))
  }
  internalMessage.value = `自动恢复失败，已尝试 ${maxAttempts} 次`
  return false
}

// 切换文件
const executeFileSwitch = async (filename: string, source?: string) => {
  const normSource = source ? source.replace(/\\/g, '/').toLowerCase() : ''
  let target = availableFiles.value.find((f: ResourceFileInfo) => {
    const fSource = f.source ? f.source.replace(/\\/g, '/').toLowerCase() : ''
    if (source) {
      return f.value === filename && fSource === normSource
    }
    return f.value === filename
  })

  if (target) {
    const newId = makeFileId(target.source, target.value)
    appConfig.hydrateWorkspaceFromResource(newId)
    loadFileById(newId)
  } else {
    ElMessage.error(`无法切换: 未找到文件 ${filename}`)
  }
}

// 设置 profiles
const setProfiles = (profiles: EditableProfile[]) => {
  localProfiles.value = profiles
  emit('update:profiles', profiles)
}

const setProfileIndex = (index: number) => {
  localProfileIndex.value = index
  emit('update:profileIndex', index)
}

const setMessage = (msg: string) => {
  internalMessage.value = msg
}

// 暴露方法
defineExpose({
  handleResourceLoad,
  handleResourceLoadWithRetry,
  executeFileSwitch,
  setProfiles,
  setProfileIndex,
  normalizeProfiles,
  makeFileId,
  parseFileId,
  findFileById,
  status,
  message,
  setMessage,
  fileOptions,
  currentProfile,
  availableFiles,
  resourceProfiles,
  selectedProfileIndex,
  selectedResourceFile
})

// 配置切换时重新加载
watch(selectedProfileIndex, (nv, ov) => {
  if (nv === ov) return
  emit('config-changed')
  void handleResourceLoad()
})

watch(
  () => props.initialFiles,
  files => {
    if (availableFiles.value.length > 0 || !files?.length) return
    availableFiles.value = [...files]
  }
)
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between text-xs mb-1">
      <div class="flex items-center gap-1.5 font-bold text-slate-700">
        <Database :size="14" class="text-emerald-500" />
        资源配置
      </div>
      <StatusIndicator :status="status" />
    </div>
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
      <div class="flex gap-2">
        <Dropdown
          :model-value="selectedProfileIndex"
          :options="profileOptions"
          placeholder="选择资源配置"
          class="flex-1"
          @update:model-value="handleProfileIndexUpdate"
        />
        <button class="btn-icon" @click="$emit('open-settings')">
          <Settings :size="16" />
        </button>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="status === 'connecting'"
          class="flex-1 btn-primary bg-emerald-500 shadow-emerald-100"
          @click="handleResourceLoad"
        >
          <component
            :is="status === 'connecting' ? RefreshCw : HardDrive"
            :size="12"
            :class="{ 'animate-spin': status === 'connecting' }"
          />
          <span>{{ status === 'connected' ? '重新加载' : '加载资源' }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.btn-primary {
  @apply flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-icon {
  @apply p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
