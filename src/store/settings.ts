/** Per-user settings: live in this browser's localStorage, never committed. Shared workspace settings live in peeponote.json. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import type { IconStyle } from '../theme/glyphs'
import type { ThemeName } from '../theme/themes'
import type { TransportPref } from '../git/sync'
import type { PluginId } from '../plugins'

/** the GitHub account this browser is signed in as (from the token, refreshed on boot) */
export interface GhIdentity {
  login: string
  id: number
  name: string
  avatarUrl: string
  /** the address git puts in commits: the public one, or GitHub's noreply address */
  email: string
}

/** a repo you've opened before: URL + the token that worked for it, so going back is one click */
export interface RepoEntry {
  url: string
  token: string
  /** browser-storage slot holding its clone */
  slot: string
  lastUsed: number
}

export interface Settings {
  repos: RepoEntry[]
  authorName: string
  authorEmail: string
  token: string
  username: string
  corsProxy: string
  /** how to talk to the remote: GitHub REST API (no proxy) or git-over-HTTP via CORS proxy */
  transport: TransportPref
  /** poll the remote every ~45s and fast-forward when others pushed and there's nothing local to lose */
  autoPull: boolean
  /** first-run wizard finished (or skipped) */
  onboarded: boolean
  theme: ThemeName
  /** draw the peepo mascots; off replaces each of them with an icon in `iconStyle` */
  mascots: boolean
  /** with the mascots off: colour-coded badges, or monochrome icons in the text colour */
  iconStyle: IconStyle
  /** who the token belongs to: comments, reviews and notifications are signed in as this person */
  github: GhIdentity | null
  /** History lists the commits peeponote makes on its own (review activity, merges) */
  showAutoCommits: boolean
  /** the app version whose changelog this browser has already seen ('' = never) */
  lastSeenVersion: string
  /** show "what's new" by itself the first time you open a new version */
  showChangelogOnUpdate: boolean
  /** view only: boards scroll and zoom but can't be changed, so a stray tap or drag edits nothing */
  viewOnly: boolean
  /** plugins switched on or off by hand; absent = the plugin's default */
  plugins: Partial<Record<PluginId, boolean>>
  /** the plugin question was answered (onboarding, or the one-time dialog for people from before plugins) */
  pluginsChosen: boolean
  set: (patch: Partial<Omit<Settings, 'set' | 'reset' | 'rememberRepo' | 'forgetRepo'>>) => void
  /** back to factory defaults (token gone, wizard shows again) */
  reset: () => void
  rememberRepo: (e: Omit<RepoEntry, 'lastUsed'>) => void
  forgetRepo: (url: string) => void
}

const DEFAULTS: Omit<Settings, 'set' | 'reset' | 'rememberRepo' | 'forgetRepo'> = {
  repos: [],
  authorName: '',
  authorEmail: '',
  token: '',
  username: '',
  corsProxy: DEFAULT_CORS_PROXY,
  transport: 'auto',
  autoPull: true,
  onboarded: false,
  theme: 'dark',
  mascots: true,
  iconStyle: 'colour',
  github: null,
  showAutoCommits: false,
  lastSeenVersion: '',
  showChangelogOnUpdate: true,
  viewOnly: false,
  plugins: {},
  pluginsChosen: false,
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULTS }),
      rememberRepo: (e) =>
        set((s) => ({ repos: [{ ...e, lastUsed: Date.now() }, ...s.repos.filter((r) => r.url !== e.url)].slice(0, 20) })),
      forgetRepo: (url) => set((s) => ({ repos: s.repos.filter((r) => r.url !== url) })),
    }),
    { name: 'peeponote-settings' },
  ),
)
