import { describe, it, expect } from 'vitest'
import { changelogContent } from '@/generated/changelog'
import { parseChangelog } from '@/features/changelog'

describe('changelog', () => {
  it('should have content', () => {
    expect(changelogContent).toBeDefined()
    expect(changelogContent.length).toBeGreaterThan(0)
  })

  it('parses generated changelog entries', () => {
    const items = parseChangelog(`# MaaInspector 更新日志

## v0.7.0-alpha.3 (2026-06-16)

### 变更
- fix: 修复打包异常 (4846549)
`)

    expect(items).toHaveLength(1)
    expect(items[0].version).toBe('v0.7.0-alpha.3')
    expect(items[0].date).toBe('2026-06-16')
    expect(items[0].sections).toEqual([
      {
        kind: 'fixes',
        items: ['fix: 修复打包异常 (4846549)']
      }
    ])
  })

  it('normalizes version headers without a v prefix', () => {
    const items = parseChangelog(`## 0.1.4 (2026-06-16)

### 新功能
- 支持指定 MaaFramework 版本
`)

    expect(items[0].version).toBe('v0.1.4')
    expect(items[0].sections).toEqual([
      {
        kind: 'features',
        items: ['支持指定 MaaFramework 版本']
      }
    ])
  })

  it('classifies conventional commits inside a generic changes section', () => {
    const items = parseChangelog(`## Unreleased

### 变更
- feat(editor): 新增节点搜索
- perf: 减少画布重复渲染
- fix!: 修复崩溃
`)

    expect(items[0].sections).toEqual([
      { kind: 'features', items: ['feat(editor): 新增节点搜索'] },
      { kind: 'improvements', items: ['perf: 减少画布重复渲染'] },
      { kind: 'fixes', items: ['fix!: 修复崩溃'] }
    ])
  })

  it('ignores content before the first release and empty releases', () => {
    const items = parseChangelog(`# 更新日志
- 不属于任何版本

## v1.0.0 (2026-01-01)

## v0.9.0 - 2025-12-01
### 修复
- 修复旧问题
`)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'v0.9.0',
      version: 'v0.9.0',
      date: '2025-12-01'
    })
  })
})
