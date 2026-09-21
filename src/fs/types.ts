export interface PeepoStat {
  type: 'file' | 'dir'
  mode: number
  size: number
  ino: number
  mtimeMs: number
  ctimeMs: number
  uid: number
  gid: number
  dev: number
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
}

export type ReadOpts = 'utf8' | { encoding?: 'utf8' } | undefined

export interface PeepoFSPromises {
  readFile(path: string, opts?: ReadOpts): Promise<Uint8Array | string>
  writeFile(path: string, data: Uint8Array | string, opts?: unknown): Promise<void>
  unlink(path: string): Promise<void>
  readdir(path: string): Promise<string[]>
  mkdir(path: string): Promise<void>
  rmdir(path: string): Promise<void>
  stat(path: string): Promise<PeepoStat>
  lstat(path: string): Promise<PeepoStat>
  readlink(path: string): Promise<string>
  symlink(target: string, path: string): Promise<void>
}

export type StorageKind = 'browser' | 'folder'

export interface PeepoFS {
  kind: StorageKind
  label: string
  /** repo root inside this fs */
  dir: string
  promises: PeepoFSPromises
  /** force anything still buffered in memory onto durable storage (browser storage batches its directory table) */
  persist?: () => Promise<void>
}

/** absolute path inside the fs for a repo-relative path */
export const abs = (fs: PeepoFS, rel: string) => (fs.dir === '/' ? `/${rel}` : `${fs.dir}/${rel}`)

export class FsError extends Error {
  code: string
  constructor(code: string, path: string) {
    super(`${code}: ${path}`)
    this.code = code
  }
}

export function makeStat(type: 'file' | 'dir', size: number, mtimeMs: number): PeepoStat {
  return {
    type,
    mode: type === 'dir' ? 0o40000 : 0o100644,
    size,
    ino: 0,
    mtimeMs,
    ctimeMs: mtimeMs,
    uid: 0,
    gid: 0,
    dev: 1,
    isFile: () => type === 'file',
    isDirectory: () => type === 'dir',
    isSymbolicLink: () => false,
  }
}

/** Helpers on top of the raw promise fs */
export async function readText(fs: PeepoFS, path: string): Promise<string> {
  return (await fs.promises.readFile(path, 'utf8')) as string
}

export async function readBytes(fs: PeepoFS, path: string): Promise<Uint8Array> {
  return (await fs.promises.readFile(path)) as Uint8Array
}

export async function exists(fs: PeepoFS, path: string): Promise<boolean> {
  try {
    await fs.promises.stat(path)
    return true
  } catch {
    return false
  }
}

export async function mkdirp(fs: PeepoFS, path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  let cur = ''
  for (const p of parts) {
    cur += '/' + p
    if (!(await exists(fs, cur))) {
      try {
        await fs.promises.mkdir(cur)
      } catch (e) {
        if ((e as FsError).code !== 'EEXIST') throw e
      }
    }
  }
}

export async function writeText(fs: PeepoFS, path: string, text: string): Promise<void> {
  const dir = path.slice(0, path.lastIndexOf('/'))
  if (dir) await mkdirp(fs, dir)
  await fs.promises.writeFile(path, text, 'utf8')
}

export async function writeBytes(fs: PeepoFS, path: string, data: Uint8Array): Promise<void> {
  const dir = path.slice(0, path.lastIndexOf('/'))
  if (dir) await mkdirp(fs, dir)
  await fs.promises.writeFile(path, data)
}
