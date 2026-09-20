import { useEffect, useMemo, useRef } from 'react'
import { useReview, useMe, anchorKey } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { openLink } from '../nav/links'
import { Peepo } from '../ui/Peepo'
import { Avatar } from './Avatar'
import { reviewStatus, useNotifications, type Notification } from './notifications'
import { samePerson } from './identity'
import { isCardAnchor } from '../model/review'

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
  const verdicts = useReview((s) => s.verdicts)
  const comments = useReview((s) => s.comments)
  const markSeen = useReview((s) => s.markSeen)
  const boards = useWorkspace((s) => s.boards)
  const identity = useReview((s) => s.identity)

  const askedOfMe = useMemo(() => Object.values(reviews).filter((r) => me && r.status === 'open' && r.reviewers.some((p) => samePerson(p, me))), [reviews, me])
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
        {unseen.length > 0 && (
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
              <button
                key={r.id}
                onClick={() => open({ id: r.id, kind: 'review-request', at: r.createdAt, who: r.requester, boardId: r.boardId, reviewId: r.id, what: '', unseen: false, verified: true })}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-swamp-700"
              >
                <Avatar person={r.requester} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px]">
                    <b>{r.requester.name}</b> · {r.targets.length ? `${r.targets.length} card${r.targets.length === 1 ? '' : 's'} on ` : ''}
                    <b>{boards[r.boardId]?.name ?? '?'}</b>
                  </div>
                  {r.message && <div className="truncate text-[12px] text-frog-200/70">{r.message}</div>}
                  <div className="text-[11px] text-frog-200/50">
                    {timeAgo(r.createdAt)} · {reviewStatus(r, Object.values(verdicts).filter((v) => v.reviewId === r.id), Object.values(comments))}
                  </div>
                </div>
                <span className="rounded bg-frog-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Review</span>
              </button>
            ))}
          </Section>
        )}
        {mine.length > 0 && (
          <Section title="Your requests">
            {mine.slice(0, 8).map((r) => {
              const vs = Object.values(verdicts).filter((v) => v.reviewId === r.id)
              const status = reviewStatus(r, vs, Object.values(comments))
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    openLink(r.targets.length ? { kind: 'card', boardId: r.boardId, cardId: r.targets[0] } : { kind: 'board', boardId: r.boardId })
                    useReview.getState().setMode({ on: true, reviewId: r.id })
                    if (mobile) onClose()
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-swamp-700"
                >
                  <div className="flex -space-x-1.5">
                    {r.reviewers.slice(0, 3).map((p) => (
                      <Avatar key={p.email} person={p} size={22} className="ring-2 ring-swamp-900" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">
                      <b>{boards[r.boardId]?.name ?? '?'}</b> → {r.reviewers.map((p) => p.name).join(', ')}
                    </div>
                    <div className="text-[11px] text-frog-200/50">
                      {timeAgo(r.createdAt)} · <StatusPill status={status} />
                    </div>
                  </div>
                </button>
              )
            })}
          </Section>
        )}
        <Section title="Activity">
          {items.map((n) => (
            <Row key={n.id} n={n} onOpen={() => open(n)} onSeen={() => markSeen([n.id])} />
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

export function StatusPill({ status }: { status: ReturnType<typeof reviewStatus> }) {
  const cls =
    status === 'approved' ? 'bg-frog-600 text-white' : status === 'changes requested' ? 'bg-amber-600 text-white' : status === 'closed' ? 'bg-swamp-600 text-frog-200' : 'bg-swamp-600 text-frog-100'
  return <span className={`rounded px-1.5 py-px text-[10px] font-bold ${cls}`}>{status}</span>
}

/** a notification row; counts as seen after it has been on screen for a moment */
function Row({ n, onOpen, onSeen }: { n: Notification; onOpen: () => void; onSeen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !n.unseen) return
    let t: ReturnType<typeof setTimeout> | undefined
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) t = setTimeout(onSeen, 1500)
      else clearTimeout(t)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(t)
    }
  }, [n.unseen, onSeen])
  return (
    <button ref={ref} onClick={onOpen} className={`flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-swamp-700 ${n.unseen ? 'bg-frog-900/20' : ''}`}>
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
      {n.unseen && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-frog-400" />}
    </button>
  )
}
