import { changelogReleases as generatedReleases } from '@/generated/changelog'
import type { ChangelogRelease } from './types'

export type {
  ChangelogRelease,
  ChangelogSection,
  ChangelogSectionKind
} from './types'
export { parseChangelog } from './parser'

export const changelogReleases: readonly ChangelogRelease[] = generatedReleases
