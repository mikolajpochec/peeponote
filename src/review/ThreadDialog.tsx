import { useEffect, useMemo, useState } from 'react'
import { isCardAnchor, type Comment } from '../model/review'
import { anchorKey, useMe, useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { openLink } from '../nav/links'
import { InlineMd } from '../cards/Inline'
import { BoardPreview, CardPreview } from '../ui/CardPreview'
import { confirm } from '../ui/confirm'
import { Avatar } from './Avatar'
import { MentionInput } from './MentionInput'
import { samePerson, userKey } from './identity'

const timeAgo = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000
  return d < 60 ? 'just now' : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : new Date(iso).toLocaleString()
}

/**
 * All threads on one element (card, row or spot) with a live preview of the element beside them.
 * Reply, resolve, mute, delete your own; start a new thread here.
 */
export function ThreadDialog() {
  const open = useReview((s) => s.openThread)
  const close = () => useReview.getState().setOpenThread(null)
  const comments = useReview((s) => s.comments)
  const verified = useReview((s) => s.verified)
  const states = useReview((s) => s.states)
  const identity = useReview((s) => s.identity)
  const addComment = useReview((s) => s.addComment)
  const resolveThread = useReview((s) => s.resolveThread)
  const deleteComment = useReview((s) => s.deleteComment)
  const editComment = useReview((s) => s.editComment)
  const muteThread = useReview((s) => s.muteThread)
  const markSeen = useReview((s) => s.markSeen)
  const mode = useReview((s) => s.mode)
  const me = useMe()
  const board = useWorkspace((s) => (open ? s.boards[open.boardId] : undefined))
  const anyoneCanClose = useWorkspace((s) => !!s.meta?.settings?.review?.anyoneCanClose)
  const [reply, setReply] = useState<Record<string, string>>({})
  const [fresh, setFresh] = useState('')
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !editing && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, editing])

  const threads = useMemo(() => {
    if (!open) return []
    const roots = Object.values(comments).filter((c) => c.boardId === open.boardId && !c.parentId && anchorKey(c.anchor) === open.anchorKey)
    roots.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return roots.map((root) => ({ root, replies: Object.values(comments).filter((c) => c.parentId === root.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
  }, [open, comments])

  // everything shown here counts as seen
  useEffect(() => {
    if (!open || !me) return
    const ids = threads.flatMap((t) => [t.root, ...t.replies]).filter((c) => !samePerson(c.author, me)).map((c) => c.id)
    if (ids.length) markSeen(ids)
  }, [open, threads, me, markSeen])

  if (!open || !board) return null
  const anchor = threads[0]?.root.anchor ?? parseAnchorKey(open.anchorKey)
  const card = anchor && isCardAnchor(anchor) ? board.cards.find((c) => c.id === anchor.cardId) : undefined
  const muted = new Set(me ? states[userKey(me.email)]?.muted ?? [] : [])
  const canResolve = (root: Comment) => !!me && (anyoneCanClose || samePerson(root.author, me))
  const canWrite = identity.kind === 'verified'

  const goTo = () => {
    if (card) openLink({ kind: 'card', boardId: board.id, cardId: card.id })
    else if (anchor && !isCardAnchor(anchor)) openLink({ kind: 'place', boardId: board.id, x: anchor.x, y: anchor.y, scale: 1 })
    close()
  }
  const post = async (rootId: string) => {
    const text = reply[rootId]?.trim()
    if (!text) return
    const root = comments[rootId]
    const c = await addComment(board.id, root.anchor, text, { parentId: rootId, reviewId: root.reviewId })
    if (c) setReply((r) => ({ ...r, [rootId]: '' }))
  }
  const startThread = async () => {
    if (!fresh.trim() || !anchor) return
    const c = await addComment(board.id, anchor, fresh, { reviewId: mode.reviewId })
    if (c) setFresh('')
  }

  return (
    <div className="fixed inset-0 z-[62] flex items-center justify-center bg-black/70 p-4" onClick={close}>
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-(--hair) bg-swamp-800 shadow-2xl md:flex-row" onClick={(e) => e.stopPropagation()}>
        {/* threads */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-(--hair) px-4 py-3">
            <div className="flex-1">
              <div className="text-[15px] font-black">
                {threads.length ? `${threads.length} thread${threads.length === 1 ? '' : 's'}` : 'No comments yet'}
                {card ? ` on this ${card.type === 'story' ? card.kind : card.type}` : ' on this spot'}
              </div>
              <div className="text-[11px] text-frog-200/60">{board.name}</div>
            </div>
            <button onClick={close} className="text-frog-200/60 hover:text-white">
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 scrollbar-thin">
            {threads.map(({ root, replies }) => (
              <div key={root.id} className={`mb-4 rounded-xl bg-swamp-700/50 p-3 ${root.resolved ? 'opacity-70' : ''}`}>
                <CommentView c={root} verified={verified[root.id]} me={me} editing={editing} setEditing={setEditing} onEdit={editComment} onDelete={deleteComment} />
                {replies.map((r) => (
                  <div key={r.id} className="ml-6 mt-2 border-l-2 border-(--hair) pl-3">
                    <CommentView c={r} verified={verified[r.id]} me={me} editing={editing} setEditing={setEditing} onEdit={editComment} onDelete={deleteComment} />
                  </div>
                ))}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  {root.resolved ? (
                    <span className="rounded bg-frog-700/60 px-1.5 py-0.5 font-bold text-frog-100">
                      ✓ resolved by {root.resolved.by.name} {timeAgo(root.resolved.at)}
                    </span>
                  ) : null}
                  {canResolve(root) && (
                    <button onClick={() => resolveThread(root.id, !root.resolved)} className="rounded px-1.5 py-0.5 font-semibold text-frog-200 hover:bg-(--hover-strong) hover:text-white">
                      {root.resolved ? 'Reopen' : '✓ Resolve'}
                    </button>
                  )}
                  {me && (
                    <button onClick={() => muteThread(root.id, !muted.has(root.id))} className="rounded px-1.5 py-0.5 font-semibold text-frog-200/70 hover:bg-(--hover-strong) hover:text-white">
                      {muted.has(root.id) ? '🔔 Unmute' : '🔕 Mute'}
                    </button>
                  )}
                </div>
                {canWrite && !root.resolved && (
                  <div className="mt-2">
                    <MentionInput value={reply[root.id] ?? ''} onChange={(v) => setReply((r) => ({ ...r, [root.id]: v }))} onSubmit={() => post(root.id)} placeholder="Reply… (@ to mention, Enter to send)" rows={1} />
                  </div>
                )}
              </div>
            ))}
            {canWrite ? (
              <div className="rounded-xl border border-dashed border-(--hair) p-3">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-frog-200/60">New thread here</div>
                <MentionInput value={fresh} onChange={setFresh} onSubmit={startThread} placeholder="What's on your mind? (@ to mention)" rows={2} />
                <div className="mt-1.5 flex justify-end">
                  <button onClick={startThread} disabled={!fresh.trim()} className="rounded bg-frog-500 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-frog-400 disabled:opacity-40">
                    Post
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-900/30 p-3 text-[12px] text-amber-100 ring-1 ring-amber-400/30">
                <button className="underline" onClick={() => window.dispatchEvent(new CustomEvent('peeponote:identify'))}>
                  Identify yourself
                </button>{' '}
                to reply or start a thread.
              </div>
            )}
          </div>
        </div>
        {/* the element */}
        <div className="flex w-full shrink-0 flex-col gap-2 border-t border-(--hair) bg-swamp-900/60 p-4 md:w-64 md:border-l md:border-t-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-frog-200/60">{card ? 'The element' : 'The spot'}</div>
          <div className="overflow-hidden rounded-lg ring-1 ring-(--hair)">{card ? <CardPreview card={card} board={board} w={224} h={150} /> : <BoardPreview board={board} w={224} h={150} />}</div>
          {card && anchor && isCardAnchor(anchor) && anchor.itemId && <div className="text-[11px] text-frog-200/60">Row: {anchor.itemId}</div>}
          <button onClick={goTo} className="rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500">
            Go there →
          </button>
          {!mode.on && (
            <button onClick={() => (useReview.getState().setMode({ on: true }), goTo())} className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-frog-200 hover:bg-(--hover-strong)">
              Open in review mode
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentView({
  c,
  verified,
  me,
  editing,
  setEditing,
  onEdit,
  onDelete,
}: {
  c: Comment
  verified: boolean | undefined
  me: { name: string; email: string } | null
  editing: { id: string; text: string } | null
  setEditing: (e: { id: string; text: string } | null) => void
  onEdit: (id: string, text: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const own = !!me && samePerson(c.author, me)
  return (
    <div>
      <div className="flex items-center gap-2">
        <Avatar person={c.author} size={22} />
        <span className="text-[13px] font-bold">{c.author.name}</span>
        <span className="text-[11px] text-frog-200/50">{timeAgo(c.createdAt)}</span>
        {c.editedAt && <span className="text-[10px] text-frog-200/40">edited</span>}
        {!verified && <span className="rounded bg-swamp-600 px-1 text-[9px] font-bold uppercase text-frog-200/60">unverified</span>}
        {own && !editing && (
          <span className="ml-auto flex gap-1 text-[11px]">
            <button onClick={() => setEditing({ id: c.id, text: c.text })} className="rounded px-1 text-frog-200/60 hover:bg-(--hover-strong) hover:text-white">
              Edit
            </button>
            <button
              onClick={async () => {
                if (await confirm({ title: 'Delete this comment?', message: 'Replies by others stay.', confirmLabel: 'Delete', danger: true })) await onDelete(c.id)
              }}
              className="rounded px-1 text-frog-200/60 hover:bg-red-900/40 hover:text-red-100"
            >
              Delete
            </button>
          </span>
        )}
      </div>
      {editing?.id === c.id ? (
        <div className="mt-1">
          <MentionInput
            value={editing.text}
            onChange={(t) => setEditing({ id: c.id, text: t })}
            onSubmit={async () => {
              await onEdit(c.id, editing.text)
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
            autoFocus
          />
        </div>
      ) : (
        <div className="mt-1 text-[13px] leading-snug text-frog-50 [&_p]:m-0">
          <InlineMd text={c.text} />
        </div>
      )}
    </div>
  )
}

function parseAnchorKey(k: string): Comment['anchor'] | null {
  const m = /^card:([^#]+)(?:#(.+))?$/.exec(k)
  if (m) return { cardId: m[1], itemId: m[2] }
  const s = /^spot:(-?\d+),(-?\d+)$/.exec(k)
  if (s) return { x: Number(s[1]), y: Number(s[2]) }
  return null
}
