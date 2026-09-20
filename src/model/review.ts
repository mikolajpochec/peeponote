/**
 * Review & comments live as files under `<workspace>/review/`. One file per object, one writer per file, so
 * two people never edit the same file and merges stay trivial:
 *
 *   review/people/<userKey>.json           Account (name, email, salt, public key)      — its owner
 *   review/people/<userKey>.webp           profile picture, 256×256                     — its owner
 *   review/reviews/<reviewId>.json         ReviewRequest                                — the requester
 *   review/verdicts/<reviewId>.<userKey>.json  Verdict                                  — that reviewer
 *   review/comments/<commentId>.json       Comment                                      — its author
 *   review/state/<userKey>.json            UserState (seen / muted)                     — that user
 *
 * Every object is signed by its author (see src/review/identity.ts); readers show "unverified" when the
 * signature is missing or doesn't match the author's account.
 */
import { z } from 'zod'
import type { Person } from '../review/identity'
export type { Person }

export const REVIEW_DIR = 'review'
export const PEOPLE_DIR = `${REVIEW_DIR}/people`
export const REVIEWS_DIR = `${REVIEW_DIR}/reviews`
export const VERDICTS_DIR = `${REVIEW_DIR}/verdicts`
export const COMMENTS_DIR = `${REVIEW_DIR}/comments`
export const STATE_DIR = `${REVIEW_DIR}/state`

const person = z.object({ name: z.string(), email: z.string() })

export const accountSchema = z
  .object({
    name: z.string(),
    email: z.string(),
    salt: z.string(),
    key: z.string(),
    createdAt: z.string(),
    picture: z.boolean().optional(),
  })
  .passthrough()

export const reviewRequestSchema = z
  .object({
    id: z.string(),
    boardId: z.string(),
    targets: z.array(z.string()),
    requester: person,
    reviewers: z.array(person),
    message: z.string().optional(),
    status: z.enum(['open', 'closed']),
    createdAt: z.string(),
    updatedAt: z.string(),
    closedAt: z.string().optional(),
    closedBy: person.optional(),
    sig: z.string().optional(),
  })
  .passthrough()
export type ReviewRequest = z.infer<typeof reviewRequestSchema>

export const verdictSchema = z
  .object({
    reviewId: z.string(),
    reviewer: person,
    verdict: z.enum(['approved', 'changes-requested']),
    note: z.string().optional(),
    at: z.string(),
    sig: z.string().optional(),
  })
  .passthrough()
export type Verdict = z.infer<typeof verdictSchema>

export const anchorSchema = z.union([z.object({ cardId: z.string(), itemId: z.string().optional() }), z.object({ x: z.number(), y: z.number() })])
export type CommentAnchor = z.infer<typeof anchorSchema>

export const commentSchema = z
  .object({
    id: z.string(),
    boardId: z.string(),
    anchor: anchorSchema,
    reviewId: z.string().optional(),
    parentId: z.string().optional(),
    author: person,
    text: z.string(),
    createdAt: z.string(),
    editedAt: z.string().optional(),
    resolved: z.object({ by: person, at: z.string() }).optional(),
    sig: z.string().optional(),
  })
  .passthrough()
export type Comment = z.infer<typeof commentSchema>

export const userStateSchema = z
  .object({
    me: person,
    seen: z.record(z.string(), z.string()),
    muted: z.array(z.string()),
    updatedAt: z.string(),
    sig: z.string().optional(),
  })
  .passthrough()
export type UserState = z.infer<typeof userStateSchema>

/** the fields a signature covers, per object type (everything except `sig` and things others may touch) */
export const signedFields = {
  review: (r: ReviewRequest) => ({ id: r.id, boardId: r.boardId, targets: r.targets, requester: r.requester, reviewers: r.reviewers, message: r.message, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, closedAt: r.closedAt, closedBy: r.closedBy }),
  verdict: (v: Verdict) => ({ reviewId: v.reviewId, reviewer: v.reviewer, verdict: v.verdict, note: v.note, at: v.at }),
  comment: (c: Comment) => ({ id: c.id, boardId: c.boardId, anchor: c.anchor, reviewId: c.reviewId, parentId: c.parentId, author: c.author, text: c.text, createdAt: c.createdAt, editedAt: c.editedAt, resolved: c.resolved }),
  state: (s: UserState) => ({ me: s.me, seen: s.seen, muted: s.muted, updatedAt: s.updatedAt }),
}

export const isCardAnchor = (a: CommentAnchor): a is { cardId: string; itemId?: string } => 'cardId' in a
