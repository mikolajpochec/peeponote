/** View only: a personal switch that makes every board look-but-don't-touch, on top of history and review mode. */
import { useSettings } from './settings'
import { useWorkspace } from './workspace'
import { useReview } from './review'
import { toast } from './toast'

/** the board can't be changed right now: an old commit is open, review mode is on, or view only is */
export function useReadOnly() {
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const reviewOn = useReview((s) => s.mode.on)
  const viewOnly = useSettings((s) => s.viewOnly)
  return !!viewingRef || reviewOn || viewOnly
}

export function setViewOnly(on: boolean) {
  // close whatever editor is open, so its last keystrokes land before the lock does
  if (on) (document.activeElement as HTMLElement | null)?.blur?.()
  useSettings.getState().set({ viewOnly: on })
  toast.info(on ? 'View only: scroll and look around, nothing changes' : 'Editing again', on ? 'peepoSit' : 'peepoHappy')
}

export const toggleViewOnly = () => setViewOnly(!useSettings.getState().viewOnly)

let lastHint = 0
/** someone tried to edit while view only is on: say why nothing happened, at most every few seconds */
export function hintViewOnly() {
  if (!useSettings.getState().viewOnly || useWorkspace.getState().viewingRef || useReview.getState().mode.on) return
  if (Date.now() - lastHint < 4000) return
  lastHint = Date.now()
  toast.action('View only is on', 'Edit', () => setViewOnly(false), 'peepoSit')
}
