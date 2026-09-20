import { useEffect, useMemo, useState } from 'react'
import { useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { toast } from '../store/toast'
import { Peepo } from '../ui/Peepo'
import { CardPreview } from '../ui/CardPreview'
import { Avatar } from './Avatar'
import { fuzzyFilter } from './fuzzy'
import { usePeople, type KnownPerson } from './people'
import { samePerson, type Person } from './identity'

const field = 'w-full rounded-md bg-swamp-700 px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'

/** "Ask for review": pick one or more people (fuzzy search, or type name <email>), add a note, send. */
export function RequestReviewDialog() {
  const target = useReview((s) => s.requestDialog)
  const close = () => useReview.getState().setRequestDialog(null)
  const requestReview = useReview((s) => s.requestReview)
  const identity = useReview((s) => s.identity)
  const board = useWorkspace((s) => (target ? s.boards[target.boardId] : undefined))
  const people = usePeople()
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Person[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) return
    setQ('')
    setChosen([])
    setMessage('')
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [target])

  const list = useMemo(() => fuzzyFilter(q, people, (p) => `${p.name} ${p.email}`).filter((p) => !chosen.some((c) => samePerson(c, p))), [q, people, chosen])
  // "Basia <basia@x.y>" or a bare email typed by hand
  const typed = useMemo((): Person | null => {
    const m = /^\s*(.*?)\s*<([^>]+@[^>]+)>\s*$/.exec(q) ?? (/^[^\s@]+@[^\s@]+$/.test(q.trim()) ? [q, q.trim().split('@')[0], q.trim()] : null)
    return m ? { name: (m[1] || m[2].split('@')[0]).trim(), email: m[2].trim().toLowerCase() } : null
  }, [q])

  if (!target || !board) return null
  const cards = board.cards.filter((c) => target.targets.includes(c.id))
  const add = (p: Person) => {
    setChosen((c) => (c.some((x) => samePerson(x, p)) ? c : [...c, { name: p.name, email: p.email }]))
    setQ('')
  }
  const send = async () => {
    if (!chosen.length) return
    setBusy(true)
    const r = await requestReview(target.boardId, target.targets, chosen, message)
    setBusy(false)
    if (r) {
      toast.ok(`Asked ${chosen.map((p) => p.name).join(', ')} for a review.`, 'peepoHey')
      close()
    }
  }

  return (
    <div className="fixed inset-0 z-[62] flex items-center justify-center bg-black/70 p-4" onClick={close}>
      <div className="w-full max-w-lg rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <Peepo name="peepoHey" size={40} />
          <div className="flex-1">
            <div className="text-lg font-black">Ask for a review</div>
            <div className="text-[12px] text-frog-200/60">
              {cards.length ? `${cards.length} card${cards.length === 1 ? '' : 's'} on` : 'The whole board'} <b className="text-frog-100">{board.name}</b>
            </div>
          </div>
          <button onClick={close} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>

        {cards.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {cards.slice(0, 8).map((c) => (
              <div key={c.id} className="shrink-0 overflow-hidden rounded-lg ring-1 ring-(--hair)">
                <CardPreview card={c} board={board} w={120} h={76} />
              </div>
            ))}
            {cards.length > 8 && <div className="flex shrink-0 items-center px-2 text-[12px] text-frog-200/50">+{cards.length - 8} more</div>}
          </div>
        )}

        {identity.kind !== 'verified' && (
          <div className="mb-3 rounded-lg bg-amber-900/30 p-2 text-[12px] text-amber-100 ring-1 ring-amber-400/30">
            You need a password to ask for reviews —{' '}
            <button className="underline" onClick={() => window.dispatchEvent(new CustomEvent('peeponote:identify'))}>
              identify yourself
            </button>
            .
          </div>
        )}

        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-frog-200/60">Who should look at it?</div>
        <div className="flex flex-wrap gap-1.5 rounded-md bg-swamp-700 p-1.5">
          {chosen.map((p) => (
            <span key={p.email} className="flex items-center gap-1 rounded-full bg-frog-700/60 py-0.5 pl-0.5 pr-2 text-[12px] font-semibold">
              <Avatar person={p} size={18} />
              {p.name}
              <button className="ml-0.5 text-frog-200/70 hover:text-white" onClick={() => setChosen((c) => c.filter((x) => !samePerson(x, p)))}>
                ✕
              </button>
            </span>
          ))}
          <input
            className="min-w-32 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-frog-200/30"
            placeholder={chosen.length ? 'Add another…' : 'Type a name, or name <email>'}
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (list[0]) add(list[0])
                else if (typed) add(typed)
              }
              if (e.key === 'Backspace' && !q && chosen.length) setChosen((c) => c.slice(0, -1))
            }}
          />
        </div>
        <div className="mt-1 max-h-40 overflow-auto rounded-md scrollbar-thin">
          {list.slice(0, 8).map((p: KnownPerson) => (
            <button key={p.email} onClick={() => add(p)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-(--hover)">
              <Avatar person={p} size={22} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</span>
              <span className="truncate text-[11px] text-frog-200/50">{p.email}</span>
              {!p.hasAccount && <span className="text-[10px] text-frog-200/40">no password yet</span>}
            </button>
          ))}
          {!list.length && typed && (
            <button onClick={() => add(typed)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-(--hover)">
              <Avatar person={typed} size={22} />
              <span className="text-[13px]">
                Add <b>{typed.name}</b> &lt;{typed.email}&gt;
              </span>
            </button>
          )}
          {!list.length && !typed && q && <div className="px-2 py-1 text-[12px] text-frog-200/50">Nobody matches — type name &lt;email&gt; to add someone new.</div>}
          {!people.length && !q && <div className="px-2 py-1 text-[12px] text-frog-200/50">Nobody else has saved in this repo yet — type name &lt;email&gt;.</div>}
        </div>

        <div className="mt-3 mb-1 text-[11px] font-bold uppercase tracking-wider text-frog-200/60">A note for them (optional)</div>
        <textarea className={`${field} min-h-16 resize-y`} placeholder="What should they pay attention to?" value={message} onChange={(e) => setMessage(e.target.value)} />

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-frog-200/50">They'll see it in their notifications after the next sync.</span>
          <div className="flex gap-2">
            <button onClick={close} className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-frog-200 hover:bg-(--hover-strong)">
              Cancel
            </button>
            <button
              onClick={send}
              disabled={!chosen.length || busy || identity.kind !== 'verified'}
              className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Sending…' : `Ask ${chosen.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
