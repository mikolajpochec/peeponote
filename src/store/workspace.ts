import { create } from 'zustand'
import type { ReadCommitResult } from 'isomorphic-git'
import {
  abs, exists, mountLast, pickFolder, readBytes, readText, requestFolderPermission, useBrowserStorage,
  writeBytes, writeText, type PeepoFS,
} from '../fs'
import * as repo from '../git/repo'
import { chooseTransport, compare, fetchRemote, mergeRemote, pushRemote, resetTo, type SyncCtx, type SyncState } from '../git/sync'
import { ghClone, parseGitHubUrl } from '../git/githubApi'
import {
  ASSETS_DIR, BOARDS_DIR, WORKSPACE_FILE, boardPath, newId,
  type Board, type BoardStyle, type Card, type CardStyle, type Connector, type ConnectorStyle, type WorkspaceMeta, type WorkspaceSettings,
} from '../model/types'
import { parseBoard, parseWorkspace } from '../model/schema'
import { detectKind } from '../model/assetKind'
import { tutorialBoards } from '../model/tutorial'
import { useSettings } from './settings'
import { toast } from './toast'

export type Busy = 'saving' | 'pushing' | 'pulling' | 'syncing' | 'cloning' | 'loading' | null
export type Resolution = 'merge-ours' | 'merge-theirs' | 'force-push' | 'take-theirs'

interface WorkspaceState {
  fs: PeepoFS | null
  status: 'booting' | 'needs-permission' | 'ready' | 'error'
  pendingHandle: FileSystemDirectoryHandle | null
  error: string | null

  meta: WorkspaceMeta | null
  boards: Record<string, Board>
  currentBoardId: string | null
  /** boards edited in memory but not yet written to the working tree */
  dirtyBoards: Set<string>
  deletedBoards: Set<string>
  assetsTouched: boolean
  /** peeponote.json edited in memory, not yet written */
  metaDirty: boolean
  /** working tree differs from HEAD (uncommitted changes, survives reloads) */
  treeDirty: boolean
  selection: Set<string>
  busy: Busy
  /** what the current long operation is doing right now */
  busyDetail: string | null
  /** local and remote both have new commits — waiting for the user to pick a resolution */
  divergence: SyncState | null
  remoteUrl: string | null
  head: ReadCommitResult | null
  commits: ReadCommitResult[]
  /** when set, we're read-only viewing an old commit */
  viewingRef: string | null
  viewingBoards: Record<string, Board>

  // lifecycle
  boot: () => Promise<void>
  grantFolder: () => Promise<void>
  switchToFolder: () => Promise<void>
  switchToBrowser: () => Promise<void>
  cloneInto: (url: string) => Promise<void>

  // navigation / selection
  navigate: (boardId: string) => void
  select: (ids: string[], additive?: boolean) => void
  clearSelection: () => void

  // editing
  addCard: (boardId: string, card: Card) => void
  updateCard: (boardId: string, cardId: string, patch: Partial<Card>) => void
  moveCards: (boardId: string, deltas: Record<string, { x: number; y: number }>) => void
  removeCards: (boardId: string, ids: string[]) => void
  bringToFront: (boardId: string, cardId: string) => void
  sendToBack: (boardId: string, ids: string[]) => void
  /** insert ready-made cards + connectors (ids already fresh) */
  insert: (boardId: string, cards: Card[], connectors: Connector[]) => void
  createBoard: (parentId: string, name: string, at: { x: number; y: number }) => string
  renameBoard: (boardId: string, name: string) => void
  /** shared workspace settings + name (committed) */
  updateMeta: (patch: { name?: string; settings?: Partial<WorkspaceSettings> }) => void
  styleCards: (boardId: string, ids: string[], patch: Partial<CardStyle>) => void
  styleConnectors: (boardId: string, ids: string[], patch: Partial<ConnectorStyle>) => void
  setBoardStyle: (boardId: string, patch: Partial<BoardStyle>) => void
  addConnector: (boardId: string, c: Connector) => void
  updateConnector: (boardId: string, id: string, patch: Partial<Connector>) => void
  removeConnectors: (boardId: string, ids: string[]) => void
  addAssets: (boardId: string, files: File[], at: { x: number; y: number }) => Promise<void>

