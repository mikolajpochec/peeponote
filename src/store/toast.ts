import { create } from 'zustand'
import type { PeepoName } from '../theme/peepos'

export interface Toast {
  id: number
  text: string
  peepo: PeepoName
  kind: 'ok' | 'err' | 'info'
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let seq = 1
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = seq++
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'err' ? 7000 : t.action ? 8000 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = {
  ok: (text: string, peepo: PeepoName = 'peepoHappy') => useToasts.getState().push({ text, peepo, kind: 'ok' }),
  err: (text: string, peepo: PeepoName = 'PepeHands') => useToasts.getState().push({ text, peepo, kind: 'err' }),
  info: (text: string, peepo: PeepoName = 'peepoThink') => useToasts.getState().push({ text, peepo, kind: 'info' }),
  /** info toast with a button (e.g. Undo) */
  action: (text: string, label: string, onClick: () => void, peepo: PeepoName = 'peepoShy') => useToasts.getState().push({ text, peepo, kind: 'info', action: { label, onClick } }),
}
