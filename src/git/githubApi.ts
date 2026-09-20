/**
 * GitHub transport over the REST API (api.github.com allows CORS, git smart-HTTP does not).
 *
 * The local isomorphic-git repository stays the source of truth. Push recreates the exact same
 * git objects on GitHub via the Git Data API (blobs → trees → commits → ref); pull fetches the
 * remote objects and writes them into the local .git. Every object id is verified to match, so a
 * repo can be pushed through this transport and cloned with plain git (or vice versa) freely.
 */
import git from 'isomorphic-git'
import type { PeepoFS } from '../fs'
import { currentBranch, headOid } from './repo'

export { hasObject }

export interface GitHubTarget {
  owner: string
  repo: string
  branch: string
  token: string
}

export type Progress = (message: string) => void

const API = 'https://api.github.com'

export function parseGitHubUrl(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null
  const m = /^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url.trim())
  return m ? { owner: m[1], repo: m[2] } : null
}

export const isGitHubUrl = (url: string | null | undefined) => parseGitHubUrl(url) !== null

/** the remote moved on; caller should fetch and merge/rebase */
export class NotFastForwardError extends Error {
  constructor() {
    super('Remote has commits you don\'t have — fetch first.')
    this.name = 'NotFastForwardError'
  }
}

class GitHubError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

class Client {
  private token: string
  private owner: string
  private repo: string
  constructor(token: string, owner: string, repo: string) {
    this.token = token
    this.owner = owner
    this.repo = repo
  }

