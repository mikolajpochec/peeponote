/** View only: a personal switch that makes every board look-but-don't-touch, on top of history and review mode. */
import { useSettings } from './settings'
import { useWorkspace } from './workspace'
import { useReview } from './review'
import { toast } from './toast'

/**
 * The board can't be changed right now: an old commit is open, review mode is on, view only is, or GitHub
 * doesn't let this account write to the repo (a guest, or someone who isn't a collaborator).
 */
export function useReadOnly() {
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const canWrite = useWorkspace((s) => s.canWrite)
  const reviewOn = useReview((s) => s.mode.on)
  const viewOnly = useSettings((s) => s.viewOnly)
  return !!viewingRef || reviewOn || viewOnly || !canWrite
}

export function setViewOnly(on: boolean) {
  // close whatever editor is open, so its last keystrokes land before the lock does
  if (on) (document.activeElement as HTMLElement | null)?.blur?.()
  useSettings.getState().set({ viewOnly: on })
  toast.info(on ? 'View only: scroll and look around, nothing changes' : 'Editing again', on ? 'peepoSit' : 'peepoHappy')
}

export const toggleViewOnly = () => setViewOnly(!useSettings.getState().viewOnly)

let lastHint = 0
/** someone tried to edit and nothing happened: say why, at most every few seconds */
export function hintViewOnly() {
  const ws = useWorkspace.getState()
  if (ws.viewingRef || useReview.getState().mode.on) return
  if (Date.now() - lastHint < 4000) return
  if (!ws.canWrite) {
    lastHint = Date.now()
    if (useReview.getState().identity.kind === 'github') toast.info('Read only: GitHub does not let this account write to the repo.', 'peepoSit')
    else toast.action('Sign in with GitHub to edit these boards.', 'Sign in', () => window.dispatchEvent(new CustomEvent('peeponote:identify')), 'peepoSit')
    return
  }
  if (!useSettings.getState().viewOnly) return
  lastHint = Date.now()
  toast.action('View only is on', 'Edit', () => setViewOnly(false), 'peepoSit')
}
