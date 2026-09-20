import type { Board, Card } from '../model/types'
import { CardView } from '../cards/CardView'
import { boardVars } from '../canvas/styles'
import { resolveTheme } from '../theme/themes'
import { useSettings } from '../store/settings'
import { bbox } from '../canvas/arrange'
import { ConnectorLayer } from '../canvas/ConnectorLayer'

/** A card rendered as it looks on its board, scaled to fit a small box. Not interactive. */
export function CardPreview({ card, board, w = 220, h = 140 }: { card: Card; board: Board; w?: number; h?: number }) {
  const theme = useSettings((s) => resolveTheme(s.theme))
  const k = Math.min(1, (w - 16) / card.w, (h - 16) / card.h)
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ width: w, height: h, ...boardVars(board, theme.canvas), background: 'var(--board-bg)' }}>
      <div
        data-preview
        className="pointer-events-none absolute"
        style={{ left: (w - card.w * k) / 2, top: (h - card.h * k) / 2, transform: `translate(${-card.x * k}px, ${-card.y * k}px) scale(${k})`, transformOrigin: '0 0' }}
      >
        <CardView card={card} boardId={board.id} selected={false} readOnly scale={() => k} />
      </div>
    </div>
  )
}

/** A whole board rendered for real (cards + connectors), scaled to fit. Not interactive. */
export function BoardPreview({ board, w = 220, h = 140 }: { board: Board; w?: number; h?: number }) {
  const theme = useSettings((s) => resolveTheme(s.theme))
  const vars = boardVars(board, theme.canvas)
  const bb = bbox(board.cards)
  if (!bb)
    return (
      <div className="flex items-center justify-center rounded-lg text-[11px]" style={{ width: w, height: h, ...vars, background: 'var(--board-bg)', color: 'var(--board-fg-muted)' }}>
        empty board
      </div>
    )
  const pad = 20
  const k = Math.min((w - 16) / (bb.w + pad * 2), (h - 16) / (bb.h + pad * 2), 1)
  const ox = (w - bb.w * k) / 2 - bb.x * k
  const oy = (h - bb.h * k) / 2 - bb.y * k
  // very large boards: cap the work, the picture is tiny anyway
  const cards = board.cards.length > 80 ? [...board.cards].sort((a, b) => a.z - b.z).slice(-80) : board.cards
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ width: w, height: h, ...vars, background: 'var(--board-bg)' }}>
      <div data-preview className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${ox}px, ${oy}px) scale(${k})`, transformOrigin: '0 0', width: 1, height: 1 }}>
        <ConnectorLayer board={board} scale={k} readOnly selection={EMPTY} hoveredCard={null} draft={null} onAnchorDown={noop} onEndpointDown={noop} onSelect={noop} />
        {cards.map((c) => (
          <CardView key={c.id} card={c} boardId={board.id} selected={false} readOnly scale={() => k} />
        ))}
      </div>
    </div>
  )
}

const EMPTY = new Set<string>()
const noop = () => {}
