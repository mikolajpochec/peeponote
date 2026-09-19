import LightningFS from '@isomorphic-git/lightning-fs'
import type { PeepoFS, PeepoFSPromises } from './types'

export function createBrowserFS(name = 'peeponote'): PeepoFS {
  const lfs = new LightningFS(name)
  return {
    kind: 'browser',
    label: 'Browser storage (IndexedDB)',
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
