/** Per-user settings: live in this browser's localStorage, never committed. Shared workspace settings live in peeponote.json. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import type { ThemeName } from '../theme/themes'

export interface Settings {
  authorName: string
  authorEmail: string
  token: string
  username: string
  corsProxy: string
  autoPush: boolean
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
      autoPush: false,
      theme: 'peepo',
      set: (patch) => set(patch),
    }),
    { name: 'peeponote-settings' },
  ),
)
