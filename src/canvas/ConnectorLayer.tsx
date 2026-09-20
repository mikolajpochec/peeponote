import { useMemo } from 'react'
import type { Anchor, ArrowStyle, Board, Card, Connector, Side } from '../model/types'
import { SIDES } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { anchorPoint, bezierMid, connectorPath, itemPoint, sidePoint, type Pt } from './connectors'
import { useItemRects } from './itemRects'
import { ColorPicker } from '../ui/ColorPicker'

export interface DraftConnector {
  /** the end that stays put */
  fixed: Anchor
  /** the end under the pointer */
  moving: Pt
  /** set when re-attaching an end of an existing connector */
  editing?: { id: string; end: 'from' | 'to' }
  /** where the moving end will land if released now */
  target: Anchor
}

interface Props {
  board: Board
  scale: number
  readOnly: boolean
  selection: Set<string>
  hoveredCard: string | null
  draft: DraftConnector | null
  onAnchorDown: (e: React.PointerEvent, anchor: Anchor) => void
  onEndpointDown: (e: React.PointerEvent, connector: Connector, end: 'from' | 'to') => void
  onSelect: (id: string, additive: boolean) => void
}

const STROKE = 'var(--board-line)'
const STROKE_SEL = 'var(--board-line-sel)'

export function ConnectorLayer({ board, scale, readOnly, selection, hoveredCard, draft, onAnchorDown, onEndpointDown, onSelect }: Props) {
  const cards = useMemo(() => new Map(board.cards.map((c) => [c.id, c])), [board.cards])
  const inv = 1 / scale
  // row geometry of to-do cards (connectors can attach to single rows)
  const rects = useItemRects((s) => s.byCard)

  const resolved = board.connectors
    .map((k) => {
      const a = anchorPoint(k.from, cards, rects)
      const b = anchorPoint(k.to, cards, rects)
      return a && b ? { k, a, b } : null
    })
    .filter(Boolean) as { k: Connector; a: { pt: Pt; side: Side | null }; b: { pt: Pt; side: Side | null } }[]

  const selectedConnectors = resolved.filter(({ k }) => selection.has(k.id))
  const draftA = draft ? anchorPoint(draft.fixed, cards, rects) : null
  const draftB = draft ? anchorPoint(draft.target, cards, rects) : null
  const targetCard = draft && 'cardId' in draft.target ? cards.get(draft.target.cardId) : undefined
  const handleCards: Card[] = []
  if (!readOnly && !draft) {
    for (const id of selection) {
      const c = cards.get(id)
      if (c) handleCards.push(c)
    }
    if (hoveredCard && !selection.has(hoveredCard)) {
      const c = cards.get(hoveredCard)
      if (c) handleCards.push(c)
    }
  }

  return (
    <>
      <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1} style={{ pointerEvents: 'none', zIndex: 0 }}>
        <defs>
          <marker id="pn-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        {resolved.map(({ k, a, b }) => {
          if (draft?.editing?.id === k.id) return null
          const sel = selection.has(k.id)
          const d = connectorPath(a.pt, a.side, b.pt, b.side)
          return (
            <g key={k.id}>
              {/* fat invisible hit area */}
              <path
                data-connector={k.id}
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14 * inv}
                style={{ pointerEvents: readOnly ? 'none' : 'stroke', cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onSelect(k.id, e.shiftKey)
                }}
              />
              <path
                d={d}
                fill="none"
                style={{ stroke: k.style?.color ?? (sel ? STROKE_SEL : STROKE) }}
                strokeWidth={(k.style?.width ?? 2) + (sel ? 1 : 0)}
                strokeDasharray={k.style?.dashed ? '8 6' : undefined}
                strokeLinecap="round"
                markerEnd={k.arrows === 'end' || k.arrows === 'both' ? 'url(#pn-arrow)' : undefined}
                markerStart={k.arrows === 'start' || k.arrows === 'both' ? 'url(#pn-arrow)' : undefined}
              />
            </g>
          )
        })}
        {draft && draftA && draftB && (
          <>
            <path
              d={connectorPath(draftA.pt, draftA.side, draftB.pt, draftB.side)}
              fill="none"
              style={{ stroke: STROKE_SEL }}
              strokeWidth={2}
              strokeDasharray="6 4"
              markerEnd="url(#pn-arrow)"
            />
            {/* landing spot: snapped anchor on a card, or a free point under the pointer */}
            <circle cx={draftB.pt.x} cy={draftB.pt.y} r={targetCard ? 7 * inv : 5 * inv} fill={targetCard ? 'var(--board-line)' : 'var(--board-bg)'} style={{ stroke: STROKE_SEL }} strokeWidth={2 * inv} />
          </>
        )}
      </svg>

      {/* drop-target outline while dragging a connector */}
      {targetCard && (
        <div
          className="pointer-events-none absolute rounded-xl"
          style={{
            left: targetCard.x - 4,
            top: targetCard.y - 4,
            width: targetCard.w + 8,
            height: targetCard.h + 8,
            zIndex: 99999,
            boxShadow: `0 0 0 ${2 * inv}px var(--board-line-sel), 0 0 0 ${6 * inv}px color-mix(in srgb, var(--board-line) 35%, transparent)`,
          }}
        />
      )}

      {/* anchor handles on selected / hovered cards */}
      {handleCards.map((c) =>
        SIDES.map((side) => {
          const p = sidePoint(c, side)
          return (
            <div
              key={`${c.id}:${side}`}
              data-nodrag
              data-card={c.id}
              title="Drag to connect"
              onPointerDown={(e) => onAnchorDown(e, { cardId: c.id, side })}
              className="absolute rounded-full border-2 hover:scale-125 transition-transform"
              style={{
                borderColor: 'var(--board-line)',
                background: 'var(--board-bg)',
                left: p.x,
                top: p.y,
                width: 12,
                height: 12,
                transform: `translate(-50%, -50%) scale(${inv})`,
                zIndex: 100000,
                cursor: 'crosshair',
              }}
            />
          )
        }),
      )}
      {/* per-row handles on to-do cards: left and right of every item */}
      {handleCards
        .filter((c) => rects[c.id] && Object.keys(rects[c.id]).length)
        .flatMap((c) =>
          Object.keys(rects[c.id] ?? {}).flatMap((itemId) =>
            (['left', 'right'] as Side[]).map((side) => {
              const p = itemPoint(c, itemId, side, rects)
              if (!p || p.y <= c.y + 4 || p.y >= c.y + c.h - 4) return null // row scrolled out of view
              return (
                <div
                  key={`${c.id}:${itemId}:${side}`}
                  data-nodrag
                  data-card={c.id}
                  title="Connect this item"
                  onPointerDown={(e) => onAnchorDown(e, { cardId: c.id, side, itemId })}
                  className="absolute rounded-full border-2 opacity-70 hover:scale-125 hover:opacity-100 transition-transform"
                  style={{
                    borderColor: 'var(--board-line)',
                    background: 'var(--board-bg)',
                    left: p.x,
                    top: p.y,
                    width: 9,
                    height: 9,
                    transform: `translate(-50%, -50%) scale(${inv})`,
                    zIndex: 100000,
                    cursor: 'crosshair',
                  }}
                />
              )
            }),
          ),
        )}

      {/* selected connectors: endpoints on each, one toolbar for all of them */}
      {!readOnly && selectedConnectors.length > 0 && (
        <ConnectorToolbar
          boardId={board.id}
          connectors={selectedConnectors.map((r) => r.k)}
          at={selectedConnectors.length === 1 ? bezierMid(selectedConnectors[0].a.pt, selectedConnectors[0].a.side, selectedConnectors[0].b.pt, selectedConnectors[0].b.side) : centroid(selectedConnectors)}
          inv={inv}
        />
      )}
      {!readOnly &&
        selectedConnectors.map(({ k, a, b }) => {
            return (
              <div key={`sel-${k.id}`}>
                {(['from', 'to'] as const).map((end) => {
                  const p = end === 'from' ? a.pt : b.pt
                  return (
                    <div
                      key={end}
                      data-nodrag
                      title="Drag to reattach"
                      onPointerDown={(e) => onEndpointDown(e, k, end)}
                      className="absolute rounded-full ring-2"
                      style={{ background: 'var(--board-line-sel)', ['--tw-ring-color' as string]: 'var(--board-line)', left: p.x, top: p.y, width: 12, height: 12, transform: `translate(-50%, -50%) scale(${inv})`, zIndex: 100001, cursor: 'move' }}
                    />
                  )
                })}
              </div>
            )
          })}
    </>
  )
}

