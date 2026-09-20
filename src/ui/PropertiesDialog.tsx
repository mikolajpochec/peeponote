import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { selectBoards, useWorkspace } from '../store/workspace'
import { cardSummary, hashLinkTo, type LinkTarget } from '../nav/links'
import { boardChain, boardSlug, cardSlug, slugify } from '../nav/peepoUrl'
import { toast } from '../store/toast'
import { Peepo } from './Peepo'

type Subject = { kind: 'card'; boardId: string; cardId: string } | { kind: 'board'; boardId: string } | { kind: 'connector'; boardId: string; connectorId: string }

interface PropsState {
  subject: Subject | null
  open: (s: Subject) => void
  close: () => void
}
export const useProperties = create<PropsState>((set) => ({ subject: null, open: (subject) => set({ subject }), close: () => set({ subject: null }) }))

const row = 'grid grid-cols-[110px_1fr] items-center gap-3 text-[13px]'
const label = 'text-[11px] font-bold uppercase tracking-wider text-frog-200/50'
const field = 'w-full rounded-md bg-swamp-700 px-2 py-1 font-mono text-[12px] outline-none focus:ring-1 focus:ring-frog-400 disabled:opacity-60'
const btn = 'rounded-md bg-swamp-700 px-2 py-1 text-[12px] font-semibold hover:bg-swamp-600'

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.ok(`${what} copied.`, 'peepoHey')
  } catch {
    toast.err('Clipboard blocked — select and copy the text instead.')
  }
}

/** PPM → Properties: the advanced bits (ids, slugs, exact geometry) that stay out of the toolbars. */
export function PropertiesDialog() {
  const subject = useProperties((s) => s.subject)
  const close = useProperties((s) => s.close)
  useEffect(() => {
    if (!subject) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return // other keys must reach the dialog's inputs (React listens at the root)
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [subject, close])
  if (!subject) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="w-full max-w-md rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {subject.kind === 'card' && <CardProps boardId={subject.boardId} cardId={subject.cardId} />}
        {subject.kind === 'board' && <BoardProps boardId={subject.boardId} />}
        {subject.kind === 'connector' && <ConnectorProps boardId={subject.boardId} connectorId={subject.connectorId} />}
        <div className="mt-4 flex justify-end">
          <button onClick={close} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Peepo name="peepoThink" size={40} />
      <div className="min-w-0">
        <h2 className="truncate text-[17px] font-black tracking-tight">{title}</h2>
        <div className="text-[12px] text-frog-200/60">{sub}</div>
      </div>
    </div>
  )
}

/** Address = where the object lives (automatic) + its ID (editable). */
function AddressRows({ pathPrefix, id, auto, onSaveId, target, idHint }: { pathPrefix: string; id: string; auto: string; onSaveId: (v: string) => boolean; target: LinkTarget; idHint: string }) {
  const [draft, setDraft] = useState(id)
  useEffect(() => setDraft(id), [id])
  const save = () => {
    if (draft === id) return
    if (!onSaveId(draft)) setDraft(id)
  }
  const effective = draft || auto
  const address = `${pathPrefix}/${effective}`
  const web = hashLinkTo(target)
  return (
    <>
      <div className={row}>
        <span className={label}>Address</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <div className={`${field} flex min-w-0 items-baseline overflow-hidden whitespace-nowrap`} title={address}>
            <span className="truncate text-frog-200/60">{pathPrefix}/</span>
            <span className="shrink-0 font-bold text-frog-50">{effective}</span>
          </div>
          <button className={btn} onClick={() => copy(address, 'Address')}>
            Copy
          </button>
        </div>
      </div>
      <div className={row}>
        <span className={label}>ID</span>
        <div>
          <input
            value={draft}
            placeholder={auto}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              e.stopPropagation()
            }}
            className={field}
            spellCheck={false}
          />
          <div className="mt-0.5 text-[11px] text-frog-200/50">{idHint}</div>
        </div>
      </div>
      <div className={row}>
        <span className={label}>Share link</span>
        <div className="flex gap-1.5">
          <input readOnly value={web} className={field} onFocus={(e) => e.currentTarget.select()} title="Opens the app at this place — works from anywhere" />
          <button className={btn} onClick={() => copy(web, 'Share link')}>
            Copy
          </button>
        </div>
      </div>
    </>
  )
}

