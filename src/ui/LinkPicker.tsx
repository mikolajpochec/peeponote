import { useEffect, useMemo, useRef, useState } from 'react'
import type { Board, Card } from '../model/types'
import { selectBoards, useWorkspace } from '../store/workspace'
import { cardSummary, linkTo, type LinkTarget } from '../nav/links'
import { PEEPO_SCHEME, boardChain, boardSlug, cardSlug, resolvePeepoUrl } from '../nav/peepoUrl'
import { BoardIconView } from './BoardIcon'
import { BoardPreview, CardPreview } from './CardPreview'

const TYPE_ICON: Record<string, string> = { note: '📝', text: '¶', todo: '☑', link: '🔗', board: '🐸', asset: '📎', shape: '◇', story: '📖' }

interface Hit {
  target: LinkTarget
  title: string
  /** the peepo:// path (what gets inserted / completed) */
  path: string
  icon: React.ReactNode
  /** boards can be descended into with "/" */
  board?: Board
  card?: Card
  sub?: string
}

const pathOf = (b: Board, boards: Record<string, Board>) => `${PEEPO_SCHEME}${boardChain(b, boards).map(boardSlug).join('/')}`

/**
 * "Where should this link go?" — one box, two modes:
 *  - type a name → fuzzy search over boards and cards;
 *  - type `peepo://` → path completion segment by segment (boards, then a card), like a file path.
 * Arrow over a result to see a live preview of that board / card. Enter inserts, Tab / "/" descends.
 */
