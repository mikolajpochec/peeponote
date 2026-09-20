/**
 * Review, comments, identity and notifications — all backed by files under `<workspace>/review/`
 * (see src/model/review.ts). Writes land in the working tree immediately and are committed on their own a few
 * seconds later (`Review: …` commits, never mixed with board edits), then pushed by the normal sync.
 */
import { create } from 'zustand'
import { abs, exists, readBytes, readText, writeBytes, writeText, type PeepoFS } from '../fs'
import { wp } from '../fs/wsroot'
import * as repo from '../git/repo'
import { newId } from '../model/types'
import {
  COMMENTS_DIR,
  PEOPLE_DIR,
  REVIEWS_DIR,
  STATE_DIR,
  VERDICTS_DIR,
  accountSchema,
  commentSchema,
  reviewRequestSchema,
  signedFields,
  userStateSchema,
  verdictSchema,
  type Comment,
  type CommentAnchor,
  type Person,
  type ReviewRequest,
  type UserState,
  type Verdict,
} from '../model/review'
import { deriveKeys, newSalt, samePerson, sign, userKey, verify, type Account, type Keys } from '../review/identity'
import { useSettings } from './settings'
import { useWorkspace } from './workspace'
import { toast } from './toast'

export type IdentityStatus =
  | { kind: 'guest' } // no password on this device
  | { kind: 'verified'; keys: Keys; account: Account }
  | { kind: 'mismatch' } // password on this device doesn't fit the committed account (typo, or someone else's account)

export interface ReviewMode {
  on: boolean
  /** the request being answered, when entered from a notification */
  reviewId?: string
}

interface ReviewState {
  loaded: boolean
  accounts: Record<string, Account> // userKey → account
  pictures: Record<string, string> // userKey → object URL of the profile picture
  reviews: Record<string, ReviewRequest>
  verdicts: Record<string, Verdict> // `${reviewId}.${userKey}`
  comments: Record<string, Comment>
  states: Record<string, UserState> // userKey → state
  /** object id → signature checks out against the author's account */
  verified: Record<string, boolean>
  identity: IdentityStatus
  mode: ReviewMode
  panelOpen: boolean
  /** thread (root comment id) currently open in the dialog */
  openThread: { boardId: string; anchorKey: string } | null
  /** a comment being written (not yet a file) */
  draft: { boardId: string; anchor: CommentAnchor; reviewId?: string } | null

  load: (fs: PeepoFS) => Promise<void>
  /** derive keys from the stored password and check them against the committed account */
  refreshIdentity: () => Promise<void>
  /** new account for name/email with this password (fails when one exists) */
  createAccount: (name: string, email: string, password: string) => Promise<string | null>
  /** existing account: does this password fit? stores it locally on success */
  login: (account: Account, password: string) => Promise<boolean>
  logout: () => void
  savePicture: (webp: Uint8Array | null) => Promise<void>
  me: () => Person | null

