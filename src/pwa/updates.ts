import { registerSW } from 'virtual:pwa-register'
import { create } from 'zustand'
import { toast, useToasts } from '../store/toast'
import { selectDirty, useWorkspace } from '../store/workspace'
import { useEditing } from '../store/editing'
import { APP_VERSION, releasesBetween, type Release } from '../version'

/**
 * Keeps the installed app current. GitHub Pages ships a new bundle on every push; the service worker
 * only notices on a page load, so we ask it to look every minute and whenever the tab comes back.
 * An update always goes straight to the newest version, however many were released in between: the
 * new build's version.json tells us which ones, so the waiting toast can name them and "What's new"
 * shows every one of them before switching. When nothing would be lost (no unsaved edits, nobody
 * typing) we switch right away; otherwise we switch by ourselves once the work is saved. After the
 * reload the changelog dialog lists every version since the one this browser last saw.
 */
const CHECK_MS = 60_000

interface UpdateState {
  /** a new version is downloaded and waiting */
  ready: boolean
  /** the waiting version, once version.json was read ('' = unknown) */
  version: string
  /** the releases it brings over the running one, newest first */
  releases: Release[]
  /** switch to it now */
  apply: () => void
}

export const useUpdate = create<UpdateState>(() => ({ ready: false, version: '', releases: [], apply: () => {} }))

/** what the waiting build is: its version and the releases newer than the one running here */
async function readIncoming(): Promise<{ version: string; releases: Release[] } | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const { version, changelog } = (await res.json()) as { version: string; changelog: Release[] }
    if (typeof version !== 'string' || !Array.isArray(changelog)) return null
    return { version, releases: releasesBetween(APP_VERSION, version, changelog) }
  } catch {
    return null
  }
}

const describe = (version: string, releases: Release[]) =>
  !version
    ? 'A new version of peeponote is ready.'
    : releases.length > 1
      ? `peeponote ${version} is ready, with ${releases.length} new versions since yours (${APP_VERSION}).`
      : `peeponote ${version} is ready.`

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
    async onNeedRefresh() {
      // a newer build may land while one is already waiting: the service worker swaps it in, we re-read what it brings
      const incoming = await readIncoming()
      useUpdate.setState({ ready: true, version: incoming?.version ?? '', releases: incoming?.releases ?? [], apply })
      if (pending) return
      pending = true
      if (safeNow()) {
        apply()
        return
      }
      const { version, releases } = useUpdate.getState()
      useToasts.getState().push({
        text: `${describe(version, releases)} It switches over by itself after you save.`,
        peepo: 'peepoThink',
        kind: 'info',
        sticky: true,
        action: { label: 'Reload now', onClick: apply },
        secondary: releases.length ? { label: "What's new", onClick: openIncomingChangelog } : undefined,
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

/** the changelog dialog, listing what the waiting update brings, with an "Update now" button */
export const openIncomingChangelog = () => window.dispatchEvent(new CustomEvent('peeponote:changelog', { detail: { incoming: true } }))
