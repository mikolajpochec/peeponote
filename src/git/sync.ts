/**
 * Sync = fetch + decide. Works over either transport:
 *  - 'api'   → GitHub REST (no proxy), see githubApi.ts
 *  - 'proxy' → git smart-HTTP through a CORS proxy (isomorphic-git)
 * Merges are done here, at the card level, because boards are JSON: two people editing different
 * cards on the same board must not be a "conflict".
 */
import git, { TREE, type WalkerEntry } from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import type { PeepoFS } from '../fs'
import type { Board, Card, Connector } from '../model/types'
import { BOARDS_DIR, WORKSPACE_FILE } from '../model/types'
import { unwp } from '../fs/wsroot'
import { NotFastForwardError, ghFetch, ghPush, parseGitHubUrl, type Progress } from './githubApi'
import { currentBranch, headOid, type GitIdentity, type RemoteAuth } from './repo'

export type TransportPref = 'auto' | 'api' | 'proxy'
export type Transport = 'api' | 'proxy'

export interface SyncCtx {
  fs: PeepoFS
  remoteUrl: string
  auth: RemoteAuth
  transport: Transport
  who: GitIdentity
}

export function chooseTransport(remoteUrl: string | null | undefined, pref: TransportPref): Transport {
  if (pref === 'proxy') return 'proxy'
  if (pref === 'api') return 'api'
  return parseGitHubUrl(remoteUrl) ? 'api' : 'proxy'
}

function authFor(auth: RemoteAuth) {
  const token = auth.token.trim()
  return {
    corsProxy: auth.corsProxy?.trim() || undefined,
    onAuth: token
      ? () => ({ username: auth.username?.trim() || token, password: auth.username?.trim() ? token : 'x-oauth-basic' })
      : undefined,
    onAuthFailure: () => ({ cancel: true }),
  }
}

async function ghTarget(ctx: SyncCtx) {
  const gh = parseGitHubUrl(ctx.remoteUrl)
  if (!gh) throw new Error('The API transport only works with github.com remotes — switch to the proxy transport in Settings.')
  return { ...gh, branch: await currentBranch(ctx.fs), token: ctx.auth.token.trim() }
}

/** Download remote objects and update refs/remotes/origin/<branch>. Returns the remote head (null if empty). */
export async function fetchRemote(ctx: SyncCtx, progress: Progress = () => {}): Promise<string | null> {
  const { fs } = ctx
  const branch = await currentBranch(fs)
  if (ctx.transport === 'api') return ghFetch(fs, await ghTarget(ctx), progress)
  progress('fetching…')
  try {
    await git.fetch({ fs, http, dir: fs.dir, remote: 'origin', ref: branch, singleBranch: true, tags: false, ...authFor(ctx.auth) })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (/empty|Could not find|no such ref|not found/i.test(msg)) return null
    throw e
  }
  try {
    return await git.resolveRef({ fs, dir: fs.dir, ref: `refs/remotes/origin/${branch}` })
  } catch {
    return null
  }
}

export async function pushRemote(ctx: SyncCtx, progress: Progress = () => {}, force = false): Promise<void> {
  const { fs } = ctx
  const branch = await currentBranch(fs)
  if (ctx.transport === 'api') {
    await ghPush(fs, await ghTarget(ctx), progress, force)
    return
  }
  progress('pushing…')
  const res = await git.push({ fs, http, dir: fs.dir, remote: 'origin', ref: branch, remoteRef: branch, force, ...authFor(ctx.auth) })
  if (!res.ok) {
    if (/not.*fast.?forward|rejected|fetch first/i.test(res.error ?? '')) throw new NotFastForwardError()
    throw new Error(res.error || 'push rejected')
  }
}

export type Relation = 'same' | 'ahead' | 'behind' | 'diverged' | 'remote-empty' | 'local-empty'

export interface SyncState {
  relation: Relation
  local: string | null
  remote: string | null
  /** commits only we have / only the remote has */
  ahead: number
  behind: number
  /** display names of the people behind the remote-only commits (filled by the store) */
  who?: string
  /** the local tree has unsaved edits — merging must wait for a Save */
  dirty?: boolean
}

export async function compare(fs: PeepoFS, local: string | null, remote: string | null): Promise<SyncState> {
  const base = { local, remote, ahead: 0, behind: 0 }
  if (!remote) return { ...base, relation: local ? 'remote-empty' : 'same' }
  if (!local) return { ...base, relation: 'local-empty' }
  if (local === remote) return { ...base, relation: 'same' }
  const dir = fs.dir
  const [ours, theirs] = await Promise.all([git.log({ fs, dir, ref: local }), git.log({ fs, dir, ref: remote })])
  const theirSet = new Set(theirs.map((c) => c.oid))
  const ourSet = new Set(ours.map((c) => c.oid))
  const ahead = ours.filter((c) => !theirSet.has(c.oid)).length
  const behind = theirs.filter((c) => !ourSet.has(c.oid)).length
  const relation: Relation = ahead && behind ? 'diverged' : ahead ? 'ahead' : 'behind'
  return { local, remote, ahead, behind, relation }
}

