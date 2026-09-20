import { useEffect, useMemo, useRef, useState } from 'react'
import { selectBoards, useWorkspace } from '../store/workspace'
import { cardSummary, linkTo, type LinkTarget } from '../nav/links'
import { boardChain, boardSlug } from '../nav/peepoUrl'
import { BoardIconView } from './BoardIcon'

const TYPE_ICON: Record<string, string> = { note: '📝', text: '¶', todo: '☑', link: '🔗', board: '🐸', asset: '📎', shape: '◇', story: '📖' }

interface Hit {
  target: LinkTarget
  title: string
  path: string
  icon: React.ReactNode
}

/**
 * One search box for "where should this link go": a web URL (type it), or any board / card in the
 * workspace (search by name). Returns the URL to insert.
 */
export function LinkPicker({ onPick, onClose, initial = '' }: { onPick: (url: string, label: string) => void; onClose: () => void; initial?: string }) {
  const boards = useWorkspace(selectBoards)
  const [q, setQ] = useState(initial)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const isUrl = /^(https?:\/\/|peepo:\/\/|mailto:)/i.test(q.trim())

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase()
    if (isUrl) return []
    const out: Hit[] = []
    for (const b of Object.values(boards)) {
      const path = boardChain(b, boards).map(boardSlug).join('/')
      const bt = b.name || 'Untitled'
      if (!needle || bt.toLowerCase().includes(needle) || path.toLowerCase().includes(needle)) {
        out.push({ target: { kind: 'board', boardId: b.id }, title: bt, path: `peepo://${path}`, icon: <BoardIconView icon={b.icon} size={18} /> })
      }
      if (needle) {
        for (const c of b.cards) {
          if (c.type === 'board') continue
          const t = cardSummary(c)
          if (t.toLowerCase().includes(needle) || (c.slug && c.slug.toLowerCase().includes(needle))) {
            out.push({ target: { kind: 'card', boardId: b.id, cardId: c.id }, title: t, path: `peepo://${path}/${c.slug || c.id}`, icon: <span className="text-[14px]">{TYPE_ICON[c.type] ?? '▫'}</span> })
          }
        }
      }
    }
    return out.slice(0, 40)
  }, [q, boards, isUrl])

  useEffect(() => setSel(0), [q])

  const pick = (i: number) => {
    if (isUrl) {
      onPick(q.trim(), q.trim())
      return
    }
    const h = hits[i]
    if (h) onPick(linkTo(h.target), h.title)
  }

  return (
    <div className="w-80 rounded-xl border border-(--hair) bg-swamp-900 p-2 text-[13px] text-frog-50 shadow-2xl" data-nodrag onPointerDown={(e) => e.stopPropagation()}>
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') onClose()
          if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, hits.length - 1))
          if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0))
          if (e.key === 'Enter') {
            e.preventDefault()
            pick(sel)
          }
        }}
        placeholder="Search boards & cards, or paste https://…"
        className="w-full rounded-md bg-swamp-700 px-2 py-1.5 outline-none placeholder:text-frog-200/40 focus:ring-1 focus:ring-frog-400"
      />
      <div className="mt-1 max-h-64 overflow-auto scrollbar-thin">
        {isUrl && (
          <button onClick={() => pick(0)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left bg-frog-700/50">
            <span>🌐</span>
            <span className="min-w-0 flex-1 truncate">{q.trim()}</span>
          </button>
        )}
        {!isUrl && hits.length === 0 && <div className="px-2 py-2 text-[12px] text-frog-200/50">Nothing matches. Type a board or card name, or a URL.</div>}
        {hits.map((h, i) => (
          <button
            key={`${h.target.kind}:${h.target.boardId}:${'cardId' in h.target ? h.target.cardId : ''}`}
            onMouseEnter={() => setSel(i)}
            onClick={() => pick(i)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${i === sel ? 'bg-frog-700/50' : 'hover:bg-(--hover)'}`}
          >
            <span className="flex w-5 shrink-0 justify-center">{h.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{h.title}</span>
              <span className="block truncate text-[11px] text-frog-200/50">{h.path}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
