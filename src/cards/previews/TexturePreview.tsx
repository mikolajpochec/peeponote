import { useEffect, useState } from 'react'
import type { AssetCard } from '../../model/types'
import { useWorkspace } from '../../store/workspace'
import { useAssetUrl } from '../useAssetUrl'
import { Loading } from './Loading'

/** Pixel-perfect preview (transparency shows the board), with optional spritesheet frame stepping. */
export function TexturePreview({ card, boardId, readOnly, onDims }: { card: AssetCard; boardId: string; readOnly: boolean; onDims?: (w: number, h: number) => void }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  const updateCard = useWorkspace((s) => s.updateCard)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [frame, setFrame] = useState(0)
  const [zoom, setZoom] = useState(1)
  const fw = card.frame?.w ?? 0
  const fh = card.frame?.h ?? 0
  const sheet = dims && fw > 0 && fh > 0 && (fw < dims.w || fh < dims.h)
  const cols = sheet ? Math.floor(dims.w / fw) : 1
  const rows = sheet ? Math.floor(dims.h / fh) : 1
  const total = cols * rows

  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.onload = () => {
      setDims({ w: img.naturalWidth, h: img.naturalHeight })
      onDims?.(img.naturalWidth, img.naturalHeight)
    }
    img.src = url
  }, [url])

  if (!url) return <Loading error={error} />

  return (
    <div className="group relative flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {sheet ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="pixelated"
              style={{
                width: fw * zoom,
                height: fh * zoom,
                backgroundImage: `url(${url})`,
                backgroundSize: `${dims.w * zoom}px ${dims.h * zoom}px`,
                backgroundPosition: `-${(frame % cols) * fw * zoom}px -${Math.floor(frame / cols) * fh * zoom}px`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
        ) : (
          <img src={url} alt={card.name} draggable={false} className="pixelated h-full w-full rounded-[inherit] object-contain" />
        )}
        {dims && (
          <div className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-frog-100">
            {dims.w}×{dims.h}
          </div>
        )}
      </div>
      {/* spritesheet controls: hidden until hover/tap unless a frame size is set — plain pictures shouldn't carry a mystery "frame w×h" strip */}
      <div
        className={`flex items-center gap-1.5 border-t border-(--hair) px-2 py-1 text-[11px] text-frog-200/80 ${sheet ? '' : 'absolute inset-x-0 bottom-9 z-10 rounded-lg bg-swamp-900/85 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100'}`}
        data-nodrag
        title="Spritesheet: enter the size of ONE frame (in pixels) to step through the frames. Leave empty for a plain picture."
      >
        <span className="shrink-0">Sprite frame</span>
        <input
          className="w-12 rounded bg-black/30 px-1 text-center outline-none"
          type="number"
          min={0}
          readOnly={readOnly}
          value={fw || ''}
          placeholder="width"
          onChange={(e) => updateCard(boardId, card.id, { frame: { w: Number(e.target.value) || 0, h: fh } })}
        />
        <span>×</span>
        <input
          className="w-12 rounded bg-black/30 px-1 text-center outline-none"
          type="number"
          min={0}
          readOnly={readOnly}
          value={fh || ''}
          placeholder="height"
          onChange={(e) => updateCard(boardId, card.id, { frame: { w: fw, h: Number(e.target.value) || 0 } })}
        />
        {!sheet && <span className="opacity-60">px</span>}
        {sheet && (
          <>
            <button className="rounded bg-(--hover-strong) px-1.5 hover:bg-(--hover-strong)" onClick={() => setFrame((f) => (f - 1 + total) % total)}>
              ‹
            </button>
            <span className="tabular-nums">
              {frame + 1}/{total}
            </span>
            <button className="rounded bg-(--hover-strong) px-1.5 hover:bg-(--hover-strong)" onClick={() => setFrame((f) => (f + 1) % total)}>
              ›
            </button>
            <button className="ml-auto rounded bg-(--hover-strong) px-1.5 hover:bg-(--hover-strong)" onClick={() => setZoom((z) => (z >= 8 ? 1 : z * 2))}>
              {zoom}×
            </button>
          </>
        )}
      </div>
    </div>
  )
}
