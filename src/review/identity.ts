/**
 * Who wrote what: your GitHub account.
 *
 * The repo is just files, so the name on a comment has to mean something. peeponote asks GitHub whose token
 * this is (`GET /user`) and writes that account into `review/people/<login>.json`; only people GitHub lets
 * push can put anything there in the first place, so the login on a comment is as good as the repo's own
 * permissions. Without a token you are a guest: boards can be read, nothing can be written.
 *
 * Before 1.7 identity was a password-derived key pair. Those accounts are migrated to GitHub ones by email
 * (see `migrateAccounts` in src/store/review.ts); comments from that era keep their name and are marked as
 * written before the move.
 */
import type { GhIdentity } from '../store/settings'

export interface Person {
  name: string
  email: string
  /** the GitHub account, on everything written from 1.7 on; absent on comments from before */
  login?: string
}

export interface Account extends Person {
  /** GitHub's own numeric id: survives a rename of the login */
  githubId?: number
  /** github.com avatar, used when no picture is committed next to this file */
  avatarUrl?: string
  createdAt: string
  /** true when a profile picture sits next to the account file */
  picture?: boolean
  /** the email of the password account this person used before 1.7, so their old comments still find them */
  formerEmail?: string
}

/** file-name-safe id for a person: their GitHub login, or (old objects) their email */
export const userKey = (p: Person | string): string => {
  const raw = typeof p === 'string' ? p : p.login || p.email
  return raw
    .trim()
    .toLowerCase()
    .replace('@', '_at_')
    .replace(/[^a-z0-9._-]+/g, '_')
}

/** the same human: by GitHub login when both have one, by email otherwise */
export function samePerson(a: Person | null | undefined, b: Person | null | undefined): boolean {
  if (!a || !b) return false
  if (a.login && b.login) return a.login.toLowerCase() === b.login.toLowerCase()
  const ae = a.email?.trim().toLowerCase()
  const be = b.email?.trim().toLowerCase()
  return !!ae && ae === be
}

/** the person to put on everything I write */
export const personOf = (gh: GhIdentity): Person => ({ name: gh.name || gh.login, email: gh.email, login: gh.login })

export function accountOf(gh: GhIdentity, before?: Account): Account {
  return {
    ...personOf(gh),
    githubId: gh.id,
    avatarUrl: gh.avatarUrl,
    createdAt: before?.createdAt ?? new Date().toISOString(),
    picture: before?.picture,
    formerEmail: before?.formerEmail,
  }
}

/** initials + a stable colour for people without a picture */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
export function personColor(key: string): string {
  let h = 0
  for (const ch of key.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 45% 45%)`
}

/** the author to write into a file, from a committed account */
export const personOfAccount = (a: Account): Person => ({ name: a.name, email: a.email, login: a.login })