function CardProps({ boardId, cardId }: { boardId: string; cardId: string }) {
  const boards = useWorkspace(selectBoards)
  const updateCard = useWorkspace((s) => s.updateCard)
  const setCardSlug = useWorkspace((s) => s.setCardSlug)
  const board = boards[boardId]
  const card = board?.cards.find((c) => c.id === cardId)
  if (!board || !card) return <div>Gone.</div>
  const path = `peepo://${boardChain(board, boards).map(boardSlug).join('/')}`
  const num = (k: 'x' | 'y' | 'w' | 'h') => (
    <input type="number" value={Math.round(card[k])} onChange={(e) => updateCard(boardId, cardId, { [k]: Number(e.target.value) })} className={`${field} w-20`} />
  )
  return (
    <div className="space-y-2.5">
      <Header title={cardSummary(card)} sub={`${card.type} card on ${board.name || 'Untitled'}`} />
      <AddressRows
        pathPrefix={path}
        id={card.slug ?? ''}
        auto={card.id}
        onSaveId={(v) => setCardSlug(boardId, cardId, v)}
        target={{ kind: 'card', boardId, cardId }}
        idHint="The last part of the address. Generated automatically; give it a name (e.g. image1) to make links readable. Unique on this board."
      />
      <div className={row}>
        <span className={label}>Position</span>
        <div className="flex items-center gap-1.5">
          x {num('x')} y {num('y')}
        </div>
      </div>
      <div className={row}>
        <span className={label}>Size</span>
        <div className="flex items-center gap-1.5">
          w {num('w')} h {num('h')}
        </div>
      </div>
      <div className={row}>
        <span className={label}>Layer / group</span>
        <div className="font-mono text-[12px] text-frog-200/70">
          z {card.z}
          {card.groupId ? ` · group ${card.groupId}` : ''}
        </div>
      </div>
    </div>
  )
}

function BoardProps({ boardId }: { boardId: string }) {
  const boards = useWorkspace(selectBoards)
  const setBoardSlug = useWorkspace((s) => s.setBoardSlug)
  const board = boards[boardId]
  if (!board) return <div>Gone.</div>
  const chain = boardChain(board, boards)
  const parentPath = `peepo://${chain.slice(0, -1).map(boardSlug).join('/')}`.replace(/\/$/, '')
  return (
    <div className="space-y-2.5">
      <Header title={board.name || 'Untitled'} sub={`board · ${board.cards.length} items · created ${new Date(board.createdAt).toLocaleDateString()}`} />
      <AddressRows
        pathPrefix={chain.length > 1 ? parentPath : 'peepo:/'}
        id={board.slug ?? ''}
        auto={slugify(board.name) || board.id}
        onSaveId={(v) => setBoardSlug(boardId, v)}
        target={{ kind: 'board', boardId }}
        idHint="Path segment for everything on this board. By default it follows the board's name; set it to keep links stable when you rename."
      />
      <div className={row}>
        <span className={label}>File</span>
        <span className="font-mono text-[12px] text-frog-200/70">boards/{board.id}.json</span>
      </div>
    </div>
  )
}

function ConnectorProps({ boardId, connectorId }: { boardId: string; connectorId: string }) {
  const boards = useWorkspace(selectBoards)
  const board = boards[boardId]
  const k = board?.connectors.find((x) => x.id === connectorId)
  if (!board || !k) return <div>Gone.</div>
  const end = (a: typeof k.from) => {
    if (!('cardId' in a)) return `free point ${a.x}, ${a.y}`
    const c = board.cards.find((x) => x.id === a.cardId)
    return `${c ? cardSlug(c) : a.cardId} (${a.side}${a.itemId ? `, item ${a.itemId}` : ''})`
  }
  return (
    <div className="space-y-2.5">
      <Header title="Connector" sub={`on ${board.name || 'Untitled'}`} />
      <div className={row}>
        <span className={label}>Id</span>
        <input readOnly value={k.id} className={field} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className={row}>
        <span className={label}>From</span>
        <span className="font-mono text-[12px] text-frog-200/70">{end(k.from)}</span>
      </div>
      <div className={row}>
        <span className={label}>To</span>
        <span className="font-mono text-[12px] text-frog-200/70">{end(k.to)}</span>
      </div>
    </div>
  )
}