/** Move the local branch (and working tree) to `sha`. Used for fast-forward and "take theirs". */
export async function resetTo(fs: PeepoFS, sha: string): Promise<void> {
  const branch = await currentBranch(fs)
  await git.writeRef({ fs, dir: fs.dir, ref: `refs/heads/${branch}`, value: sha, force: true })
  await git.checkout({ fs, dir: fs.dir, ref: branch, force: true })
}

// ---------- card-level merge ----------

export type Prefer = 'ours' | 'theirs'

interface FileVersions {
  base?: string
  ours?: string
  theirs?: string
}

async function fileMap(fs: PeepoFS, base: string | undefined, ours: string, theirs: string): Promise<Map<string, FileVersions>> {
  const dir = fs.dir
  const trees = [TREE({ ref: ours }), TREE({ ref: theirs })]
  if (base) trees.push(TREE({ ref: base }))
  const rows = (await git.walk({
    fs,
    dir,
    trees,
    map: async (path: string, entries: (WalkerEntry | null)[]) => {
      const [o, t, b] = entries
      const type = await (o ?? t ?? b)?.type()
      if (type !== 'blob') return path === '.' ? undefined : { path, dir: true }
      return { path, ours: await o?.oid(), theirs: await t?.oid(), base: await b?.oid() }
    },
  })) as ({ path: string; dir?: true } & FileVersions)[]
  const out = new Map<string, FileVersions>()
  for (const r of rows) if (r && !r.dir) out.set(r.path, { base: r.base, ours: r.ours, theirs: r.theirs })
  return out
}

