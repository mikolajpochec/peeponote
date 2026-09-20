import { registerSW } from 'virtual:pwa-register'
import { toast, useToasts } from '../store/toast'
import { selectDirty, useWorkspace } from '../store/workspace'
import { useEditing } from '../store/editing'

/**
 * Keeps the installed app current. GitHub Pages ships a new bundle on every push; the service worker
 * only notices on a page load, so we ask it to look every minute and whenever the tab comes back.
 * When a new version is waiting we switch to it right away if nothing would be lost (no unsaved
 * edits, nobody typing) — otherwise a sticky toast offers "Reload now" and we switch by ourselves
 * once the work is saved.
 */
const CHECK_MS = 60_000

export function watchForUpdates() {
  let pending = false
  let unsubscribe: (() => void) | null = null

  const apply = () => {
    pending = false
    unsubscribe?.()
    unsubscribe = null
    toast.info('Updating peeponote…', 'peepoHappy')
    setTimeout(() => updateSW(true), 600)
  }
  const safeNow = () => !selectDirty(useWorkspace.getState()) && !useWorkspace.getState().busy && !useEditing.getState().handle

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) {
      if (!r) return
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) r.update().catch(() => {})
      }
      setInterval(check, CHECK_MS)
      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
    },
    onNeedRefresh() {
      if (pending) return
      pending = true
      if (safeNow()) {
        apply()
        return
      }
      useToasts.getState().push({
        text: 'A new version of peeponote is ready. It switches over by itself after you save.',
        peepo: 'peepoThink',
        kind: 'info',
        sticky: true,
        action: { label: 'Reload now', onClick: apply },
      })
      // switch as soon as everything is saved and nobody is typing
      unsubscribe = useWorkspace.subscribe(() => {
        if (pending && safeNow()) setTimeout(() => pending && safeNow() && apply(), 1500)
      })
    },
    onRegisterError(e) {
      console.warn('service worker registration failed', e)
    },
  })
  return updateSW
}
