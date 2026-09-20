import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PALETTE, contrast } from '../canvas/styles'

interface Props {
  value: string | undefined
  /** custom swatch list; default is the shared 12-column palette */
  swatches?: string[]
  onChange: (v: string | undefined) => void
  title: string
  /** what the button shows when no color is set */
  fallback: string
  icon?: string
  /** offer a "none" (transparent) choice */
  allowNone?: boolean
}

/** Swatch button that opens a small palette with "none" and a custom color input. */
export function ColorPicker({ value, swatches, onChange, title, fallback, icon, allowNone }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  useLayoutEffect(() => {
    if (!open) return setDx(0)
    const r = pop.current?.getBoundingClientRect()
    if (!r) return
    // the canvas clips its overlays, so stay inside it (or the window when used elsewhere)
    const host = (pop.current!.closest('.canvas-bg') as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth }
    const over = Math.max(0, host.left + 8 - r.left) || Math.min(0, host.right - 8 - r.right)
    if (over) setDx((d) => d + over)
  }, [open])

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
        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-(--hover-strong)"
      >
        <span
          className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-(--hair) text-[10px] font-black leading-none"
          style={{ background: value === 'transparent' ? 'repeating-conic-gradient(#8884 0 25%, transparent 0 50%) 0 0 / 8px 8px' : (value ?? fallback), color: contrast(value === 'transparent' ? '#888888' : (value ?? fallback)) }}
        >
          {icon}
        </span>
      </button>
      {open && (
        <div ref={pop} className="absolute left-1/2 top-full z-10 mt-1 rounded-lg border border-(--hair) bg-swamp-900 p-2 shadow-2xl" style={{ width: swatches ? 176 : 268, transform: `translateX(calc(-50% + ${dx}px))` }}>
          <div className={`grid gap-1 ${swatches ? 'grid-cols-6' : 'grid-cols-12'}`}>
            {(swatches ?? PALETTE.flat()).map((c, i) => (
              <button
                key={`${c}-${i}`}
                title={c}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
                className={`h-[18px] w-[18px] rounded-[5px] border ${value?.toLowerCase() === c.toLowerCase() ? 'border-white ring-2 ring-frog-300/70' : 'border-black/20'} ${!swatches && i < 12 ? 'mb-1' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-frog-200/80">
            <label className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-md bg-(--hover) px-2 py-1 hover:bg-(--hover-strong)">
              <input type="color" value={toHex(value ?? fallback)} onChange={(e) => onChange(e.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" />
              custom
            </label>
            {allowNone && (
              <button
                title="No color — transparent"
                onClick={() => {
                  onChange('transparent')
                  setOpen(false)
                }}
                className={`rounded-md px-2 py-1 hover:bg-(--hover-strong) ${value === 'transparent' ? 'bg-frog-700/60 text-white' : 'bg-(--hover)'}`}
              >
                none
              </button>
            )}
            <button
              title="Back to the default for this kind of card"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              className="rounded-md bg-(--hover) px-2 py-1 hover:bg-(--hover-strong)"
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
