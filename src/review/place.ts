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

/**
 * Candidate spots around a target, nearest first: for each of three distance rings, slide along every side
 * in steps (aligned to the target's start, its end, and every ~60 px between and beyond), so a bubble that
 * fits anywhere near its target is found. ~150 spots; testing is cheap.
 */
function candidates(t: Rect, w: number, h: number): Placement[] {
  const out: (Placement & { d: number })[] = []
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const push = (x: number, y: number, side: Placement['side']) => {
    const bx = x + w / 2
    const by = y + h / 2
    out.push({ x, y, w, h, side, d: Math.hypot(bx - cx, by - cy) })
  }
  const steps = (from: number, len: number, size: number) => {
    // aligned to the target's start / end / centre, then every 40 px along the side and well past both ends
    // (so a column of bubbles can stack beside a card)
    const pts = new Set<number>([from, from + len - size, from + len / 2 - size / 2])
    for (let o = -size * 2; o <= len + size; o += 40) pts.add(from + Math.round(o))
    return [...pts]
  }
  // rings: each further ring sits one bubble away, so the next column / row of bubbles can form
  for (let ring = 0; ring < 3; ring++) {
    const gx = GAP + ring * (w + GAP)
    const gy = GAP + ring * (h + GAP)
    for (const y of steps(t.y, t.h, h)) {
      push(t.x + t.w + gx, y, 'right')
      push(t.x - gx - w, y, 'left')
    }
    for (const x of steps(t.x, t.w, w)) {
      push(x, t.y + t.h + gy, 'below')
      push(x, t.y - gy - h, 'above')
    }
  }
  // nearest first, but prefer the plain side positions of the first ring: stable sort by distance keeps them early
  out.sort((a, b) => a.d - b.d)
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
      // the tail must reach its target without running through another bubble
      if (taken.some((o) => segmentCrosses(nearestPoint(c, r.target), nearestPoint(r.target, c), o))) continue
      found = { x: c.x, y: c.y, w: c.w, h: c.h, side: c.side }
      break
    }
    if (found) taken.push(found)
    out.set(r.id, found)
  }
  return out
}

/** the point on rect `r`'s edge closest to the centre of `o` */
export function nearestPoint(r: Rect, o: Rect) {
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  return { x: Math.max(r.x, Math.min(r.x + r.w, cx)), y: Math.max(r.y, Math.min(r.y + r.h, cy)) }
}

/** does the segment a→b pass through rect `r`? (sampled; plenty for layout purposes) */
function segmentCrosses(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect): boolean {
  for (let i = 1; i < 16; i++) {
    const t = i / 16
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true
  }
  return false
}

/** rough height before the DOM has measured the bubble */
export function estimateHeight(text: string, replies: number, width = 240): number {
  const charsPerLine = Math.max(10, Math.floor((width - 24) / 6.6))
  const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0)
  return 40 + Math.min(lines, 8) * 17 + (replies ? 20 : 0)
}
