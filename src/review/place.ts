/**
 * Where comment bubbles go. Nobody drags them: for each thread we try a handful of spots around its
 * target (right, left, below, above, then the corners; then the same further out) and take the first
 * one that covers neither a card nor an already placed bubble. No spot → null → the target shows a
 * badge instead and the thread lives in the hover cascade.
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface BubbleRequest {
  id: string
  /** what the bubble points at (a card rect, a row rect, or a 0×0 spot) */
  target: Rect
  /** measured or estimated bubble size */
  w: number
  h: number
}

export interface Placement extends Rect {
  /** which side of the target the bubble sits on (for the pointer triangle) */
  side: 'right' | 'left' | 'below' | 'above'
}

const GAP = 14

export const intersects = (a: Rect, b: Rect, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y

function candidates(t: Rect, w: number, h: number): Placement[] {
  const out: Placement[] = []
  for (const g of [GAP, GAP * 4, GAP * 8]) {
    out.push(
      { x: t.x + t.w + g, y: t.y, w, h, side: 'right' },
      { x: t.x - g - w, y: t.y, w, h, side: 'left' },
      { x: t.x, y: t.y + t.h + g, w, h, side: 'below' },
      { x: t.x, y: t.y - g - h, w, h, side: 'above' },
      // slide along the side: bottom-aligned right/left, right-aligned below/above
      { x: t.x + t.w + g, y: t.y + t.h - h, w, h, side: 'right' },
      { x: t.x - g - w, y: t.y + t.h - h, w, h, side: 'left' },
      { x: t.x + t.w - w, y: t.y + t.h + g, w, h, side: 'below' },
      { x: t.x + t.w - w, y: t.y - g - h, w, h, side: 'above' },
      // corners
      { x: t.x + t.w + g, y: t.y + t.h + g, w, h, side: 'right' },
      { x: t.x - g - w, y: t.y + t.h + g, w, h, side: 'left' },
      { x: t.x + t.w + g, y: t.y - g - h, w, h, side: 'right' },
      { x: t.x - g - w, y: t.y - g - h, w, h, side: 'left' },
    )
  }
  return out
}

/**
 * Greedy, in the given order (older threads first, so they keep their spots when new ones arrive).
 * `obstacles` = every card on the board. A bubble may not overlap any card — including its own target.
 */
export function placeBubbles(obstacles: Rect[], requests: BubbleRequest[]): Map<string, Placement | null> {
  const out = new Map<string, Placement | null>()
  const taken: Rect[] = []
  for (const r of requests) {
    let found: Placement | null = null
    for (const c of candidates(r.target, r.w, r.h)) {
      if (obstacles.some((o) => intersects(c, o, 4))) continue
      if (taken.some((o) => intersects(c, o, 6))) continue
      found = c
      break
    }
    if (found) taken.push(found)
    out.set(r.id, found)
  }
  return out
}

/** rough height before the DOM has measured the bubble */
export function estimateHeight(text: string, replies: number, width = 240): number {
  const charsPerLine = Math.max(10, Math.floor((width - 24) / 6.6))
  const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0)
  return 40 + Math.min(lines, 8) * 17 + (replies ? 20 : 0)
}
