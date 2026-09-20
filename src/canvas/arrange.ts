import type { Card } from '../model/types'

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

type Deltas = Record<string, { x: number; y: number }>

export const ALIGN_LABEL: Record<AlignMode, string> = {
  left: 'Align left',
  hcenter: 'Align horizontal centers',
  right: 'Align right',
  top: 'Align top',
  vcenter: 'Align vertical centers',
  bottom: 'Align bottom',
}

/** Move deltas that line the cards up along one edge/axis of their common bounding box. */
export function alignCards(cards: Card[], mode: AlignMode): Deltas {
  if (cards.length < 2) return {}
  const minX = Math.min(...cards.map((c) => c.x))
  const maxX = Math.max(...cards.map((c) => c.x + c.w))
  const minY = Math.min(...cards.map((c) => c.y))
  const maxY = Math.max(...cards.map((c) => c.y + c.h))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const out: Deltas = {}
  for (const c of cards) {
    let x = 0
    let y = 0
    switch (mode) {
      case 'left':
        x = minX - c.x
        break
      case 'hcenter':
        x = cx - c.w / 2 - c.x
        break
      case 'right':
        x = maxX - c.w - c.x
        break
      case 'top':
        y = minY - c.y
        break
      case 'vcenter':
        y = cy - c.h / 2 - c.y
        break
      case 'bottom':
        y = maxY - c.h - c.y
        break
    }
    if (x || y) out[c.id] = { x: Math.round(x), y: Math.round(y) }
  }
  return out
}

/** Equal gaps between neighbours; the outermost cards stay put. */
export function distributeCards(cards: Card[], axis: DistributeAxis): Deltas {
  if (cards.length < 3) return {}
  const h = axis === 'horizontal'
  const sorted = [...cards].sort((a, b) => (h ? a.x + a.w / 2 - (b.x + b.w / 2) : a.y + a.h / 2 - (b.y + b.h / 2)))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const start = h ? first.x + first.w : first.y + first.h
  const end = h ? last.x : last.y
  const inner = sorted.slice(1, -1)
  const used = inner.reduce((s, c) => s + (h ? c.w : c.h), 0)
  const gap = (end - start - used) / (inner.length + 1)
  const out: Deltas = {}
  let pos = start + gap
  for (const c of inner) {
    const d = Math.round(pos - (h ? c.x : c.y))
    if (d) out[c.id] = h ? { x: d, y: 0 } : { x: 0, y: d }
    pos += (h ? c.w : c.h) + gap
  }
  return out
}

/** Bounding box of a set of cards, or null when empty. */
export function bbox(cards: Card[]): { x: number; y: number; w: number; h: number } | null {
  if (!cards.length) return null
  const minX = Math.min(...cards.map((c) => c.x))
  const minY = Math.min(...cards.map((c) => c.y))
  const maxX = Math.max(...cards.map((c) => c.x + c.w))
  const maxY = Math.max(...cards.map((c) => c.y + c.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
