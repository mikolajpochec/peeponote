import { create } from 'zustand'
import type { PeepoName } from '../theme/peepos'

export interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  peepo?: PeepoName
}

interface ConfirmState {
  current: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null
  ask: (req: ConfirmRequest) => Promise<boolean>
  answer: (ok: boolean) => void
}

/** App-styled confirm dialog (window.confirm blocks the automation-friendly event loop and looks alien). */
export const useConfirm = create<ConfirmState>((set, get) => ({
  current: null,
  ask: (req) =>
    new Promise<boolean>((resolve) => {
      get().current?.resolve(false)
      set({ current: { ...req, resolve } })
    }),
  answer: (ok) => {
    get().current?.resolve(ok)
    set({ current: null })
  },
}))

export const confirm = (req: ConfirmRequest) => useConfirm.getState().ask(req)
