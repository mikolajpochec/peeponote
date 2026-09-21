import { useMemo } from 'react'
import { useMe, useReview } from '../store/review'
import { useWorkspace } from '../store/workspace'
import { samePerson, userKey, type Person } from './identity'

export interface KnownPerson extends Person {
  /** has committed an account (password) → can be verified */
  hasAccount: boolean
}

/** emails hidden in this workspace (Settings → Workspace → People) */
export const hiddenEmails = () => new Set((useWorkspace.getState().meta?.settings?.hiddenPeople ?? []).map((e) => e.trim().toLowerCase()))

/** Everyone we know about: committed accounts, people who marked things seen, and git commit authors. */
export function listPeople(opts: { includeHidden?: boolean } = {}): KnownPerson[] {
  const r = useReview.getState()
  const hidden = opts.includeHidden ? new Set<string>() : hiddenEmails()
  const out = new Map<string, KnownPerson>()
  const add = (p: Person, hasAccount: boolean) => {
    const email = p.email.trim().toLowerCase()
    if (!email.includes('@') || (email.endsWith('@users.noreply.github.com') && /\[bot\]/.test(email)) || hidden.has(email)) return
    const cur = out.get(email)
    if (!cur) out.set(email, { name: p.name.trim() || email, email, hasAccount })
    else if (hasAccount && !cur.hasAccount) out.set(email, { ...cur, name: p.name.trim() || cur.name, hasAccount: true })
  }
  for (const a of Object.values(r.accounts)) add(a, true)
  for (const s of Object.values(r.states)) add(s.me, false)
  for (const a of r.authors) add(a, false)
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** reactive version, minus me */
export function usePeople(excludeMe = true, includeHidden = false): KnownPerson[] {
  const accounts = useReview((s) => s.accounts)
  const states = useReview((s) => s.states)
  const authors = useReview((s) => s.authors)
  const hiddenList = useWorkspace((s) => s.meta?.settings?.hiddenPeople)
  const me = useMe()
  return useMemo(() => listPeople({ includeHidden }).filter((p) => !excludeMe || !samePerson(p, me)), [accounts, states, authors, me, excludeMe, includeHidden, hiddenList])
}

/** does `text` mention this person? `@Name`, `@[Full Name]`, `@first-token`, accent/case-insensitive */
export function mentions(text: string, p: Person): boolean {
  if (!text.includes('@')) return false
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  const t = fold(text)
  const name = fold(p.name.trim())
  if (!name) return false
  if (t.includes(`@[${name}]`)) return true
  const first = name.split(/\s+/)[0]
  const joined = name.replace(/\s+/g, '_')
  return new RegExp(`@(${escapeRe(joined)}|${escapeRe(first)})(?![\\p{L}\\p{N}_])`, 'u').test(t) || t.includes(`@${fold(p.email.split('@')[0])}`)
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** what to insert for a mention */
export const mentionToken = (p: Person) => (/\s/.test(p.name.trim()) ? `@[${p.name.trim()}]` : `@${p.name.trim()}`)

export const keyOf = (p: Person) => userKey(p.email)
