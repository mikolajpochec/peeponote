/**
 * The app's version and its changelog — one list, used by the "What's new" dialog, Settings → About and
 * `scripts/changelog.ts` (which writes CHANGELOG.md from it). Newest release first.
 *
 * Numbering (see CLAUDE.md): MAJOR.MINOR.PATCH — major = the repo format or the way you work changes,
 * minor = a new feature, patch = fixes and polish. Every release that reaches `main` bumps this and adds
 * an entry here, in plain words, written for the person using peeponote rather than for git.
 */
export const APP_VERSION = '1.5.1'

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
    version: '1.5.1',
    date: '2026-10-13',
    title: 'Tidier on phones',
    notes: [
      'The bottom toolbar fits the screen with every tool in view, File included, so it no longer slides sideways.',
      'The style and formatting bars wrap onto two rows instead of running off both edges of the screen.',
      'Settings shows all its tabs at once, the boards drawer is wider so names fit, and short board names like "Home" are no longer clipped in the top bar.',
      'Card properties stack their labels above the values on small phones.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-13',
    title: 'Better on phones',
    notes: [
      'A board you open for the first time on a phone is zoomed so its cards fit the screen width, instead of running off the right edge.',
      'Shape and Story in the bottom toolbar open their list of variants again on phones.',
      'Turn your phone sideways and you keep the phone layout: toolbar at the bottom, boards in a drawer.',
      'While you type in a card, the toolbar steps aside so the keyboard has room.',
      'Settings fits a phone: the tabs scroll sideways and desktop keyboard shortcuts are no longer listed on touch screens.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-13',
    title: 'View only, for looking without touching',
    notes: [
      'Tap 🔒 in the top bar (or ⋯ → View only, or ⇧⌘E) and your boards can be scrolled, zoomed and opened but not changed: a stray tap, drag or key press edits nothing.',
      'The blue View only button stays in the top bar while it is on; tap it again to go back to editing.',
      'It is kept in this browser, so a phone you only read on can stay locked.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-12',
    title: 'Maths in your cards',
    notes: [
      'Write $E = mc^2$ in a note, a text card, a to-do row, a story field or a review comment and it is drawn as maths.',
      'For a centred formula of its own, put $$ on the line above and below it.',
      'Prices are still prices: "it costs $5 and $10" is left alone, and a backslash before a dollar sign always keeps it literal.',
      'The maths engine is only fetched by a board that actually holds a formula, so everything else opens as quickly as before.',
    ],
  },
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
