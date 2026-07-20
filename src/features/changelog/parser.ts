import type {
  ChangelogRelease,
  ChangelogSectionKind
} from './types'

const VERSION_HEADING =
  /^##\s+(v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?|Unreleased)(?:\s*\(([^)]+)\))?(?:\s*-\s*(.+))?/i

const sectionAliases: Record<ChangelogSectionKind, RegExp> = {
  features: /新功能|特性|功能|features?|added|new/i,
  improvements: /优化|改进|变更|更新|improvements?|changes?|changelog|changed/i,
  fixes: /修复|问题|fix(?:es|ed)?|bug/i
}

const conventionalCommitSections: Array<[RegExp, ChangelogSectionKind]> = [
  [/^(?:feat)(?:\([^)]+\))?!?:/i, 'features'],
  [/^(?:fix)(?:\([^)]+\))?!?:/i, 'fixes'],
  [/^(?:perf|refactor|style|build|ci|chore|docs|test)(?:\([^)]+\))?!?:/i, 'improvements']
]

const resolveSection = (title: string): ChangelogSectionKind | null => {
  for (const [kind, pattern] of Object.entries(sectionAliases)) {
    if (pattern.test(title)) return kind as ChangelogSectionKind
  }
  return null
}

const resolveItemSection = (
  item: string,
  headingSection: ChangelogSectionKind | null
): ChangelogSectionKind => {
  if (headingSection && headingSection !== 'improvements') return headingSection
  return conventionalCommitSections.find(([pattern]) => pattern.test(item))?.[1]
    ?? headingSection
    ?? 'improvements'
}

const normalizeVersion = (version: string): string => {
  if (version.toLowerCase() === 'unreleased') return 'Unreleased'
  return version.startsWith('v') ? version : `v${version}`
}

const createRelease = (version: string, date?: string): ChangelogRelease => ({
  id: normalizeVersion(version).toLowerCase(),
  version: normalizeVersion(version),
  date: date?.trim() || '未知日期',
  sections: []
})

const addItem = (
  release: ChangelogRelease,
  kind: ChangelogSectionKind,
  item: string
) => {
  const normalizedItem = item.trim()
  if (!normalizedItem) return

  let section = release.sections.find(candidate => candidate.kind === kind)
  if (!section) {
    section = { kind, items: [] }
    release.sections.push(section)
  }
  section.items.push(normalizedItem)
}

const splitInlineItems = (text: string): string[] =>
  text
    .split(/\s+-\s+/)
    .map(item => item.trim())
    .filter(Boolean)

export const parseChangelog = (content: string): ChangelogRelease[] => {
  const releases: ChangelogRelease[] = []
  let currentRelease: ChangelogRelease | null = null
  let currentSection: ChangelogSectionKind | null = null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    const versionMatch = line.match(VERSION_HEADING)
    if (versionMatch) {
      currentRelease = createRelease(
        versionMatch[1],
        versionMatch[2] || versionMatch[3]
      )
      releases.push(currentRelease)
      currentSection = null
      continue
    }

    if (!currentRelease) continue

    const sectionMatch = line.match(/^###\s+(.+)$/)
    if (sectionMatch) {
      const inlineMatch = sectionMatch[1].match(/^(.*?)(?:\s+[-*]\s+(.+))$/)
      const sectionTitle = (inlineMatch?.[1] ?? sectionMatch[1]).trim()
      currentSection = resolveSection(sectionTitle)
      const inlineItems = inlineMatch?.[2] ? splitInlineItems(inlineMatch[2]) : []
      for (const item of inlineItems) {
        addItem(currentRelease, resolveItemSection(item, currentSection), item)
      }
      continue
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/)
    if (!listMatch) continue
    for (const item of splitInlineItems(listMatch[1])) {
      addItem(currentRelease, resolveItemSection(item, currentSection), item)
    }
  }

  return releases.filter(release => release.sections.some(section => section.items.length > 0))
}
