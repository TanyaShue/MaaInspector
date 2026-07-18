<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { invoke } from '@tauri-apps/api/core'
  import {
    Database,
    Plus,
    ArrowUp,
    ArrowDown,
    Trash2,
    X,
    Save,
    FileInput,
    Bot,
    FolderOpen,
  } from 'lucide-vue-next'
  import { systemApi } from '@/services/api'
  import type { AgentProfile, ResourceProfile } from '@/services/api'
  import { ElMessage } from 'element-plus'

  type EditableProfile = ResourceProfile & { paths: string[] }

  interface ResourceSettingsProps {
    visible?: boolean
    profiles?: EditableProfile[]
    currentIndex?: number
  }

  const props = withDefaults(defineProps<ResourceSettingsProps>(), {
    visible: false,
    profiles: () => [],
    currentIndex: 0,
  })

  const emit = defineEmits<{
    (e: 'close'): void
    (e: 'save', payload: { profiles: EditableProfile[]; index: number }): void
  }>()

  const editingProfiles = ref<EditableProfile[]>([])
  const editProfIndex = ref<number>(0)

  const cloneProfiles = (profiles: EditableProfile[]): EditableProfile[] =>
    JSON.parse(JSON.stringify(profiles || [])) as EditableProfile[]

  const normalizeProfiles = (profiles: EditableProfile[]): EditableProfile[] =>
    profiles.map((prof) => ({
      ...prof,
      name: prof.name ?? 'New Profile',
      paths: Array.isArray(prof.paths) ? [...prof.paths] : [],
      schema_path: typeof prof.schema_path === 'string' ? prof.schema_path : '',
      interface_path: typeof prof.interface_path === 'string' ? prof.interface_path : '',
      agent: prof.agent
        ? {
            ...prof.agent,
            child_args: [...(prof.agent.child_args || [])],
            environment: { ...(prof.agent.environment || {}) },
          }
        : undefined,
    }))

  watch(
    () => props.visible,
    (val: boolean) => {
      if (val) {
        editingProfiles.value = normalizeProfiles(cloneProfiles(props.profiles))
        editProfIndex.value = props.currentIndex || 0
      }
    }
  )

  const addPathToProfile = () => {
    const current = editingProfiles.value[editProfIndex.value]
    if (!current) return
    current.paths.push('D:/New/Path')
  }

  const triggerFolderPicker = async () => {
    const current = editingProfiles.value[editProfIndex.value]
    if (!current) return

    const selected = await invoke<string | null>('system_pick_folder')

    if (typeof selected === 'string' && selected && !current.paths.includes(selected)) {
      current.paths.push(selected)
    }
  }

  const triggerSchemaFolderPicker = async () => {
    const current = editingProfiles.value[editProfIndex.value]
    if (!current) return

    const selected = await invoke<string | null>('system_pick_folder')
    if (typeof selected === 'string' && selected) current.schema_path = selected
  }

  const removePath = (pIndex: number) => {
    const current = editingProfiles.value[editProfIndex.value]
    if (!current) return
    current.paths.splice(pIndex, 1)
  }

  const movePath = (pIndex: number, direction: -1 | 1) => {
    const current = editingProfiles.value[editProfIndex.value]
    if (!current) return
    const paths = current.paths
    if (direction === -1 && pIndex > 0) {
      ;[paths[pIndex], paths[pIndex - 1]] = [paths[pIndex - 1], paths[pIndex]]
    } else if (direction === 1 && pIndex < paths.length - 1) {
      ;[paths[pIndex], paths[pIndex + 1]] = [paths[pIndex + 1], paths[pIndex]]
    }
  }

  const removeProfile = () => {
    editingProfiles.value.splice(editProfIndex.value, 1)
    editProfIndex.value = Math.max(0, editingProfiles.value.length - 1)
  }

  const addProfile = () => {
    editingProfiles.value.push({ name: 'New Profile', paths: [], schema_path: '' })
    editProfIndex.value = editingProfiles.value.length - 1
  }

  const importInterface = async () => {
    try {
      const imported = await systemApi.importInterface()
      const newProfiles = normalizeProfiles(imported.profiles as EditableProfile[])
      const firstIndex = editingProfiles.value.length
      editingProfiles.value.push(...newProfiles)
      editProfIndex.value = firstIndex
      ElMessage.success(`已从 ${imported.project_name} 导入 ${newProfiles.length} 个资源配置`)
    } catch (error) {
      if (String(error).includes('已取消导入')) return
      ElMessage.error(`导入失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const ensureAgent = (): AgentProfile => {
    const current = editingProfiles.value[editProfIndex.value]
    if (!current) {
      return {
        child_exec: '',
        child_args: [],
        working_directory: '',
        socket_id: '',
        auto_start: true,
      }
    }
    if (!current.agent) {
      current.agent = {
        child_exec: '',
        child_args: [],
        working_directory: '',
        socket_id: '',
        auto_start: true,
        environment: {},
      }
    }
    return current.agent
  }

  const agentArgsText = (agent?: AgentProfile) => (agent?.child_args || []).join('\n')
  const setAgentArgs = (value: string) => {
    ensureAgent().child_args = value
      .split(/\r?\n/)
      .map((arg) => arg.trim())
      .filter(Boolean)
  }

  const save = () => {
    emit('save', { profiles: editingProfiles.value, index: editProfIndex.value })
  }
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 animate-in fade-in duration-200"
  >
    <div
      class="flex h-[min(680px,calc(100vh-2rem))] w-[min(820px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <div class="w-[200px] bg-slate-50 border-r border-slate-100 flex flex-col min-h-0">
        <div class="p-3 text-xs font-medium text-slate-500 border-b border-slate-200">
          配置列表 (Profiles)
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          <div
            v-for="(prof, idx) in editingProfiles"
            :key="idx"
            class="px-3 py-2 rounded-lg cursor-pointer text-xs truncate border transition-all"
            :class="
              editProfIndex === idx
                ? 'bg-white border-slate-200 shadow-sm text-indigo-600 font-medium'
                : 'border-transparent text-slate-600 hover:bg-slate-100'
            "
            @click="editProfIndex = idx"
          >
            {{ prof.name }}
          </div>
        </div>
        <div class="p-2 border-t border-slate-100 space-y-1.5">
          <button
            class="border border-indigo-200 bg-indigo-50 rounded-lg py-1.5 text-xs text-indigo-600 hover:border-indigo-300 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1 w-full"
            @click="importInterface"
          >
            <FileInput :size="12" />
            从 interface.json 导入
          </button>
          <button
            class="border border-dashed border-slate-300 rounded-lg py-1.5 text-xs text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white transition-colors flex items-center justify-center gap-1 w-full"
            @click="addProfile"
          >
            <Plus :size="12" />
            新建配置
          </button>
        </div>
      </div>

      <div class="flex-1 min-w-0 min-h-0 flex flex-col bg-white">
        <div class="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Database :size="16" />
            编辑资源配置
          </h3>
          <button
            class="text-slate-400 hover:text-red-500 transition-colors"
            @click="$emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <div
          v-if="editingProfiles[editProfIndex]"
          class="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
        >
          <div class="space-y-1">
            <label class="text-[10px] font-medium tracking-wide text-slate-500">配置名称</label>
            <input
              v-model="editingProfiles[editProfIndex].name"
              type="text"
              class="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-700 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"
            />
          </div>

          <div v-if="editingProfiles[editProfIndex].interface_path" class="space-y-1">
            <label class="text-[10px] font-medium tracking-wide text-slate-500"
              >来源 interface.json</label
            >
            <div
              class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-mono text-slate-500"
            >
              <FileInput :size="12" class="shrink-0" />
              <span class="truncate">{{ editingProfiles[editProfIndex].interface_path }}</span>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-medium tracking-wide text-slate-500"
                >Schema 文件目录（可选）</label
              >
              <button
                class="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
                @click="triggerSchemaFolderPicker"
              >
                <Plus :size="10" />选择文件夹
              </button>
            </div>
            <input
              v-model="editingProfiles[editProfIndex].schema_path"
              type="text"
              class="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-600 outline-none transition-all shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 font-mono"
              placeholder="包含 custom.action.schema.json 等文件的目录"
            />
          </div>

          <section class="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-semibold text-emerald-700">Resource Paths</label>
              <div class="flex items-center gap-2">
                <button
                  class="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
                  @click="triggerFolderPicker"
                >
                  <Plus :size="10" />选择文件夹
                </button>
                <button
                  class="text-[10px] text-indigo-500 hover:underline flex items-center gap-1"
                  @click="addPathToProfile"
                >
                  <Plus :size="10" />添加路径
                </button>
              </div>
            </div>

            <div
              class="custom-scrollbar mt-2 min-h-24 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-emerald-100 bg-white/80 p-1"
            >
              <div
                v-for="(path, pIdx) in editingProfiles[editProfIndex].paths"
                :key="pIdx"
                class="flex items-center gap-2 bg-white p-2 rounded shadow-sm border border-slate-100 group"
                :title="path"
              >
                <span class="text-[10px] font-mono text-slate-400 w-4 text-center">{{
                  pIdx + 1
                }}</span>
                <input
                  v-model="editingProfiles[editProfIndex].paths[pIdx]"
                  class="flex-1 text-xs border-none outline-none p-0 text-slate-600 placeholder:text-slate-300"
                  placeholder="Path..."
                />

                <div
                  class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    :disabled="pIdx === 0"
                    class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 disabled:opacity-30"
                    @click="movePath(pIdx, -1)"
                  >
                    <ArrowUp :size="12" />
                  </button>
                  <button
                    :disabled="pIdx === editingProfiles[editProfIndex].paths.length - 1"
                    class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500 disabled:opacity-30"
                    @click="movePath(pIdx, 1)"
                  >
                    <ArrowDown :size="12" />
                  </button>
                  <button
                    class="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                    @click="removePath(pIdx)"
                  >
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>
              <div
                v-if="editingProfiles[editProfIndex].paths.length === 0"
                class="text-center py-4 text-xs text-slate-400 italic"
              >
                暂无路径
              </div>
            </div>
            <p class="mt-1.5 text-[10px] text-slate-400">路径按从上到下的顺序加载，后加载的资源会覆盖前面的内容。</p>
          </section>

          <section class="shrink-0 rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <Bot :size="14" />
                Agent 设置
              </div>
              <label class="flex items-center gap-1.5 text-[10px] text-slate-600">
                <input
                  :checked="ensureAgent().auto_start"
                  type="checkbox"
                  @change="ensureAgent().auto_start = ($event.target as HTMLInputElement).checked"
                />
                连接时自动启动
              </label>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="space-y-1">
                <span class="text-[10px] text-slate-500">可执行文件 (child_exec)</span>
                <input
                  v-model="ensureAgent().child_exec"
                  class="agent-input"
                  placeholder="agent/agent.exe"
                />
              </label>
              <label class="space-y-1">
                <span class="text-[10px] text-slate-500">Socket ID</span>
                <input
                  v-model="ensureAgent().socket_id"
                  class="agent-input"
                  placeholder="Agent 通信标识"
                />
              </label>
            </div>
            <label class="space-y-1 block">
              <span class="text-[10px] text-slate-500 flex items-center gap-1"
                ><FolderOpen :size="10" />启动工作目录 (CWD)</span
              >
              <input
                v-model="ensureAgent().working_directory"
                class="agent-input font-mono"
                placeholder="interface.json 所在目录"
              />
            </label>
            <label class="space-y-1 block">
              <span class="text-[10px] text-slate-500"
                >启动参数（每行一个，Socket ID 会自动追加到末尾）</span
              >
              <textarea
                :value="agentArgsText(editingProfiles[editProfIndex].agent)"
                rows="3"
                class="agent-input resize-y font-mono"
                placeholder="--example&#10;value"
                @input="setAgentArgs(($event.target as HTMLTextAreaElement).value)"
              />
            </label>
          </section>

          <div class="border-t border-slate-100 pt-2 flex justify-between">
            <button class="text-xs text-red-500 hover:underline" @click="removeProfile">
              删除此配置
            </button>
          </div>
        </div>

        <div v-else class="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-300">
          <Database :size="48" class="mb-2 opacity-50" />
          <span class="text-xs">请选择或新建资源配置</span>
        </div>

        <div class="p-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
          <button
            class="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 rounded transition-colors"
            @click="$emit('close')"
          >
            取消
          </button>
          <button
            class="px-3 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded shadow-sm hover:bg-indigo-600 transition-colors flex items-center gap-1"
            @click="save"
          >
            <Save :size="14" />
            保存所有配置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .agent-input {
    @apply w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100;
  }
</style>
