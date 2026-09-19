import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string | undefined
  swatches: string[]
  onChange: (v: string | undefined) => void
  title: string
  /** what the button shows when no color is set */
  fallback: string
  icon?: string
}

/** Swatch button that opens a small palette with "none" and a custom color input. */
export function ColorPicker({ value, swatches, onChange, title, fallback, icon }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/10"
      >
        <span
          className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/40 text-[10px] font-black leading-none"
          style={{ background: value ?? fallback, color: contrast(value ?? fallback) }}
        >
          {icon}
        </span>
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-10 mt-1 w-44 -translate-x-1/2 rounded-lg border border-white/10 bg-swamp-900 p-2 shadow-2xl">
          <div className="grid grid-cols-6 gap-1.5">
            {swatches.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
                className={`h-5 w-5 rounded-full border ${value === c ? 'border-frog-300 ring-2 ring-frog-300/50' : 'border-white/20'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-frog-200/80">
            <label className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 hover:bg-white/10">
              <input type="color" value={toHex(value ?? fallback)} onChange={(e) => onChange(e.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" />
              custom
            </label>
            <button
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/10"
            >
              default
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function toHex(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : '#888888'
}

export function contrast(bg: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(bg)
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.6 ? '#1b1d1a' : '#fff'
}
