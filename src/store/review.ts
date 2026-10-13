/**
 * Review, comments, identity and notifications — all backed by files under `<workspace>/review/`
 * (see src/model/review.ts). Writes land in the working tree immediately and are committed on their own a few
 * seconds later (`Review: …` commits, never mixed with board edits), then pushed by the normal sync.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { abs, exists, readBytes, readText, writeBytes, writeText, type PeepoFS } from '../fs'
import { wp } from '../fs/wsroot'
import * as repo from '../git/repo'
import { newId } from '../model/types'
import {
  COMMENTS_DIR,
  PEOPLE_DIR,
  REVIEW_DIR,
  REVIEWS_DIR,
  STATE_DIR,
  VERDICTS_DIR,
  accountSchema,
  commentSchema,
  reviewRequestSchema,
  userStateSchema,
  verdictSchema,
  type Comment,
  type CommentAnchor,
  type Person,
  type ReviewRequest,
  type UserState,
  type Verdict,
} from '../model/review'
import { accountOf, personOfAccount, samePerson, userKey, type Account } from '../review/identity'
import { useSettings } from './settings'
import { deriveNotifications } from '../review/notifications'
import { useWorkspace } from './workspace'
import { toast } from './toast'

export type IdentityStatus =
  | { kind: 'guest' } // no GitHub token in this browser: boards can be read, nothing written
  | { kind: 'github'; account: Account }

export interface ReviewMode {
  on: boolean
  /** the request being answered, when entered from a notification */
  reviewId?: string
}

interface ReviewState {
  loaded: boolean
  /** HEAD the review files were last read at — a different HEAD means someone (or another tab) committed review activity */
  loadedHead: string | null
  accounts: Record<string, Account> // userKey → account
  pictures: Record<string, string> // userKey → object URL of the profile picture
  reviews: Record<string, ReviewRequest>
  verdicts: Record<string, Verdict> // `${reviewId}.${userKey}`
  comments: Record<string, Comment>
  states: Record<string, UserState> // userKey → state
  /** unique git commit authors (reviewer picker, mentions) */
  authors: Person[]
  identity: IdentityStatus
  mode: ReviewMode
  panelOpen: boolean
  /** resolved threads are hidden on the board unless this is on */
  showResolved: boolean
  /** thread (root comment id) currently open in the dialog */
  openThread: { boardId: string; anchorKey: string } | null
  /** a comment being written (not yet a file) */
  draft: { boardId: string; anchor: CommentAnchor; reviewId?: string } | null
  /** "Ask for review" dialog target */
  requestDialog: { boardId: string; targets: string[] } | null

  load: (fs: PeepoFS) => Promise<void>
  /** read the GitHub account out of the settings and make sure the repo knows about it */
  refreshIdentity: () => Promise<void>
  /** forget the token in this browser: back to being a guest */
  signOut: () => void
  savePicture: (webp: Uint8Array | null) => Promise<void>
  me: () => Person | null

