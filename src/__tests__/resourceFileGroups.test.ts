import { describe, expect, it } from 'vitest'
import { getResourceFileName, groupResourceFilesByFolder } from '@/utils/resourceFileGroups'
import type { ResourceFileInfo } from '@/services/api'

const file = (source: string, value: string | null): ResourceFileInfo => ({
  source,
  value,
  filename: value,
  label: value || `[Empty] (${source})`
})

describe('resourceFileGroups', () => {
  it('groups only the selected resource path and keeps the root folder first', () => {
    const groups = groupResourceFilesByFolder([
      file('D:\\resource-a', 'root.json'),
      file('D:\\resource-a', 'chapter\\b.json'),
      file('D:\\resource-a', 'chapter/a.json'),
      file('D:\\resource-b', 'other.json')
    ], 'D:\\resource-a')

    expect(groups.map(group => group.folder)).toEqual(['根目录', 'chapter'])
    expect(groups[1].files.map(getResourceFileName)).toEqual(['a.json', 'b.json'])
  })

  it('ignores the placeholder returned for an empty resource path', () => {
    expect(groupResourceFilesByFolder([
      file('D:\\empty-resource', null)
    ], 'D:\\empty-resource')).toEqual([])
  })
})
