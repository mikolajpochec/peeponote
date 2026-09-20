import { useEffect, type RefObject } from 'react'
import { create } from 'zustand'
import { useViewport } from './viewport'

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

/**
 * Report the rows (`[data-item]` descendants of `container`) of a card so connectors can attach to them.
 * Re-measures on layout, resize and scroll; skipped inside scaled previews.
 */
export function useItemRectsReporter(boardId: string, cardId: string, container: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const el = container.current
    const shell = el?.closest('[data-card]') as HTMLElement | null
    if (!el || !shell || el.closest('[data-preview]')) return
    const report = () => {
      const k = useViewport.getState().get(boardId).scale || 1
      const top = shell.getBoundingClientRect().top
      const rects: Record<string, ItemRect> = {}
      for (const row of el.querySelectorAll<HTMLElement>('[data-item]')) {
        const r = row.getBoundingClientRect()
        rects[row.dataset.item!] = { y: (r.top - top) / k, h: r.height / k }
      }
      useItemRects.getState().report(cardId, rects)
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    const scrollers = [el, ...el.querySelectorAll<HTMLElement>('.overflow-auto')]
    for (const s of scrollers) s.addEventListener('scroll', report, { passive: true })
    return () => {
      ro.disconnect()
      for (const s of scrollers) s.removeEventListener('scroll', report)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, cardId, ...deps])
  useEffect(() => () => useItemRects.getState().forget(cardId), [cardId])
}
