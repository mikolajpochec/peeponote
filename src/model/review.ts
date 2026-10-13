/**
 * Review & comments live as files under `<workspace>/review/`. One file per object, one writer per file, so
 * two people never edit the same file and merges stay trivial:
 *
 *   review/people/<login>.json             Account (GitHub login, name, email, avatar)  — its owner
 *   review/people/<login>.webp             profile picture, 256×256                     — its owner
 *   review/reviews/<reviewId>.json         ReviewRequest                                — the requester
 *   review/verdicts/<reviewId>.<userKey>.json  Verdict                                  — that reviewer
 *   review/comments/<commentId>.json       Comment                                      — its author
 *   review/state/<userKey>.json            UserState (seen / muted)                     — that user
 *
 * The author of every object is a GitHub account (see src/review/identity.ts). Only people GitHub lets push can
 * add a file here at all, so the login on a comment carries the repo's own permissions.
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

const person = z.object({ name: z.string(), email: z.string(), login: z.string().optional() })

export const accountSchema = z
  .object({
    name: z.string(),
    email: z.string(),
    login: z.string().optional(),
    githubId: z.number().optional(),
    avatarUrl: z.string().optional(),
    createdAt: z.string(),
    picture: z.boolean().optional(),
    formerEmail: z.string().optional(),
    /** password accounts from before 1.7 still carry these; they are read, never written */
    salt: z.string().optional(),
    key: z.string().optional(),
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
    /** notifications removed from the panel (their ids) */
    hidden: z.array(z.string()).optional(),
    updatedAt: z.string(),
    sig: z.string().optional(),
  })
  .passthrough()
export type UserState = z.infer<typeof userStateSchema>

export const isCardAnchor = (a: CommentAnchor): a is { cardId: string; itemId?: string } => 'cardId' in a
