import { useEffect, useRef, useState } from 'react'
import { PEEPOS, type PeepoName } from '../theme/peepos'
import { Peepo } from './Peepo'

export const DEFAULT_BOARD_ICON = 'peepo:peepoGlad'

const EMOJI = [
  '📁', '📌', '💡', '🎯', '🚀', '🎨', '🧪', '🔧', '📚', '🎮', '🎵', '🎬',
  '🧊', '🗺️', '📝', '✅', '⭐', '❤️', '🔥', '🌱', '🐛', '💬', '🏠', '⚙️',
]

/** Renders a board's icon: peepo emote, emoji, or nothing. */
export function BoardIconView({ icon, size = 26, className = '' }: { icon: string | undefined; size?: number; className?: string }) {
  const v = icon ?? DEFAULT_BOARD_ICON
  if (!v) return null
  if (v.startsWith('peepo:')) {
    const name = v.slice(6) as PeepoName
    return <Peepo name={(PEEPOS as readonly string[]).includes(name) ? name : 'peepoGlad'} size={size} className={className} />
  }
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} style={{ width: size, height: size, fontSize: size * 0.8 }}>
      {v}
    </span>
  )
}

/** Click-to-open picker: peepo emotes, common emoji, any custom text, or no icon. */
export function BoardIconPicker({ icon, onChange, size = 26, disabled }: { icon: string | undefined; onChange: (icon: string | undefined) => void; size?: number; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])

  const pick = (v: string | undefined) => {
    onChange(v)
    setOpen(false)
  }
  const cur = icon ?? DEFAULT_BOARD_ICON

  return (
    <div ref={root} className="relative shrink-0" data-nodrag onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        disabled={disabled}
        title={disabled ? undefined : 'Change icon'}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-center rounded-md ${disabled ? '' : 'hover:bg-black/20'}`}
        style={{ width: size + 6, height: size + 6 }}
      >
        <BoardIconView icon={icon} size={size} />
        {!cur && <span className="text-[11px] opacity-50">icon</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-(--hair) bg-swamp-900 p-2 text-frog-50 shadow-2xl">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-frog-200/50">Peepos</div>
          <div className="grid grid-cols-6 gap-1">
            {PEEPOS.map((p) => (
              <button key={p} title={p} onClick={() => pick(`peepo:${p}`)} className={`flex h-8 items-center justify-center rounded-md hover:bg-(--hover-strong) ${cur === `peepo:${p}` ? 'bg-frog-700/60' : ''}`}>
                <Peepo name={p} size={24} />
              </button>
            ))}
          </div>
          <div className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-frog-200/50">Emoji</div>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI.map((e) => (
              <button key={e} onClick={() => pick(e)} className={`flex h-7 items-center justify-center rounded-md text-[17px] hover:bg-(--hover-strong) ${cur === e ? 'bg-frog-700/60' : ''}`}>
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && custom.trim()) pick(custom.trim())
                e.stopPropagation()
              }}
              placeholder="any emoji…"
              className="min-w-0 flex-1 rounded-md bg-(--hover) px-2 py-1 outline-none focus:ring-1 focus:ring-frog-400"
            />
            <button onClick={() => custom.trim() && pick(custom.trim())} className="rounded-md bg-(--hover) px-2 py-1 hover:bg-(--hover-strong)">
              set
            </button>
            <button onClick={() => pick('')} className="rounded-md bg-(--hover) px-2 py-1 hover:bg-(--hover-strong)" title="No icon">
              none
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
