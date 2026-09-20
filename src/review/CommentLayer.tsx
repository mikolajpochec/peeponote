import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Board } from '../model/types'
import { isCardAnchor, type Comment } from '../model/review'
import { anchorKey, useMe, useReview } from '../store/review'
import { useItemRects } from '../canvas/itemRects'
import { useWorkspace } from '../store/workspace'
import { InlineMd } from '../cards/Inline'
import { Popover } from '../ui/Popover'
import { Avatar } from './Avatar'
import { userKey } from './identity'
import { MentionInput } from './MentionInput'
import { estimateHeight, placeBubbles, type Placement, type Rect } from './place'

export const BUBBLE_W = 240

export interface Thread {
  /** the root comment id — unique per thread (several threads can share one anchor) */
  key: string
  /** what it points at, for the thread dialog */
  anchor: string
  root: Comment
  replies: Comment[]
  target: Rect | null // null when the anchored card is gone
  cardId?: string
}

/** threads of a board grouped by what they point at; oldest first (stable placement) */
export function threadsOf(board: Board, comments: Record<string, Comment>, rects: Record<string, Record<string, { y: number; h: number }>>): Thread[] {
  const roots = Object.values(comments).filter((c) => c.boardId === board.id && !c.parentId)
  roots.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return roots.map((root) => {
    const replies = Object.values(comments)
      .filter((c) => c.parentId === root.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    let target: Rect | null
    let cardId: string | undefined
    if (isCardAnchor(root.anchor)) {
      cardId = root.anchor.cardId
      const card = board.cards.find((c) => c.id === cardId)
      if (!card) target = null
      else {
        const row = root.anchor.itemId ? rects[card.id]?.[root.anchor.itemId] : undefined
        target = row ? { x: card.x, y: card.y + row.y, w: card.w, h: row.h } : { x: card.x, y: card.y, w: card.w, h: card.h }
      }
    } else target = { x: root.anchor.x, y: root.anchor.y, w: 0, h: 0 }
    return { key: root.id, anchor: anchorKey(root.anchor), root, replies, target, cardId }
  })
}

const timeAgo = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000
  return d < 60 ? 'now' : d < 3600 ? `${Math.floor(d / 60)}m` : d < 86400 ? `${Math.floor(d / 3600)}h` : new Date(iso).toLocaleDateString()
}

/**
 * Everything comment-related drawn on a board: bubbles (review mode), leader lines to their targets, badges on
 * commented cards, the draft being written. Lives inside the zoomed layer, after the cards.
 */
