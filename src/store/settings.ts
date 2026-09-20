/** Per-user settings: live in this browser's localStorage, never committed. Shared workspace settings live in peeponote.json. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import type { ThemeName } from '../theme/themes'
import type { TransportPref } from '../git/sync'

export interface Settings {
  authorName: string
  authorEmail: string
  token: string
  username: string
  corsProxy: string
  /** how to talk to the remote: GitHub REST API (no proxy) or git-over-HTTP via CORS proxy */
  transport: TransportPref
  /** show a separate Push button instead of pushing as part of Save */
  separatePush: boolean
  /** first-run wizard finished (or skipped) */
  onboarded: boolean
  theme: ThemeName
  set: (patch: Partial<Omit<Settings, 'set'>>) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      authorName: '',
      authorEmail: '',
      token: '',
      username: '',
      corsProxy: DEFAULT_CORS_PROXY,
      transport: 'auto',
      separatePush: false,
      onboarded: false,
      theme: 'dark',
      set: (patch) => set(patch),
    }),
    { name: 'peeponote-settings' },
  ),
)
