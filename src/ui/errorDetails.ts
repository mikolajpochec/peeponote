import { create } from 'zustand'

export interface ErrorReport {
  title: string
  /** the thrown thing, or a message */
  error: unknown
  /** what we were doing and with what — remote, transport, shas… */
  context?: Record<string, unknown>
  at: number
}

interface ErrorState {
  open: ErrorReport | null
  /** last few reports, newest first */
  recent: ErrorReport[]
  show: (r: ErrorReport) => void
  close: () => void
}

export const useErrorDetails = create<ErrorState>((set) => ({
  open: null,
  recent: [],
  show: (r) => set((s) => ({ open: r, recent: [r, ...s.recent].slice(0, 10) })),
  close: () => set({ open: null }),
}))

/** Plain-text dump for the dialog and for the clipboard. */
export function formatReport(r: ErrorReport): string {
  const e = r.error as { name?: string; message?: string; stack?: string; status?: number; code?: string } | undefined
  const lines = [`${r.title}`, `at: ${new Date(r.at).toISOString()}`, '']
  if (e && typeof e === 'object') {
    lines.push(`error: ${e.name ?? 'Error'}${e.status ? ` (HTTP ${e.status})` : ''}${e.code ? ` [${e.code}]` : ''}`)
    lines.push(`message: ${e.message ?? String(r.error)}`)
    if (e.stack) lines.push('', 'stack:', e.stack.split('\n').slice(0, 12).join('\n'))
  } else lines.push(`error: ${String(r.error)}`)
  if (r.context && Object.keys(r.context).length) {
    lines.push('', 'context:')
    for (const [k, v] of Object.entries(r.context)) lines.push(`  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }
  lines.push('', `app: ${location.origin}${location.pathname} · ${navigator.userAgent}`)
  return lines.join('\n')
}
