import type { Board, Card } from '../model/types'
import { CardView } from '../cards/CardView'
import { boardVars } from '../canvas/styles'
import { resolveTheme } from '../theme/themes'
import { useSettings } from '../store/settings'

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

/** A whole board as a thumbnail: cards become tinted rectangles at their real positions. */
export function BoardPreview({ board, w = 220, h = 140 }: { board: Board; w?: number; h?: number }) {
  const theme = useSettings((s) => resolveTheme(s.theme))
  const vars = boardVars(board, theme.canvas)
  if (!board.cards.length)
    return (
      <div className="flex items-center justify-center rounded-lg text-[11px]" style={{ width: w, height: h, ...vars, background: 'var(--board-bg)', color: 'var(--board-fg-muted)' }}>
        empty board
      </div>
    )
  const minX = Math.min(...board.cards.map((c) => c.x))
  const minY = Math.min(...board.cards.map((c) => c.y))
  const maxX = Math.max(...board.cards.map((c) => c.x + c.w))
  const maxY = Math.max(...board.cards.map((c) => c.y + c.h))
  const k = Math.min((w - 16) / Math.max(maxX - minX, 1), (h - 16) / Math.max(maxY - minY, 1), 1)
  const ox = (w - (maxX - minX) * k) / 2
  const oy = (h - (maxY - minY) * k) / 2
  const fill = (c: Card) => c.style?.bg ?? (c.type === 'text' ? 'transparent' : c.type === 'board' ? '#5d9b4c' : c.type === 'asset' ? '#3d4a55' : c.type === 'shape' ? 'transparent' : '#fbf8ef')
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ width: w, height: h, ...vars, background: 'var(--board-bg)' }}>
      {board.cards.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-[2px]"
          style={{
            left: ox + (c.x - minX) * k,
            top: oy + (c.y - minY) * k,
            width: Math.max(2, c.w * k),
            height: Math.max(2, c.h * k),
            background: fill(c),
            outline: c.type === 'text' || c.type === 'shape' ? `1px solid ${c.style?.border ?? 'var(--board-line)'}` : undefined,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  )
}
