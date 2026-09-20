import { useMemo, useState } from 'react'
import { useReview, useMe, anchorKey } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { openLink } from '../nav/links'
import { Peepo } from '../ui/Peepo'
import { Avatar } from './Avatar'
import { reviewStatus, useNotifications, type Notification } from './notifications'
import { samePerson } from './identity'
import { isCardAnchor, type ReviewRequest } from '../model/review'

function timeAgo(iso: string) {
  if (!iso) return ''
  const d = (Date.now() - Date.parse(iso)) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

const KIND_ICON: Record<Notification['kind'], string> = { 'review-request': '👀', verdict: '✅', comment: '💬', reply: '↩', mention: '@', resolved: '☑' }

/** Right-side panel: reviews asked of you / yours, then everything that happened. Rows turn "seen" as you look at them. */
export function NotificationsPanel({ onClose, mobile }: { onClose: () => void; mobile?: boolean }) {
  const items = useNotifications()
  const me = useMe()
  const reviews = useReview((s) => s.reviews)
  const comments = useReview((s) => s.comments)
  const markSeen = useReview((s) => s.markSeen)
  const markUnseen = useReview((s) => s.markUnseen)
  const hide = useReview((s) => s.hideNotifications)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const identity = useReview((s) => s.identity)

  const askedOfMe = useMemo(
    () =>
      Object.values(reviews)
        .filter((r) => me && r.status === 'open' && r.reviewers.some((p) => samePerson(p, me)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reviews, me],
  )
  const mine = useMemo(() => Object.values(reviews).filter((r) => me && samePerson(r.requester, me)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [reviews, me])
  const unseen = items.filter((n) => n.unseen)

  const open = (n: Notification) => {
    const r = useReview.getState()
    if (n.kind === 'review-request' && n.reviewId) {
      const rq = reviews[n.reviewId]
      if (rq) {
        openLink(rq.targets.length ? { kind: 'card', boardId: rq.boardId, cardId: rq.targets[0] } : { kind: 'board', boardId: rq.boardId })
        r.setMode({ on: true, reviewId: rq.id })
      }
    } else if (n.kind === 'verdict' && n.reviewId && reviews[n.reviewId]) {
      // a verdict on my request: show the review itself (bar with who said what), targets highlighted
      const rq = reviews[n.reviewId]
      openLink(rq.targets.length ? { kind: 'card', boardId: rq.boardId, cardId: rq.targets[0] } : { kind: 'board', boardId: rq.boardId })
      r.setMode({ on: true, reviewId: rq.id })
    } else if (n.rootId && comments[n.rootId]) {
      const root = comments[n.rootId]
      openLink(isCardAnchor(root.anchor) ? { kind: 'card', boardId: root.boardId, cardId: root.anchor.cardId } : { kind: 'place', boardId: root.boardId, x: root.anchor.x, y: root.anchor.y, scale: 1 })
      setTimeout(() => r.setOpenThread({ boardId: root.boardId, anchorKey: anchorKey(root.anchor) }), 50)
    } else if (n.cardId) openLink({ kind: 'card', boardId: n.boardId, cardId: n.cardId })
    else openLink({ kind: 'board', boardId: n.boardId })
    markSeen([n.id])
    if (mobile) onClose()
  }

  return (
    <aside className={`flex shrink-0 flex-col border-l border-(--hair) bg-swamp-900 ${mobile ? 'absolute inset-0 z-30 w-full' : 'w-80'}`}>
      <div className="flex items-center gap-2 border-b border-(--hair) px-3 py-2">
        <Peepo name="peepoHey" size={24} />
        <div className="flex-1 text-sm font-extrabold">Notifications</div>
        {picked.size === 0 && unseen.length > 0 && (
          <button onClick={() => markSeen(unseen.map((n) => n.id))} className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-frog-200/70 hover:bg-(--hover-strong) hover:text-white">
            Mark all seen
          </button>
        )}
        <button onClick={onClose} className="text-frog-200/60 hover:text-white">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
        {identity.kind !== 'verified' && (
          <div className="m-3 rounded-lg bg-amber-900/30 p-2 text-[12px] text-amber-100 ring-1 ring-amber-400/30">
            Notifications are personal —{' '}
            <button className="underline" onClick={() => window.dispatchEvent(new CustomEvent('peeponote:identify'))}>
              identify yourself
            </button>{' '}
            to see who asked you for reviews and who replied.
          </div>
        )}
        {askedOfMe.length > 0 && (
          <Section title="Asked of you">
            {askedOfMe.map((r) => (
              <ReviewRow key={r.id} r={r} role="reviewer" onOpen={() => open({ id: r.id, kind: 'review-request', at: r.createdAt, who: r.requester, boardId: r.boardId, reviewId: r.id, what: '', unseen: false, verified: true })} />
            ))}
          </Section>
        )}
        {mine.length > 0 && (
          <Section title="Your requests">
            {mine.slice(0, 8).map((r) => (
              <ReviewRow
                key={r.id}
                r={r}
                role="requester"
                onOpen={() => {
                  openLink(r.targets.length ? { kind: 'card', boardId: r.boardId, cardId: r.targets[0] } : { kind: 'board', boardId: r.boardId })
                  useReview.getState().setMode({ on: true, reviewId: r.id })
                  if (mobile) onClose()
                }}
              />
            ))}
          </Section>
        )}
        <Section title="Activity">
          {picked.size > 0 && (
            <div className="sticky top-0 z-10 mx-2 mb-1 flex flex-wrap items-center gap-1 rounded-lg bg-swamp-700 px-2 py-1 text-[11px] shadow">
              <span className="font-bold">{picked.size} selected</span>
              <span className="flex-1" />
              <button onClick={() => (markSeen([...picked]), setPicked(new Set()))} className="rounded px-1.5 py-0.5 font-semibold hover:bg-(--hover-strong)">
                Seen
              </button>
              <button onClick={() => (markUnseen([...picked]), setPicked(new Set()))} className="rounded px-1.5 py-0.5 font-semibold hover:bg-(--hover-strong)">
                Unseen
              </button>
              <button onClick={() => (hide([...picked]), setPicked(new Set()))} className="rounded px-1.5 py-0.5 font-semibold text-red-200 hover:bg-red-900/40">
                Remove
              </button>
              <button onClick={() => setPicked(new Set())} className="rounded px-1.5 py-0.5 text-frog-200/60 hover:bg-(--hover-strong)">
                ✕
              </button>
            </div>
          )}
          {items.length > 1 && picked.size === 0 && <div className="px-3 pb-1 text-[10px] text-frog-200/40">Tick rows to mark several seen / unseen, or remove them.</div>}
          {items.map((n) => (
            <Row key={n.id} n={n} picked={picked.has(n.id)} onPick={() => toggle(n.id)} onOpen={() => open(n)} onToggleSeen={() => (n.unseen ? markSeen([n.id]) : markUnseen([n.id]))} />
          ))}
          {!items.length && <div className="px-3 py-4 text-[13px] text-frog-200/50">{me ? 'Nothing yet. Comments, mentions and review requests land here.' : ''}</div>}
        </Section>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-(--hair) pb-1">
      <div className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-frog-200/50">{title}</div>
      {children}
    </div>
  )
}

/**
 * One review in the panel, read at a glance: a coloured left edge when it waits for *you*, a state line
 * ("waiting for Basia", "Basia asked for changes", "approved — close it?") and a per-reviewer ✓ / ✎ / … strip.
 */
function ReviewRow({ r, role, onOpen }: { r: ReviewRequest; role: 'reviewer' | 'requester'; onOpen: () => void }) {
  const verdicts = useReview((s) => s.verdicts)
  const comments = useReview((s) => s.comments)
  const boards = useWorkspace((s) => s.boards)
  const me = useMe()
  const vs = Object.values(verdicts).filter((v) => v.reviewId === r.id)
  const status = reviewStatus(r, vs, Object.values(comments))
  const mine = me ? vs.find((v) => samePerson(v.reviewer, me)) : undefined
  const changes = vs.filter((v) => v.verdict === 'changes-requested')
  const waiting = r.reviewers.filter((p) => !vs.some((v) => samePerson(v.reviewer, p)))
  const commented = new Set(Object.values(comments).filter((c) => c.reviewId === r.id).map((c) => c.author.email.toLowerCase()))

  // what this row asks of me
  let needsMe = false
  let line: string
  let tone: 'action' | 'ok' | 'wait' | 'done' = 'wait'
  if (r.status === 'closed') {
    line = `closed${r.closedBy ? ` by ${r.closedBy.name}` : ''}`
    tone = 'done'
  } else if (role === 'reviewer') {
    if (!mine) {
      needsMe = true
      line = 'Your review is needed'
      tone = 'action'
    } else if (mine.verdict === 'approved') {
      line = 'You approved'
      tone = 'ok'
    } else {
      line = 'You asked for changes — waiting for ' + r.requester.name
      tone = 'wait'
    }
  } else if (status === 'changes requested') {
    needsMe = true
    line = `${changes.map((v) => v.reviewer.name).join(', ')} asked for changes`
    tone = 'action'
  } else if (status === 'approved') {
    needsMe = true
    line = 'Approved by everyone — close it?'
    tone = 'ok'
  } else if (status === 'in progress') {
    line = `${r.reviewers.filter((p) => commented.has(p.email.toLowerCase())).map((p) => p.name).join(', ') || 'Someone'} is looking at it`
    tone = 'wait'
  } else {
    line = `Waiting for ${waiting.map((p) => p.name).join(', ')}`
    tone = 'wait'
  }
  const edge = tone === 'action' ? 'border-l-amber-400' : tone === 'ok' ? 'border-l-frog-400' : tone === 'done' ? 'border-l-transparent' : 'border-l-swamp-500'
  const lineCls = tone === 'action' ? 'text-amber-200' : tone === 'ok' ? 'text-frog-300' : tone === 'done' ? 'text-frog-200/50' : 'text-frog-200/70'
  return (
    <button onClick={onOpen} className={`flex w-full items-start gap-2 border-l-[3px] px-3 py-2 text-left hover:bg-swamp-700 ${edge} ${r.status === 'closed' ? 'opacity-60' : ''} ${needsMe ? 'bg-amber-500/5' : ''}`}>
      <Avatar person={role === 'reviewer' ? r.requester : r.reviewers[0] ?? r.requester} size={26} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px]">
          {role === 'reviewer' ? (
            <>
              <b>{r.requester.name}</b> · {r.targets.length ? `${r.targets.length} card${r.targets.length === 1 ? '' : 's'} on ` : ''}
              <b>{boards[r.boardId]?.name ?? '?'}</b>
            </>
          ) : (
            <>
              <b>{boards[r.boardId]?.name ?? '?'}</b> → {r.reviewers.map((p) => p.name).join(', ')}
            </>
          )}
        </div>
        {r.message && <div className="truncate text-[12px] text-frog-200/60">{r.message}</div>}
        <div className={`mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold ${lineCls}`}>
          {needsMe && <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />}
          {tone === 'ok' && !needsMe && <span>✓</span>}
          <span className="truncate">{line}</span>
        </div>
        {/* who said what */}
        <div className="mt-1 flex flex-wrap gap-1">
          {r.reviewers.map((p) => {
            const v = vs.find((x) => samePerson(x.reviewer, p))
            const k = v ? (v.verdict === 'approved' ? 'ok' : 'changes') : commented.has(p.email.toLowerCase()) ? 'looking' : 'waiting'
            const cls = k === 'ok' ? 'bg-frog-700/60 text-frog-50' : k === 'changes' ? 'bg-amber-600/50 text-amber-50' : k === 'looking' ? 'bg-swamp-600 text-frog-100' : 'bg-swamp-700 text-frog-200/60'
            const icon = k === 'ok' ? '✓' : k === 'changes' ? '✎' : k === 'looking' ? '👀' : '…'
            return (
              <span key={p.email} className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-[10px] font-bold ${cls}`} title={v?.note || (k === 'waiting' ? 'no answer yet' : k === 'looking' ? 'commented, no verdict yet' : '')}>
                <Avatar person={p} size={14} />
                {icon} {p.name.split(' ')[0]}
              </span>
            )
          })}
        </div>
      </div>
      <span className="text-[10px] text-frog-200/40">{timeAgo(r.updatedAt || r.createdAt)}</span>
    </button>
  )
}

export function StatusPill({ status }: { status: ReturnType<typeof reviewStatus> }) {
  const cls =
    status === 'approved' ? 'bg-frog-600 text-white' : status === 'changes requested' ? 'bg-amber-600 text-white' : status === 'closed' ? 'bg-swamp-600 text-frog-200' : 'bg-swamp-600 text-frog-100'
  return <span className={`rounded px-1.5 py-px text-[10px] font-bold ${cls}`}>{status}</span>
}

/** a notification row: click opens it (and marks it seen); the checkbox selects it for the batch bar; the dot toggles seen */
function Row({ n, picked, onPick, onOpen, onToggleSeen }: { n: Notification; picked: boolean; onPick: () => void; onOpen: () => void; onToggleSeen: () => void }) {
  return (
    <div className={`group/row flex w-full items-start gap-2 px-2 py-2 text-left hover:bg-swamp-700 ${n.unseen ? 'bg-frog-900/20' : 'opacity-50 hover:opacity-100'} ${picked ? 'bg-frog-800/40 opacity-100' : ''}`}>
      <input type="checkbox" checked={picked} onChange={onPick} className={`mt-2 accent-frog-500 ${picked ? '' : 'opacity-0 group-hover/row:opacity-100'}`} title="Select" />
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2 text-left">
        <div className="relative">
          {n.who.email ? <Avatar person={n.who} size={26} /> : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-swamp-600 text-[12px]">@</span>}
          <span className="absolute -bottom-1 -right-1 rounded-full bg-swamp-900 px-0.5 text-[10px] leading-none">{KIND_ICON[n.kind]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-snug">
            {n.who.email && <b>{n.who.name} </b>}
            {n.what}
            {!n.verified && <span className="ml-1 rounded bg-swamp-600 px-1 text-[9px] font-bold uppercase text-frog-200/60">unverified</span>}
          </div>
          {n.excerpt && <div className="truncate text-[12px] text-frog-200/70">{n.excerpt}</div>}
          <div className="text-[11px] text-frog-200/50">{timeAgo(n.at)}</div>
        </div>
      </button>
      <button
        onClick={onToggleSeen}
        title={n.unseen ? 'Mark seen' : 'Mark unseen'}
        className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ring-1 ring-frog-400/60 ${n.unseen ? 'bg-frog-400' : 'bg-transparent opacity-40 group-hover/row:opacity-100'}`}
      />
    </div>
  )
}