  // persistence
  /** write pending in-memory edits to the working tree (not a commit) */
  flush: () => Promise<void>

  // git
  save: (message?: string) => Promise<boolean>
  /** fetch, then push / fast-forward / ask about a merge — the one entry point for talking to the remote */
  sync: (opts?: { silent?: boolean }) => Promise<void>
  resolveDivergence: (mode: Resolution) => Promise<void>
  push: () => Promise<boolean>
  pull: () => Promise<void>
  setRemote: (url: string) => Promise<void>
  refreshGit: () => Promise<void>
  viewCommit: (oid: string | null) => Promise<void>
  restoreCommit: (oid: string) => Promise<void>
}

const isDirty = (s: Pick<WorkspaceState, 'dirtyBoards' | 'deletedBoards' | 'assetsTouched' | 'treeDirty' | 'metaDirty'>) =>
  s.dirtyBoards.size > 0 || s.deletedBoards.size > 0 || s.assetsTouched || s.treeDirty || s.metaDirty

export const selectDirty = (s: WorkspaceState) => isDirty(s)

function identity() {
  const s = useSettings.getState()
  return { name: s.authorName, email: s.authorEmail }
}
function remoteAuth() {
  const s = useSettings.getState()
  return { token: s.token, username: s.username, corsProxy: s.corsProxy }
}

async function loadBoards(fs: PeepoFS): Promise<{ meta: WorkspaceMeta; boards: Record<string, Board> }> {
  const meta = parseWorkspace(await readText(fs, abs(fs, WORKSPACE_FILE)))
  const boards: Record<string, Board> = {}
  const dir = abs(fs, BOARDS_DIR)
  if (await exists(fs, dir)) {
    for (const f of await fs.promises.readdir(dir)) {
      if (!f.endsWith('.json')) continue
      try {
        const b = parseBoard(await readText(fs, `${dir}/${f}`))
        boards[b.id] = b
      } catch (e) {
        console.warn('bad board file', f, e)
      }
    }
  }
  return { meta, boards }
}

async function seedWorkspace(fs: PeepoFS): Promise<void> {
  const rootId = newId()
  const meta: WorkspaceMeta = { version: 1, name: 'peeponote', rootBoardId: rootId }
  await writeText(fs, abs(fs, WORKSPACE_FILE), JSON.stringify(meta, null, 2))
  // Home + the "How to use peeponote" walkthrough
  for (const b of tutorialBoards(rootId)) await writeText(fs, abs(fs, boardPath(b.id)), JSON.stringify(b, null, 2))
  await writeText(fs, abs(fs, '.gitignore'), '.DS_Store\n')
  await writeText(
    fs,
    abs(fs, 'README.md'),
    '# peeponote board\n\nThis repository is a [peeponote](https://github.com/) workspace. Boards live in `boards/`, files in `assets/`.\n',
  )
}

async function sha1Short(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', buf)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8)
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_')
}

