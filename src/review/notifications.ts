import { useMemo } from 'react'
import type { Board, Card } from '../model/types'
import type { Comment, Person, ReviewRequest, Verdict } from '../model/review'
import { stripMd } from '../nav/links'
import { useMe, useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { samePerson, userKey } from './identity'
import { mentions } from './people'

export type NotificationKind = 'review-request' | 'verdict' | 'comment' | 'reply' | 'mention' | 'resolved'

export interface Notification {
  /** what gets marked seen */
  id: string
  kind: NotificationKind
  at: string
  who: Person
  boardId: string
  cardId?: string
  /** thread root for comment-ish rows */
  rootId?: string
  reviewId?: string
  /** one line: "asked you to review 5 cards", "replied to you", … */
  what: string
  /** excerpt (comment text, message) */
  excerpt?: string
  unseen: boolean
  verified: boolean
}

/** the review's shown state, from its verdicts + comments */
export function reviewStatus(r: ReviewRequest, verdicts: Verdict[], comments: Comment[]): 'requested' | 'in progress' | 'approved' | 'changes requested' | 'closed' {
  if (r.status === 'closed') return 'closed'
  if (verdicts.some((v) => v.verdict === 'changes-requested')) return 'changes requested'
  if (r.reviewers.length && r.reviewers.every((p) => verdicts.some((v) => samePerson(v.reviewer, p) && v.verdict === 'approved'))) return 'approved'
  if (comments.some((c) => c.reviewId === r.id && !samePerson(c.author, r.requester))) return 'in progress'
  return 'requested'
}

export function textOfCard(c: Card): string {
  switch (c.type) {
    case 'text':
      return c.text
    case 'note':
      return c.md
    case 'todo':
      return [c.title, ...c.items.map((i) => i.text)].join('\n')
    case 'shape':
      return c.label
    case 'link':
      return c.title
    case 'story':
      return [c.title, ...Object.values(c.fields), ...(c.options ?? []).map((o) => `${o.text} ${o.note ?? ''}`), ...(c.lines ?? []).map((l) => l.text)].join('\n')
    default:
      return ''
  }
}

const excerpt = (s: string, n = 90) => {
  // plain words: no `### ` / `**` in a notification row
  const t = s
    .split('\n')
    .map((l) => stripMd(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

export function deriveNotifications(
  s: { reviews: Record<string, ReviewRequest>; verdicts: Record<string, Verdict>; comments: Record<string, Comment>; states: Record<string, { seen: Record<string, string>; muted: string[]; hidden?: string[] }>; verified: Record<string, boolean> },
  boards: Record<string, Board>,
  me: Person | null,
): Notification[] {
  if (!me) return []
  const mine = s.states[userKey(me.email)]
  const seen = mine?.seen ?? {}
  const muted = new Set(mine?.muted ?? [])
  const hidden = new Set(mine?.hidden ?? [])
  const out: Notification[] = []
  const comments = Object.values(s.comments)
  const rootOf = (c: Comment): Comment => (c.parentId && s.comments[c.parentId] ? rootOf(s.comments[c.parentId]) : c)
  const boardName = (id: string) => boards[id]?.name ?? 'a board'

  // reviews I'm asked to do
  for (const r of Object.values(s.reviews)) {
    if (samePerson(r.requester, me) || !r.reviewers.some((p) => samePerson(p, me))) continue
    const n = r.targets.length
    out.push({
      id: r.id,
      kind: 'review-request',
      at: r.createdAt,
      who: r.requester,
      boardId: r.boardId,
      cardId: r.targets[0],
      reviewId: r.id,
      what: `asked you to review ${n ? `${n} card${n === 1 ? '' : 's'} on` : ''} ${boardName(r.boardId)}${r.status === 'closed' ? ' (closed)' : ''}`,
      excerpt: r.message ? excerpt(r.message) : undefined,
      unseen: !seen[r.id],
      verified: !!s.verified[r.id],
    })
  }
  // verdicts on my requests
  for (const [k, v] of Object.entries(s.verdicts)) {
    const r = s.reviews[v.reviewId]
    if (!r || !samePerson(r.requester, me) || samePerson(v.reviewer, me)) continue
    const id = `verdict:${k}`
    out.push({
      id,
      kind: 'verdict',
      at: v.at,
      who: v.reviewer,
      boardId: r.boardId,
      cardId: r.targets[0],
      reviewId: r.id,
      what: `${v.verdict === 'approved' ? 'approved' : 'requested changes on'} your review of ${boardName(r.boardId)}`,
      excerpt: v.note ? excerpt(v.note) : undefined,
      unseen: !seen[id],
      verified: !!s.verified[id],
    })
  }
  // comments by others
  for (const c of comments) {
    if (samePerson(c.author, me)) continue
    const root = rootOf(c)
    if (muted.has(root.id)) continue
    const inMyThread = samePerson(root.author, me) || comments.some((x) => x.id !== c.id && rootOf(x).id === root.id && samePerson(x.author, me))
    const inMyReview = !!c.reviewId && samePerson(s.reviews[c.reviewId]?.requester, me)
    const mentioned = mentions(c.text, me)
    const kind: NotificationKind = mentioned ? 'mention' : c.parentId && inMyThread ? 'reply' : 'comment'
    const cardId = 'cardId' in c.anchor ? c.anchor.cardId : undefined
    const target = cardId ? excerpt(textOfCard(boards[c.boardId]?.cards.find((x) => x.id === cardId) ?? ({ type: 'shape', label: '' } as Card)), 30) : ''
    out.push({
      id: c.id,
      kind,
      at: c.createdAt,
      who: c.author,
      boardId: c.boardId,
      cardId,
      rootId: root.id,
      reviewId: c.reviewId,
      what: mentioned ? `mentioned you on ${boardName(c.boardId)}` : kind === 'reply' ? 'replied to you' : `commented on ${target ? `"${target}"` : 'a spot'}${inMyReview ? ' in your review' : ''} · ${boardName(c.boardId)}`,
      excerpt: excerpt(c.text),
      unseen: !seen[c.id],
      verified: !!s.verified[c.id],
    })
    // someone resolved my thread
    if (c.resolved && samePerson(root.author, me) && !samePerson(c.resolved.by, me) && root.id === c.id) {
      const id = `resolved:${c.id}:${c.resolved.at}`
      out.push({ id, kind: 'resolved', at: c.resolved.at, who: c.resolved.by, boardId: c.boardId, cardId, rootId: c.id, what: 'resolved your thread', unseen: !seen[id], verified: true })
    }
  }
  // @mentions written on the boards themselves
  for (const b of Object.values(boards)) {
    for (const c of b.cards) {
      if (!mentions(textOfCard(c), me)) continue
      const id = `mention:${c.id}`
      out.push({ id, kind: 'mention', at: seen[id] ?? '', who: { name: 'Someone', email: '' }, boardId: b.id, cardId: c.id, what: `you're mentioned in "${excerpt(textOfCard(c), 40)}" on ${b.name}`, unseen: !seen[id], verified: true })
    }
  }
  return out.filter((n) => !hidden.has(n.id)).sort((a, b) => (a.unseen === b.unseen ? (b.at || '').localeCompare(a.at || '') : a.unseen ? -1 : 1))
}

export function useNotifications(): Notification[] {
  const reviews = useReview((s) => s.reviews)
  const verdicts = useReview((s) => s.verdicts)
  const comments = useReview((s) => s.comments)
  const states = useReview((s) => s.states)
  const verified = useReview((s) => s.verified)
  const me = useMe()
  const boards = useWorkspace((s) => s.boards)
  return useMemo(() => deriveNotifications({ reviews, verdicts, comments, states, verified }, boards, me), [reviews, verdicts, comments, states, verified, boards, me])
}

export const useUnseenCount = () => useNotifications().filter((n) => n.unseen).length
