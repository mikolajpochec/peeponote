import { useEffect, useRef, useState } from 'react'

const OUT = 256

/**
 * Square crop for a profile picture: drag to move, wheel / pinch / slider to zoom, round mask preview.
 * Produces a 256×256 WebP.
 */
export function AvatarCropper({ file, onDone, onCancel }: { file: File; onDone: (webp: Uint8Array) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1) // 1 = the image's shorter side fills the frame
  const [off, setOff] = useState({ x: 0, y: 0 }) // image centre offset from the frame centre, in frame px
  const frame = 260
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ d: number; zoom: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // base scale: shorter side → frame; then zoom
  const base = img ? frame / Math.min(img.naturalWidth, img.naturalHeight) : 1
  const scale = base * zoom
  const clampOff = (o: { x: number; y: number }, z = zoom) => {
    if (!img) return o
    const s = base * z
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    const mx = Math.max(0, (w - frame) / 2)
    const my = Math.max(0, (h - frame) / 2)
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) }
  }
  const setZoomAt = (z: number) => {
    const nz = Math.max(1, Math.min(6, z))
    setZoom(nz)
    setOff((o) => clampOff({ x: (o.x * nz) / zoom, y: (o.y * nz) / zoom }, nz))
  }

  useEffect(() => {
    const c = canvas.current
    if (!c || !img) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, frame, frame)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    ctx.drawImage(img, frame / 2 - w / 2 + off.x, frame / 2 - h / 2 + off.y, w, h)
  }, [img, scale, off])

  const finish = async () => {
    if (!img) return
    const out = document.createElement('canvas')
    out.width = OUT
    out.height = OUT
    const ctx = out.getContext('2d')!
    const k = OUT / frame
    const w = img.naturalWidth * scale * k
    const h = img.naturalHeight * scale * k
    ctx.drawImage(img, OUT / 2 - w / 2 + off.x * k, OUT / 2 - h / 2 + off.y * k, w, h)
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', 0.86))
    if (blob) onDone(new Uint8Array(await blob.arrayBuffer()))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="rounded-2xl border border-(--hair) bg-swamp-800 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-[14px] font-bold">Crop your picture</div>
        <div
          className="relative touch-none select-none overflow-hidden rounded-xl bg-black/40"
          style={{ width: frame, height: frame, cursor: 'grab' }}
          onPointerDown={(e) => {
            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
          }}
          onPointerMove={(e) => {
            if (!drag.current || pinch.current) return
            setOff(clampOff({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }))
          }}
          onPointerUp={() => (drag.current = null)}
          onWheel={(e) => {
            e.preventDefault()
            setZoomAt(zoom * Math.exp(-e.deltaY * 0.002))
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) pinch.current = { d: dist(e), zoom }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && pinch.current) {
              e.preventDefault()
              setZoomAt((pinch.current.zoom * dist(e)) / pinch.current.d)
            }
          }}
          onTouchEnd={(e) => {
            if (e.touches.length < 2) pinch.current = null
          }}
        >
          <canvas ref={canvas} width={frame} height={frame} />
          {/* round mask: what's outside the circle is dimmed */}
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 49%, rgba(0,0,0,0.55) 50%)' }} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-frog-200/70">
          <span>Zoom</span>
          <input type="range" min={1} max={6} step={0.01} value={zoom} onChange={(e) => setZoomAt(Number(e.target.value))} className="flex-1 accent-frog-500" />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-frog-200 hover:bg-(--hover-strong)">
            Cancel
          </button>
          <button onClick={finish} disabled={!img} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:opacity-40">
            Use this
          </button>
        </div>
      </div>
    </div>
  )
}

const dist = (e: React.TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