export const useWorkspace = create<WorkspaceState>((set, get) => {
  async function openFs(fs: PeepoFS) {
    set({ busy: 'loading', fs, status: 'ready', error: null, viewingRef: null, viewingBoards: {} })
    try {
      if (!(await repo.isRepo(fs))) {
        await repo.initRepo(fs)
      }
      if (!(await exists(fs, abs(fs, WORKSPACE_FILE)))) {
        await seedWorkspace(fs)
        await repo.stageAll(fs)
        await repo.commit(fs, 'peepoHey welcome board', identity())
      }
      const { meta, boards } = await loadBoards(fs)
      set({
        meta,
        boards,
        currentBoardId: meta.rootBoardId,
        dirtyBoards: new Set(),
        deletedBoards: new Set(),
        assetsTouched: false,
        metaDirty: false,
        treeDirty: await repo.hasChanges(fs),
        selection: new Set(),
      })
      await get().refreshGit()
    } catch (e) {
      console.error(e)
      set({ status: 'error', error: (e as Error).message })
    } finally {
      set({ busy: null })
    }
  }

  function mutateBoard(boardId: string, fn: (b: Board) => Board) {
    const b = get().boards[boardId]
    if (!b || get().viewingRef) return
    const next = fn(b)
    const dirtyBoards = new Set(get().dirtyBoards)
    dirtyBoards.add(boardId)
    set({ boards: { ...get().boards, [boardId]: next }, dirtyBoards })
    scheduleFlush()
  }

  function syncCtx(): SyncCtx | null {
    const { fs, remoteUrl } = get()
    if (!fs || !remoteUrl) return null
    return { fs, remoteUrl, auth: remoteAuth(), transport: chooseTransport(remoteUrl, useSettings.getState().transport), who: identity() }
  }
  const progress = (m: string) => set({ busyDetail: m })

  /** re-read boards from the working tree (after pull / merge / restore) */
  async function reloadBoards(fs: PeepoFS) {
    const { meta, boards } = await loadBoards(fs)
    const cur = get().currentBoardId
    set({
      meta,
      boards,
      currentBoardId: cur && boards[cur] ? cur : meta.rootBoardId,
      dirtyBoards: new Set(),
      deletedBoards: new Set(),
      assetsTouched: false,
      metaDirty: false,
      treeDirty: await repo.hasChanges(fs),
      selection: new Set(),
    })
    await get().refreshGit()
  }

  let flushTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleFlush() {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => void get().flush(), 400)
  }

  return {
    fs: null,
    status: 'booting',
    pendingHandle: null,
    error: null,
    meta: null,
    boards: {},
    currentBoardId: null,
    dirtyBoards: new Set(),
    deletedBoards: new Set(),
    assetsTouched: false,
    metaDirty: false,
    treeDirty: false,
    selection: new Set(),
    busy: null,
    busyDetail: null,
    divergence: null,
    remoteUrl: null,
    head: null,
    commits: [],
    viewingRef: null,
    viewingBoards: {},

    boot: async () => {
      try {
        const m = await mountLast()
        if (m.status === 'needs-permission') {
          set({ status: 'needs-permission', pendingHandle: m.handle })
          return
        }
        await openFs(m.fs)
      } catch (e) {
        set({ status: 'error', error: (e as Error).message })
      }
    },

    grantFolder: async () => {
      const h = get().pendingHandle
      if (!h) return
      const fs = await requestFolderPermission(h)
      if (fs) await openFs(fs)
      else toast.err('Folder access denied', 'peepoSad')
    },

    switchToFolder: async () => {
      const fs = await pickFolder()
      if (!fs) return
      await openFs(fs)
      toast.ok(`Mounted folder. Real .git on disk now.`, 'peepoPog')
    },

    switchToBrowser: async () => {
      const fs = await useBrowserStorage()
      await openFs(fs)
      toast.ok('Using browser storage', 'peepoSit')
    },

    cloneInto: async (url) => {
      const fs = get().fs
      if (!fs) return
      set({ busy: 'cloning' })
      try {
        if (await repo.isRepo(fs)) throw new Error('This storage already has a repo. Pick an empty folder or wipe browser storage first.')
        if (chooseTransport(url, useSettings.getState().transport) === 'api' && parseGitHubUrl(url)) await ghClone(fs, url, useSettings.getState().token, progress)
        else await repo.clone(fs, url, remoteAuth())
        toast.ok('Cloned! peepoPog', 'peepoPog')
        await openFs(fs)
      } catch (e) {
        toast.err(`Clone failed: ${(e as Error).message}`)
      } finally {
        set({ busy: null, busyDetail: null })
      }
    },

    navigate: (boardId) => set({ currentBoardId: boardId, selection: new Set() }),
    select: (ids, additive) =>
      set((s) => {
        const sel = additive ? new Set(s.selection) : new Set<string>()
        for (const id of ids) sel.add(id)
        return { selection: sel }
      }),
    clearSelection: () => set({ selection: new Set() }),

    addCard: (boardId, card) => mutateBoard(boardId, (b) => ({ ...b, cards: [...b.cards, card] })),

    updateCard: (boardId, cardId, patch) =>
      mutateBoard(boardId, (b) => ({
        ...b,
        cards: b.cards.map((c) => (c.id === cardId ? ({ ...c, ...patch } as Card) : c)),
      })),

    moveCards: (boardId, deltas) =>
      mutateBoard(boardId, (b) => ({
        ...b,
        cards: b.cards.map((c) => {
          const d = deltas[c.id]
          return d ? { ...c, x: c.x + d.x, y: c.y + d.y } : c
        }),
      })),

    removeCards: (boardId, ids) => {
      const b = get().boards[boardId]
      if (!b) return
      const removed = b.cards.filter((c) => ids.includes(c.id))
      // recursively delete nested boards
      const deleted = new Set(get().deletedBoards)
      const boards = { ...get().boards }
      const dirtyBoards = new Set(get().dirtyBoards)
      const rm = (id: string) => {
        const nb = boards[id]
        if (!nb) return
        for (const c of nb.cards) if (c.type === 'board') rm(c.boardId)
        delete boards[id]
        deleted.add(id)
        dirtyBoards.delete(id)
      }
      for (const c of removed) if (c.type === 'board') rm(c.boardId)
      const assetsTouched = get().assetsTouched || removed.some((c) => c.type === 'asset')
      const gone = new Set(ids)
      boards[boardId] = {
        ...b,
        cards: b.cards.filter((c) => !gone.has(c.id)),
        // drop connectors glued to removed cards
        connectors: b.connectors.filter((k) => !('cardId' in k.from && gone.has(k.from.cardId)) && !('cardId' in k.to && gone.has(k.to.cardId))),
      }
      dirtyBoards.add(boardId)
      set({ boards, deletedBoards: deleted, dirtyBoards, assetsTouched, selection: new Set() })
      scheduleFlush()
    },

    bringToFront: (boardId, cardId) =>
      mutateBoard(boardId, (b) => {
        const maxZ = b.cards.reduce((m, c) => Math.max(m, c.z), 0)
        const card = b.cards.find((c) => c.id === cardId)
        if (!card || card.z === maxZ) return b
        return { ...b, cards: b.cards.map((c) => (c.id === cardId ? { ...c, z: maxZ + 1 } : c)) }
      }),

    sendToBack: (boardId, ids) =>
      mutateBoard(boardId, (b) => {
        const minZ = b.cards.reduce((m, c) => Math.min(m, c.z), 0)
        return { ...b, cards: b.cards.map((c) => (ids.includes(c.id) ? { ...c, z: minZ - ids.length + ids.indexOf(c.id) } : c)) }
      }),

    insert: (boardId, cards, connectors) => {
      mutateBoard(boardId, (b) => {
        const maxZ = b.cards.reduce((m, c) => Math.max(m, c.z), 0)
        return {
          ...b,
          cards: [...b.cards, ...cards.map((c, i) => ({ ...c, z: maxZ + 1 + i }))],
          connectors: [...b.connectors, ...connectors],
        }
      })
      if (cards.some((c) => c.type === 'asset')) set({ assetsTouched: true, treeDirty: true })
    },

    createBoard: (parentId, name, at) => {
      const id = newId()
      const board: Board = { id, name, parentId, createdAt: new Date().toISOString(), cards: [], connectors: [] }
      const parent = get().boards[parentId]
      const z = parent ? parent.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1 : 1
      const dirtyBoards = new Set(get().dirtyBoards)
      dirtyBoards.add(id)
      set({ boards: { ...get().boards, [id]: board }, dirtyBoards })
      scheduleFlush()
      mutateBoard(parentId, (b) => ({
        ...b,
        cards: [...b.cards, { id: newId(), type: 'board', boardId: id, x: at.x, y: at.y, w: 200, h: 140, z }],
      }))
      return id
    },

    renameBoard: (boardId, name) => mutateBoard(boardId, (b) => ({ ...b, name })),

    updateMeta: (patch) => {
      const meta = get().meta
      if (!meta || get().viewingRef) return
      const settings = { ...(meta.settings ?? {}), ...(patch.settings ?? {}) }
      set({ meta: { ...meta, ...(patch.name !== undefined ? { name: patch.name } : {}), settings }, metaDirty: true })
      scheduleFlush()
    },

    styleCards: (boardId, ids, patch) =>
      mutateBoard(boardId, (b) => ({
        ...b,
        cards: b.cards.map((c) => (ids.includes(c.id) ? ({ ...c, style: mergeStyle(c.style, patch) } as Card) : c)),
      })),
    styleConnectors: (boardId, ids, patch) =>
      mutateBoard(boardId, (b) => ({
        ...b,
        connectors: b.connectors.map((k) => (ids.includes(k.id) ? { ...k, style: mergeStyle(k.style, patch) } : k)),
      })),
    setBoardStyle: (boardId, patch) => mutateBoard(boardId, (b) => ({ ...b, style: mergeStyle(b.style, patch) })),

    addConnector: (boardId, c) => mutateBoard(boardId, (b) => ({ ...b, connectors: [...b.connectors, c] })),
    updateConnector: (boardId, id, patch) =>
      mutateBoard(boardId, (b) => ({ ...b, connectors: b.connectors.map((k) => (k.id === id ? { ...k, ...patch } : k)) })),
    removeConnectors: (boardId, ids) => {
      mutateBoard(boardId, (b) => ({ ...b, connectors: b.connectors.filter((k) => !ids.includes(k.id)) }))
      set({ selection: new Set() })
    },

    addAssets: async (boardId, files, at) => {
      const fs = get().fs
      if (!fs || get().viewingRef) return
      let dx = 0
      for (const file of files) {
        const buf = await file.arrayBuffer()
        const hash = await sha1Short(buf)
        const path = `${ASSETS_DIR}/${hash}-${safeName(file.name)}`
        await writeBytes(fs, abs(fs, path), new Uint8Array(buf))
        const kind = detectKind(file.name, file.type)
        const size = kind === 'audio' ? { w: 300, h: 130 } : kind === 'code' || kind === 'data' ? { w: 320, h: 260 } : { w: 280, h: 280 }
        const b = get().boards[boardId]
        const z = b ? b.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1 : 1
        get().addCard(boardId, {
          id: newId(),
          type: 'asset',
          x: at.x + dx,
          y: at.y,
          ...size,
          z,
          path,
          name: file.name,
          mime: file.type,
          size: file.size,
          kind,
        })
        dx += size.w + 20
      }
      set({ assetsTouched: true, treeDirty: true })
    },

    flush: async () => {
      clearTimeout(flushTimer)
      const { fs, boards, dirtyBoards, deletedBoards, meta, metaDirty } = get()
      if (!fs || get().viewingRef || (dirtyBoards.size === 0 && deletedBoards.size === 0 && !metaDirty)) return
      if (metaDirty && meta) {
        await writeText(fs, abs(fs, WORKSPACE_FILE), JSON.stringify(meta, null, 2))
        if (get().meta === meta) set({ metaDirty: false })
      }
      const written: [string, Board][] = []
      for (const id of dirtyBoards) {
        const b = boards[id]
        if (!b) continue
        await writeText(fs, abs(fs, boardPath(id)), JSON.stringify(b, null, 2))
        written.push([id, b])
      }
      const removed: string[] = []
      for (const id of deletedBoards) {
        const p = abs(fs, boardPath(id))
        if (await exists(fs, p)) await fs.promises.unlink(p)
        removed.push(id)
      }
      // only clear what hasn't changed again while we were writing
      const nextDirty = new Set(get().dirtyBoards)
      for (const [id, b] of written) if (get().boards[id] === b) nextDirty.delete(id)
      const nextDeleted = new Set(get().deletedBoards)
      for (const id of removed) nextDeleted.delete(id)
      set({ dirtyBoards: nextDirty, deletedBoards: nextDeleted, treeDirty: true })
    },

    save: async (message) => {
      const fs = get().fs
      if (!fs || get().viewingRef) return false
      if (!isDirty(get())) {
        toast.info('Nothing to save. peepoSit', 'peepoSit')
        return false
      }
      set({ busy: 'saving' })
      try {
        await get().flush()
        const boards = get().boards
        // garbage-collect unreferenced assets
        const referenced = new Set<string>()
        for (const b of Object.values(boards)) for (const c of b.cards) if (c.type === 'asset') referenced.add(c.path)
        const assetsDir = abs(fs, ASSETS_DIR)
        if (await exists(fs, assetsDir)) {
          for (const f of await fs.promises.readdir(assetsDir)) {
            if (!referenced.has(`${ASSETS_DIR}/${f}`)) await fs.promises.unlink(`${assetsDir}/${f}`)
          }
        }
        const changes = await repo.stageAll(fs)
        const n = changes.added.length + changes.modified.length + changes.deleted.length
        if (n === 0) {
          set({ dirtyBoards: new Set(), deletedBoards: new Set(), assetsTouched: false, metaDirty: false, treeDirty: false })
          toast.info('No changes in the tree. peepoSit', 'peepoSit')
          return false
        }
        const msg = message?.trim() || defaultMessage(changes)
        await repo.commit(fs, msg, identity())
        set({ dirtyBoards: new Set(), deletedBoards: new Set(), assetsTouched: false, metaDirty: false, treeDirty: false })
        await get().refreshGit()
        toast.ok(`Committed: ${msg}`, 'peepoClap')
        // default: a save also syncs when a remote is set up (unless the user wants them separate)
        if (!useSettings.getState().separatePush && get().remoteUrl && useSettings.getState().token) {
          set({ busy: null })
          await get().sync({ silent: true })
        }
        return true
      } catch (e) {
        console.error(e)
        toast.err(`Save failed: ${(e as Error).message}`)
        return false
      } finally {
        set({ busy: null })
      }
    },

    sync: async ({ silent } = {}) => {
      const ctx = syncCtx()
      if (!ctx) {
        toast.err('No remote configured. Open settings. monkaS', 'monkaS')
        return
      }
      const { fs } = ctx
      if (get().busy) return
      set({ busy: 'syncing', busyDetail: null })
      try {
        const remote = await fetchRemote(ctx, progress)
        const local = await repo.headOid(fs)
        const st = await compare(fs, local, remote)
        const dirty = isDirty(get())
        switch (st.relation) {
          case 'same':
            if (!silent) toast.info('Already in sync. peepoSit', 'peepoSit')
            break
          case 'remote-empty':
          case 'ahead':
            if (!ctx.auth.token) throw new Error('A token is needed to push. Add one in Settings.')
            await pushRemote(ctx, progress)
            toast.ok(`Pushed ${st.ahead || ''} ${st.ahead === 1 ? 'commit' : 'commits'}. peepoRun`.replace('  ', ' '), 'peepoRun')
            break
          case 'local-empty':
          case 'behind':
            if (dirty) {
              toast.err('Remote has new changes — Save yours first, then pull. peepoShy', 'peepoShy')
              break
            }
            progress('updating working tree…')
            await resetTo(fs, remote!)
            await reloadBoards(fs)
            toast.ok(`Pulled ${st.behind} ${st.behind === 1 ? 'commit' : 'commits'}. peepoGlad`, 'peepoGlad')
            break
          case 'diverged':
            if (dirty) {
              toast.err('Remote has new changes — Save yours first, then sync. peepoShy', 'peepoShy')
              break
            }
            set({ divergence: st })
            break
        }
        await get().refreshGit()
      } catch (e) {
        console.error(e)
        toast.err(`Sync failed: ${(e as Error).message}`)
      } finally {
        set({ busy: null, busyDetail: null })
      }
    },

    resolveDivergence: async (mode) => {
      const d = get().divergence
      const ctx = syncCtx()
      if (!d || !ctx || !d.local || !d.remote) return
      set({ divergence: null, busy: 'syncing', busyDetail: null })
      try {
        const { fs } = ctx
        if (mode === 'force-push') {
          await pushRemote(ctx, progress, true)
          toast.ok('Remote overwritten with your version. monkaS', 'monkaS')
        } else if (mode === 'take-theirs') {
          await resetTo(fs, d.remote)
          await reloadBoards(fs)
          toast.ok('Took the remote version. Your commits are gone from this branch. FeelsOkayMan', 'FeelsOkayMan')
        } else {
          const r = await mergeRemote(fs, d.local, d.remote, mode === 'merge-ours' ? 'ours' : 'theirs', identity(), progress)
          await reloadBoards(fs)
          await pushRemote(ctx, progress)
          toast.ok(
            `Merged${r.files ? ` ${r.files} file${r.files === 1 ? '' : 's'}` : ''}${r.conflicts ? `, ${r.conflicts} conflict${r.conflicts === 1 ? '' : 's'} resolved` : ''} and pushed. peepoClap`,
            'peepoClap',
          )
        }
        await get().refreshGit()
      } catch (e) {
        console.error(e)
        toast.err(`Could not resolve: ${(e as Error).message}`)
      } finally {
        set({ busy: null, busyDetail: null })
      }
    },

    push: async () => {
      await get().sync()
      return true
    },

    pull: async () => {
      await get().sync()
    },

    setRemote: async (url) => {
      const fs = get().fs
      if (!fs) return
      await repo.setRemoteUrl(fs, url)
      set({ remoteUrl: url.trim() || null })
    },

    refreshGit: async () => {
      const fs = get().fs
      if (!fs) return
      const [commits, remoteUrl] = await Promise.all([repo.log(fs), repo.getRemoteUrl(fs)])
      set({ commits, head: commits[0] ?? null, remoteUrl })
    },

    viewCommit: async (oid) => {
      const fs = get().fs
      if (!fs) return
      if (!oid) {
        set({ viewingRef: null, viewingBoards: {}, selection: new Set() })
        return
      }
      set({ busy: 'loading' })
      try {
        const files = await repo.listFilesAt(fs, oid)
        const boards: Record<string, Board> = {}
        for (const f of files) {
          if (!f.startsWith(`${BOARDS_DIR}/`) || !f.endsWith('.json')) continue
          try {
            const b = parseBoard(await repo.readTextAt(fs, oid, f))
            boards[b.id] = b
          } catch {
            /* skip */
          }
        }
        const cur = get().currentBoardId
        const meta = get().meta
        set({
          viewingRef: oid,
          viewingBoards: boards,
          selection: new Set(),
          currentBoardId: cur && boards[cur] ? cur : meta && boards[meta.rootBoardId] ? meta.rootBoardId : Object.keys(boards)[0] ?? cur,
        })
      } catch (e) {
        toast.err(`Could not load commit: ${(e as Error).message}`)
      } finally {
        set({ busy: null })
      }
    },

    restoreCommit: async (oid) => {
      const fs = get().fs
      if (!fs) return
      set({ busy: 'loading' })
      try {
        await repo.hardResetTo(fs, oid)
        const { meta, boards } = await loadBoards(fs)
        set({
          meta,
          boards,
          viewingRef: null,
          viewingBoards: {},
          dirtyBoards: new Set(),
          deletedBoards: new Set(),
          assetsTouched: false,
          metaDirty: false,
          treeDirty: false,
          currentBoardId: meta.rootBoardId,
        })
        await get().refreshGit()
        toast.ok('Restored. Time travel complete. peepoPog', 'peepoPog')
      } catch (e) {
        toast.err(`Restore failed: ${(e as Error).message}`)
      } finally {
        set({ busy: null })
      }
    },
  }
})

