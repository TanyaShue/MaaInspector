import type { ResourceFileInfo } from '@/services/api'

export interface ResourceFileGroup {
  folder: string
  files: ResourceFileInfo[]
}

const normalizeRelativePath = (value: string) => value.replace(/\\/g, '/')

export const getResourceFileName = (file: ResourceFileInfo): string => {
  const path = normalizeRelativePath(file.value || file.filename || '')
  return path.split('/').filter(Boolean).pop() || file.label || '未命名文件'
}

export const groupResourceFilesByFolder = (
  files: ResourceFileInfo[],
  source: string
): ResourceFileGroup[] => {
  const groups = new Map<string, ResourceFileInfo[]>()

  files
    .filter(file => file.source === source && Boolean(file.value))
    .forEach(file => {
      const path = normalizeRelativePath(file.value || '')
      const segments = path.split('/').filter(Boolean)
      const folder = segments.length > 1 ? segments.slice(0, -1).join('/') : '根目录'
      const group = groups.get(folder) || []
      group.push(file)
      groups.set(folder, group)
    })

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      if (left === '根目录') return -1
      if (right === '根目录') return 1
      return left.localeCompare(right, 'zh-CN')
    })
    .map(([folder, groupFiles]) => ({
      folder,
      files: groupFiles.sort((left, right) =>
        getResourceFileName(left).localeCompare(getResourceFileName(right), 'zh-CN')
      )
    }))
}