function centroid(rs: { a: { pt: Pt }; b: { pt: Pt } }[]): Pt {
  let x = 0
  let y = 0
  for (const r of rs) {
    x += (r.a.pt.x + r.b.pt.x) / 2
    y += (r.a.pt.y + r.b.pt.y) / 2
  }
  return { x: x / rs.length, y: y / rs.length }
}

/** Styles every selected connector at once; shows the first one's values. */
function ConnectorToolbar({ boardId, connectors, at, inv }: { boardId: string; connectors: Connector[]; at: Pt; inv: number }) {
  const updateConnector = useWorkspace((s) => s.updateConnector)
  const removeConnectors = useWorkspace((s) => s.removeConnectors)
  const styleConnectors = useWorkspace((s) => s.styleConnectors)
  const connector = connectors[0]
  const ids = connectors.map((k) => k.id)
  const st = connector.style ?? {}
  const width = st.width ?? 2
  const opts: { v: ArrowStyle; label: string; title: string }[] = [
    { v: 'end', label: '→', title: 'Arrow at end' },
    { v: 'start', label: '←', title: 'Arrow at start' },
    { v: 'both', label: '↔', title: 'Both ends' },
    { v: 'none', label: '—', title: 'Plain line' },
  ]
  return (
    <div
      data-nodrag
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute flex items-center gap-0.5 rounded-lg border border-(--hair) bg-swamp-900/95 p-0.5 shadow-xl"
      style={{ left: at.x, top: at.y, transform: `translate(-50%, -140%) scale(${inv})`, transformOrigin: '50% 100%', zIndex: 100002 }}
    >
      {opts.map((o) => (
        <button
          key={o.v}
          title={o.title}
          onClick={() => ids.forEach((id) => updateConnector(boardId, id, { arrows: o.v }))}
          className={`h-6 w-6 rounded text-[13px] font-bold ${connectors.every((k) => k.arrows === o.v) ? 'bg-frog-600 text-white' : 'text-frog-100 hover:bg-(--hover-strong)'}`}
        >
          {o.label}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-(--hover-strong)" />
      {connectors.length > 1 && <span className="px-1 text-[11px] text-frog-200/60">{connectors.length}×</span>}
      <ColorPicker title="Line color" value={st.color} fallback="#8ac47e" onChange={(color) => styleConnectors(boardId, ids, { color })} />
      <button
        title={`Line width: ${width}`}
        onClick={() => styleConnectors(boardId, ids, { width: width >= 6 ? undefined : width + 1 })}
        className="flex h-6 w-6 items-center justify-center rounded text-frog-100 hover:bg-(--hover-strong)"
      >
        <span className="block w-3.5 rounded-full bg-current" style={{ height: Math.min(6, width) }} />
      </button>
      <button
        title="Dashed"
        onClick={() => styleConnectors(boardId, ids, { dashed: st.dashed ? undefined : true })}
        className={`h-6 w-6 rounded text-[13px] ${st.dashed ? 'bg-frog-600 text-white' : 'text-frog-100 hover:bg-(--hover-strong)'}`}
      >
        ┄
      </button>
      <span className="mx-0.5 h-4 w-px bg-(--hover-strong)" />
      <button title="Delete (Del)" onClick={() => removeConnectors(boardId, ids)} className="h-6 w-6 rounded text-[12px] text-frog-200 hover:bg-red-700 hover:text-white">
        ✕
      </button>
    </div>
  )
}