export function CommentLayer({ board, scale }: { board: Board; scale: number }) {
  const comments = useReview((s) => s.comments)
  const rects = useItemRects((s) => s.byCard)
  const mode = useReview((s) => s.mode)
  const draft = useReview((s) => s.draft)
  const verified = useReview((s) => s.verified)
  const setOpenThread = useReview((s) => s.setOpenThread)
  const resolveThread = useReview((s) => s.resolveThread)
  const authorOnly = useWorkspace((s) => !!s.meta?.settings?.review?.authorOnlyClose)
  const me = useMe()
  const canResolve = (root: Comment) => !!me && (!authorOnly || root.author.email.toLowerCase() === me.email.toLowerCase())
  const states = useReview((s) => s.states)
  const seen = me ? states[userKey(me.email)]?.seen ?? {} : {}
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [cascade, setCascade] = useState<{ cardId: string; el: HTMLElement } | null>(null)
  // the cascade opens under the pointer: closing must wait a beat, and hovering the list itself keeps it open
  const cascadeClose = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openCascade = (cardId: string, el: HTMLElement) => {
    if (cascadeClose.current) clearTimeout(cascadeClose.current)
    setCascade((c) => (c?.cardId === cardId ? c : { cardId, el }))
  }
  const closeCascadeSoon = () => {
    if (cascadeClose.current) clearTimeout(cascadeClose.current)
    cascadeClose.current = setTimeout(() => setCascade(null), 180)
  }

  const threads = useMemo(() => threadsOf(board, comments, rects), [board, comments, rects])
  const bubbles = mode.on && scale >= 0.5
  const draftHere = draft && draft.boardId === board.id ? draft : null

  // placement: threads in order, then the draft last (so it takes what's left rather than displacing others)
  const placement = useMemo(() => {
    if (!bubbles) return new Map<string, Placement | null>()
    const obstacles: Rect[] = board.cards.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }))
    const reqs = threads
      .filter((t) => t.target && !t.root.resolved)
      .map((t) => ({ id: t.key, target: t.target!, w: BUBBLE_W, h: sizes[t.key] ?? estimateHeight(t.root.text, t.replies.length) }))
    if (draftHere) {
      const t = draftTarget(board, draftHere.anchor, rects)
      if (t) reqs.push({ id: 'draft', target: t, w: BUBBLE_W, h: sizes.draft ?? 110 })
    }
    return placeBubbles(obstacles, reqs)
  }, [bubbles, board, threads, sizes, draftHere, rects])

  // positions glide towards their targets (JS, not CSS) so the tails can be redrawn in step with the bubbles
  const shown = useAnimatedPlacement(placement)

  const report = (id: string, h: number) => setSizes((s) => (Math.abs((s[id] ?? 0) - h) < 1 ? s : { ...s, [id]: h }))

  // per card: threads count, and whether any is unplaced (→ dashed ring + cascade)
  const byCard = useMemo(() => {
    const m = new Map<string, { threads: Thread[]; unplaced: boolean; unresolved: number }>()
    for (const t of threads) {
      if (!t.cardId || !t.target) continue
      const e = m.get(t.cardId) ?? { threads: [], unplaced: false, unresolved: 0 }
      e.threads.push(t)
      if (!t.root.resolved) e.unresolved++
      if (bubbles && !t.root.resolved && placement.get(t.key) === null) e.unplaced = true
      m.set(t.cardId, e)
    }
    return m
  }, [threads, placement, bubbles])

  // bubbles that just lost their spot (or their thread) fade out in place instead of vanishing
  const [leaving, setLeaving] = useState<Record<string, { thread: Thread; place: Placement }>>({})
  const prevPlaced = useRef<Map<string, { thread: Thread; place: Placement }>>(new Map())
  useEffect(() => {
    const now = new Map<string, { thread: Thread; place: Placement }>()
    if (bubbles) for (const t of threads) {
      const p = shown.get(t.key)
      if (p) now.set(t.key, { thread: t, place: p })
    }
    const gone: Record<string, { thread: Thread; place: Placement }> = {}
    for (const [k, v] of prevPlaced.current) if (!now.has(k)) gone[k] = v
    prevPlaced.current = now
    if (Object.keys(gone).length) {
      setLeaving((l) => ({ ...l, ...gone }))
      // removal is scheduled once per batch and never cancelled (this effect re-runs every animation frame)
      setTimeout(() => setLeaving((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !(k in gone)))), 260)
    }
  }, [shown, threads, bubbles])

  return (
    <div className="pointer-events-none absolute left-0 top-0" data-comments>
      {/* tails: each bubble grows a wedge that reaches the element / spot it talks about */}
      {bubbles && (
        <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
          {threads.map((t) => {
            const p = shown.get(t.key)
            if (!p || !t.target) return null
            return <Tail key={t.key} bubble={p} target={t.target} muted={!!t.root.resolved} />
          })}
          {draftHere && <Tail bubble={shown.get('draft') ?? fallbackPlace(board, draftHere.anchor, rects)} target={draftTarget(board, draftHere.anchor, rects) ?? { x: 0, y: 0, w: 0, h: 0 }} draft />}
        </svg>
      )}

      {/* badges + rings on commented cards (always), spot pins */}
      {[...byCard.entries()].map(([cardId, e]) => {
        const card = board.cards.find((c) => c.id === cardId)
        if (!card) return null
        const unseen = me ? e.threads.some((t) => [t.root, ...t.replies].some((c) => c.author.email !== me.email && !seen[c.id])) : false
        const hidden = bubbles ? e.threads.filter((t) => !t.root.resolved && placement.get(t.key) === null).length : 0
        return (
          <div key={cardId} className="absolute" style={{ left: card.x, top: card.y, width: card.w, height: card.h }}>
            {hidden > 0 && <div className="absolute -inset-1.5 rounded-2xl border-2 border-dashed border-amber-400/80 comment-fade" />}
            <button
              data-nodrag
              data-badge={cardId}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation()
                setOpenThread({ boardId: board.id, anchorKey: `card:${cardId}` })
              }}
              title={`${e.threads.length} thread${e.threads.length === 1 ? '' : 's'} — click to read`}
              className={`pointer-events-auto absolute -left-2 -top-2 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-[11px] font-black shadow ring-2 ring-(--board-bg) comment-fade ${
                e.unresolved ? 'bg-frog-500 text-white' : 'bg-swamp-600 text-frog-200'
              } ${unseen ? 'animate-pulse' : ''}`}
            >
              💬{e.threads.length > 1 ? e.threads.length : ''}
            </button>
            {hidden > 0 && (
              <button
                data-nodrag
                data-badge={`${cardId}:hidden`}
                onPointerDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.stopPropagation()
                  setOpenThread({ boardId: board.id, anchorKey: `card:${cardId}` })
                }}
                onPointerEnter={(ev) => openCascade(cardId, ev.currentTarget)}
                onPointerLeave={closeCascadeSoon}
                title="Not enough room to show these without covering something — hover to list them, click to read"
                className="pointer-events-auto absolute -right-2 -top-3 flex h-6 items-center gap-1 rounded-full bg-amber-400 px-2 text-[11px] font-black text-black shadow ring-2 ring-(--board-bg) comment-fade"
              >
                💬 {hidden} more comment{hidden === 1 ? '' : 's'} ▾
              </button>
            )}
          </div>
        )
      })}
      {threads
        .filter((t) => !t.cardId && t.target)
        .map((t) => (
          <button
            key={t.key}
            data-nodrag
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation()
              setOpenThread({ boardId: board.id, anchorKey: t.anchor })
            }}
            className={`pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[12px] shadow ring-2 ring-(--board-bg) comment-fade ${t.root.resolved ? 'bg-swamp-600' : 'bg-frog-500 text-white'}`}
            style={{ left: t.target!.x, top: t.target!.y }}
            title="Comment on this spot"
          >
            💬
          </button>
        ))}

      {/* bubbles */}
      {bubbles &&
        threads.map((t) => {
          const p = shown.get(t.key)
          if (!p) return null
          return (
            <Bubble
              key={t.key}
              thread={t}
              place={p}
              verified={verified[t.root.id] !== false && verified[t.root.id] !== undefined}
              onSize={(h) => report(t.key, h)}
              onOpen={() => setOpenThread({ boardId: board.id, anchorKey: t.anchor })}
              onResolve={canResolve(t.root) ? () => resolveThread(t.root.id, true) : undefined}
            />
          )
        })}
      {Object.entries(leaving).map(([k, v]) => (
        <Bubble key={`leaving:${k}`} thread={v.thread} place={v.place} verified leaving onSize={() => {}} onOpen={() => {}} />
      ))}
      {bubbles && draftHere && <DraftBubble board={board} place={shown.get('draft') ?? fallbackPlace(board, draftHere.anchor, rects)} onSize={(h) => report('draft', h)} />}

      {/* cascade of threads for a crowded card */}
      {cascade && (
        <Popover anchor={cascade.el} onClose={() => setCascade(null)} sticky className="w-72 rounded-xl border border-(--hair) bg-swamp-800 p-1 shadow-2xl">
          <div
            onPointerEnter={() => {
              if (cascadeClose.current) clearTimeout(cascadeClose.current)
            }}
            onPointerLeave={closeCascadeSoon}
          >
          <div className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-wider text-frog-200/50">{byCard.get(cascade.cardId)?.threads.length} threads on this card — some don't fit around it</div>
          {(byCard.get(cascade.cardId)?.threads ?? []).map((t) => (
            <button
              key={t.key}
              onClick={() => setOpenThread({ boardId: board.id, anchorKey: t.anchor })}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1 text-left hover:bg-(--hover) ${t.root.resolved ? 'opacity-50' : ''}`}
            >
              <Avatar person={t.root.author} size={20} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px]">
                  <b>{t.root.author.name}</b> <span className="text-frog-200/50">{timeAgo(t.root.createdAt)}</span>
                </div>
                <div className="line-clamp-2 text-[12px] text-frog-100">{t.root.text}</div>
                {t.replies.length > 0 && <div className="text-[11px] text-frog-200/50">{t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}</div>}
              </div>
              {canResolve(t.root) && !t.root.resolved && (
                <span
                  role="button"
                  title="Resolve"
                  onClick={(e) => {
                    e.stopPropagation()
                    resolveThread(t.root.id, true)
                  }}
                  className="rounded px-1.5 py-0.5 text-[11px] font-bold text-frog-300 hover:bg-frog-700/60 hover:text-white"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
          </div>
        </Popover>
      )}
    </div>
  )
}

function draftTarget(board: Board, anchor: Comment['anchor'], rects: Record<string, Record<string, { y: number; h: number }>>): Rect | null {
  if (isCardAnchor(anchor)) {
    const card = board.cards.find((c) => c.id === anchor.cardId)
    if (!card) return null
    const row = anchor.itemId ? rects[card.id]?.[anchor.itemId] : undefined
    return row ? { x: card.x, y: card.y + row.y, w: card.w, h: row.h } : { x: card.x, y: card.y, w: card.w, h: card.h }
  }
  return { x: anchor.x, y: anchor.y, w: 0, h: 0 }
}
/** a draft must always be visible: if nothing fits, sit to the right of the target anyway */
function fallbackPlace(board: Board, anchor: Comment['anchor'], rects: Record<string, Record<string, { y: number; h: number }>>): Placement {
  const t = draftTarget(board, anchor, rects) ?? { x: 0, y: 0, w: 0, h: 0 }
  return { x: t.x + t.w + 14, y: t.y, w: BUBBLE_W, h: 110, side: 'right' }
}

/**
 * The bubble's tail, stretched to whatever the comment is about: a wedge whose base sits on the bubble's edge
 * (tucked 2 px inside, so the bubble hides it) and whose tip touches the target's edge — or the exact spot.
 * Same colour and outline as the bubble; only the two long edges are stroked.
 */
function Tail({ bubble, target, muted, draft }: { bubble: Rect; target: Rect; muted?: boolean; draft?: boolean }) {
  const tip = nearest(target, bubble) // where on the target's edge we point (the spot itself for 0×0 targets)
  const base = nearest(bubble, { x: tip.x, y: tip.y, w: 0, h: 0 })
  const onVertical = base.x <= bubble.x + 0.5 || base.x >= bubble.x + bubble.w - 0.5
  const half = 8
  const inset = 2
  let b1: { x: number; y: number }, b2: { x: number; y: number }
  if (onVertical) {
    const x = base.x <= bubble.x + 0.5 ? bubble.x + inset : bubble.x + bubble.w - inset
    const y = Math.max(bubble.y + half + 4, Math.min(bubble.y + bubble.h - half - 4, base.y))
    b1 = { x, y: y - half }
    b2 = { x, y: y + half }
  } else {
    const y = base.y <= bubble.y + 0.5 ? bubble.y + inset : bubble.y + bubble.h - inset
    const x = Math.max(bubble.x + half + 4, Math.min(bubble.x + bubble.w - half - 4, base.x))
    b1 = { x: x - half, y }
    b2 = { x: x + half, y }
  }
  const stroke = draft ? 'rgb(251 191 36)' : 'var(--board-line-sel)'
  return (
    <g opacity={muted ? 0.5 : 1}>
      <polygon points={`${b1.x},${b1.y} ${tip.x},${tip.y} ${b2.x},${b2.y}`} fill="var(--color-swamp-800)" />
      <path d={`M${b1.x},${b1.y} L${tip.x},${tip.y} L${b2.x},${b2.y}`} fill="none" stroke={stroke} strokeWidth={draft ? 2 : 1} strokeLinejoin="round" />
    </g>
  )
}

/** the point on rect `r`'s edge closest to the centre of `o` */
function nearest(r: Rect, o: Rect) {
  const cx = o.x + o.w / 2
  const cy = o.y + o.h / 2
  return { x: Math.max(r.x, Math.min(r.x + r.w, cx)), y: Math.max(r.y, Math.min(r.y + r.h, cy)) }
}

/** eases current positions towards the computed ones (new bubbles appear in place, moved ones glide) */
function useAnimatedPlacement(target: Map<string, Placement | null>): Map<string, Placement> {
  const [cur, setCur] = useState<Map<string, Placement>>(new Map())
  const targetRef = useRef(target)
  targetRef.current = target
  useEffect(() => {
    // new / removed bubbles: apply at once (also keeps things right in background tabs, where rAF is paused)
    setCur((prev) => {
      const next = new Map<string, Placement>()
      for (const [k, p] of target) if (p) next.set(k, prev.get(k) ?? p)
      return next
    })
    let raf = 0
    const step = () => {
      let moving = false
      setCur((prev) => {
        const next = new Map<string, Placement>()
        for (const [k, p] of targetRef.current) {
          if (!p) continue
          const c = prev.get(k)
          if (!c) {
            next.set(k, p)
            continue
          }
          const dx = p.x - c.x
          const dy = p.y - c.y
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) next.set(k, p)
          else {
            moving = true
            next.set(k, { ...p, x: c.x + dx * 0.22, y: c.y + dy * 0.22 })
          }
        }
        return next
      })
      // the updater above runs during React's render; give it a frame and keep going while anything still moves
      raf = requestAnimationFrame(() => {
        if (moving) step()
      })
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return cur
}

const Bubble = memo(function Bubble({ thread, place, verified, leaving = false, onSize, onOpen, onResolve }: { thread: Thread; place: Placement; verified: boolean; leaving?: boolean; onSize: (h: number) => void; onOpen: () => void; onResolve?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => onSize(el.offsetHeight))
    ro.observe(el)
    onSize(el.offsetHeight)
    return () => ro.disconnect()
  }, [onSize])
  const t = thread
  const last = t.replies[t.replies.length - 1]
  return (
    <div
      ref={ref}
      data-bubble={t.key}
      data-nodrag
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      data-leaving={leaving || undefined}
      className={`bubble group/bubble pointer-events-auto absolute cursor-pointer select-none rounded-lg bg-swamp-800 p-2 text-frog-50 shadow-xl ring-1 ring-(--board-line-sel) hover:ring-2 ${t.root.resolved ? 'opacity-50' : ''}`}
      style={{ left: place.x, top: place.y, width: place.w }}
    >
      <div className="flex items-center gap-1.5">
        <Avatar person={t.root.author} size={18} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{t.root.author.name}</span>
        <span className="text-[10px] text-frog-200/50">{timeAgo(t.root.createdAt)}</span>
        {!verified && <span className="rounded bg-swamp-600 px-1 text-[8px] font-bold uppercase text-frog-200/60">unverified</span>}
        {onResolve && !t.root.resolved && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onResolve()
            }}
            title="Resolve this thread"
            className="ml-0.5 rounded px-1 text-[11px] font-bold text-frog-300 opacity-0 transition-opacity hover:bg-frog-700/60 hover:text-white group-hover/bubble:opacity-100"
          >
            ✓
          </button>
        )}
      </div>
      <div className="mt-1 max-h-[8.5rem] overflow-hidden text-[12px] leading-snug [&_p]:m-0">
        <InlineMd text={t.root.text} />
      </div>
      {t.replies.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 border-t border-(--hair) pt-1 text-[11px] text-frog-200/70">
          <Avatar person={last.author} size={14} />
          <span className="truncate">
            {t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'} · last {last.author.name}
          </span>
        </div>
      )}
      {t.root.resolved && <div className="mt-1 text-[10px] font-bold uppercase text-frog-200/50">resolved</div>}
    </div>
  )
})

/**
 * The bubble's tail: an SVG wedge drawn in the bubble's colour with the same 1 px outline as the bubble, only on
 * its two outer edges (the base overlaps the bubble's ring so the outline reads as one shape).
 */
function DraftBubble({ board, place, onSize }: { board: Board; place: Placement; onSize: (h: number) => void }) {
  const draft = useReview((s) => s.draft)!
  const setDraft = useReview((s) => s.setDraft)
  const addComment = useReview((s) => s.addComment)
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => onSize(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [onSize])
  const post = async () => {
    if (!text.trim()) return
    const c = await addComment(board.id, draft.anchor, text, { reviewId: draft.reviewId })
    if (c) setDraft(null)
  }
  return (
    <div
      ref={ref}
      data-bubble="draft"
      data-nodrag
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="bubble pointer-events-auto absolute rounded-lg bg-swamp-800 p-2 text-frog-50 shadow-2xl ring-2 ring-amber-400"
      style={{ left: place.x, top: place.y, width: place.w }}
    >
      <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-amber-300">New comment{isCardAnchor(draft.anchor) && draft.anchor.itemId ? ' on this row' : isCardAnchor(draft.anchor) ? '' : ' on this spot'}</div>
      <MentionInput value={text} onChange={setText} onSubmit={post} onCancel={() => setDraft(null)} placeholder="Say something… (@ to mention, Enter to post)" autoFocus rows={3} />
      <div className="mt-1.5 flex justify-end gap-1">
        <button onClick={() => setDraft(null)} className="rounded px-2 py-0.5 text-[11px] font-semibold text-frog-200 hover:bg-(--hover-strong)">
          Cancel
        </button>
        <button onClick={post} disabled={!text.trim()} className="rounded bg-frog-500 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-frog-400 disabled:opacity-40">
          Post
        </button>
      </div>
    </div>
  )
}
