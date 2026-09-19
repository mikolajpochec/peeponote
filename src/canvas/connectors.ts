import type { Anchor, Board, Card, Side } from '../model/types'

export interface Pt {
  x: number
  y: number
}

export function sidePoint(card: Card, side: Side): Pt {
  switch (side) {
    case 'top':
      return { x: card.x + card.w / 2, y: card.y }
    case 'bottom':
      return { x: card.x + card.w / 2, y: card.y + card.h }
    case 'left':
      return { x: card.x, y: card.y + card.h / 2 }
    case 'right':
      return { x: card.x + card.w, y: card.y + card.h / 2 }
  }
}

/** Resolve an anchor to a board point. Returns null when the card is gone. */
export function anchorPoint(anchor: Anchor, cards: Map<string, Card>): { pt: Pt; side: Side | null } | null {
  if ('cardId' in anchor) {
    const card = cards.get(anchor.cardId)
    if (!card) return null
    return { pt: sidePoint(card, anchor.side), side: anchor.side }
  }
  return { pt: { x: anchor.x, y: anchor.y }, side: null }
}

const OUT: Record<Side, Pt> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

/** Cubic bezier leaving each end perpendicular to its side (or straight toward the other end for free points). */
export function connectorPath(a: Pt, aSide: Side | null, b: Pt, bSide: Side | null): string {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const k = Math.min(160, Math.max(30, dist * 0.4))
  const dirA = aSide ? OUT[aSide] : norm(b.x - a.x, b.y - a.y)
  const dirB = bSide ? OUT[bSide] : norm(a.x - b.x, a.y - b.y)
  const c1 = { x: a.x + dirA.x * k, y: a.y + dirA.y * k }
  const c2 = { x: b.x + dirB.x * k, y: b.y + dirB.y * k }
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`
}

function norm(x: number, y: number): Pt {
  const l = Math.hypot(x, y) || 1
  return { x: x / l, y: y / l }
}

/** Point on the bezier at t (for placing the mini toolbar mid-way). */
export function bezierMid(a: Pt, aSide: Side | null, b: Pt, bSide: Side | null): Pt {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const k = Math.min(160, Math.max(30, dist * 0.4))
  const dirA = aSide ? OUT[aSide] : norm(b.x - a.x, b.y - a.y)
  const dirB = bSide ? OUT[bSide] : norm(a.x - b.x, a.y - b.y)
  const c1 = { x: a.x + dirA.x * k, y: a.y + dirA.y * k }
  const c2 = { x: b.x + dirB.x * k, y: b.y + dirB.y * k }
  // t = 0.5
  return {
    x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x,
    y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y,
  }
}

/** Topmost card under a board point. */
export function cardAt(board: Board, p: Pt, exclude?: string): Card | undefined {
  let best: Card | undefined
  for (const c of board.cards) {
    if (c.id === exclude) continue
    if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
      if (!best || c.z > best.z) best = c
    }
  }
  return best
}

/** Side of `card` that faces `from` — where an incoming connector should attach. */
export function facingSide(card: Card, from: Pt): Side {
  const cx = card.x + card.w / 2
  const cy = card.y + card.h / 2
  const dx = (from.x - cx) / Math.max(card.w, 1)
  const dy = (from.y - cy) / Math.max(card.h, 1)
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}

/** Snap a drop point to a card side, or leave it as a free anchor. */
export function anchorForDrop(board: Board, p: Pt, other: Pt, excludeCard?: string): Anchor {
  const card = cardAt(board, p, excludeCard)
  if (card) return { cardId: card.id, side: facingSide(card, other) }
  return { x: Math.round(p.x), y: Math.round(p.y) }
}
