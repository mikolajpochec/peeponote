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

/** `filepath` is inside `within` ('' = whole repo) */
const inside = (filepath: string, within: string) => !within || filepath === within || filepath.startsWith(`${within}/`)

/** Stage every change in the working tree (only under `within`, never under `exclude`). Returns what changed. */
export async function stageAll(fs: PeepoFS, within = '', exclude?: string): Promise<ChangeSummary> {
  const matrix = await git.statusMatrix({ ...ctx(fs) })
  const out: ChangeSummary = { added: [], modified: [], deleted: [] }
  for (const [filepath, head, workdir, stage] of matrix) {
    if (head === 1 && workdir === 1 && stage === 1) continue
    if (!inside(filepath, within)) continue // stray files elsewhere in a monorepo are not ours to commit
    if (exclude && inside(filepath, exclude)) continue // review files travel in their own commits
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

export async function hasChanges(fs: PeepoFS, within = '', exclude?: string): Promise<boolean> {
  const matrix = await git.statusMatrix({ ...ctx(fs) })
  return matrix.some(([f, h, w, s]) => inside(f, within) && !(exclude && inside(f, exclude)) && !(h === 1 && w === 1 && s === 1))
}

/** Files under `within` that differ from HEAD (changed, added or deleted in the working tree). */
export async function changedPaths(fs: PeepoFS, within: string): Promise<string[]> {
  const matrix = await git.statusMatrix({ ...ctx(fs), filepaths: [within] })
  return matrix.filter(([, h, w, s]) => !(h === 1 && w === 1 && s === 1)).map(([f]) => f)
}

/**
 * Commit just these paths (added/changed → add, missing → remove), leaving everything else in the working
 * tree uncommitted. Between saves the index equals HEAD, so the commit contains exactly `filepaths`.
 */
export async function commitPaths(fs: PeepoFS, filepaths: string[], message: string, who: GitIdentity): Promise<string | null> {
  for (const filepath of filepaths) {
    if (await exists(fs, abs(fs, filepath))) await git.add({ ...ctx(fs), filepath })
    else await git.remove({ ...ctx(fs), filepath }).catch(() => {})
  }
  // nothing actually differs from HEAD (e.g. a file created and deleted within the same batch) → no empty commit
  const matrix = await git.statusMatrix({ ...ctx(fs), filepaths })
  const staged = matrix.some(([, head, , stage]) => (head === 1 ? stage !== 1 : stage !== 0))
  if (!staged) return null
  return commit(fs, message, who)
}

/** Folders ('' = root) holding peeponote.json in the commit `ref` points at. */
export async function workspacesAt(fs: PeepoFS, ref: string): Promise<string[]> {
  try {
    const files = await git.listFiles({ ...ctx(fs), ref })
    return files.filter((f) => f === 'peeponote.json' || f.endsWith('/peeponote.json')).map((f) => f.slice(0, Math.max(0, f.length - 'peeponote.json'.length - 1)))
  } catch {
    return []
  }
}

/** Bring folders/files back from HEAD into the working tree (someone deleted them on disk). */
export async function restorePaths(fs: PeepoFS, filepaths: string[]): Promise<void> {
  await git.checkout({ ...ctx(fs), ref: await currentBranch(fs), filepaths: filepaths.map((p) => p || '.'), force: true })
}

/** Does `filepath` exist in the commit `ref` points at? */
export async function existsAt(fs: PeepoFS, ref: string, filepath: string): Promise<boolean> {
  try {
    await readBlobAt(fs, ref, filepath)
    return true
  } catch {
    return false
  }
}

export const APP_TAG = '[peeponote]'
export const APP_TRAILER = 'Co-Authored-By: peeponote <331708502+peeponote[bot]@users.noreply.github.com>'

/** "[peeponote] Save: update 1 file" + a co-author trailer, so app-made commits are recognisable in any git UI */
export function stampMessage(message: string): string {
  const [title, ...rest] = message.trim().split('\n')
  const head = title.startsWith(APP_TAG) ? title : `${APP_TAG} ${title}`
  const body = rest.join('\n').trim()
  return `${head}\n\n${body ? `${body}\n\n` : ''}${APP_TRAILER}\n`
}

export async function commit(fs: PeepoFS, message: string, who: GitIdentity): Promise<string> {
  return git.commit({
    ...ctx(fs),
    message: stampMessage(message),
    author: { name: who.name || 'peepo', email: who.email || 'peepo@peeponote.local' },
  })
}

export async function log(fs: PeepoFS, depth = 100, ref?: string): Promise<ReadCommitResult[]> {
  try {
    return await git.log({ ...ctx(fs), depth, ref })
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
/** Throw away everything not committed: tracked files back to HEAD, new files deleted. */
export async function discardWorktree(fs: PeepoFS): Promise<void> {
  const matrix = await git.statusMatrix({ ...ctx(fs) })
  for (const [filepath, head, workdir] of matrix) {
    if (head === 0 && workdir !== 0) {
      await git.remove({ ...ctx(fs), filepath }).catch(() => {})
      await fs.promises.unlink(abs(fs, filepath)).catch(() => {})
    }
  }
  await git.checkout({ ...ctx(fs), ref: await currentBranch(fs), force: true })
}

export async function hardResetTo(fs: PeepoFS, oid: string): Promise<void> {
  const ref = await currentBranch(fs)
  await git.writeRef({ ...ctx(fs), ref: `refs/heads/${ref}`, value: oid, force: true })
  await git.checkout({ ...ctx(fs), ref, force: true })
}
