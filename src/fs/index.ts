import { createBrowserFS } from './lightning'
import { createFolderFS, supportsFolderAccess } from './fsa'
import { FOLDER_HANDLE_KEY, kvDel, kvGet, kvSet } from './handleStore'
import type { PeepoFS } from './types'

export * from './types'
export { supportsFolderAccess }

export type MountResult =
  | { status: 'ok'; fs: PeepoFS }
  | { status: 'needs-permission'; handle: FileSystemDirectoryHandle }

/** Mounts the fs the user last chose. A stored folder may need a user gesture to re-grant access. */
export async function mountLast(): Promise<MountResult> {
  const handle = await kvGet<FileSystemDirectoryHandle>(FOLDER_HANDLE_KEY).catch(() => undefined)
  if (handle && supportsFolderAccess) {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return { status: 'ok', fs: createFolderFS(handle) }
    return { status: 'needs-permission', handle }
  }
  return { status: 'ok', fs: createBrowserFS() }
}

export async function requestFolderPermission(handle: FileSystemDirectoryHandle): Promise<PeepoFS | null> {
  const perm = await handle.requestPermission({ mode: 'readwrite' })
  if (perm !== 'granted') return null
  return createFolderFS(handle)
}

export async function pickFolder(): Promise<PeepoFS | null> {
  if (!supportsFolderAccess) return null
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    await kvSet(FOLDER_HANDLE_KEY, handle)
    return createFolderFS(handle)
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return null
    throw e
  }
}

export async function useBrowserStorage(): Promise<PeepoFS> {
  await kvDel(FOLDER_HANDLE_KEY).catch(() => {})
  return createBrowserFS()
}
