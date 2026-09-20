import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Card, CardStyle, FontFamily, ShapeKind, TextAlign } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { FONT_LABEL, RADII, contrast, defaultBold, defaultFontSize } from '../canvas/styles'
import { ALIGN_LABEL, alignCards, distributeCards, type AlignMode } from '../canvas/arrange'
import { ColorPicker } from './ColorPicker'
import { DEFAULT_SHAPE_STROKE, SHAPES } from '../cards/ShapeCard'

const ALIGN_ICON: Record<TextAlign, string> = { left: '⫷', center: '☰', right: '⫸' }
const ARRANGE: [AlignMode, string][] = [
  ['left', '⇤'],
  ['hcenter', '↔'],
  ['right', '⇥'],
  ['top', '⤒'],
  ['vcenter', '↕'],
  ['bottom', '⤓'],
]
const FONTS: FontFamily[] = ['sans', 'serif', 'mono', 'hand']

const btn = 'flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[13px] font-bold text-frog-100 hover:bg-(--hover-strong)'
const on = 'bg-frog-600 text-white hover:bg-frog-500'

/** Floating toolbar for styling the selected cards. */
export function StyleBar({ boardId, cards }: { boardId: string; cards: Card[] }) {
  const styleCards = useWorkspace((s) => s.styleCards)
  const moveCards = useWorkspace((s) => s.moveCards)
  const updateCard = useWorkspace((s) => s.updateCard)
  const groupCards = useWorkspace((s) => s.groupCards)
  const ungroupCards = useWorkspace((s) => s.ungroupCards)
  const ids = cards.map((c) => c.id)
  const many = cards.length > 1
  const groupIds = new Set(cards.map((c) => c.groupId).filter(Boolean))
  // one group covering the whole selection → offer ungroup; otherwise group
  const oneGroup = groupIds.size === 1 && cards.every((c) => c.groupId)
  const first = cards[0]
  const s: CardStyle = first.style ?? {}
  const apply = (patch: Partial<CardStyle>) => styleCards(boardId, ids, patch)
  const textual = cards.some((c) => c.type !== 'asset' && c.type !== 'board')
  const size = s.fontSize ?? defaultFontSize(first)
  const bold = s.bold ?? defaultBold(first)
  const [menu, setMenu] = useState<'font' | 'align' | 'arrange' | 'shape' | null>(null)
  const shapes = cards.filter((c) => c.type === 'shape')
  const allShapes = shapes.length === cards.length
  const strokeW = s.strokeWidth ?? (allShapes ? DEFAULT_SHAPE_STROKE : 2)
  const setShape = (kind: ShapeKind) => {
    for (const c of shapes) updateCard(boardId, c.id, { shape: kind } as Partial<Card>)
  }
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
      {allShapes && (
        <>
          <div className="relative">
            <button className={btn} title="Shape" onClick={() => setMenu(menu === 'shape' ? null : 'shape')}>
              {SHAPES.find((x) => x.kind === (shapes[0] as Extract<Card, { type: 'shape' }>).shape)?.icon ?? '◇'}
            </button>
            {menu === 'shape' && (
              <Menu>
                <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(3, 2.25rem)' }}>
                  {SHAPES.map((sh) => (
                    <MenuItem
                      key={sh.kind}
                      title={sh.label}
                      active={shapes.every((c) => (c as Extract<Card, { type: 'shape' }>).shape === sh.kind)}
                      onClick={() => (setShape(sh.kind), setMenu(null))}
                    >
                      <span className="block text-center text-[16px]">{sh.icon}</span>
                    </MenuItem>
                  ))}
                </div>
              </Menu>
            )}
          </div>
          <Sep />
        </>
      )}
      {/* a new fill resets the ink so it re-derives its contrast automatically */}
      <ColorPicker title="Fill (text color adapts)" icon="◼" value={s.bg} fallback={first.type === 'text' || allShapes ? '#00000000' : '#fbf8ef'} onChange={(bg) => apply({ bg, fg: undefined })} />
      <ColorPicker title="Text color" icon="A" value={s.fg} fallback={s.bg ? contrast(s.bg) : '#1b1d1a'} onChange={(fg) => apply({ fg })} />
      <ColorPicker title={allShapes ? 'Stroke color' : 'Border'} icon="◻" value={s.border} fallback="#00000000" onChange={(border) => apply({ border })} />
      {(allShapes || s.border) && (
        <>
          <button
            className={btn}
            title={`Stroke width: ${strokeW}px`}
            onClick={() => {
              const steps = [0, 1, 2, 4, 6, 10]
              const next = steps[(steps.indexOf(strokeW) + 1) % steps.length]
              apply({ strokeWidth: next })
            }}
          >
            <span className="block w-4 rounded-full bg-current" style={{ height: Math.max(1, Math.min(strokeW, 8)) }} />
          </button>
          <button className={`${btn} ${s.dashed ? on : ''}`} title="Dashed" onClick={() => apply({ dashed: s.dashed ? undefined : true })}>
            ┅
          </button>
        </>
      )}

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

      {cards.some((c) => c.type === 'text' && c.autoSize === false) && (
        <>
          <Sep />
          <button
            className={btn}
            title="Back to automatic size (fit the text)"
            onClick={() => cards.forEach((c) => c.type === 'text' && c.autoSize === false && updateCard(boardId, c.id, { autoSize: true } as Partial<Card>))}
          >
            ⤢<span className="ml-0.5 text-[10px] font-semibold">auto</span>
          </button>
        </>
      )}
      {(many || oneGroup) && (
        <>
          <Sep />
          {many && (
            <div className="relative">
              <button className={btn} title="Align / distribute" onClick={() => setMenu(menu === 'arrange' ? null : 'arrange')}>
                ⊞
              </button>
              {menu === 'arrange' && (
                <Menu>
                  <div className="flex gap-0.5">
                    {ARRANGE.slice(0, 3).map(([m, icon]) => (
                      <MenuItem key={m} active={false} title={ALIGN_LABEL[m]} onClick={() => (moveCards(boardId, alignCards(cards, m)), setMenu(null))}>
                        {icon}
                      </MenuItem>
                    ))}
                  </div>
                  <div className="flex gap-0.5">
                    {ARRANGE.slice(3).map(([m, icon]) => (
                      <MenuItem key={m} active={false} title={ALIGN_LABEL[m]} onClick={() => (moveCards(boardId, alignCards(cards, m)), setMenu(null))}>
                        {icon}
                      </MenuItem>
                    ))}
                  </div>
                  {cards.length > 2 && (
                    <>
                      <span className="my-0.5 h-px bg-(--hair)" />
                      <MenuItem active={false} title="Equal horizontal gaps" onClick={() => (moveCards(boardId, distributeCards(cards, 'horizontal')), setMenu(null))}>
                        ⇹ Distribute horizontally
                      </MenuItem>
                      <MenuItem active={false} title="Equal vertical gaps" onClick={() => (moveCards(boardId, distributeCards(cards, 'vertical')), setMenu(null))}>
                        ⇳ Distribute vertically
                      </MenuItem>
                    </>
                  )}
                </Menu>
              )}
            </div>
          )}
          {oneGroup ? (
            <button className={`${btn} ${on}`} title="Ungroup (⌘⇧G)" onClick={() => ungroupCards(boardId, ids)}>
              ⧉
            </button>
          ) : (
            many && (
              <button className={btn} title="Group (⌘G)" onClick={() => groupCards(boardId, ids)}>
                ⧉
              </button>
            )
          )}
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
        onClick={() => apply({ bg: undefined, fg: undefined, fontSize: undefined, font: undefined, bold: undefined, italic: undefined, align: undefined, border: undefined, radius: undefined, opacity: undefined, strokeWidth: undefined, dashed: undefined })}
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
  const ref = useRef<HTMLDivElement>(null)
  const [dx, setDx] = useState(0)
  // centered under its button, but nudged back inside the window when that would clip it
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // the canvas clips its overlays, so stay inside it (or the window when used elsewhere)
    const host = (ref.current!.closest('.canvas-bg') as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth }
    const over = Math.max(0, host.left + 8 - r.left) || Math.min(0, host.right - 8 - r.right)
    if (over) setDx((d) => d + over)
  }, [])
  return (
    <div
      ref={ref}
      className={`absolute left-1/2 top-full z-10 mt-1 flex gap-0.5 rounded-lg border border-(--hair) bg-swamp-900 p-1 shadow-2xl ${row ? '' : 'flex-col'}`}
      style={{ transform: `translateX(calc(-50% + ${dx}px))` }}
    >
      {children}
    </div>
  )
}

function MenuItem({ children, active, onClick, title }: { children: React.ReactNode; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={`rounded-md px-2 py-1 text-left text-[13px] whitespace-nowrap ${active ? on : 'text-frog-100 hover:bg-(--hover-strong)'}`}>
      {children}
    </button>
  )
}
