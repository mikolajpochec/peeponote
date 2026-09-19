import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_CORS_PROXY } from '../git/repo'

export interface Settings {
  authorName: string
  authorEmail: string
  token: string
  username: string
  corsProxy: string
  autoPush: boolean
  snapToGrid: boolean
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
      snapToGrid: false,
      set: (patch) => set(patch),
    }),
    { name: 'peeponote-settings' },
  ),
)
