import { useRef, useState } from 'react'
import type { LinkCard as LinkCardT } from '../model/types'
import { selectBoards, useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { describeLink, isInternalLink, openLink, parseLink } from '../nav/links'
import { BoardIconView } from '../ui/BoardIcon'
import { LinkPicker } from '../ui/LinkPicker'
import { Popover } from '../ui/Popover'

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function LinkCard({ card, boardId, readOnly, selected }: CardProps<LinkCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  if (isInternalLink(card.url)) return <InternalLink card={card} boardId={boardId} readOnly={readOnly} selected={selected} target={parseLink(card.url)} />

  const host = hostOf(card.url)
  return (
    <div className="flex h-full w-full items-stretch gap-3 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-frog-100">
        {host && card.url ? <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" className="h-6 w-6" /> : <span>🔗</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.title}
          placeholder={host || 'Title'}
          onChange={(e) => updateCard(boardId, card.id, { title: e.target.value })}
          className="min-w-0 bg-transparent text-[1em] font-bold outline-none placeholder:opacity-50"
        />
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.url}
          placeholder="https://… or paste a peeponote link"
          onChange={(e) => updateCard(boardId, card.id, { url: e.target.value })}
          className="min-w-0 bg-transparent text-[0.86em] opacity-70 outline-none"
        />
        <div className="mt-auto flex items-center gap-2">
          {card.url && (
            <a data-nodrag href={card.url} target="_blank" rel="noreferrer noopener" className="self-start text-[0.86em] font-semibold underline opacity-80 hover:opacity-100">
              Open ↗
            </a>
          )}
          {!card.url && !readOnly && <BoardPicker onPick={(url) => updateCard(boardId, card.id, { url })} />}
        </div>
      </div>
    </div>
  )
}

/** A link into this workspace: shows what it points at and jumps there on click. */
function InternalLink({ card, boardId, readOnly, target }: CardProps<LinkCardT> & { target: ReturnType<typeof parseLink> }) {
  const updateCard = useWorkspace((s) => s.updateCard)
  // subscribe to boards so the label follows renames / deletions
  useWorkspace(selectBoards)
  const info = target ? describeLink(target) : { title: 'Broken link', sub: card.url, icon: undefined, missing: true }
  const kindLabel = !target ? 'peepo://' : target.kind === 'card' ? 'card' : target.kind === 'place' ? 'spot' : 'board'
  return (
    <div className="flex h-full w-full items-stretch gap-3 p-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${info.missing ? 'bg-red-200 text-red-800' : 'bg-frog-100'}`}>
        {info.missing || !target ? '⚠' : target.kind === 'board' ? <BoardIconView icon={info.icon} size={26} /> : target.kind === 'card' ? '🎯' : '📍'}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.title}
          placeholder={info.title}
          onChange={(e) => updateCard(boardId, card.id, { title: e.target.value })}
          className="min-w-0 bg-transparent text-[1em] font-bold outline-none placeholder:opacity-70"
        />
        <div className="truncate text-[0.86em] opacity-70">
          {kindLabel} · {card.title ? info.title + ' · ' : ''}
          {info.sub}
        </div>
        <div className="mt-auto flex items-center gap-2">
          <button
            data-nodrag
            disabled={info.missing || !target}
            onClick={() => target && openLink(target)}
            className="self-start rounded-md bg-black/15 px-2 py-0.5 text-[0.86em] font-semibold hover:bg-black/25 disabled:opacity-40"
          >
            Go →
          </button>
          {!readOnly && (
            <button data-nodrag onClick={() => updateCard(boardId, card.id, { url: '' })} className="text-[0.8em] opacity-50 hover:opacity-90" title="Change target">
              change
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** "Pick a target…" for a fresh link card: the shared link picker, floating above the card. */
function BoardPicker({ onPick }: { onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={btn} data-nodrag onClick={() => setOpen((o) => !o)} className="rounded-md bg-black/10 px-2 py-0.5 text-[0.86em] font-semibold hover:bg-black/20">
        🐸 Link to a board or card…
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)}>
          <LinkPicker
            onClose={() => setOpen(false)}
            onPick={(url) => {
              setOpen(false)
              onPick(url)
            }}
          />
        </Popover>
      )}
    </>
  )
}
