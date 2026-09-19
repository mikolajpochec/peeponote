import { useEffect, useRef, useState } from 'react'
import type { Card, CardStyle, FontFamily, TextAlign } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { FILLS, FONT_LABEL, INKS, RADII, defaultBold, defaultFontSize } from '../canvas/styles'
import { ColorPicker } from './ColorPicker'

const ALIGN_ICON: Record<TextAlign, string> = { left: '⫷', center: '☰', right: '⫸' }
const FONTS: FontFamily[] = ['sans', 'serif', 'mono', 'hand']

const btn = 'flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[13px] font-bold text-frog-100 hover:bg-(--hover-strong)'
const on = 'bg-frog-600 text-white hover:bg-frog-500'

/** Floating toolbar for styling the selected cards. */
export function StyleBar({ boardId, cards }: { boardId: string; cards: Card[] }) {
  const styleCards = useWorkspace((s) => s.styleCards)
  const ids = cards.map((c) => c.id)
  const first = cards[0]
  const s: CardStyle = first.style ?? {}
  const apply = (patch: Partial<CardStyle>) => styleCards(boardId, ids, patch)
  const textual = cards.some((c) => c.type !== 'asset' && c.type !== 'board')
  const size = s.fontSize ?? defaultFontSize(first)
  const bold = s.bold ?? defaultBold(first)
  const [menu, setMenu] = useState<'font' | 'align' | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null)
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [menu])

  return (
    <div
      ref={root}
      data-nodrag
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="flex items-center gap-0.5 rounded-xl border border-(--hair) bg-swamp-900/95 p-1 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <ColorPicker title="Fill" icon="◼" value={s.bg} fallback={first.type === 'text' ? '#00000000' : '#fbf8ef'} swatches={FILLS} onChange={(bg) => apply({ bg })} />
      <ColorPicker title="Text color" icon="A" value={s.fg} fallback="#1b1d1a" swatches={INKS} onChange={(fg) => apply({ fg })} />
      <ColorPicker title="Border" icon="◻" value={s.border} fallback="#00000000" swatches={INKS} onChange={(border) => apply({ border })} />

      {textual && (
        <>
          <Sep />
          <button className={btn} title="Smaller text" onClick={() => apply({ fontSize: Math.max(8, size - 2) })}>
            A<span className="text-[9px]">−</span>
          </button>
          <span className="w-6 text-center text-[11px] tabular-nums text-frog-200/70">{size}</span>
          <button className={btn} title="Bigger text" onClick={() => apply({ fontSize: Math.min(120, size + 2) })}>
            A<span className="text-[9px]">+</span>
          </button>
          <div className="relative">
            <button className={`${btn} ${s.font ? on : ''}`} title="Font" onClick={() => setMenu(menu === 'font' ? null : 'font')}>
              {FONT_LABEL[s.font ?? 'sans']}
            </button>
            {menu === 'font' && (
              <Menu>
                {FONTS.map((f) => (
                  <MenuItem key={f} active={(s.font ?? 'sans') === f} onClick={() => (apply({ font: f === 'sans' ? undefined : f }), setMenu(null))}>
                    <span style={{ fontFamily: f === 'sans' ? undefined : f === 'serif' ? 'Georgia, serif' : f === 'mono' ? 'monospace' : '"Comic Sans MS", cursive' }}>
                      {FONT_LABEL[f]}
                    </span>
                  </MenuItem>
                ))}
              </Menu>
            )}
          </div>
          <button className={`${btn} ${bold ? on : ''}`} title="Bold" onClick={() => apply({ bold: !bold })}>
            B
          </button>
          <button className={`${btn} italic ${s.italic ? on : ''}`} title="Italic" onClick={() => apply({ italic: s.italic ? undefined : true })}>
            I
          </button>
          <div className="relative">
            <button className={`${btn} ${s.align ? on : ''}`} title="Align" onClick={() => setMenu(menu === 'align' ? null : 'align')}>
              {ALIGN_ICON[s.align ?? 'left']}
            </button>
            {menu === 'align' && (
              <Menu row>
                {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                  <MenuItem key={a} active={(s.align ?? 'left') === a} onClick={() => (apply({ align: a === 'left' ? undefined : a }), setMenu(null))}>
                    {ALIGN_ICON[a]}
                  </MenuItem>
                ))}
              </Menu>
            )}
          </div>
        </>
      )}

      <Sep />
      <button
        className={btn}
        title={`Corner radius: ${s.radius ?? 12}px`}
        onClick={() => {
          const cur = s.radius ?? 12
          const next = RADII[(RADII.indexOf(cur) + 1) % RADII.length]
          apply({ radius: next === 12 ? undefined : next })
        }}
      >
        <span className="block h-3.5 w-3.5 border-2 border-current border-b-0 border-r-0" style={{ borderTopLeftRadius: (s.radius ?? 12) / 2 }} />
      </button>
      <label className="flex items-center gap-1 px-1" title={`Opacity ${s.opacity ?? 100}%`}>
        <span className="text-[11px] text-frog-200/70">◐</span>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={s.opacity ?? 100}
          onChange={(e) => apply({ opacity: Number(e.target.value) === 100 ? undefined : Number(e.target.value) })}
          className="h-1 w-14 accent-frog-400"
        />
      </label>
      <Sep />
      <button
        className={btn}
        title="Reset style"
        disabled={!cards.some((c) => c.style)}
        onClick={() => apply({ bg: undefined, fg: undefined, fontSize: undefined, font: undefined, bold: undefined, italic: undefined, align: undefined, border: undefined, radius: undefined, opacity: undefined })}
      >
        ↺
      </button>
    </div>
  )
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-(--hover-strong)" />
}

function Menu({ children, row }: { children: React.ReactNode; row?: boolean }) {
  return (
    <div className={`absolute left-1/2 top-full z-10 mt-1 flex -translate-x-1/2 gap-0.5 rounded-lg border border-(--hair) bg-swamp-900 p-1 shadow-2xl ${row ? '' : 'flex-col'}`}>
      {children}
    </div>
  )
}

function MenuItem({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-md px-2 py-1 text-left text-[13px] whitespace-nowrap ${active ? on : 'text-frog-100 hover:bg-(--hover-strong)'}`}>
      {children}
    </button>
  )
}
