/**
 * The app's version and its changelog — one list, used by the "What's new" dialog, Settings → About and
 * `scripts/changelog.ts` (which writes CHANGELOG.md from it). Newest release first.
 *
 * Numbering (see CLAUDE.md): MAJOR.MINOR.PATCH — major = the repo format or the way you work changes,
 * minor = a new feature, patch = fixes and polish. Every release that reaches `main` bumps this and adds
 * an entry here, in plain words, written for the person using peeponote rather than for git.
 */
export const APP_VERSION = '1.2.0'

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
    version: '1.2.0',
    date: '2026-10-12',
    title: 'Themes, with or without frogs',
    notes: [
      'Three more themes in Settings → Look: Slate, Plum and Mocha, next to Dark and Peepo.',
      'The mascots can be turned off there as well. Every peepo becomes a quiet line icon that means the same thing, and the frog disappears from the palette and the menus.',
      'Both are personal and kept in this browser, so your boards look the same to everyone else.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-12',
    title: 'Setting up takes one paste',
    notes: [
      'Three screens instead of five: say hello, paste a GitHub key, pick the repo your boards live in.',
      'The key page opens with the right box already ticked, and the key is checked the moment you paste it; your name and email come from GitHub, so there is nothing to type.',
      'Your repos are listed for you, and a new private one can be made right there.',
      'peeponote asks for a classic GitHub key now. Unlike the fine-grained kind, it also works with a repo a teammate shared with you.',
      'You can still skip GitHub and keep the boards in this browser.',
    ],
  },
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
