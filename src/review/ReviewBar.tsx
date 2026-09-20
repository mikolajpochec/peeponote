import { useEffect, useMemo, useRef, useState } from 'react'
import type { Board } from '../model/types'
import { useMe, useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { useArrivals } from '../canvas/arrivals'
import { Avatar } from './Avatar'
import { samePerson, userKey } from './identity'
import { reviewStatus } from './notifications'
import { StatusPill } from './NotificationsPanel'
import { confirm } from '../ui/confirm'

/**
 * The strip at the top of the canvas while reviewing: what's being reviewed, who asked, verdict buttons for
 * reviewers, close for the requester, exit. Also the "click a card to comment" hint.
 */
export function ReviewBar({ board, onHeight }: { board: Board; onHeight?: (h: number) => void }) {
  const root = useRef<HTMLDivElement>(null)
  // the bar wraps and grows (note line, verdict chips): overlays below it need its real height
  useEffect(() => {
    const el = root.current
    if (!el || !onHeight) return
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight))
    ro.observe(el)
    onHeight(el.offsetHeight)
    return () => {
      ro.disconnect()
      onHeight(0)
    }
  }, [onHeight])
  const mode = useReview((s) => s.mode)
  const setMode = useReview((s) => s.setMode)
  const reviews = useReview((s) => s.reviews)
  const verdicts = useReview((s) => s.verdicts)
  const comments = useReview((s) => s.comments)
  const giveVerdict = useReview((s) => s.giveVerdict)
  const closeReview = useReview((s) => s.closeReview)
  const deleteReview = useReview((s) => s.deleteReview)
  const identity = useReview((s) => s.identity)
  const me = useMe()
  const anyoneCanClose = useWorkspace((s) => !s.meta?.settings?.review?.authorOnlyClose)
  const select = useWorkspace((s) => s.select)
  const showResolved = useReview((s) => s.showResolved)
  const setShowResolved = useReview((s) => s.setShowResolved)
  const resolvedHere = useMemo(() => Object.values(comments).filter((c) => c.boardId === board.id && !c.parentId && c.resolved).length, [comments, board.id])
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState<null | 'approved' | 'changes-requested'>(null)
  const [changing, setChanging] = useState(false)

  // the request we're answering, or any open one on this board that involves me
  const review = useMemo(() => {
    if (mode.reviewId && reviews[mode.reviewId]) return reviews[mode.reviewId]
    return Object.values(reviews).find((r) => r.boardId === board.id && r.status === 'open' && me && (r.reviewers.some((p) => samePerson(p, me)) || samePerson(r.requester, me)))
  }, [mode.reviewId, reviews, board.id, me])
  const vs = useMemo(() => Object.values(verdicts).filter((v) => review && v.reviewId === review.id), [verdicts, review])
  const myVerdict = review && me ? verdicts[`${review.id}.${userKey(me.email)}`] : undefined
  const amReviewer = !!review && !!me && review.reviewers.some((p) => samePerson(p, me))
  const amRequester = !!review && !!me && samePerson(review.requester, me)
  const onThisBoard = review?.boardId === board.id

  const highlight = () => {
    if (!review || !onThisBoard) return
    select(review.targets)
    useArrivals.getState().mark(review.targets, [])
  }

  return (
    <div ref={root} className="relative z-20 flex flex-col gap-1.5 border-b border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[13px]" data-nodrag>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <span className="shrink-0 font-black text-amber-200">🔍 Review mode</span>
      {review ? (
        <>
          <span className="flex min-w-0 flex-wrap items-center gap-1 text-frog-100">
            <Avatar person={review.requester} size={18} />
            <b>{review.requester.name}</b> asked {review.reviewers.map((p) => p.name).join(', ')} to look at{' '}
            {review.targets.length ? (
              <button onClick={highlight} className="underline decoration-dotted hover:text-white" title="Select and flash the cards">
                {review.targets.length} card{review.targets.length === 1 ? '' : 's'}
              </button>
            ) : (
              'the whole board'
            )}
            {!onThisBoard && <span className="text-frog-200/60"> (on another board)</span>}
          </span>
          <StatusPill status={reviewStatus(review, vs, Object.values(comments))} />
          {vs.map((v) => (
            <span key={v.reviewer.email} className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${v.verdict === 'approved' ? 'bg-frog-700/60 text-frog-50' : 'bg-amber-600/50 text-amber-50'}`}>
              <Avatar person={v.reviewer} size={14} />
              {v.verdict === 'approved' ? '✓' : '✎'} {v.reviewer.name}
            </span>
          ))}
        </>
      ) : (
        <span className="text-frog-200/80">Click a card, a row or an empty spot to comment. Nothing on the board can change while reviewing.</span>
      )}
      </div>
      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
      {resolvedHere > 0 && !mode.reviewId && (
        <label className="flex items-center gap-1 text-[12px] text-frog-200/80" title="Resolved threads are hidden by default">
          <input type="checkbox" className="accent-frog-500" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show {resolvedHere} resolved
        </label>
      )}
      {review && amReviewer && review.status === 'open' && (
        <>
          {myVerdict && !changing ? (
            // one verdict per reviewer; you can change your mind, but there's nothing to "approve again"
            <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-bold ${myVerdict.verdict === 'approved' ? 'bg-frog-700/60 text-frog-50' : 'bg-amber-600/50 text-amber-50'}`}>
              {myVerdict.verdict === 'approved' ? '✓ You approved' : '✎ You requested changes'}
              <button onClick={() => setChanging(true)} className="rounded px-1 text-[11px] font-semibold text-frog-100/70 underline decoration-dotted hover:text-white">
                change
              </button>
            </span>
          ) : (
            <>
              <button onClick={() => setAsking('approved')} className="rounded-md bg-frog-500 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-frog-400">
                ✓ Approve
              </button>
              <button onClick={() => setAsking('changes-requested')} className="rounded-md bg-amber-500 px-2.5 py-1 text-[12px] font-bold text-black hover:bg-amber-400">
                ✎ Request changes
              </button>
              {changing && (
                <button onClick={() => setChanging(false)} className="rounded-md px-2 py-1 text-[12px] text-frog-200 hover:bg-(--hover-strong)">
                  keep mine
                </button>
              )}
            </>
          )}
        </>
      )}
      {review && (amRequester || anyoneCanClose) && identity.kind === 'verified' && (
        <>
          <button onClick={() => closeReview(review.id)} className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-frog-100 hover:bg-(--hover-strong)">
            {review.status === 'open' ? 'Close review' : 'Reopen'}
          </button>
          <button
            onClick={async () => {
              const n = Object.values(comments).filter((c) => c.reviewId === review.id).length
              if (
                await confirm({
                  title: 'Delete this review?',
                  message: `The request, ${vs.length} verdict${vs.length === 1 ? '' : 's'} and ${n} comment${n === 1 ? '' : 's'} are removed for everyone. Finished reviews disappear by themselves after 10 days.`,
                  confirmLabel: 'Delete review',
                  danger: true,
                })
              )
                await deleteReview(review.id)
            }}
            title="Delete the review with its comments and verdicts"
            className="rounded-md px-2 py-1 text-[12px] text-frog-200/70 hover:bg-red-900/40 hover:text-red-100"
          >
            🗑
          </button>
        </>
      )}
      <button onClick={() => setMode({ on: false })} className="rounded-md bg-swamp-700 px-2.5 py-1 text-[12px] font-bold text-frog-50 hover:bg-swamp-600">
        Exit review
      </button>
      </div>
      </div>
      {review?.message && (
        <div className="flex w-full items-start gap-2 rounded-lg bg-black/25 px-3 py-2 text-[14px] leading-snug text-frog-50">
          <Avatar person={review.requester} size={22} className="mt-0.5" />
          <div className="min-w-0">
            <span className="mr-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200/90">{review.requester.name} asks</span>
            <span className="whitespace-pre-wrap">{review.message}</span>
          </div>
        </div>
      )}
      {/* each reviewer's verdict with its note, same shape as the request above */}
      {review &&
        vs
          .filter((v) => v.note)
          .map((v) => (
            <div
              key={v.reviewer.email}
              className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-[14px] leading-snug text-frog-50 ${v.verdict === 'approved' ? 'bg-frog-900/40 ring-1 ring-frog-500/40' : 'bg-amber-900/30 ring-1 ring-amber-400/40'}`}
            >
              <Avatar person={v.reviewer} size={22} className="mt-0.5" />
              <div className="min-w-0">
                <span className={`mr-1.5 text-[11px] font-black uppercase tracking-wider ${v.verdict === 'approved' ? 'text-frog-300' : 'text-amber-200/90'}`}>
                  {v.reviewer.name} {v.verdict === 'approved' ? 'approves' : 'requests changes'}
                </span>
                <span className="whitespace-pre-wrap">{v.note}</span>
              </div>
            </div>
          ))}
      {asking && review && (
        <div className="flex w-full items-center gap-2 pt-1">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                await giveVerdict(review.id, asking, note)
                setAsking(null)
                setChanging(false)
                setNote('')
              }
              if (e.key === 'Escape') setAsking(null)
            }}
            placeholder={asking === 'approved' ? 'Optional note — Enter to approve' : 'What should change? — Enter to send'}
            className="flex-1 rounded-md bg-swamp-800 px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-frog-400"
          />
          <button
            onClick={async () => {
              await giveVerdict(review.id, asking, note)
              setAsking(null)
              setChanging(false)
              setNote('')
            }}
            className="rounded-md bg-frog-500 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-frog-400"
          >
            Send
          </button>
          <button onClick={() => setAsking(null)} className="rounded-md px-2 py-1 text-[12px] text-frog-200 hover:bg-(--hover-strong)">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