  requestReview: (boardId: string, targets: string[], reviewers: Person[], message?: string) => Promise<ReviewRequest | null>
  closeReview: (id: string) => Promise<void>
  /** remove a review with its verdicts and comments (files of everyone involved) */
  deleteReview: (id: string) => Promise<void>
  giveVerdict: (reviewId: string, verdict: Verdict['verdict'], note?: string) => Promise<void>
  addComment: (boardId: string, anchor: CommentAnchor, text: string, opts?: { reviewId?: string; parentId?: string }) => Promise<Comment | null>
  editComment: (id: string, text: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  resolveThread: (rootId: string, resolved: boolean) => Promise<void>
  markSeen: (ids: string[]) => void
  markUnseen: (ids: string[]) => void
  /** take notifications off the panel (per user) */
  hideNotifications: (ids: string[]) => void
  muteThread: (rootId: string, muted: boolean) => void

  setMode: (mode: ReviewMode) => void
  setPanelOpen: (open: boolean) => void
  setShowResolved: (on: boolean) => void
  setOpenThread: (t: ReviewState['openThread']) => void
  setDraft: (d: ReviewState['draft']) => void
  setRequestDialog: (d: ReviewState['requestDialog']) => void

  /** commit whatever review files are waiting (debounced normally; call to flush) */
  commitNow: () => Promise<void>
}

const COMMIT_DELAY = 5000
let commitTimer: ReturnType<typeof setTimeout> | undefined
const pending = new Map<string, string>() // repo-relative path → message fragment

async function readDir(fs: PeepoFS, dir: string): Promise<string[]> {
  try {
    return await fs.promises.readdir(abs(fs, wp(dir)))
  } catch {
    return []
  }
}

export const anchorKey = (a: CommentAnchor) => ('cardId' in a ? `card:${a.cardId}${a.itemId ? `#${a.itemId}` : ''}` : `spot:${Math.round(a.x)},${Math.round(a.y)}`)

export const useReview = create<ReviewState>((set, get) => {
  const fsOf = () => useWorkspace.getState().fs
  /** the person writing right now, or a nudge to sign in (comments and reviews are GitHub-only) */
  const meOrToast = (): Person | null => {
    const id = get().identity
    if (id.kind !== 'github') {
      toast.action('Comments and reviews need a GitHub account.', 'Sign in', () => window.dispatchEvent(new CustomEvent('peeponote:identify')))
      return null
    }
    if (!useWorkspace.getState().canWrite) {
      toast.err('Read only: GitHub does not let this account write to the repo.', 'peepoSad')
      return null
    }
    return { name: id.account.name, email: id.account.email, login: id.account.login }
  }
  const now = () => new Date().toISOString()

  async function writeJson(rel: string, obj: unknown, msg: string) {
    const fs = fsOf()
    if (!fs) return
    await writeText(fs, abs(fs, wp(rel)), JSON.stringify(obj, null, 2))
    pending.set(wp(rel), msg)
    schedule()
  }
  async function removeFile(rel: string, msg: string) {
    const fs = fsOf()
    if (!fs) return
    const p = abs(fs, wp(rel))
    if (await exists(fs, p)) await fs.promises.unlink(p)
    pending.set(wp(rel), msg)
    schedule()
  }
  function schedule() {
    clearTimeout(commitTimer)
    commitTimer = setTimeout(() => void get().commitNow(), COMMIT_DELAY)
  }

  /**
   * Before 1.7 an account was a password-derived key file named after an email. When that person signs in with
   * GitHub we adopt their old account: the new file keeps the picture and the day they joined, and everything
   * they wrote (comments, reviews, verdicts, their seen-state) is rewritten to carry their login, so threads,
   * notifications and "my own comments" keep working. Only ever their own files; everyone else migrates
   * themselves when they sign in.
   */
  function inheritFromPassword(accounts: Record<string, Account>, ghEmail: string): Account | undefined {
    const old = Object.values(accounts).filter((a) => !a.login)
    if (!old.length) return undefined
    const mine = old.find((a) => a.email.toLowerCase() === ghEmail.toLowerCase()) ?? old.find((a) => a.email.toLowerCase() === useSettings.getState().authorEmail.trim().toLowerCase())
    return mine ? { ...mine, formerEmail: mine.email.toLowerCase() } : undefined
  }

  async function adoptPasswordAccount(account: Account) {
    const former = account.formerEmail
    const fs = fsOf()
    if (!former || !fs) return
    const oldKey = userKey(former)
    const newKey = userKey(account)
    if (oldKey === newKey) return
    const mine = (p: Person | undefined) => !!p && !p.login && p.email.trim().toLowerCase() === former
    const stamp = (p: Person) => ({ ...p, login: account.login, name: account.name })
    const msg = `moved ${account.name} to their GitHub account`

    for (const r of Object.values(get().reviews)) {
      if (!mine(r.requester)) continue
      const next: ReviewRequest = { ...r, requester: stamp(r.requester), sig: undefined }
      set((st) => ({ reviews: { ...st.reviews, [r.id]: next } }))
      await writeJson(`${REVIEWS_DIR}/${r.id}.json`, next, msg)
    }
    for (const [k, v] of Object.entries(get().verdicts)) {
      if (!mine(v.reviewer)) continue
      const next: Verdict = { ...v, reviewer: stamp(v.reviewer), sig: undefined }
      const nextKey = k.replace(new RegExp(`\\.${oldKey}$`), `.${newKey}`)
      set((st) => {
        const verdicts = { ...st.verdicts }
        delete verdicts[k]
        verdicts[nextKey] = next
        return { verdicts }
      })
      await writeJson(`${VERDICTS_DIR}/${nextKey}.json`, next, msg)
      if (nextKey !== k) await removeFile(`${VERDICTS_DIR}/${k}.json`, msg)
    }
    for (const c of Object.values(get().comments)) {
      const authored = mine(c.author)
      const resolvedByMe = mine(c.resolved?.by)
      if (!authored && !resolvedByMe) continue
      const next: Comment = { ...c, author: authored ? stamp(c.author) : c.author, resolved: c.resolved ? { ...c.resolved, by: resolvedByMe ? stamp(c.resolved.by) : c.resolved.by } : undefined, sig: undefined }
      set((st) => ({ comments: { ...st.comments, [c.id]: next } }))
      await writeJson(`${COMMENTS_DIR}/${c.id}.json`, next, msg)
    }
    const oldState = get().states[oldKey]
    if (oldState) {
      const next: UserState = { ...oldState, me: personOfAccount(account), updatedAt: now(), sig: undefined }
      set((st) => {
        const states = { ...st.states }
        delete states[oldKey]
        states[newKey] = next
        return { states }
      })
      await writeJson(`${STATE_DIR}/${newKey}.json`, next, msg)
      await removeFile(`${STATE_DIR}/${oldKey}.json`, msg)
    }
    // the picture moves next to the new account file
    if (account.picture) {
      try {
        const bytes = await readBytes(fs, abs(fs, wp(`${PEOPLE_DIR}/${oldKey}.webp`)))
        await writeBytes(fs, abs(fs, wp(`${PEOPLE_DIR}/${newKey}.webp`)), bytes)
        pending.set(wp(`${PEOPLE_DIR}/${newKey}.webp`), msg)
        await removeFile(`${PEOPLE_DIR}/${oldKey}.webp`, msg)
      } catch {
        /* no picture file after all */
      }
    }
    set((st) => {
      const accounts = { ...st.accounts }
      delete accounts[oldKey]
      return { accounts }
    })
    await removeFile(`${PEOPLE_DIR}/${oldKey}.json`, msg)
    toast.ok(`Your comments now belong to @${account.login}`, 'peepoClap')
  }

  return {
    loaded: false,
    loadedHead: null,
    accounts: {},
    pictures: {},
    reviews: {},
    verdicts: {},
    comments: {},
    states: {},
    authors: [],
    identity: { kind: 'guest' },
    mode: { on: false },
    panelOpen: false,
    showResolved: false,
    openThread: null,
    draft: null,
    requestDialog: null,

    load: async (fs) => {
      const parse = async <T,>(dir: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, key: (f: string, v: T) => string) => {
        const out: Record<string, T> = {}
        for (const f of await readDir(fs, dir)) {
          if (!f.endsWith('.json')) continue
          try {
            const r = schema.safeParse(JSON.parse(await readText(fs, abs(fs, wp(`${dir}/${f}`)))))
            if (r.success && r.data) out[key(f.slice(0, -5), r.data)] = r.data
          } catch (e) {
            console.warn(`review: skipping ${dir}/${f}`, e)
          }
        }
        return out
      }
      const [accounts, reviews, verdicts, comments, states] = await Promise.all([
        parse<Account>(PEOPLE_DIR, accountSchema, (f) => f),
        parse<ReviewRequest>(REVIEWS_DIR, reviewRequestSchema, (_f, r) => r.id),
        parse<Verdict>(VERDICTS_DIR, verdictSchema, (f) => f),
        parse<Comment>(COMMENTS_DIR, commentSchema, (_f, c) => c.id),
        parse<UserState>(STATE_DIR, userStateSchema, (f) => f),
      ])
      // profile pictures → object URLs (revoke the old ones)
      const pictures: Record<string, string> = {}
      for (const [k, a] of Object.entries(accounts)) {
        if (!a.picture) continue
        try {
          const bytes = await readBytes(fs, abs(fs, wp(`${PEOPLE_DIR}/${k}.webp`)))
          pictures[k] = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/webp' }))
        } catch {
          /* missing picture */
        }
      }
      for (const url of Object.values(get().pictures)) URL.revokeObjectURL(url)
      const authors: Person[] = []
      const seenAuthors = new Set<string>()
      for (const c of await repo.log(fs, 300)) {
        const a = c.commit.author
        const e = a.email.trim().toLowerCase()
        if (!e || seenAuthors.has(e)) continue
        seenAuthors.add(e)
        authors.push({ name: a.name, email: e })
      }
      const wasLoaded = get().loaded
      const me = get().me()
      const before = wasLoaded && me ? deriveNotifications(get(), useWorkspace.getState().boards, me).filter((n) => n.unseen) : []
      set({ accounts, reviews, verdicts, comments, states, pictures, authors, loadedHead: await repo.headOid(fs) })
      await get().refreshIdentity()
      set({ loaded: true }) // only now: the identity prompt must see the settled identity, not the guest default
      // review files written but never committed (the tab died inside the 5 s window): commit them now
      if (!wasLoaded) {
        const left = await repo.changedPaths(fs, wp(REVIEW_DIR)).catch(() => [] as string[])
        if (left.length) {
          for (const p of left) if (!pending.has(p)) pending.set(p, 'activity from before a restart')
          schedule()
        }
      }
      // housekeeping: finished reviews (closed, or approved by everyone) older than 10 days go away by themselves
      if (get().identity.kind === 'github') {
        const cutoff = Date.now() - 10 * 24 * 3600 * 1000
        const all = Object.values(get().comments)
        const stale = Object.values(get().reviews).filter((r) => {
          const vs = Object.values(get().verdicts).filter((v) => v.reviewId === r.id)
          const finished = r.status === 'closed' || (r.reviewers.length > 0 && r.reviewers.every((p) => vs.some((v) => samePerson(v.reviewer, p) && v.verdict === 'approved')))
          if (!finished) return false
          const last = Math.max(Date.parse(r.updatedAt), ...vs.map((v) => Date.parse(v.at)), ...all.filter((c) => c.reviewId === r.id).map((c) => Date.parse(c.createdAt)))
          return last < cutoff
        })
        for (const r of stale) await get().deleteReview(r.id)
        if (stale.length) pending.forEach((_, k) => pending.set(k, `cleaned up ${stale.length} finished review${stale.length === 1 ? '' : 's'} older than 10 days`))
      }
      // something new arrived with a pull → say so (one toast, opens the panel)
      if (wasLoaded && me) {
        const known = new Set(before.map((n) => n.id))
        const fresh = deriveNotifications(get(), useWorkspace.getState().boards, me).filter((n) => n.unseen && !known.has(n.id))
        if (fresh.length === 1) toast.action(`${fresh[0].who.email ? fresh[0].who.name + ' ' : ''}${fresh[0].what}`, 'Open', () => set({ panelOpen: true }), 'peepoHey')
        else if (fresh.length > 1) toast.action(`${fresh.length} new notifications`, 'Open', () => set({ panelOpen: true }), 'peepoHey')
      }
    },

    refreshIdentity: async () => {
      const gh = useSettings.getState().github
      if (!gh) {
        set({ identity: { kind: 'guest' } })
        return
      }
      const k = userKey({ name: gh.name, email: gh.email, login: gh.login })
      const known = get().accounts[k]
      const account = accountOf(gh, known ?? inheritFromPassword(get().accounts, gh.email))
      set((s) => ({ accounts: { ...s.accounts, [k]: account }, identity: { kind: 'github', account } }))
      // keep the committed account in step with GitHub (new name, new avatar, first time here), when we may write
      const stale = !known || known.name !== account.name || known.avatarUrl !== account.avatarUrl || known.login !== account.login || known.githubId !== account.githubId
      if (stale && useWorkspace.getState().canWrite) {
        await writeJson(`${PEOPLE_DIR}/${k}.json`, account, known ? `updated ${account.name}'s account` : `${account.name} joined`)
        if (!known) await adoptPasswordAccount(account)
      }
    },

    signOut: () => {
      useSettings.getState().set({ token: '', github: null })
      set({ identity: { kind: 'guest' } })
      toast.info('Signed out of GitHub. Boards stay as they are; saving and comments need signing in again.', 'peepoSad')
    },

    savePicture: async (webp) => {
      const id = get().identity
      const fs = fsOf()
      if (id.kind !== 'github' || !fs) return
      const k = userKey(id.account)
      const rel = `${PEOPLE_DIR}/${k}.webp`
      if (webp) await writeBytes(fs, abs(fs, wp(rel)), webp)
      else await removeFile(rel, 'picture removed')
      pending.set(wp(rel), webp ? 'profile picture' : 'picture removed')
      const account: Account = { ...id.account, picture: !!webp }
      await writeJson(`${PEOPLE_DIR}/${k}.json`, account, webp ? `profile picture for ${account.name}` : `picture removed`)
      const old = get().pictures[k]
      if (old) URL.revokeObjectURL(old)
      const pictures = { ...get().pictures }
      if (webp) pictures[k] = URL.createObjectURL(new Blob([webp as BlobPart], { type: 'image/webp' }))
      else delete pictures[k]
      set((s) => ({ accounts: { ...s.accounts, [k]: account }, pictures, identity: { kind: 'github', account } }))
    },

    me: () => {
      const id = get().identity
      return id.kind === 'github' ? personOfAccount(id.account) : null
    },

    requestReview: async (boardId, targets, reviewers, message) => {
      const me = meOrToast()
      if (!me) return null
      const r: ReviewRequest = { id: newId(), boardId, targets, requester: me, reviewers, message: message?.trim() || undefined, status: 'open', createdAt: now(), updatedAt: now() }
      set((s) => ({ reviews: { ...s.reviews, [r.id]: r } }))
      const board = useWorkspace.getState().boards[boardId]
      await writeJson(`${REVIEWS_DIR}/${r.id}.json`, r, `asked ${reviewers.map((p) => p.name).join(', ')} to review ${targets.length ? `${targets.length} card${targets.length === 1 ? '' : 's'} on` : ''} "${board?.name ?? boardId}"`)
      return r
    },

    closeReview: async (id) => {
      const me = meOrToast()
      const r = get().reviews[id]
      if (!me || !r) return
      const next: ReviewRequest = { ...r, status: r.status === 'open' ? 'closed' : 'open', updatedAt: now(), closedAt: r.status === 'open' ? now() : undefined, closedBy: r.status === 'open' ? me : undefined }
      set((s) => ({ reviews: { ...s.reviews, [id]: next } }))
      await writeJson(`${REVIEWS_DIR}/${id}.json`, next, `${next.status === 'closed' ? 'closed' : 'reopened'} the review of "${useWorkspace.getState().boards[r.boardId]?.name ?? ''}"`)
    },

    deleteReview: async (id) => {
      const r = get().reviews[id]
      if (!r) return
      const board = useWorkspace.getState().boards[r.boardId]?.name ?? ''
      const commentIds = Object.values(get().comments).filter((c) => c.reviewId === id).map((c) => c.id)
      const verdictKeys = Object.keys(get().verdicts).filter((k) => k.startsWith(`${id}.`))
      set((s) => {
        const reviews = { ...s.reviews }
        delete reviews[id]
        const comments = { ...s.comments }
        for (const c of commentIds) delete comments[c]
        const verdicts = { ...s.verdicts }
        for (const k of verdictKeys) delete verdicts[k]
        return { reviews, comments, verdicts, mode: s.mode.reviewId === id ? { on: s.mode.on } : s.mode }
      })
      const msg = `deleted the review of "${board}"`
      await removeFile(`${REVIEWS_DIR}/${id}.json`, msg)
      for (const k of verdictKeys) await removeFile(`${VERDICTS_DIR}/${k}.json`, msg)
      for (const c of commentIds) await removeFile(`${COMMENTS_DIR}/${c}.json`, msg)
    },

    giveVerdict: async (reviewId, verdict, note) => {
      const me = meOrToast()
      if (!me) return
      const v: Verdict = { reviewId, reviewer: me, verdict, note: note?.trim() || undefined, at: now() }
      const k = `${reviewId}.${userKey(me)}`
      set((s) => ({ verdicts: { ...s.verdicts, [k]: v } }))
      const r = get().reviews[reviewId]
      await writeJson(`${VERDICTS_DIR}/${k}.json`, v, `${verdict === 'approved' ? 'approved' : 'requested changes on'} "${useWorkspace.getState().boards[r?.boardId ?? '']?.name ?? ''}"`)
    },

    addComment: async (boardId, anchor, text, opts) => {
      const me = meOrToast()
      if (!me || !text.trim()) return null
      const c: Comment = { id: newId(), boardId, anchor, reviewId: opts?.reviewId, parentId: opts?.parentId, author: me, text: text.trim(), createdAt: now() }
      set((s) => ({ comments: { ...s.comments, [c.id]: c } }))
      const board = useWorkspace.getState().boards[boardId]
      await writeJson(`${COMMENTS_DIR}/${c.id}.json`, c, `${opts?.parentId ? 'reply' : 'comment'} on "${board?.name ?? boardId}"`)
      return c
    },

    editComment: async (id, text) => {
      const me = meOrToast()
      const c = get().comments[id]
      if (!me || !c || !samePerson(c.author, me)) return
      const next: Comment = { ...c, text: text.trim(), editedAt: now() }
      set((s) => ({ comments: { ...s.comments, [id]: next } }))
      await writeJson(`${COMMENTS_DIR}/${id}.json`, next, `edited a comment on "${useWorkspace.getState().boards[c.boardId]?.name ?? ''}"`)
    },

    deleteComment: async (id) => {
      const me = meOrToast()
      const c = get().comments[id]
      if (!me || !c || !samePerson(c.author, me)) return
      const gone = [id, ...Object.values(get().comments).filter((x) => x.parentId === id && samePerson(x.author, me)).map((x) => x.id)]
      set((s) => {
        const comments = { ...s.comments }
        for (const g of gone) delete comments[g]
        return { comments }
      })
      for (const g of gone) await removeFile(`${COMMENTS_DIR}/${g}.json`, `deleted a comment on "${useWorkspace.getState().boards[c.boardId]?.name ?? ''}"`)
    },

    resolveThread: async (rootId, resolved) => {
      const me = meOrToast()
      const c = get().comments[rootId]
      if (!me || !c) return
      const next: Comment = { ...c, resolved: resolved ? { by: me, at: now() } : undefined }
      set((s) => ({ comments: { ...s.comments, [rootId]: next } }))
      await writeJson(`${COMMENTS_DIR}/${rootId}.json`, next, `${resolved ? 'resolved' : 'reopened'} a thread on "${useWorkspace.getState().boards[c.boardId]?.name ?? ''}"`)
    },

    markSeen: (ids) => {
      const id = get().identity
      if (id.kind !== 'github' || !ids.length) return
      const k = userKey(id.account)
      const cur = get().states[k] ?? { me: personOfAccount(id.account), seen: {}, muted: [], updatedAt: now() }
      const fresh = ids.filter((x) => !cur.seen[x])
      if (!fresh.length) return
      const t = now()
      const next: UserState = { ...cur, me: personOfAccount(id.account), seen: { ...cur.seen, ...Object.fromEntries(fresh.map((x) => [x, t])) }, updatedAt: t }
      set((s) => ({ states: { ...s.states, [k]: next } }))
      void writeJson(`${STATE_DIR}/${k}.json`, next, 'seen')
    },

    markUnseen: (ids) => {
      const id = get().identity
      if (id.kind !== 'github' || !ids.length) return
      const k = userKey(id.account)
      const cur = get().states[k]
      if (!cur) return
      const seen = { ...cur.seen }
      let n = 0
      for (const x of ids) if (x in seen) (delete seen[x], n++)
      if (!n) return
      const next: UserState = { ...cur, seen, updatedAt: now() }
      set((s) => ({ states: { ...s.states, [k]: next } }))
      void writeJson(`${STATE_DIR}/${k}.json`, next, 'seen')
    },

    hideNotifications: (ids) => {
      const id = get().identity
      if (id.kind !== 'github' || !ids.length) return
      const k = userKey(id.account)
      const cur = get().states[k] ?? { me: personOfAccount(id.account), seen: {}, muted: [], updatedAt: now() }
      const next: UserState = { ...cur, hidden: [...new Set([...(cur.hidden ?? []), ...ids])], updatedAt: now() }
      set((s) => ({ states: { ...s.states, [k]: next } }))
      void writeJson(`${STATE_DIR}/${k}.json`, next, 'seen')
    },

    muteThread: (rootId, muted) => {
      const id = get().identity
      if (id.kind !== 'github') return
      const k = userKey(id.account)
      const cur = get().states[k] ?? { me: personOfAccount(id.account), seen: {}, muted: [], updatedAt: now() }
      const next: UserState = { ...cur, muted: muted ? [...new Set([...cur.muted, rootId])] : cur.muted.filter((x) => x !== rootId), updatedAt: now() }
      set((s) => ({ states: { ...s.states, [k]: next } }))
      void writeJson(`${STATE_DIR}/${k}.json`, next, muted ? 'muted a thread' : 'unmuted a thread')
    },

    setMode: (mode) => set({ mode, draft: null }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setShowResolved: (showResolved) => set({ showResolved }),
    setOpenThread: (openThread) => set({ openThread }),
    setDraft: (draft) => set({ draft }),
    setRequestDialog: (requestDialog) => set({ requestDialog }),

    commitNow: async () => {
      clearTimeout(commitTimer)
      const ws = useWorkspace.getState()
      const fs = ws.fs
      if (!fs || !pending.size) return
      if (ws.busy) {
        schedule() // a save/sync is running — try again shortly
        return
      }
      const paths = [...pending.keys()]
      const msgs = [...new Set(pending.values())]
      pending.clear()
      // "seen" alone is noise in the title; anything else names the action
      const meaningful = msgs.filter((m) => m !== 'seen')
      const title = meaningful.length === 0 ? 'Review: seen' : meaningful.length === 1 ? `Review: ${meaningful[0]}` : `Review: ${meaningful[0]} (+${meaningful.length - 1} more)`
      try {
        const who = get().me() ?? { name: useSettings.getState().authorName, email: useSettings.getState().authorEmail }
        if (!(await repo.commitPaths(fs, paths, title, who))) return // nothing differed from HEAD after all
        await ws.refreshGit()
        // offline: the commit is in; sync() itself notes it for when the connection returns
        if (ws.remoteUrl && useSettings.getState().token) await ws.sync({ silent: true })
      } catch (e) {
        for (const p of paths) pending.set(p, msgs[0] ?? 'review')
        toast.fail('Could not save review activity', e, { paths })
      }
    },
  }
})

// the last few seconds of review activity must not be lost when the tab closes
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => void useReview.getState().commitNow())

/** the signed-in me, stable across renders (null for guests) */
export function useMe(): Person | null {
  const id = useReview((s) => s.identity)
  return useMemo(() => (id.kind === 'github' ? personOfAccount(id.account) : null), [id])
}
