/**
 * The app's version and its changelog — one list, used by the "What's new" dialog, Settings → About and
 * `scripts/changelog.ts` (which writes CHANGELOG.md from it). Newest release first.
 *
 * Numbering (see CLAUDE.md): MAJOR.MINOR.PATCH — major = the repo format or the way you work changes,
 * minor = a new feature, patch = fixes and polish. Every release that reaches `main` bumps this and adds
 * an entry here, in plain words, written for the person using peeponote rather than for git.
 */
export const APP_VERSION = '1.0.0'

export interface Release {
  version: string
  /** YYYY-MM-DD */
  date: string
  /** what this release is about, one short line */
  title: string
  /** what changed, in the user's words */
  notes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: '1.0.0',
    date: '2026-09-28',
    title: 'First stable version',
    notes: ['Released the first stable version'],
  },
]

export const latestRelease = () => CHANGELOG[0]
/** releases newer than the one this browser last saw ('' = never seen any) */
export function releasesSince(seen: string): Release[] {
  if (!seen) return [latestRelease()]
  const i = CHANGELOG.findIndex((r) => r.version === seen)
  return i === -1 ? [latestRelease()] : CHANGELOG.slice(0, i)
}
