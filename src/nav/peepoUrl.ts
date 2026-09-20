/**
 * Human-readable links into the workspace:
 *
 *   peepo://Home/Styl-Graficzny/Obrazki          → board (path of boards from the root)
 *   peepo://Home/Styl-Graficzny/Obrazki/image1   → card on that board
 *   peepo://Home/Obrazki/@120,-40,1.5            → spot on a board
 *
 * Every segment matches a board or card by its slug (user-set in Properties), its id, or the
 * slugified name — so paths read well, and survive renames as long as the id/slug is used or
 * the object stays unique.
 */
import type { Board, Card } from '../model/types'
import type { LinkTarget } from './links'

export const PEEPO_SCHEME = 'peepo://'

/** "Styl graficzny!" → "Styl-graficzny" — letters (incl. ł, ó…) and digits stay; the rest becomes "-" */
export function slugify(name: string): string {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/** comparison key: case- and accent-insensitive, so "Fabuła" matches "fabula" too */
const norm = (s: string) =>
  slugify(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** effective slug of a board / card (explicit slug wins, else the id) */
export const boardSlug = (b: Board) => b.slug || slugify(b.name) || b.id
export const cardSlug = (c: Card) => c.slug || c.id

function boardMatches(b: Board, seg: string): boolean {
  const s = norm(seg)
  return b.id === seg || (!!b.slug && norm(b.slug) === s) || norm(b.name) === s
}
function cardMatches(c: Card, seg: string): boolean {
  return c.id === seg || (!!c.slug && norm(c.slug) === norm(seg))
}

/** Boards from the root down to `b` */
export function boardChain(b: Board, boards: Record<string, Board>): Board[] {
  const chain: Board[] = []
  for (let cur: Board | undefined = b; cur; cur = cur.parentId ? boards[cur.parentId] : undefined) chain.unshift(cur)
  return chain
}

export function peepoUrlFor(t: LinkTarget, boards: Record<string, Board>): string | null {
  const board = boards[t.boardId]
  if (!board) return null
  const path = boardChain(board, boards).map(boardSlug).join('/')
  if (t.kind === 'card') {
    const card = board.cards.find((c) => c.id === t.cardId)
    if (!card) return null
    return `${PEEPO_SCHEME}${path}/${cardSlug(card)}`
  }
  if (t.kind === 'place') return `${PEEPO_SCHEME}${path}/@${Math.round(t.x)},${Math.round(t.y)}${t.scale !== 1 ? `,${t.scale.toFixed(2)}` : ''}`
  return `${PEEPO_SCHEME}${path}`
}

/** Resolve a peepo:// URL against the workspace. Null when it isn't one or nothing matches. */
export function resolvePeepoUrl(url: string, boards: Record<string, Board>, rootId: string | null): LinkTarget | null {
  if (!url.toLowerCase().startsWith(PEEPO_SCHEME)) return null
  const raw = url.slice(PEEPO_SCHEME.length).replace(/\/+$/, '')
  const segs = raw.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  if (!segs.length) return rootId ? { kind: 'board', boardId: rootId } : null

  // trailing @x,y[,scale] = a spot
  let place: { x: number; y: number; scale: number } | null = null
  const last = segs[segs.length - 1]
  const pm = /^@(-?\d+),(-?\d+)(?:,([\d.]+))?$/.exec(last)
  if (pm) {
    place = { x: Number(pm[1]), y: Number(pm[2]), scale: pm[3] ? Number(pm[3]) : 1 }
    segs.pop()
  }

  // walk boards from the root
  const all = Object.values(boards)
  let cur: Board | undefined = rootId ? boards[rootId] : all.find((b) => !b.parentId)
  let i = 0
  if (cur && boardMatches(cur, segs[0] ?? '')) i = 1 // root segment is optional
  for (; cur && i < segs.length; i++) {
    const seg = segs[i]
    const child = all.find((b) => b.parentId === cur!.id && boardMatches(b, seg))
    if (child) {
      cur = child
      continue
    }
    // not a sub-board: the last segment may be a card on `cur`
    if (i === segs.length - 1) {
      const card = cur.cards.find((c) => cardMatches(c, seg))
      if (card) return { kind: 'card', boardId: cur.id, cardId: card.id }
    }
    cur = undefined
  }
  if (cur) return place ? { kind: 'place', boardId: cur.id, ...place } : { kind: 'board', boardId: cur.id }

  // path broken (renamed / moved): fall back to a unique slug or id anywhere in the workspace
  const want = segs[segs.length - 1]
  if (!want) return null
  const cardHits = all.flatMap((b) => b.cards.filter((c) => cardMatches(c, want)).map((c) => ({ boardId: b.id, cardId: c.id })))
  if (cardHits.length === 1) return { kind: 'card', ...cardHits[0] }
  const boardHits = all.filter((b) => boardMatches(b, want))
  if (boardHits.length === 1) return place ? { kind: 'place', boardId: boardHits[0].id, ...place } : { kind: 'board', boardId: boardHits[0].id }
  return null
}

/** Slugs must be url-safe words, unique among siblings. Returns an error message or null. */
export function validateSlug(slug: string, taken: Iterable<string>, ownCurrent?: string): string | null {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug)) return 'Use letters, digits, - and _ only (no spaces or slashes)'
  for (const t of taken) if (t !== ownCurrent && norm(t) === norm(slug)) return `"${slug}" is already used here`
  return null
}
