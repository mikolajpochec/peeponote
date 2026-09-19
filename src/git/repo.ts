import git, { type ReadCommitResult } from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import { abs, exists, mkdirp, type PeepoFS } from '../fs'

export interface GitIdentity {
  name: string
  email: string
}

export interface RemoteAuth {
  token: string
  username?: string
  corsProxy?: string
}

export const DEFAULT_BRANCH = 'main'
export const DEFAULT_CORS_PROXY = 'https://cors.isomorphic-git.org'

const ctx = (fs: PeepoFS) => ({ fs, dir: fs.dir })

function authFor(auth: RemoteAuth) {
  const token = auth.token.trim()
  return {
    corsProxy: auth.corsProxy?.trim() || undefined,
    // anonymous when no token (public clones); otherwise PAT as user, or user + PAT
    onAuth: token
      ? () => ({
          username: auth.username?.trim() || token,
          password: auth.username?.trim() ? token : 'x-oauth-basic',
        })
      : undefined,
    onAuthFailure: () => ({ cancel: true }),
  }
}

export async function isRepo(fs: PeepoFS): Promise<boolean> {
  return exists(fs, abs(fs, '.git'))
}

export async function initRepo(fs: PeepoFS): Promise<void> {
  await mkdirp(fs, fs.dir)
  await git.init({ ...ctx(fs), defaultBranch: DEFAULT_BRANCH })
}

export async function currentBranch(fs: PeepoFS): Promise<string> {
  return (await git.currentBranch({ ...ctx(fs), fullname: false })) || DEFAULT_BRANCH
}

export interface ChangeSummary {
  added: string[]
  modified: string[]
  deleted: string[]
}

/** Stage every change in the working tree. Returns what changed. */
export async function stageAll(fs: PeepoFS): Promise<ChangeSummary> {
  const matrix = await git.statusMatrix({ ...ctx(fs) })
  const out: ChangeSummary = { added: [], modified: [], deleted: [] }
  for (const [filepath, head, workdir, stage] of matrix) {
    if (head === 1 && workdir === 1 && stage === 1) continue
    if (workdir === 0) {
      await git.remove({ ...ctx(fs), filepath })
      out.deleted.push(filepath)
    } else {
      await git.add({ ...ctx(fs), filepath })
      if (head === 0) out.added.push(filepath)
      else out.modified.push(filepath)
    }
  }
  return out
}

export async function hasChanges(fs: PeepoFS): Promise<boolean> {
  const matrix = await git.statusMatrix({ ...ctx(fs) })
  return matrix.some(([, h, w, s]) => !(h === 1 && w === 1 && s === 1))
}

export async function commit(fs: PeepoFS, message: string, who: GitIdentity): Promise<string> {
  return git.commit({
    ...ctx(fs),
    message,
    author: { name: who.name || 'peepo', email: who.email || 'peepo@peeponote.local' },
  })
}

export async function log(fs: PeepoFS, depth = 100): Promise<ReadCommitResult[]> {
  try {
    return await git.log({ ...ctx(fs), depth })
  } catch {
    return []
  }
}

export async function headOid(fs: PeepoFS): Promise<string | null> {
  try {
    return await git.resolveRef({ ...ctx(fs), ref: 'HEAD' })
  } catch {
    return null
  }
}

export async function getRemoteUrl(fs: PeepoFS): Promise<string | null> {
  try {
    const remotes = await git.listRemotes({ ...ctx(fs) })
    return remotes.find((r) => r.remote === 'origin')?.url ?? null
  } catch {
    return null
  }
}

export async function setRemoteUrl(fs: PeepoFS, url: string): Promise<void> {
  if (!url.trim()) {
    try {
      await git.deleteRemote({ ...ctx(fs), remote: 'origin' })
    } catch {
      /* no remote */
    }
    return
  }
  await git.addRemote({ ...ctx(fs), remote: 'origin', url: url.trim(), force: true })
}

export async function push(fs: PeepoFS, auth: RemoteAuth): Promise<void> {
  const ref = await currentBranch(fs)
  const res = await git.push({
    ...ctx(fs),
    http,
    remote: 'origin',
    ref,
    remoteRef: ref,
    ...authFor(auth),
  })
  if (!res.ok) throw new Error(res.error || 'push rejected')
}

export async function pull(fs: PeepoFS, auth: RemoteAuth, who: GitIdentity): Promise<void> {
  const ref = await currentBranch(fs)
  await git.pull({
    ...ctx(fs),
    http,
    ref,
    singleBranch: true,
    fastForwardOnly: true,
    author: { name: who.name || 'peepo', email: who.email || 'peepo@peeponote.local' },
    ...authFor(auth),
  })
}

export async function clone(fs: PeepoFS, url: string, auth: RemoteAuth): Promise<void> {
  await mkdirp(fs, fs.dir)
  await git.clone({
    ...ctx(fs),
    http,
    url: url.trim(),
    singleBranch: true,
    ...authFor(auth),
  })
}

export async function listFilesAt(fs: PeepoFS, ref: string): Promise<string[]> {
  return git.listFiles({ ...ctx(fs), ref })
}

export async function readBlobAt(fs: PeepoFS, ref: string, filepath: string): Promise<Uint8Array> {
  const oid = await git.resolveRef({ ...ctx(fs), ref })
  const { blob } = await git.readBlob({ ...ctx(fs), oid, filepath })
  return blob
}

export async function readTextAt(fs: PeepoFS, ref: string, filepath: string): Promise<string> {
  return new TextDecoder().decode(await readBlobAt(fs, ref, filepath))
}

/** Reset the working tree + index to a commit (hard reset, moves the branch). */
export async function hardResetTo(fs: PeepoFS, oid: string): Promise<void> {
  const ref = await currentBranch(fs)
  await git.writeRef({ ...ctx(fs), ref: `refs/heads/${ref}`, value: oid, force: true })
  await git.checkout({ ...ctx(fs), ref, force: true })
}