/** Merge a style patch; `undefined` values delete keys, empty result becomes undefined. */
function mergeStyle<T extends object>(cur: T | undefined, patch: Partial<T>): T | undefined {
  const next = { ...(cur ?? {}) } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k]
    else next[k] = v
  }
  return Object.keys(next).length ? (next as T) : undefined
}

function defaultMessage(c: repo.ChangeSummary) {
  const parts: string[] = []
  if (c.added.length) parts.push(`add ${c.added.length}`)
  if (c.modified.length) parts.push(`update ${c.modified.length}`)
  if (c.deleted.length) parts.push(`remove ${c.deleted.length}`)
  return `Save: ${parts.join(', ')} file${c.added.length + c.modified.length + c.deleted.length === 1 ? '' : 's'}`
}

/** Boards as currently displayed (live or historical) */
export const selectBoards = (s: WorkspaceState) => (s.viewingRef ? s.viewingBoards : s.boards)

/** Read raw bytes for an asset path, honoring history view. */
export async function readAssetBytes(path: string): Promise<Uint8Array> {
  const { fs, viewingRef } = useWorkspace.getState()
  if (!fs) throw new Error('no fs')
  if (viewingRef) return repo.readBlobAt(fs, viewingRef, path)
  return readBytes(fs, abs(fs, path))
}
