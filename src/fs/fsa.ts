// File System Access API adapter exposing the promise-fs subset isomorphic-git needs.
import { FsError, makeStat, type PeepoFS, type PeepoFSPromises, type PeepoStat, type ReadOpts } from './types'

const enc = new TextEncoder()
const dec = new TextDecoder()

function split(path: string): string[] {
  return path.split('/').filter((p) => p && p !== '.')
}

export function createFolderFS(root: FileSystemDirectoryHandle): PeepoFS {
  const dirCache = new Map<string, FileSystemDirectoryHandle>()
  dirCache.set('', root)

  async function dirHandle(parts: string[], create = false): Promise<FileSystemDirectoryHandle> {
    const key = parts.join('/')
    const cached = dirCache.get(key)
    if (cached) return cached
    let h = root
    let cur = ''
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p
      const c = dirCache.get(cur)
      if (c) {
        h = c
        continue
      }
      try {
        h = await h.getDirectoryHandle(p, { create })
      } catch (e) {
        throw translate(e, '/' + cur)
      }
      dirCache.set(cur, h)
    }
    return h
  }

  function translate(e: unknown, path: string): Error {
    const name = (e as DOMException)?.name
    if (name === 'NotFoundError') return new FsError('ENOENT', path)
    if (name === 'TypeMismatchError') return new FsError('ENOTDIR', path)
    if (name === 'InvalidModificationError') return new FsError('ENOTEMPTY', path)
    if (name === 'NotAllowedError') return new FsError('EACCES', path)
    return e instanceof Error ? e : new Error(String(e))
  }

  async function fileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    const parts = split(path)
    const name = parts.pop()
    if (!name) throw new FsError('EISDIR', path)
    const dir = await dirHandle(parts, create)
    try {
      return await dir.getFileHandle(name, { create })
    } catch (e) {
      throw translate(e, path)
    }
  }

  const promises: PeepoFSPromises = {
    async readFile(path: string, opts?: ReadOpts) {
      const fh = await fileHandle(path)
      const file = await fh.getFile()
      const buf = new Uint8Array(await file.arrayBuffer())
      const encoding = typeof opts === 'string' ? opts : opts?.encoding
      return encoding === 'utf8' ? dec.decode(buf) : buf
    },
    async writeFile(path: string, data: Uint8Array | string) {
      const fh = await fileHandle(path, true)
      const w = await fh.createWritable()
      const bytes = typeof data === 'string' ? enc.encode(data) : data
      await w.write(bytes as unknown as BufferSource)
      await w.close()
    },
    async unlink(path: string) {
      const parts = split(path)
      const name = parts.pop()!
      const dir = await dirHandle(parts)
      try {
        await dir.removeEntry(name)
      } catch (e) {
        throw translate(e, path)
      }
    },
    async readdir(path: string) {
      const dir = await dirHandle(split(path))
      const out: string[] = []
      for await (const name of dir.keys()) out.push(name)
      return out
    },
    async mkdir(path: string) {
      const parts = split(path)
      const name = parts.pop()!
      const parent = await dirHandle(parts)
      // detect EEXIST like node does
      try {
        await parent.getDirectoryHandle(name)
        throw new FsError('EEXIST', path)
      } catch (e) {
        if ((e as FsError).code === 'EEXIST') throw e
      }
      try {
        const h = await parent.getDirectoryHandle(name, { create: true })
        dirCache.set([...parts, name].join('/'), h)
      } catch (e) {
        throw translate(e, path)
      }
    },
    async rmdir(path: string) {
      const parts = split(path)
      const name = parts.pop()!
      const parent = await dirHandle(parts)
      try {
        await parent.removeEntry(name)
      } catch (e) {
        throw translate(e, path)
      }
      const key = [...parts, name].join('/')
      for (const k of [...dirCache.keys()]) if (k === key || k.startsWith(key + '/')) dirCache.delete(k)
    },
    async stat(path: string): Promise<PeepoStat> {
      const parts = split(path)
      if (parts.length === 0) return makeStat('dir', 0, 0)
      const name = parts.pop()!
      const parent = await dirHandle(parts)
      try {
        const fh = await parent.getFileHandle(name)
        const f = await fh.getFile()
        return makeStat('file', f.size, f.lastModified)
      } catch (e) {
        if ((e as DOMException)?.name !== 'TypeMismatchError') throw translate(e, path)
      }
      try {
        await parent.getDirectoryHandle(name)
        return makeStat('dir', 0, 0)
      } catch (e) {
        throw translate(e, path)
      }
    },
    lstat(path: string) {
      return promises.stat(path)
    },
    async readlink(path: string) {
      throw new FsError('ENOSYS', path)
    },
    async symlink(_target: string, path: string) {
      throw new FsError('ENOSYS', path)
    },
  }

  return { kind: 'folder', label: `Folder: ${root.name}`, dir: '/', promises }
}

export const supportsFolderAccess = typeof window !== 'undefined' && 'showDirectoryPicker' in window
