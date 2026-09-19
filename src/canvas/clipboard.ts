import type { Anchor, Board, Card, Connector } from '../model/types'
import { newId } from '../model/types'
import { useWorkspace } from '../store/workspace'

export const CLIP_MIME = 'application/x-peeponote'

export interface ClipPayload {
  cards: Card[]
  connectors: Connector[]
}

/** In-app fallback for when the system clipboard isn't available (context-menu paste). */
let internal: ClipPayload | null = null

export function hasClipboard(): boolean {
  return !!internal && internal.cards.length > 0
}

/** Selected cards (+ connectors fully inside the selection), deep-cloned. Nested boards are not copied — a board card would point at the same board, so we skip them. */
export function collect(board: Board, ids: Set<string>): ClipPayload {
  const cards = board.cards.filter((c) => ids.has(c.id) && c.type !== 'board').map((c) => structuredClone(c))
  const keep = new Set(cards.map((c) => c.id))
  const inside = (a: Anchor) => !('cardId' in a) || keep.has(a.cardId)
  const connectors = board.connectors.filter((k) => inside(k.from) && inside(k.to) && ('cardId' in k.from || 'cardId' in k.to)).map((k) => structuredClone(k))
  return { cards, connectors }
}

export function copySelection(board: Board, ids: Set<string>, dt?: DataTransfer | null): ClipPayload {
  const payload = collect(board, ids)
  internal = payload
  if (dt && payload.cards.length) {
    dt.setData(CLIP_MIME, JSON.stringify(payload))
    // plain-text fallback so pasting into a text editor gives something useful
    dt.setData(
      'text/plain',
      payload.cards
        .map((c) => (c.type === 'note' ? c.md : c.type === 'text' ? c.text : c.type === 'link' ? c.url : c.type === 'todo' ? c.items.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}`).join('\n') : c.type === 'asset' ? c.name : ''))
        .filter(Boolean)
        .join('\n\n'),
    )
  }
  return payload
}

export function readPayload(dt?: DataTransfer | null): ClipPayload | null {
  const raw = dt?.getData(CLIP_MIME)
  if (raw) {
    try {
      return JSON.parse(raw) as ClipPayload
    } catch {
      /* fall through */
    }
  }
  return internal
}

/**
 * Insert a payload with fresh ids. `at` = new top-left of the group's bounding box;
 * without it the group lands offset from the original.
 */
export function pastePayload(boardId: string, payload: ClipPayload, at?: { x: number; y: number }): string[] {
  if (!payload.cards.length) return []
  const minX = Math.min(...payload.cards.map((c) => c.x))
  const minY = Math.min(...payload.cards.map((c) => c.y))
  const dx = at ? at.x - minX : 24
  const dy = at ? at.y - minY : 24
  const idMap = new Map<string, string>()
  const cards = payload.cards.map((c) => {
    const id = newId()
    idMap.set(c.id, id)
    return { ...structuredClone(c), id, x: Math.round(c.x + dx), y: Math.round(c.y + dy) }
  })
  const remap = (a: Anchor): Anchor => ('cardId' in a ? { cardId: idMap.get(a.cardId) ?? a.cardId, side: a.side } : { x: Math.round(a.x + dx), y: Math.round(a.y + dy) })
  const connectors = payload.connectors.map((k) => ({ ...structuredClone(k), id: newId(), from: remap(k.from), to: remap(k.to) }))
  const ws = useWorkspace.getState()
  ws.insert(boardId, cards, connectors)
  ws.select(cards.map((c) => c.id))
  return cards.map((c) => c.id)
}

export function duplicateSelection(board: Board, ids: Set<string>): string[] {
  return pastePayload(board.id, collect(board, ids))
}
