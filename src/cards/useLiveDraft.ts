import { useEffect, useMemo, useRef } from 'react'

const LIVE_MS = 300

/**
 * Text you're typing reaches the board (and so the working tree) shortly after every change, instead of only
 * when you leave the editor — a crash or a power cut then costs a moment of typing, not the whole text. All
 * updates of one editing session share one undo step (`session`); `commit` writes the final text at once.
 */
export function useLiveDraft(editing: boolean, draft: string, stored: string, apply: (value: string, opts: { session: string }) => void) {
  const session = useRef<string | null>(null)
  if (editing && !session.current) session.current = `edit:${Math.random().toString(36).slice(2)}`
  if (!editing) session.current = null
  const latest = useRef(apply)
  latest.current = apply

  useEffect(() => {
    if (!editing || draft === stored) return
    const s = session.current!
    const t = setTimeout(() => latest.current(draft, { session: s }), LIVE_MS)
    return () => clearTimeout(t)
  }, [editing, draft, stored])

  return useMemo(
    () => ({
      /** the session id — pass it along with other updates made while editing (auto-size) so they join the step */
      session: session.current ?? undefined,
      /** leaving the editor: the last state goes in now, still in the same undo step */
      commit: (final: string, current: string) => {
        const s = session.current ?? undefined
        if (final !== current) latest.current(final, { session: s! })
      },
    }),
    [session.current],
  )
}
