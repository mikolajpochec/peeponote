import { useEffect, useState } from 'react'
import { readAssetBytes, useWorkspace } from '../store/workspace'

const cache = new Map<string, Promise<string>>()

export function assetBlobUrl(path: string, mime: string, ref: string | null): Promise<string> {
  const key = `${ref ?? 'live'}:${path}`
  let p = cache.get(key)
  if (!p) {
    p = readAssetBytes(path).then((bytes) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' })))
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export function useAssetUrl(path: string, mime: string): { url: string | null; error: string | null } {
  const ref = useWorkspace((s) => s.viewingRef)
  const fsKey = useWorkspace((s) => s.fs?.label)
  const [state, setState] = useState<{ url: string | null; error: string | null }>({ url: null, error: null })
  useEffect(() => {
    let alive = true
    setState({ url: null, error: null })
    assetBlobUrl(path, mime, ref).then(
      (url) => alive && setState({ url, error: null }),
      (e) => alive && setState({ url: null, error: (e as Error).message }),
    )
    return () => {
      alive = false
    }
  }, [path, mime, ref, fsKey])
  return state
}

export function useAssetText(path: string, mime: string, limit = 200_000): string | null {
  const ref = useWorkspace((s) => s.viewingRef)
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    readAssetBytes(path).then((b) => {
      if (!alive) return
      const t = new TextDecoder().decode(b.subarray(0, limit))
      setText(b.length > limit ? t + `\n… (${b.length - limit} more bytes)` : t)
    })
    return () => {
      alive = false
    }
  }, [path, mime, ref, limit])
  return text
}

/** Drop cached blob URLs (e.g. after switching storage). */
export function clearAssetCache() {
  for (const p of cache.values()) p.then((u) => URL.revokeObjectURL(u)).catch(() => {})
  cache.clear()
}
