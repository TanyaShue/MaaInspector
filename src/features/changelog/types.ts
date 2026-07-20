export type ChangelogSectionKind = 'features' | 'improvements' | 'fixes'

export interface ChangelogSection {
  kind: ChangelogSectionKind
  items: string[]
}

export interface ChangelogRelease {
  id: string
  version: string
  date: string
  sections: ChangelogSection[]
}