  requestReview: (boardId: string, targets: string[], reviewers: Person[], message?: string) => Promise<ReviewRequest | null>
  closeReview: (id: string) => Promise<void>
  giveVerdict: (reviewId: string, verdict: Verdict['verdict'], note?: string) => Promise<void>
  addComment: (boardId: string, anchor: CommentAnchor, text: string, opts?: { reviewId?: string; parentId?: string }) => Promise<Comment | null>
  editComment: (id: string, text: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  resolveThread: (rootId: string, resolved: boolean) => Promise<void>
  markSeen: (ids: string[]) => void
  muteThread: (rootId: string, muted: boolean) => void

  setMode: (mode: ReviewMode) => void
  setPanelOpen: (open: boolean) => void
  setOpenThread: (t: ReviewState['openThread']) => void
  setDraft: (d: ReviewState['draft']) => void

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
  const meOrToast = (): { person: Person; keys: Keys } | null => {
    const id = get().identity
    if (id.kind === 'verified') return { person: { name: id.account.name, email: id.account.email }, keys: id.keys }
    toast.action('Identify yourself to comment or review.', 'Set password', () => window.dispatchEvent(new CustomEvent('peeponote:identify')))
    return null
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

  async function verifyAll(s: Pick<ReviewState, 'accounts' | 'reviews' | 'verdicts' | 'comments' | 'states'>) {
    const verified: Record<string, boolean> = {}
    const keyOf = (p: Person) => s.accounts[userKey(p.email)]?.key
    const check = async (id: string, p: Person, sig: string | undefined, fields: Record<string, unknown>) => {
      const k = keyOf(p)
      verified[id] = !!k && (await verify(k, sig, fields))
    }
    await Promise.all([
      ...Object.values(s.reviews).map((r) => check(r.id, r.requester, r.sig, signedFields.review(r))),
      ...Object.entries(s.verdicts).map(([k, v]) => check(`verdict:${k}`, v.reviewer, v.sig, signedFields.verdict(v))),
      ...Object.values(s.comments).map((c) => check(c.id, c.author, c.sig, signedFields.comment(c))),
      ...Object.entries(s.states).map(([k, st]) => check(`state:${k}`, st.me, st.sig, signedFields.state(st))),
    ])
    return verified
  }

  return {
    loaded: false,
    accounts: {},
    pictures: {},
    reviews: {},
    verdicts: {},
    comments: {},
    states: {},
    verified: {},
    identity: { kind: 'guest' },
    mode: { on: false },
    panelOpen: false,
    openThread: null,
    draft: null,

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
      const verified = await verifyAll({ accounts, reviews, verdicts, comments, states })
      set({ loaded: true, accounts, reviews, verdicts, comments, states, pictures, verified })
      await get().refreshIdentity()
    },

    refreshIdentity: async () => {
      const { authorName, authorEmail, identityPassword } = useSettings.getState()
      if (!identityPassword || !authorEmail.trim()) {
        set({ identity: { kind: 'guest' } })
        return
      }
      const account = get().accounts[userKey(authorEmail)]
      if (!account) {
        // password set here but no account committed yet (fresh repo, or the account file hasn't arrived): create it
        const salt = newSalt()
        const keys = await deriveKeys(authorName, authorEmail, identityPassword, salt)
        const acc: Account = { name: authorName.trim(), email: authorEmail.trim().toLowerCase(), salt, key: keys.key, createdAt: now() }
        await writeJson(`${PEOPLE_DIR}/${userKey(acc.email)}.json`, acc, `account for ${acc.name}`)
        set((s) => ({ accounts: { ...s.accounts, [userKey(acc.email)]: acc }, identity: { kind: 'verified', keys, account: acc } }))
        return
      }
      const keys = await deriveKeys(account.name, account.email, identityPassword, account.salt)
      set({ identity: keys.key === account.key ? { kind: 'verified', keys, account } : { kind: 'mismatch' } })
    },

    createAccount: async (name, email, password) => {
      const e = email.trim().toLowerCase()
      if (!name.trim() || !e.includes('@')) return 'Name and a real email are needed.'
      if (password.length < 4) return 'Pick a longer password (4+ characters).'
      if (get().accounts[userKey(e)]) return 'Someone already set a password for this email — log in instead.'
      useSettings.getState().set({ authorName: name.trim(), authorEmail: e, identityPassword: password })
      await get().refreshIdentity()
      return get().identity.kind === 'verified' ? null : 'Could not create the account.'
    },

    login: async (account, password) => {
      const keys = await deriveKeys(account.name, account.email, password, account.salt)
      if (keys.key !== account.key) return false
      useSettings.getState().set({ authorName: account.name, authorEmail: account.email, identityPassword: password })
      set({ identity: { kind: 'verified', keys, account } })
      return true
    },

    logout: () => {
      useSettings.getState().set({ identityPassword: '' })
      set({ identity: { kind: 'guest' } })
    },

    savePicture: async (webp) => {
      const id = get().identity
      const fs = fsOf()
      if (id.kind !== 'verified' || !fs) return
      const k = userKey(id.account.email)
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
      set((s) => ({ accounts: { ...s.accounts, [k]: account }, pictures, identity: { kind: 'verified', keys: id.keys, account } }))
    },

    me: () => {
      const id = get().identity
      return id.kind === 'verified' ? { name: id.account.name, email: id.account.email } : null
    },

    requestReview: async (boardId, targets, reviewers, message) => {
      const me = meOrToast()
      if (!me) return null
      const r: ReviewRequest = { id: newId(), boardId, targets, requester: me.person, reviewers, message: message?.trim() || undefined, status: 'open', createdAt: now(), updatedAt: now() }
      r.sig = await sign(me.keys, signedFields.review(r))
      set((s) => ({ reviews: { ...s.reviews, [r.id]: r }, verified: { ...s.verified, [r.id]: true } }))
      const board = useWorkspace.getState().boards[boardId]
      await writeJson(`${REVIEWS_DIR}/${r.id}.json`, r, `asked ${reviewers.map((p) => p.name).join(', ')} to review ${targets.length ? `${targets.length} card${targets.length === 1 ? '' : 's'} on` : ''} "${board?.name ?? boardId}"`)
      return r
    },

    closeReview: async (id) => {
      const me = meOrToast()
      const r = get().reviews[id]
      if (!me || !r) return
      const next: ReviewRequest = { ...r, status: r.status === 'open' ? 'closed' : 'open', updatedAt: now(), closedAt: r.status === 'open' ? now() : undefined, closedBy: r.status === 'open' ? me.person : undefined }
      // only the requester's key verifies this file; someone else closing it (allowed by the workspace setting) shows as unverified — fine
      next.sig = samePerson(me.person, r.requester) ? await sign(me.keys, signedFields.review(next)) : undefined
      set((s) => ({ reviews: { ...s.reviews, [id]: next }, verified: { ...s.verified, [id]: !!next.sig } }))
      await writeJson(`${REVIEWS_DIR}/${id}.json`, next, `${next.status === 'closed' ? 'closed' : 'reopened'} the review of "${useWorkspace.getState().boards[r.boardId]?.name ?? ''}"`)
    },

    giveVerdict: async (reviewId, verdict, note) => {
      const me = meOrToast()
      if (!me) return
      const v: Verdict = { reviewId, reviewer: me.person, verdict, note: note?.trim() || undefined, at: now() }
      v.sig = await sign(me.keys, signedFields.verdict(v))
      const k = `${reviewId}.${userKey(me.person.email)}`
      set((s) => ({ verdicts: { ...s.verdicts, [k]: v }, verified: { ...s.verified, [`verdict:${k}`]: true } }))
      const r = get().reviews[reviewId]
      await writeJson(`${VERDICTS_DIR}/${k}.json`, v, `${verdict === 'approved' ? 'approved' : 'requested changes on'} "${useWorkspace.getState().boards[r?.boardId ?? '']?.name ?? ''}"`)
    },

    addComment: async (boardId, anchor, text, opts) => {
      const me = meOrToast()
      if (!me || !text.trim()) return null
      const c: Comment = { id: newId(), boardId, anchor, reviewId: opts?.reviewId, parentId: opts?.parentId, author: me.person, text: text.trim(), createdAt: now() }
      c.sig = await sign(me.keys, signedFields.comment(c))
      set((s) => ({ comments: { ...s.comments, [c.id]: c }, verified: { ...s.verified, [c.id]: true } }))
      const board = useWorkspace.getState().boards[boardId]
      await writeJson(`${COMMENTS_DIR}/${c.id}.json`, c, `${opts?.parentId ? 'reply' : 'comment'} on "${board?.name ?? boardId}"`)
      return c
    },

    editComment: async (id, text) => {
      const me = meOrToast()
      const c = get().comments[id]
      if (!me || !c || !samePerson(c.author, me.person)) return
      const next: Comment = { ...c, text: text.trim(), editedAt: now() }
      next.sig = await sign(me.keys, signedFields.comment(next))
      set((s) => ({ comments: { ...s.comments, [id]: next } }))
      await writeJson(`${COMMENTS_DIR}/${id}.json`, next, `edited a comment on "${useWorkspace.getState().boards[c.boardId]?.name ?? ''}"`)
    },

    deleteComment: async (id) => {
      const me = meOrToast()
      const c = get().comments[id]
      if (!me || !c || !samePerson(c.author, me.person)) return
      const gone = [id, ...Object.values(get().comments).filter((x) => x.parentId === id && samePerson(x.author, me.person)).map((x) => x.id)]
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
      const next: Comment = { ...c, resolved: resolved ? { by: me.person, at: now() } : undefined }
      // the author's key signs it; another person resolving (workspace setting) leaves the root unverified-by-signature
      next.sig = samePerson(me.person, c.author) ? await sign(me.keys, signedFields.comment(next)) : c.sig
      set((s) => ({ comments: { ...s.comments, [rootId]: next }, verified: { ...s.verified, [rootId]: samePerson(me.person, c.author) ? true : s.verified[rootId] } }))
      await writeJson(`${COMMENTS_DIR}/${rootId}.json`, next, `${resolved ? 'resolved' : 'reopened'} a thread on "${useWorkspace.getState().boards[c.boardId]?.name ?? ''}"`)
    },

    markSeen: (ids) => {
      const id = get().identity
      if (id.kind !== 'verified' || !ids.length) return
      const k = userKey(id.account.email)
      const cur = get().states[k] ?? { me: { name: id.account.name, email: id.account.email }, seen: {}, muted: [], updatedAt: now() }
      const fresh = ids.filter((x) => !cur.seen[x])
      if (!fresh.length) return
      const t = now()
      const next: UserState = { ...cur, me: { name: id.account.name, email: id.account.email }, seen: { ...cur.seen, ...Object.fromEntries(fresh.map((x) => [x, t])) }, updatedAt: t }
      set((s) => ({ states: { ...s.states, [k]: next } }))
      void sign(id.keys, signedFields.state(next)).then((sig) => writeJson(`${STATE_DIR}/${k}.json`, { ...next, sig }, 'seen'))
    },

    muteThread: (rootId, muted) => {
      const id = get().identity
      if (id.kind !== 'verified') return
      const k = userKey(id.account.email)
      const cur = get().states[k] ?? { me: { name: id.account.name, email: id.account.email }, seen: {}, muted: [], updatedAt: now() }
      const next: UserState = { ...cur, muted: muted ? [...new Set([...cur.muted, rootId])] : cur.muted.filter((x) => x !== rootId), updatedAt: now() }
      set((s) => ({ states: { ...s.states, [k]: next } }))
      void sign(id.keys, signedFields.state(next)).then((sig) => writeJson(`${STATE_DIR}/${k}.json`, { ...next, sig }, muted ? 'muted a thread' : 'unmuted a thread'))
    },

    setMode: (mode) => set({ mode, draft: null }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setOpenThread: (openThread) => set({ openThread }),
    setDraft: (draft) => set({ draft }),

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
        await repo.commitPaths(fs, paths, title, who)
        await ws.refreshGit()
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
