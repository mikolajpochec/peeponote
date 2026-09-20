import { create } from 'zustand'
import type { Board } from '../model/types'

/**
 * Cards that just arrived from other people (auto-pull / merge). The canvas plays a short
 * "landing" animation on them so it's obvious what changed and where.
 */
interface ArrivalsState {
  /** cardId → when it arrived */
  cards: Record<string, number>
  /** boardId → when it changed (sidebar flash) */
  boards: Record<string, number>
  mark: (cards: string[], boards: string[]) => void
}

export const ARRIVAL_MS = 2600

export const useArrivals = create<ArrivalsState>((set) => ({
  cards: {},
  boards: {},
  mark: (cards, boards) => {
    if (!cards.length && !boards.length) return
    const now = Date.now()
    set((s) => ({
      cards: { ...s.cards, ...Object.fromEntries(cards.map((id) => [id, now])) },
      boards: { ...s.boards, ...Object.fromEntries(boards.map((id) => [id, now])) },
    }))
    // forget them once the animation is over so the class comes off and memory stays flat
    setTimeout(() => {
      set((s) => ({
        cards: Object.fromEntries(Object.entries(s.cards).filter(([, t]) => Date.now() - t < ARRIVAL_MS)),
        boards: Object.fromEntries(Object.entries(s.boards).filter(([, t]) => Date.now() - t < ARRIVAL_MS)),
      }))
    }, ARRIVAL_MS + 50)
  },
}))

/** Cards (added or changed) and boards that differ between two workspace snapshots. */
export function diffWorkspaces(prev: Record<string, Board>, next: Record<string, Board>): { cards: string[]; boards: string[] } {
  const cards: string[] = []
  const boards: string[] = []
  for (const [id, b] of Object.entries(next)) {
    const p = prev[id]
    if (!p) {
      boards.push(id)
      continue
    }
    const before = new Map(p.cards.map((c) => [c.id, JSON.stringify(c)]))
    let changed = false
    for (const c of b.cards) {
      if (before.get(c.id) !== JSON.stringify(c)) {
        cards.push(c.id)
        changed = true
      }
    }
    if (changed || p.cards.length !== b.cards.length || JSON.stringify(p.connectors) !== JSON.stringify(b.connectors) || p.name !== b.name) boards.push(id)
  }
  return { cards, boards }
}

/** "Mikołaj", "Mikołaj and Basia", "Mikołaj, Basia + 3 others" */
export function formatAuthors(names: string[]): string {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (uniq.length === 0) return 'someone'
  if (uniq.length === 1) return uniq[0]
  if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]}`
  const rest = uniq.length - 2
  return `${uniq[0]}, ${uniq[1]} + ${rest} other${rest === 1 ? '' : 's'}`
}
