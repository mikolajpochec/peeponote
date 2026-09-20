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
  }
}

export async function wipeBrowserFS(name = 'peeponote'): Promise<void> {
  const lfs = new LightningFS()
  lfs.init(name, { wipe: true })
  // touching the fs forces the wipe to complete
  await lfs.promises.readdir('/')
}
