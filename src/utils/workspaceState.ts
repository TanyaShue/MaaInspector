import type { LastTabsState, ResourceProfile, WorkspaceState } from '@/services/api'
import type { TabResourceInfo as RuntimeTabResourceInfo } from '@/utils/flowWorkspaceTypes'

type PersistedTabResourceInfo = NonNullable<WorkspaceState['tabs']>[number]
type AnyTabResourceInfo = RuntimeTabResourceInfo | PersistedTabResourceInfo

const normalizePath = (path: string) => path.replace(/\\/g, '/').trim()

const getResourceFile = (tab: AnyTabResourceInfo): string => {
  const maybeRuntime = tab as RuntimeTabResourceInfo
  const maybePersisted = tab as PersistedTabResourceInfo
  return maybeRuntime.resourceFile || maybePersisted.resource_file || ''
}

export const buildResourceSignature = (profile?: ResourceProfile | null): string => {
  const name = (profile?.name || '').trim()
  const paths = Array.isArray(profile?.paths) ? profile.paths.map(normalizePath) : []
  const schemaPath = normalizePath(profile?.schema_path || '')
  return JSON.stringify({ name, paths, schemaPath })
}

export const toPersistedTabs = (tabs?: AnyTabResourceInfo[] | null): PersistedTabResourceInfo[] =>
  (tabs || []).map(tab => ({
    id: tab.id || '',
    title: tab.title || '',
    resource_file: getResourceFile(tab)
  }))

export const toRuntimeTabs = (tabs?: AnyTabResourceInfo[] | null): RuntimeTabResourceInfo[] =>
  (tabs || []).map(tab => ({
    id: tab.id || `flow-${crypto.randomUUID()}`,
    title: tab.title || '',
    resourceFile: getResourceFile(tab)
  }))

export const legacyTabsToWorkspaceState = (
  lastTabs?: LastTabsState | null,
  resourceSignature = '',
  restoreWorkspaceOnStart?: boolean
): WorkspaceState | null => {
  if (!lastTabs) return null
  return {
    resource_index: lastTabs.resource_index,
    resource_signature: resourceSignature || undefined,
    tabs: toPersistedTabs(lastTabs.tabs),
    active_tab_id: lastTabs.active_tab_id || '',
    restore_workspace_on_start: restoreWorkspaceOnStart
  }
}
