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
const SLOT_KEY = 'peeponote-slot'

/** which browser-storage repo is active ('peeponote' = the original single slot) */
export function activeSlot(): { name: string; label: string } {
  try {
    const raw = localStorage.getItem(SLOT_KEY)
    if (raw) return JSON.parse(raw) as { name: string; label: string }
  } catch {
    /* fall through */
  }
  return { name: 'peeponote', label: 'Browser storage (IndexedDB)' }
}
export function setActiveSlot(slot: { name: string; label: string } | null) {
  if (slot) localStorage.setItem(SLOT_KEY, JSON.stringify(slot))
  else localStorage.removeItem(SLOT_KEY)
}

export async function mountLast(): Promise<MountResult> {
  const handle = await kvGet<FileSystemDirectoryHandle>(FOLDER_HANDLE_KEY).catch(() => undefined)
  if (handle && supportsFolderAccess) {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return { status: 'ok', fs: createFolderFS(handle) }
    return { status: 'needs-permission', handle }
  }
  const slot = activeSlot()
  return { status: 'ok', fs: createBrowserFS(slot.name, slot.label) }
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

export async function useBrowserStorage(slot?: { name: string; label: string }): Promise<PeepoFS> {
  await kvDel(FOLDER_HANDLE_KEY).catch(() => {})
  if (slot) setActiveSlot(slot)
  const s = slot ?? activeSlot()
  return createBrowserFS(s.name, s.label)
}
