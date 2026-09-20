/** Per-user settings: live in this browser's localStorage, never committed. Shared workspace settings live in peeponote.json. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import type { ThemeName } from '../theme/themes'
import type { TransportPref } from '../git/sync'

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
  /** proves it's you on comments/reviews; stays in this browser, re-derived into keys on boot */
  identityPassword: string
  /** "Later" on the identify-yourself prompt: don't ask again before this time */
  identityPromptSnoozedUntil: number
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
  identityPassword: '',
  identityPromptSnoozedUntil: 0,
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