export function LinkPicker({ onPick, onClose, initial = '' }: { onPick: (url: string, label: string) => void; onClose: () => void; initial?: string }) {
  const boards = useWorkspace(selectBoards)
  const rootId = useWorkspace((s) => s.meta?.rootBoardId ?? null)
  const [q, setQ] = useState(initial)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  // after the popover has been positioned (it mounts hidden until then — a hidden input can't take focus)
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  const trimmed = q.trim()
  const isWeb = /^(https?:\/\/|mailto:)/i.test(trimmed)
  const pathMode = trimmed.toLowerCase().startsWith(PEEPO_SCHEME)

  const hits = useMemo<Hit[]>(() => {
    if (isWeb) return []
    const all = Object.values(boards)
    const out: Hit[] = []

    if (pathMode) {
      // complete the path: resolve everything but the last (partial) segment, list what can follow
      const raw = trimmed.slice(PEEPO_SCHEME.length)
      const segs = raw.split('/')
      const partial = segs.pop() ?? ''
      const prefix = segs.length ? `${PEEPO_SCHEME}${segs.join('/')}` : null
      const base = prefix ? resolvePeepoUrl(prefix, boards, rootId) : rootId ? { kind: 'board' as const, boardId: rootId } : null
      const needle = partial.toLowerCase()
      if (!prefix) {
        // first segment: the root (and, for convenience, any top-level board name)
        const root = rootId ? boards[rootId] : all.find((b) => !b.parentId)
        if (root && (!needle || boardSlug(root).toLowerCase().startsWith(needle) || root.name.toLowerCase().startsWith(needle)))
          out.push({ target: { kind: 'board', boardId: root.id }, title: root.name || 'Untitled', path: pathOf(root, boards), icon: <BoardIconView icon={root.icon} size={18} />, board: root, sub: 'root board' })
      }
      if (base && base.kind === 'board') {
        const here = boards[base.boardId]
        if (here) {
          for (const b of all.filter((x) => x.parentId === here.id)) {
            const s = boardSlug(b)
            if (!needle || s.toLowerCase().includes(needle) || b.name.toLowerCase().includes(needle))
              out.push({ target: { kind: 'board', boardId: b.id }, title: b.name || 'Untitled', path: pathOf(b, boards), icon: <BoardIconView icon={b.icon} size={18} />, board: b, sub: `${b.cards.length} items · "/" to go inside` })
          }
          for (const c of here.cards) {
            if (c.type === 'board') continue
            const s = cardSlug(c)
            const t = cardSummary(c)
            if (!needle || s.toLowerCase().includes(needle) || t.toLowerCase().includes(needle))
              out.push({ target: { kind: 'card', boardId: here.id, cardId: c.id }, title: t, path: `${pathOf(here, boards)}/${s}`, icon: <span className="text-[14px]">{TYPE_ICON[c.type] ?? '▫'}</span>, card: c, board: here, sub: c.type })
          }
        }
      }
      return out.slice(0, 60)
    }

    // search mode
    const needle = trimmed.toLowerCase()
    for (const b of all) {
      const path = pathOf(b, boards)
      const bt = b.name || 'Untitled'
      if (!needle || bt.toLowerCase().includes(needle) || path.toLowerCase().includes(needle))
        out.push({ target: { kind: 'board', boardId: b.id }, title: bt, path, icon: <BoardIconView icon={b.icon} size={18} />, board: b, sub: `${b.cards.length} items` })
      if (needle) {
        for (const c of b.cards) {
          if (c.type === 'board') continue
          const t = cardSummary(c)
          if (t.toLowerCase().includes(needle) || (c.slug && c.slug.toLowerCase().includes(needle)))
            out.push({ target: { kind: 'card', boardId: b.id, cardId: c.id }, title: t, path: `${path}/${cardSlug(c)}`, icon: <span className="text-[14px]">{TYPE_ICON[c.type] ?? '▫'}</span>, card: c, board: b, sub: `${c.type} on ${bt}` })
        }
      }
    }
    return out.slice(0, 40)
  }, [trimmed, boards, rootId, isWeb, pathMode])

  useEffect(() => setSel(0), [trimmed])
  useEffect(() => {
    // keep the highlighted row in view
    input.current?.parentElement?.querySelector<HTMLElement>(`[data-row="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const pick = (i: number) => {
    if (isWeb) return onPick(trimmed, trimmed)
    const h = hits[i]
    if (!h) {
      // a complete peepo:// path typed by hand that resolves → take it as is
      if (pathMode && resolvePeepoUrl(trimmed, boards, rootId)) return onPick(trimmed, trimmed.slice(trimmed.lastIndexOf('/') + 1))
      return
    }
    onPick(linkTo(h.target), h.title)
  }
  /** descend into the highlighted board (Tab or "/") */
  const descend = (i: number) => {
    const h = hits[i]
    if (h?.board && h.target.kind === 'board') setQ(`${h.path}/`)
  }

  const current = hits[sel]
  const hint = isWeb
    ? 'Web link'
    : pathMode
      ? 'Path completion — ↑↓ pick, Tab or "/" goes into a board, ⏎ inserts'
      : 'Search by name · or type peepo:// to build a path (Home/Board/card-slug)'

  return (
    <div className="flex items-start gap-2 rounded-xl border border-(--hair) bg-swamp-900 p-2 text-[13px] text-frog-50 shadow-2xl" data-nodrag onPointerDown={(e) => e.stopPropagation()}>
      <div className="w-80">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, Math.max(hits.length - 1, 0))))
            else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)))
            else if (e.key === 'Tab') (e.preventDefault(), descend(sel))
            else if (e.key === '/' && pathMode && current?.target.kind === 'board' && current.board && !q.endsWith('/')) (e.preventDefault(), descend(sel))
            else if (e.key === 'Enter') (e.preventDefault(), pick(sel))
          }}
          placeholder="Search boards & cards, https://…, or peepo://Home/…"
          className="w-full rounded-md bg-swamp-700 px-2 py-1.5 font-mono text-[12px] outline-none placeholder:font-sans placeholder:text-frog-200/40 focus:ring-1 focus:ring-frog-400"
          spellCheck={false}
        />
        <div className="mt-1 px-1 text-[10px] text-frog-200/45">{hint}</div>
        <div className="mt-1 max-h-60 overflow-auto scrollbar-thin">
          {isWeb && (
            <button onClick={() => pick(0)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left bg-frog-700/50">
              <span>🌐</span>
              <span className="min-w-0 flex-1 truncate">{trimmed}</span>
            </button>
          )}
          {!isWeb && hits.length === 0 && (
            <div className="px-2 py-2 text-[12px] text-frog-200/50">
              {pathMode ? 'Nothing here matches. Check the path — or Backspace to the last "/" and pick from the list.' : 'Nothing matches. Type a board or card name, or a URL.'}
            </div>
          )}
          {hits.map((h, i) => (
            <button
              key={`${h.target.kind}:${h.target.boardId}:${'cardId' in h.target ? h.target.cardId : ''}`}
              data-row={i}
              onMouseEnter={() => setSel(i)}
              onClick={() => pick(i)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${i === sel ? 'bg-frog-700/50' : 'hover:bg-(--hover)'}`}
            >
              <span className="flex w-5 shrink-0 justify-center">{h.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {h.title}
                  {h.sub && <span className="ml-1.5 text-[10px] text-frog-200/40">{h.sub}</span>}
                </span>
                <span className="block truncate font-mono text-[10px] text-frog-200/50">{h.path}</span>
              </span>
              {h.target.kind === 'board' && (
                <span
                  className="rounded px-1 text-[10px] text-frog-200/50 hover:bg-(--hover-strong) hover:text-frog-100"
                  title="Go inside"
                  onClick={(e) => {
                    e.stopPropagation()
                    descend(i)
                    input.current?.focus()
                  }}
                >
                  /…
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* live preview of the highlighted target */}
      {current && current.board && !isWeb && (
        <div className="w-[220px] shrink-0 pt-0.5">
          {current.card ? <CardPreview card={current.card} board={current.board} /> : <BoardPreview board={current.board} />}
          <div className="mt-1 truncate px-0.5 text-[10px] text-frog-200/50">{current.card ? `${current.card.type} · ${current.board.name || 'Untitled'}` : `board · ${current.board.cards.length} items`}</div>
        </div>
      )}
    </div>
  )
}