function byId<T extends { id: string }>(xs: T[]): Map<string, T> {
  return new Map(xs.map((x) => [x.id, x]))
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Three-way merge of a list keyed by id: modify beats delete, both-modified goes to `prefer`. */
function mergeList<T extends { id: string }>(base: T[] | undefined, ours: T[], theirs: T[], prefer: Prefer): { items: T[]; conflicts: number } {
  const b = byId(base ?? [])
  const o = byId(ours)
  const t = byId(theirs)
  const ids = new Set([...o.keys(), ...t.keys()])
  const items: T[] = []
  let conflicts = 0
  for (const id of ids) {
    const bo = b.get(id)
    const oo = o.get(id)
    const to = t.get(id)
    if (oo && to) {
      if (same(oo, to)) items.push(oo)
      else if (bo && same(oo, bo)) items.push(to)
      else if (bo && same(to, bo)) items.push(oo)
      else {
        conflicts++
        items.push(prefer === 'ours' ? oo : to)
      }
    } else if (oo) {
      // only ours has it: theirs deleted it (keep only if we changed it), or we added it
      if (!bo || !same(oo, bo)) items.push(oo)
    } else if (to) {
      if (!bo || !same(to, bo)) items.push(to)
    }
  }
  return { items, conflicts }
}

function mergeScalar<T>(base: T | undefined, ours: T, theirs: T, prefer: Prefer): T {
  if (same(ours, theirs)) return ours
  if (base !== undefined && same(ours, base)) return theirs
  if (base !== undefined && same(theirs, base)) return ours
  return prefer === 'ours' ? ours : theirs
}

export function mergeBoardJson(base: string | undefined, ours: string, theirs: string, prefer: Prefer): { json: string; conflicts: number } {
  const b = base ? (JSON.parse(base) as Board) : undefined
  const o = JSON.parse(ours) as Board
  const t = JSON.parse(theirs) as Board
  const cards = mergeList<Card>(b?.cards, o.cards, t.cards, prefer)
  const connectors = mergeList<Connector>(b?.connectors ?? [], o.connectors ?? [], t.connectors ?? [], prefer)
  const merged: Board = {
    ...o,
    name: mergeScalar(b?.name, o.name, t.name, prefer),
    style: mergeScalar(b?.style, o.style, t.style, prefer),
    cards: cards.items,
    connectors: connectors.items,
  }
  // connectors must point at surviving cards
  const alive = new Set(merged.cards.map((c) => c.id))
  merged.connectors = merged.connectors.filter((k) => (!('cardId' in k.from) || alive.has(k.from.cardId)) && (!('cardId' in k.to) || alive.has(k.to.cardId)))
  return { json: JSON.stringify(merged, null, 2), conflicts: cards.conflicts + connectors.conflicts }
}

export function mergeJsonShallow(base: string | undefined, ours: string, theirs: string, prefer: Prefer): string {
  const b = base ? (JSON.parse(base) as Record<string, unknown>) : undefined
  const o = JSON.parse(ours) as Record<string, unknown>
  const t = JSON.parse(theirs) as Record<string, unknown>
  const out: Record<string, unknown> = { ...(prefer === 'ours' ? t : o), ...(prefer === 'ours' ? o : t) }
  for (const k of new Set([...Object.keys(o), ...Object.keys(t)])) out[k] = mergeScalar(b?.[k], o[k], t[k], prefer)
  return JSON.stringify(out, null, 2)
}

export interface MergeResult {
  sha: string
  conflicts: number
  files: number
}

/** Create a merge commit of ours + theirs with card-level resolution, check it out. */
export async function mergeRemote(fs: PeepoFS, ours: string, theirs: string, prefer: Prefer, who: GitIdentity, progress: Progress = () => {}, dryRun = false): Promise<MergeResult> {
  const dir = fs.dir
  progress('finding common ancestor…')
  const bases = await git.findMergeBase({ fs, dir, oids: [ours, theirs] })
  const base = bases[0] as string | undefined
  const files = await fileMap(fs, base, ours, theirs)
  const result = new Map<string, string>() // path → blob oid
  let conflicts = 0
  let changed = 0
  const text = async (oid: string) => new TextDecoder().decode((await git.readBlob({ fs, dir, oid })).blob)

  for (const [path, v] of files) {
    const { base: b, ours: o, theirs: t } = v
    let pick: string | undefined
    if (o === t) pick = o
    else if (o === b) pick = t // only theirs changed (or deleted)
    else if (t === b) pick = o // only ours changed (or deleted)
    else if (!o || !t) pick = o ?? t // modified on one side, deleted on the other: keep the modification
    else {
      // both modified
      changed++
      const rel = unwp(path)
      if (rel && rel.startsWith(`${BOARDS_DIR}/`) && rel.endsWith('.json')) {
        progress(`merging ${path}…`)
        const m = mergeBoardJson(b ? await text(b) : undefined, await text(o), await text(t), prefer)
        conflicts += m.conflicts
        pick = await git.writeBlob({ fs, dir, blob: new TextEncoder().encode(m.json) })
      } else if (rel === WORKSPACE_FILE) {
        const json = mergeJsonShallow(b ? await text(b) : undefined, await text(o), await text(t), prefer)
        pick = await git.writeBlob({ fs, dir, blob: new TextEncoder().encode(json) })
      } else {
        conflicts++
        pick = prefer === 'ours' ? o : t
      }
    }
    if (pick) result.set(path, pick)
  }

  // dry run: only report how many cards clash (blobs written above are harmless loose objects)
  if (dryRun) return { sha: '', conflicts, files: changed }

  progress('writing merge commit…')
  const tree = await writeTreeFromMap(fs, result)
  const sha = await git.writeCommit({
    fs,
    dir,
    commit: {
      message: `Merge remote changes${conflicts ? ` (${conflicts} conflict${conflicts === 1 ? '' : 's'} resolved, preferring ${prefer === 'ours' ? 'mine' : 'theirs'})` : ''}\n`,
      tree,
      parent: [ours, theirs],
      author: person(who),
      committer: person(who),
    },
  })
  await resetTo(fs, sha)
  return { sha, conflicts, files: changed }
}

function person(who: GitIdentity) {
  const now = new Date()
  return { name: who.name || 'peepo', email: who.email || 'peepo@peeponote.local', timestamp: Math.floor(now.getTime() / 1000), timezoneOffset: now.getTimezoneOffset() }
}

/** path → blob oid  ⇒  nested tree objects, returns root tree oid */
async function writeTreeFromMap(fs: PeepoFS, files: Map<string, string>): Promise<string> {
  const dir = fs.dir
  type Node = { blobs: Map<string, string>; dirs: Map<string, Node> }
  const root: Node = { blobs: new Map(), dirs: new Map() }
  for (const [path, oid] of files) {
    const parts = path.split('/')
    let n = root
    for (const p of parts.slice(0, -1)) n = n.dirs.get(p) ?? n.dirs.set(p, { blobs: new Map(), dirs: new Map() }).get(p)!
    n.blobs.set(parts[parts.length - 1], oid)
  }
  const write = async (n: Node): Promise<string> => {
    const entries: { mode: string; path: string; oid: string; type: 'blob' | 'tree' }[] = []
    for (const [name, oid] of n.blobs) entries.push({ mode: '100644', path: name, oid, type: 'blob' })
    for (const [name, child] of n.dirs) entries.push({ mode: '040000', path: name, oid: await write(child), type: 'tree' })
    return git.writeTree({ fs, dir, tree: entries })
  }
  return write(root)
}

export { headOid }
