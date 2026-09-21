import LightningFS from '@isomorphic-git/lightning-fs'
import type { PeepoFS, PeepoFSPromises } from './types'

/** IndexedDB database name for a remote: one local repo per remote, so switching back is instant */
export function slotFor(remoteUrl: string): string {
  const clean = remoteUrl
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/[^\w.-]+/g, '_')
  return `peeponote:${clean}`
}

export function createBrowserFS(name = 'peeponote', label = 'Browser storage (IndexedDB)'): PeepoFS {
  const lfs = new LightningFS(name)
  return {
    kind: 'browser',
    label,
    dir: '/repo',
    promises: lfs.promises as unknown as PeepoFSPromises,
    // LightningFS writes file contents to IndexedDB at once but saves its directory table (paths → inodes) only
    // after a 500 ms pause — a crash in between forgets files created since. Saving it right after our writes
    // closes that gap. Private API, so it is best-effort.
    persist: async () => {
      try {
        const backend = (lfs.promises as unknown as { _backend?: { _saveSuperblock?: () => Promise<void> } })._backend
        await backend?._saveSuperblock?.()
      } catch (e) {
        console.warn('peeponote: could not persist the directory table', e)
      }
    },
  }
}

export async function wipeBrowserFS(name = 'peeponote'): Promise<void> {
  const lfs = new LightningFS()
  lfs.init(name, { wipe: true })
  // touching the fs forces the wipe to complete
  await lfs.promises.readdir('/')
}
