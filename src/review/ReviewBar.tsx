import { useMemo, useState } from 'react'
import type { Board } from '../model/types'
import { useMe, useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { useArrivals } from '../canvas/arrivals'
import { Avatar } from './Avatar'
import { samePerson, userKey } from './identity'
import { reviewStatus } from './notifications'
import { StatusPill } from './NotificationsPanel'

/**
 * The strip at the top of the canvas while reviewing: what's being reviewed, who asked, verdict buttons for
 * reviewers, close for the requester, exit. Also the "click a card to comment" hint.
 */
export function ReviewBar({ board }: { board: Board }) {
  const mode = useReview((s) => s.mode)
  const setMode = useReview((s) => s.setMode)
  const reviews = useReview((s) => s.reviews)
  const verdicts = useReview((s) => s.verdicts)
  const comments = useReview((s) => s.comments)
  const giveVerdict = useReview((s) => s.giveVerdict)
  const closeReview = useReview((s) => s.closeReview)
  const identity = useReview((s) => s.identity)
  const me = useMe()
  const anyoneCanClose = useWorkspace((s) => !s.meta?.settings?.review?.authorOnlyClose)
  const select = useWorkspace((s) => s.select)
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState<null | 'approved' | 'changes-requested'>(null)

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
    <div className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 border-b border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-[13px] backdrop-blur" data-nodrag>
      <span className="font-black text-amber-200">🔍 Review mode</span>
      {review ? (
        <>
          <span className="flex items-center gap-1 text-frog-100">
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
          {review.message && <span className="max-w-72 truncate text-frog-200/80" title={review.message}>“{review.message}”</span>}
        </>
      ) : (
        <span className="text-frog-200/80">Click a card, a row or an empty spot to comment. Nothing on the board can change while reviewing.</span>
      )}
      <span className="flex-1" />
      {review && amReviewer && review.status === 'open' && (
        <>
          {myVerdict && <span className="text-[11px] text-frog-200/70">you: {myVerdict.verdict === 'approved' ? '✓ approved' : '✎ changes requested'}</span>}
          <button onClick={() => setAsking('approved')} className="rounded-md bg-frog-500 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-frog-400">
            ✓ Approve
          </button>
          <button onClick={() => setAsking('changes-requested')} className="rounded-md bg-amber-500 px-2.5 py-1 text-[12px] font-bold text-black hover:bg-amber-400">
            ✎ Request changes
          </button>
        </>
      )}
      {review && (amRequester || anyoneCanClose) && identity.kind === 'verified' && (
        <button onClick={() => closeReview(review.id)} className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-frog-100 hover:bg-(--hover-strong)">
          {review.status === 'open' ? 'Close review' : 'Reopen'}
        </button>
      )}
      <button onClick={() => setMode({ on: false })} className="rounded-md bg-swamp-700 px-2.5 py-1 text-[12px] font-bold text-frog-50 hover:bg-swamp-600">
        Exit review
      </button>
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
