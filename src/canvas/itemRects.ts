import { create } from 'zustand'

/**
 * Where a card's inner items (to-do rows) sit, in board units relative to the card's top-left.
 * Cards report this from the DOM so connectors can attach to individual rows.
 */
export interface ItemRect {
  y: number
  h: number
}

interface ItemRectsState {
  byCard: Record<string, Record<string, ItemRect>>
  report: (cardId: string, rects: Record<string, ItemRect>) => void
  forget: (cardId: string) => void
}

export const useItemRects = create<ItemRectsState>((set, get) => ({
  byCard: {},
  report: (cardId, rects) => {
    const prev = get().byCard[cardId]
    if (prev && shallowEqualRects(prev, rects)) return
    set((s) => ({ byCard: { ...s.byCard, [cardId]: rects } }))
  },
  forget: (cardId) =>
    set((s) => {
      if (!(cardId in s.byCard)) return s
      const next = { ...s.byCard }
      delete next[cardId]
      return { byCard: next }
    }),
}))

function shallowEqualRects(a: Record<string, ItemRect>, b: Record<string, ItemRect>): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    const x = a[k]
    const y = b[k]
    if (!y || Math.abs(x.y - y.y) > 0.5 || Math.abs(x.h - y.h) > 0.5) return false
  }
  return true
}
