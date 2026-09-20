/**
 * Deep links inside a workspace: a board, a card on a board, or a spot on a board.
 * They're ordinary URLs of the app with a hash, so they paste as link cards, survive
 * being sent around, and open the right place when the app loads.
 *
 *   …/#/b/<boardId>                → board
 *   …/#/b/<boardId>/c/<cardId>     → card (centered, highlighted)
 *   …/#/b/<boardId>/@<x>,<y>,<s>   → place (viewport)
 */
import { useWorkspace } from '../store/workspace'
import { useViewport } from '../canvas/viewport'
import { useArrivals } from '../canvas/arrivals'
import type { Board, Card } from '../model/types'

export type LinkTarget =
  | { kind: 'board'; boardId: string }
  | { kind: 'card'; boardId: string; cardId: string }
  | { kind: 'place'; boardId: string; x: number; y: number; scale: number }

const appBase = () => `${location.origin}${location.pathname}`

export function linkTo(t: LinkTarget): string {
  const base = `${appBase()}#/b/${t.boardId}`
  if (t.kind === 'card') return `${base}/c/${t.cardId}`
  if (t.kind === 'place') return `${base}/@${Math.round(t.x)},${Math.round(t.y)},${t.scale.toFixed(2)}`
  return base
}

/** Parse a hash (with or without the URL in front). Null for anything that isn't an internal link. */
export function parseLink(s: string): LinkTarget | null {
  const hash = s.includes('#') ? s.slice(s.indexOf('#')) : s.startsWith('/b/') ? `#${s}` : null
  if (!hash) return null
  // links from another deployment of the app still resolve — a board id is a board id
  const m = /^#\/b\/([\w-]+)(?:\/c\/([\w-]+)|\/@(-?\d+),(-?\d+)(?:,([\d.]+))?)?\/?$/.exec(hash)
  if (!m) return null
  const boardId = m[1]
  if (m[2]) return { kind: 'card', boardId, cardId: m[2] }
  if (m[3] !== undefined) return { kind: 'place', boardId, x: Number(m[3]), y: Number(m[4]), scale: m[5] ? Number(m[5]) : 1 }
  return { kind: 'board', boardId }
}

/** True when the string is a link into this app (any origin — pasted from another host still works). */
export const isInternalLink = (url: string) => parseLink(url) !== null && /(^#\/b\/|\/#\/b\/)/.test(url)

/** Human label for a target, from the live workspace. */
export function describeLink(t: LinkTarget): { title: string; sub: string; icon?: string; missing: boolean } {
  const s = useWorkspace.getState()
  const board: Board | undefined = s.boards[t.boardId]
  if (!board) return { title: 'Missing board', sub: 'the link points at a board that no longer exists', missing: true }
  if (t.kind === 'card') {
    const card = board.cards.find((c) => c.id === t.cardId)
    if (!card) return { title: `${board.name || 'Untitled'} → missing card`, sub: 'that card was removed', icon: board.icon, missing: true }
    return { title: cardSummary(card), sub: `on ${board.name || 'Untitled'}`, icon: board.icon, missing: false }
  }
  if (t.kind === 'place') return { title: board.name || 'Untitled', sub: `spot at ${t.x}, ${t.y}`, icon: board.icon, missing: false }
  return { title: board.name || 'Untitled', sub: `${board.cards.length} item${board.cards.length === 1 ? '' : 's'}`, icon: board.icon, missing: false }
}

export function cardSummary(card: Card): string {
  const one = (t: string, n = 40) => {
    const l = t.trim().split('\n')[0]
    return l.length > n ? `${l.slice(0, n - 1)}…` : l
  }
  switch (card.type) {
    case 'note':
      return one(card.md) || 'Note'
    case 'text':
      return one(card.text) || (card.variant === 'title' ? 'Title' : 'Text')
    case 'todo':
      return one(card.title) || 'To-do'
    case 'link':
      return one(card.title || card.url) || 'Link'
    case 'board':
      return useWorkspace.getState().boards[card.boardId]?.name || 'Board'
    case 'asset':
      return card.name
    case 'shape':
      return one(card.label) || 'Shape'
  }
}

/** Go there: switch board, center on the card / spot, highlight the card. */
export function openLink(t: LinkTarget): boolean {
  const ws = useWorkspace.getState()
  const board = ws.boards[t.boardId]
  if (!board) return false
  if (ws.currentBoardId !== t.boardId) ws.navigate(t.boardId)
  // the canvas mounts on the next tick when we switched boards (a timer, not rAF: rAF stalls in background tabs)
  setTimeout(() => {
    const el = document.querySelector('.canvas-bg') as HTMLElement | null
    const cw = el?.clientWidth ?? 800
    const ch = el?.clientHeight ?? 600
    if (t.kind === 'card') {
      const card = board.cards.find((c) => c.id === t.cardId)
      if (!card) return
      const cur = useViewport.getState().get(t.boardId)
      const scale = Math.max(cur.scale, 0.6)
      useViewport.getState().set(t.boardId, { scale, x: cw / 2 - (card.x + card.w / 2) * scale, y: ch / 2 - (card.y + card.h / 2) * scale })
      useWorkspace.getState().select([card.id])
      useArrivals.getState().mark([card.id], [])
    } else if (t.kind === 'place') {
      useViewport.getState().set(t.boardId, { scale: t.scale, x: cw / 2 - t.x * t.scale, y: ch / 2 - t.y * t.scale })
    }
  }, 0)
  return true
}

/** Keep the address bar pointing at the current board so the URL is always shareable. */
export function reflectBoardInHash(boardId: string | null) {
  if (!boardId) return
  const want = `#/b/${boardId}`
  if (location.hash.startsWith(want)) return
  history.replaceState(null, '', want)
}

export async function copyLink(t: LinkTarget): Promise<string> {
  const url = linkTo(t)
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    /* clipboard blocked; the caller shows the URL */
  }
  return url
}