  async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${API}/repos/${this.owner}/${this.repo}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`
      try {
        const j = (await res.json()) as { message?: string }
        if (j.message) msg = j.message
      } catch {
        /* no body */
      }
      if (res.status === 401) msg = 'GitHub rejected the token (401). Check it in Settings.'
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') msg = 'GitHub API rate limit hit — try again later (a token raises the limit).'
      if (res.status === 404) msg = `${msg} — repo not found, or the token lacks access to ${this.owner}/${this.repo}.`
      throw new GitHubError(res.status, msg)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  /** GET with a custom media type, returned as text */
  async raw(path: string, accept: string): Promise<string> {
    const headers: Record<string, string> = { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    const res = await fetch(`${API}/repos/${this.owner}/${this.repo}${path}`, { headers })
    if (!res.ok) throw new GitHubError(res.status, `${res.status} ${res.statusText}`)
    return res.text()
  }

  /** sha of refs/heads/<branch>, null when the branch (or the whole repo) is empty */
  async getRef(branch: string): Promise<string | null> {
    try {
      const r = await this.req<{ object: { sha: string } }>('GET', `/git/ref/heads/${encodeURIComponent(branch)}`)
      return r.object.sha
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return null
      throw e
    }
  }
}

// ---------- helpers ----------

interface Person {
  name: string
  email: string
  timestamp: number
  timezoneOffset: number
}

/** isomorphic-git person → ISO 8601 with the original offset (GitHub keeps it, so the commit id survives) */
function toIsoDate(p: Person): string {
  const local = new Date(p.timestamp * 1000 - p.timezoneOffset * 60_000).toISOString().slice(0, 19)
  const abs = Math.abs(p.timezoneOffset)
  const sign = p.timezoneOffset <= 0 ? '+' : '-'
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hasObject(fs: PeepoFS, oid: string): Promise<boolean> {
  try {
    await git.readObject({ fs, dir: fs.dir, oid, format: 'deflated' })
    return true
  } catch {
    return false
  }
}

interface TreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
}

// ---------- push ----------

export async function ghPush(fs: PeepoFS, target: GitHubTarget, progress: Progress = () => {}, force = false): Promise<{ pushed: number }> {
  if (!target.token) throw new Error('A GitHub token is required to push. Add one in Settings.')
  const gh = new Client(target.token, target.owner, target.repo)
  const dir = fs.dir
  const local = await headOid(fs)
  if (!local) throw new Error('Nothing to push yet.')

  progress('checking remote…')
  const remote = await gh.getRef(target.branch)
  if (remote === local) return { pushed: 0 }

  // commits to send: local history back to the remote head (oldest first)
  const log = await git.log({ fs, dir, ref: local })
  const idx = remote ? log.findIndex((c) => c.oid === remote) : -1
  if (remote && idx === -1 && !force) throw new NotFastForwardError()
  // forced: send everything the remote might lack (anything it does have is skipped via `known`)
  const toPush = (idx === -1 ? log : log.slice(0, idx)).reverse()

  // everything reachable from the remote head already exists on GitHub
  const known = new Set<string>()
  if (remote) {
    known.add(remote)
    const rc = await gh.req<{ tree: { sha: string } }>('GET', `/git/commits/${remote}`)
    known.add(rc.tree.sha)
    const rt = await gh.req<{ tree: TreeEntry[] }>('GET', `/git/trees/${rc.tree.sha}?recursive=1`)
    for (const e of rt.tree) known.add(e.sha)
  }

  // The Git Data API refuses to create objects in a repo with no commits ("Git Repository is empty", 409).
  // Seed it with a throwaway commit through the Contents API, then continue as usual; the seed lands on
  // GitHub's default branch and is cleaned up after our real branch exists.
  let seededBranch: string | null = null
  const seedEmptyRepo = async () => {
    progress('initializing empty repository…')
    await gh.req('PUT', '/contents/.peeponote-init', { message: 'Initialize repository', content: toBase64(new TextEncoder().encode('peeponote\n')) })
    const info = await gh.req<{ default_branch: string }>('GET', '')
    seededBranch = info.default_branch
  }
  const isEmptyRepoError = (e: unknown) => e instanceof GitHubError && e.status === 409 && /empty/i.test(e.message)

  let uploaded = 0
  const ensureBlob = async (oid: string) => {
    if (known.has(oid)) return
    const { blob } = await git.readBlob({ fs, dir, oid })
    progress(`uploading file ${++uploaded}…`)
    const body = { content: toBase64(blob), encoding: 'base64' }
    let r: { sha: string }
    try {
      r = await gh.req<{ sha: string }>('POST', '/git/blobs', body)
    } catch (e) {
      if (!isEmptyRepoError(e) || seededBranch) throw e
      await seedEmptyRepo()
      r = await gh.req<{ sha: string }>('POST', '/git/blobs', body)
    }
    if (r.sha !== oid) throw new Error(`Blob id mismatch (${r.sha.slice(0, 7)} vs ${oid.slice(0, 7)})`)
    known.add(oid)
  }
  const ensureTree = async (oid: string): Promise<void> => {
    if (known.has(oid)) return
    const { tree } = await git.readTree({ fs, dir, oid })
    for (const e of tree) {
      if (e.type === 'blob') await ensureBlob(e.oid)
      else if (e.type === 'tree') await ensureTree(e.oid)
    }
    const r = await gh.req<{ sha: string }>('POST', '/git/trees', {
      tree: tree.map((e) => ({ path: e.path, mode: e.mode, type: e.type, sha: e.oid })),
    })
    if (r.sha !== oid) throw new Error(`Tree id mismatch (${r.sha.slice(0, 7)} vs ${oid.slice(0, 7)})`)
    known.add(oid)
  }

  for (const [i, c] of toPush.entries()) {
    progress(`commit ${i + 1}/${toPush.length}: ${c.commit.message.split('\n')[0].slice(0, 40)}`)
    await ensureTree(c.commit.tree)
    if (c.commit.gpgsig) throw new Error('Signed commits can\'t be recreated through the API — use the proxy transport for this repo.')
    const r = await gh.req<{ sha: string }>('POST', '/git/commits', {
      message: c.commit.message,
      tree: c.commit.tree,
      parents: c.commit.parent,
      author: { name: c.commit.author.name, email: c.commit.author.email, date: toIsoDate(c.commit.author) },
      committer: { name: c.commit.committer.name, email: c.commit.committer.email, date: toIsoDate(c.commit.committer) },
    })
    if (r.sha !== c.oid) throw new Error(`GitHub produced a different commit id (${r.sha.slice(0, 7)} vs ${c.oid.slice(0, 7)}). Use the proxy transport for this repo.`)
    known.add(c.oid)
  }

  progress('updating branch…')
  const branchRef = `/git/refs/heads/${encodeURIComponent(target.branch)}`
  if (remote) {
    try {
      await gh.req('PATCH', branchRef, { sha: local, force })
    } catch (e) {
      // someone pushed between our fetch and this update → let the sync layer fetch again and merge
      if (e instanceof GitHubError && e.status === 422 && /fast.?forward/i.test(e.message)) throw new NotFastForwardError()
      throw e
    }
  }
  else if (seededBranch === target.branch) await gh.req('PATCH', branchRef, { sha: local, force: true }) // replace the seed commit
  else {
    await gh.req('POST', '/git/refs', { ref: `refs/heads/${target.branch}`, sha: local })
    if (seededBranch) {
      // the seed went to a differently named default branch: point the repo at ours and drop it (best effort — needs admin rights)
      try {
        await gh.req('PATCH', '', { default_branch: target.branch })
        await gh.req('DELETE', `/git/refs/heads/${encodeURIComponent(seededBranch)}`)
      } catch {
        /* token lacks admin permission; the extra branch is harmless */
      }
    }
  }
  await git.writeRef({ fs, dir, ref: `refs/remotes/origin/${target.branch}`, value: local, force: true })
  return { pushed: toPush.length }
}

// ---------- pull ----------

interface ApiCommit {
  sha: string
  message: string
  tree: { sha: string }
  parents: { sha: string }[]
  author: { name: string; email: string; date: string }
  committer: { name: string; email: string; date: string }
  /** payload = the raw commit text minus the signature; together they rebuild the exact object */
  verification?: { signature: string | null; payload: string | null }
}

/** Reassemble the raw commit object from GitHub's verification payload (+ gpgsig header when signed). */
function rawCommit(payload: string, signature: string | null): string {
  if (!signature) return payload
  const cut = payload.indexOf('\n\n')
  const headers = payload.slice(0, cut)
  const message = payload.slice(cut + 2)
  const sig = signature.replace(/\n$/, '').split('\n').join('\n ')
  return `${headers}\ngpgsig ${sig}\n\n${message}`
}

const enc = new TextEncoder()

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', bytes as BufferSource)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** git object id of a commit body */
async function commitOid(body: string): Promise<string> {
  const content = enc.encode(body)
  const header = enc.encode(`commit ${content.length}\0`)
  const all = new Uint8Array(header.length + content.length)
  all.set(header)
  all.set(content, header.length)
  return sha1Hex(all)
}

/** "+0200" style zone for minutes east of UTC */
function zone(east: number): string {
  const abs = Math.abs(east)
  return `${east < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`
}

function renderCommit(c: ApiCommit, message: string, authorEast: number, committerEast: number): string {
  const ts = (iso: string) => Math.floor(Date.parse(iso) / 1000)
  const lines = [`tree ${c.tree.sha}`]
  for (const p of c.parents) lines.push(`parent ${p.sha}`)
  lines.push(`author ${c.author.name} <${c.author.email}> ${ts(c.author.date)} ${zone(authorEast)}`)
  lines.push(`committer ${c.committer.name} <${c.committer.email}> ${ts(c.committer.date)} ${zone(committerEast)}`)
  return `${lines.join('\n')}\n\n${message}`
}

/**
 * The API returns dates in UTC and drops the original zone, which is part of the hashed text.
 * Find the body that hashes to the real id: UTC first, then the author's zone from the patch
 * header, then every 15-minute offset. All in memory — nothing is written until it matches.
 */
async function reconstructCommit(gh: Client, c: ApiCommit): Promise<string | null> {
  const messages = [c.message + '\n', c.message, c.message + '\n\n']
  const tryZones = async (pairs: [number, number][]) => {
    for (const msg of messages) {
      for (const [a, k] of pairs) {
        const body = renderCommit(c, msg, a, k)
        if ((await commitOid(body)) === c.sha) return body
      }
    }
    return null
  }
  let body = await tryZones([[0, 0]])
  if (body) return body
  // author zone from the e-mail style patch header ("Date: Tue, 13 Sep 2011 21:42:41 -0700")
  let patchZone: number | null = null
  try {
    const m = /^Date: .* ([+-])(\d{2})(\d{2})\s*$/m.exec(await gh.raw(`/commits/${c.sha}`, 'application/vnd.github.patch'))
    if (m) patchZone = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
  } catch {
    /* patch not available */
  }
  if (patchZone !== null) {
    body = await tryZones([[patchZone, patchZone], [patchZone, 0], [0, patchZone]])
    if (body) return body
  }
  const all: number[] = []
  for (let z = -12 * 60; z <= 14 * 60; z += 15) all.push(z)
  body = await tryZones(all.map((z) => [z, z] as [number, number]))
  if (body) return body
  if (patchZone !== null) {
    body = await tryZones(all.map((z) => [patchZone!, z] as [number, number]))
    if (body) return body
  }
  // last resort: full grid (~10k hashes)
  const grid: [number, number][] = []
  for (const a of all) for (const k of all) grid.push([a, k])
  return tryZones(grid)
}

async function writeCommitExact(fs: PeepoFS, gh: Client, c: ApiCommit): Promise<string> {
  const dir = fs.dir
  const v = c.verification
  if (v?.payload) {
    // try the two plausible signature layouts (with / without trailing blank continuation line)
    const variants = v.signature ? [rawCommit(v.payload, v.signature), rawCommit(v.payload, v.signature + '\n')] : [v.payload]
    for (const raw of variants) {
      if ((await commitOid(raw)) === c.sha) return git.writeObject({ fs, dir, type: 'commit', format: 'content', object: enc.encode(raw) })
    }
  }
  const body = await reconstructCommit(gh, c)
  if (!body) throw new Error(`Couldn't rebuild commit ${c.sha.slice(0, 7)} byte-for-byte — use the proxy transport for this repo.`)
  return git.writeObject({ fs, dir, type: 'commit', format: 'content', object: enc.encode(body) })
}

/**
 * Download every remote object we don't have and point refs/remotes/origin/<branch> at the remote head.
 * Doesn't touch the local branch or working tree — that's the sync layer's job (fast-forward or merge).
 * Returns the remote head (null for an empty remote).
 */
export async function ghFetch(fs: PeepoFS, target: GitHubTarget, progress: Progress = () => {}): Promise<string | null> {
  const gh = new Client(target.token, target.owner, target.repo)
  const dir = fs.dir
  const branch = target.branch

  progress('checking remote…')
  const remote = await gh.getRef(branch)
  if (!remote) return null
  if (await hasObject(fs, remote)) {
    await git.writeRef({ fs, dir, ref: `refs/remotes/origin/${branch}`, value: remote, force: true })
    return remote
  }

  // walk remote history until we reach commits we already have
  const commits: ApiCommit[] = []
  const seen = new Set<string>()
  const queue = [remote]
  while (queue.length) {
    const sha = queue.shift()!
    if (seen.has(sha)) continue
    seen.add(sha)
    if (await hasObject(fs, sha)) continue
    progress(`fetching commit ${commits.length + 1}…`)
    const c = await gh.req<ApiCommit>('GET', `/git/commits/${sha}`)
    commits.push(c)
    for (const p of c.parents) queue.push(p.sha)
  }

  // objects: trees + blobs for each new commit
  let files = 0
  for (const c of commits) {
    if (await hasObject(fs, c.tree.sha)) continue
    const rt = await gh.req<{ tree: TreeEntry[]; truncated: boolean }>('GET', `/git/trees/${c.tree.sha}?recursive=1`)
    if (rt.truncated) throw new Error('Repository tree too large for the API transport.')
    for (const e of rt.tree) {
      if (e.type !== 'blob' || (await hasObject(fs, e.sha))) continue
      progress(`downloading file ${++files}…`)
      const b = await gh.req<{ content: string; encoding: string }>('GET', `/git/blobs/${e.sha}`)
      const oid = await git.writeBlob({ fs, dir, blob: fromBase64(b.content) })
      if (oid !== e.sha) throw new Error(`Blob id mismatch for ${e.path}`)
    }
    // trees, deepest first, so children exist when we verify parents
    const byDir = new Map<string, TreeEntry[]>()
    for (const e of rt.tree) {
      const i = e.path.lastIndexOf('/')
      const d = i === -1 ? '' : e.path.slice(0, i)
      ;(byDir.get(d) ?? byDir.set(d, []).get(d)!).push(e)
    }
    const dirs = [...byDir.keys()].sort((a, b) => b.split('/').length - a.split('/').length)
    for (const d of dirs) {
      const entries = byDir.get(d)!
      const expected = d === '' ? c.tree.sha : rt.tree.find((e) => e.path === d && e.type === 'tree')?.sha
      const oid = await git.writeTree({
        fs,
        dir,
        tree: entries.map((e) => ({ mode: e.mode, path: e.path.slice(e.path.lastIndexOf('/') + 1), oid: e.sha, type: e.type })),
      })
      if (expected && oid !== expected) throw new Error(`Tree id mismatch at "${d || '/'}"`)
    }
  }

  // commits, oldest first
  for (const c of commits.reverse()) {
    progress(`rebuilding commit ${c.sha.slice(0, 7)}…`)
    const oid = await writeCommitExact(fs, gh, c)
    if (oid !== c.sha) throw new Error(`Commit id mismatch (${oid.slice(0, 7)} vs ${c.sha.slice(0, 7)}) — use the proxy transport for this repo.`)
  }

  await git.writeRef({ fs, dir, ref: `refs/remotes/origin/${branch}`, value: remote, force: true })
  return remote
}

/** Clone = init + remote + pull. The target dir must be empty. */
export async function ghClone(fs: PeepoFS, url: string, token: string, progress: Progress = () => {}): Promise<void> {
  const gh = parseGitHubUrl(url)
  if (!gh) throw new Error('Not a GitHub URL')
  const client = new Client(token, gh.owner, gh.repo)
  progress('looking up repository…')
  const info = await client.req<{ default_branch: string }>('GET', '')
  const branch = info.default_branch || 'main'
  await git.init({ fs, dir: fs.dir, defaultBranch: branch })
  await git.addRemote({ fs, dir: fs.dir, remote: 'origin', url: url.trim(), force: true })
  const remote = await ghFetch(fs, { ...gh, branch, token }, progress)
  if (remote) {
    await git.writeRef({ fs, dir: fs.dir, ref: `refs/heads/${branch}`, value: remote, force: true })
    await git.checkout({ fs, dir: fs.dir, ref: branch, force: true })
  }
}

export async function targetFor(fs: PeepoFS, remoteUrl: string, token: string): Promise<GitHubTarget | null> {
  const gh = parseGitHubUrl(remoteUrl)
  if (!gh) return null
  return { ...gh, branch: await currentBranch(fs), token }
}
