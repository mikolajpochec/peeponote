import { useEffect, useState } from 'react'
import type { AssetCard } from '../../model/types'
import { useAssetUrl } from '../useAssetUrl'
import { Loading } from './Loading'

let seq = 0

export function FontPreview({ card }: { card: AssetCard }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  const [family, setFamily] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    const name = `peepofont-${++seq}`
    const face = new FontFace(name, `url(${url})`)
    let alive = true
    face
      .load()
      .then((f) => {
        if (!alive) return
        document.fonts.add(f)
        setFamily(name)
      })
      .catch((e) => alive && setErr(String(e)))
    return () => {
      alive = false
      document.fonts.delete(face)
    }
  }, [url])

  if (!url || (!family && !err)) return <Loading error={error} />
  if (err) return <Loading error={err} />
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1 overflow-hidden px-3 py-2" style={{ fontFamily: family! }}>
      <div className="text-[28px] leading-tight">Aa Bb Cc 123</div>
      <div className="text-[14px] leading-tight opacity-90">The quick brown frog jumps over the lazy peepo.</div>
      <div className="text-[11px] leading-tight opacity-70">abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 !?&%</div>
    </div>
  )
}
