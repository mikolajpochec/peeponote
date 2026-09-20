import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MenuItem =
  | { kind: 'sep' }
  | { kind: 'item'; label: string; shortcut?: string; icon?: string; disabled?: boolean; danger?: boolean; onClick: () => void }
  /** expands inline (click / tap) — works without hover on phones */
  | { kind: 'submenu'; label: string; icon?: string; disabled?: boolean; items: MenuItem[] }

export const sep: MenuItem = { kind: 'sep' }

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [openSub, setOpenSub] = useState<number | null>(null)

  // keep the menu inside the viewport
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.min(x, window.innerWidth - r.width - 8),
      y: Math.min(y, window.innerHeight - r.height - 8),
    })
  }, [x, y, items.length, openSub])

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    window.addEventListener('wheel', onClose, { passive: true, once: true })
    window.addEventListener('blur', onClose, { once: true })
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('wheel', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      data-nodrag
      className="fixed z-50 min-w-48 rounded-xl border border-(--hair) bg-swamp-900/95 p-1 text-[13px] shadow-2xl shadow-black/50 backdrop-blur select-none"
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.kind === 'sep' ? (
          <div key={i} className="my-1 h-px bg-(--hair)" />
        ) : it.kind === 'submenu' ? (
          <div key={i}>
            <button
              disabled={it.disabled}
              onClick={() => setOpenSub((o) => (o === i ? null : i))}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-frog-50 hover:bg-frog-700 disabled:opacity-40 ${openSub === i ? 'bg-(--hover-strong)' : ''}`}
            >
              <span className="w-4 text-center text-[12px] opacity-80">{it.icon ?? ''}</span>
              <span className="flex-1">{it.label}</span>
              <span className="text-[11px] opacity-50">{openSub === i ? '▾' : '▸'}</span>
            </button>
            {openSub === i && (
              <div className="ml-4 border-l border-(--hair) pl-1">
                {it.items.map((sub, j) =>
                  sub.kind === 'item' ? (
                    <button
                      key={j}
                      disabled={sub.disabled}
                      onClick={() => {
                        sub.onClick()
                        onClose()
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1 text-left text-frog-50 hover:bg-frog-700 disabled:opacity-40"
                    >
                      <span className="w-4 text-center text-[12px] opacity-80">{sub.icon ?? ''}</span>
                      <span className="flex-1">{sub.label}</span>
                    </button>
                  ) : null,
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => {
              it.onClick()
              onClose()
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left ${
              it.danger ? 'text-red-300 hover:bg-red-900/50' : 'text-frog-50 hover:bg-frog-700'
            } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
          >
            <span className="w-4 text-center text-[12px] opacity-80">{it.icon ?? ''}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-[11px] opacity-50">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  )
}
