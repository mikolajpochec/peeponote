import { create } from 'zustand'
import type { ReadCommitResult } from 'isomorphic-git'
import {
  abs, exists, mkdirp, mountLast, pickFolder, readBytes, readText, requestFolderPermission, useBrowserStorage,
  writeBytes, writeText, type PeepoFS,
} from '../fs'
import * as repo from '../git/repo'
import { chooseTransport, compare, fetchRemote, mergeBoardJson, mergeJsonShallow, mergeRemote, pushRemote, resetTo, type SyncCtx, type SyncState } from '../git/sync'
import { NotFastForwardError, ghClone, parseGitHubUrl } from '../git/githubApi'
import {
  ASSETS_DIR, BOARDS_DIR, WORKSPACE_FILE, boardPath, newId,
  type Board, type BoardStyle, type Card, type CardStyle, type Connector, type ConnectorStyle, type ShapeKind, type WorkspaceMeta, type WorkspaceSettings,
} from '../model/types'
import { parseBoard, parseWorkspace } from '../model/schema'
import { detectKind } from '../model/assetKind'
import { tutorialBoards } from '../model/tutorial'
import { useSettings } from './settings'
import { toast } from './toast'
import { confirm } from '../ui/confirm'
import { diffWorkspaces, formatAuthors, useArrivals } from '../canvas/arrivals'
import { rememberedStyle, styleKeyOf, useLastStyle } from './lastStyle'
import { boardSlug, cardSlug, validateSlug } from '../nav/peepoUrl'
import { findWorkspaces, rootHasOtherFiles, setWsPrefix, unwp, wp, wsPrefix } from '../fs/wsroot'
import { cardSummary } from '../nav/links'

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
  /** repo-relative folder holding peeponote.json ('' = repo root) and every folder that has one */
  wsRoot: string
  wsCandidates: string[]
  setWsRoot: (root: string) => Promise<void>
  /** boards visited before the current one (most recent last) — the floating Back button walks it */
  navStack: string[]
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
  goBack: () => void
  /** selecting any member of a group selects the whole group */
  select: (ids: string[], additive?: boolean) => void
  clearSelection: () => void

  // editing
  addCard: (boardId: string, card: Card) => void
  updateCard: (boardId: string, cardId: string, patch: Partial<Card>) => void
  moveCards: (boardId: string, deltas: Record<string, { x: number; y: number }>) => void
  removeCards: (boardId: string, ids: string[]) => void
  groupCards: (boardId: string, ids: string[]) => void
  /** whole-workspace undo / redo of board edits (⌘Z / ⇧⌘Z); text typing has its own history inside the editor */
  undo: () => boolean
  redo: () => boolean
  undoRemoval: () => boolean
  ungroupCards: (boardId: string, ids: string[]) => void
  bringToFront: (boardId: string, cardId: string) => void
  sendToBack: (boardId: string, ids: string[]) => void
  /** insert ready-made cards + connectors (ids already fresh) */
  insert: (boardId: string, cards: Card[], connectors: Connector[]) => void
  createBoard: (parentId: string, name: string, at: { x: number; y: number }) => string
  renameBoard: (boardId: string, name: string) => void
  setBoardIcon: (boardId: string, icon: string | undefined) => void
  /** peepo:// path segment; validated for uniqueness among siblings, '' clears */
  setBoardSlug: (boardId: string, slug: string) => boolean
  setCardSlug: (boardId: string, cardId: string, slug: string) => boolean
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
  /** background check: pull others' commits when it's a clean fast-forward; never blocks, never dialogs */
  autoSync: () => Promise<void>
  pull: () => Promise<void>
  setRemote: (url: string) => Promise<void>
  refreshGit: () => Promise<void>
  viewCommit: (oid: string | null) => Promise<void>
  restoreCommit: (oid: string) => Promise<void>
  /** drop every unsaved edit and go back to the last save (asks first) */
  discardChanges: () => Promise<void>
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
  const meta = parseWorkspace(await readText(fs, abs(fs, wp(WORKSPACE_FILE))))
  const boards: Record<string, Board> = {}
  const dir = abs(fs, wp(BOARDS_DIR))
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
  if (wsPrefix()) await mkdirp(fs, abs(fs, wsPrefix()))
  const rootId = newId()
  const meta: WorkspaceMeta = { version: 1, name: 'peeponote', rootBoardId: rootId }
  await writeText(fs, abs(fs, wp(WORKSPACE_FILE)), JSON.stringify(meta, null, 2))
  // Home + the "How to use peeponote" walkthrough
  for (const b of tutorialBoards(rootId)) await writeText(fs, abs(fs, wp(boardPath(b.id))), JSON.stringify(b, null, 2))
  await writeText(fs, abs(fs, wp('.gitignore')), '.DS_Store\n')
  await writeText(fs, abs(fs, wp('README.md')), workspaceReadme())
}

const PROJECT_URL = 'https://github.com/mikolajpochec/peeponote'

/** README committed into every fresh workspace repo: says what this is and how to open it */
function workspaceReadme(): string {
  // the app that created this workspace — hosted URL or wherever it runs
  const app = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : PROJECT_URL
  return [
    '# peeponote board',
    '',
    `This repository is a [peeponote](${PROJECT_URL}) workspace — a visual board app where every Save is a git commit.`,
    '',
    `**Open it:** go to [${app}](${app}) → Settings → *Clone an existing peeponote repo* → paste this repository's URL.`,
    '',
    '## Layout',
    '',
    '- `peeponote.json` — workspace name, root board id, shared settings',
    '- `boards/<id>.json` — one file per board: cards, connectors, style',
    '- `assets/<sha>-<name>` — files dropped onto boards (images, audio, 3D models, code, …), content-addressed',
    '',
    'Everything is plain JSON and regular files, so it diffs, merges and greps like any other repo.',
    '',
  ].join('\n')
}

/** every member of every group touched by `ids` */
export function expandGroups(cards: Card[], ids: Iterable<string>): string[] {
  const want = new Set(ids)
  const groups = new Set<string>()
  for (const c of cards) if (want.has(c.id) && c.groupId) groups.add(c.groupId)
  if (groups.size) for (const c of cards) if (c.groupId && groups.has(c.groupId)) want.add(c.id)
  return [...want]
}

/** a group of one is no group */
function dissolveSingletons(cards: Card[]): Card[] {
  const count = new Map<string, number>()
  for (const c of cards) if (c.groupId) count.set(c.groupId, (count.get(c.groupId) ?? 0) + 1)
  if (![...count.values()].some((n) => n < 2)) return cards
  return cards.map((c) => {
    if (c.groupId && (count.get(c.groupId) ?? 0) < 2) {
      const { groupId: _g, ...rest } = c
      return rest as Card
    }
    return c
  })
}

/** natural aspect of a dropped picture, scaled to fit the default card footprint */
async function pictureSize(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file)
    const { width, height } = bmp
    bmp.close()
    if (!width || !height) return null
    const k = Math.min(1, 360 / width, 360 / height)
    return { w: Math.max(40, Math.round(width * k)), h: Math.max(40, Math.round(height * k)) }
  } catch {
    return null // svg without intrinsic size, or an undecodable file
  }
}

let lastNotifiedRemote: string | null = null

// ---- undo / redo: whole-workspace snapshots (cheap — they share the untouched board objects) ------
interface Snapshot {
  boards: Record<string, Board>
  dirtyBoards: Set<string>
  deletedBoards: Set<string>
  currentBoardId: string | null
}
const undoStack: Snapshot[] = []
const redoStack: Snapshot[] = []
let lastMutationAt = 0
const UNDO_LIMIT = 100
/** mutations closer than this are one gesture (a drag, a resize) and share one undo step */
const COALESCE_MS = 350

function withRemembered(card: Card): Card {
  if (card.style) return card
  const style = rememberedStyle(styleKeyOf(card))
  return style ? ({ ...card, style } as Card) : card
}

// where you were, per workspace — survives a refresh
const navKey = (rootId: string) => `peeponote-nav:${rootId}`
function saveNav(rootId: string | undefined, current: string, stack: string[]) {
  if (!rootId) return
  try {
    localStorage.setItem(navKey(rootId), JSON.stringify({ current, stack }))
  } catch {
    /* storage unavailable */
  }
}
function loadNav(rootId: string, boards: Record<string, Board>): { current: string; stack: string[] } {
  try {
    const raw = localStorage.getItem(navKey(rootId))
    if (raw) {
      const v = JSON.parse(raw) as { current?: string; stack?: string[] }
      const stack = (v.stack ?? []).filter((id) => boards[id])
      if (v.current && boards[v.current]) return { current: v.current, stack }
    }
  } catch {
    /* ignore */
  }
  return { current: rootId, stack: [] }
}

/** display names of everyone who committed between `from` (exclusive) and `to` (inclusive) */
async function authorsBetween(fs: PeepoFS, to: string, from: string | null): Promise<string> {
  try {
    const log = await repo.log(fs, 50, to)
    const names: string[] = []
    for (const c of log) {
      if (c.oid === from) break
      names.push(c.commit.author.name)
    }
    return formatAuthors(names)
  } catch {
    return 'Someone'
  }
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
      // monorepo-friendly: the workspace is wherever peeponote.json lives (root, or one subfolder)
      const found = await findWorkspaces(fs)
      const preferred = localStorage.getItem(`peeponote-wsroot:${fs.label}`)
      let root: string
      if (preferred !== null && found.includes(preferred)) root = preferred
      else if (found.length) root = found[0]
      else root = (await rootHasOtherFiles(fs)) ? 'peeponote' : '' // fresh workspace in a non-empty repo → its own folder
      setWsPrefix(root)
      if (!found.length && wsPrefix()) await mkdirp(fs, abs(fs, wsPrefix()))
      set({ wsRoot: wsPrefix(), wsCandidates: found })
      if (!(await exists(fs, abs(fs, wp(WORKSPACE_FILE))))) {
        await seedWorkspace(fs)
        await repo.stageAll(fs)
        await repo.commit(fs, 'Welcome board', identity())
      }
      const { meta, boards } = await loadBoards(fs)
      const nav = loadNav(meta.rootBoardId, boards)
      set({
        meta,
        boards,
        currentBoardId: nav.current,
        navStack: nav.stack,
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

  /** call before changing boards: pushes an undo step (coalescing rapid-fire changes) and clears redo */
  function record(force = false) {
    const now = Date.now()
    if (!force && now - lastMutationAt < COALESCE_MS && undoStack.length) {
      lastMutationAt = now
      return
    }
    lastMutationAt = now
    undoStack.push({ boards: get().boards, dirtyBoards: new Set(get().dirtyBoards), deletedBoards: new Set(get().deletedBoards), currentBoardId: get().currentBoardId })
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    redoStack.length = 0
  }
  function restore(snap: Snapshot) {
    const dirty = new Set(snap.dirtyBoards)
    for (const id of Object.keys(snap.boards)) if (!get().boards[id] || JSON.stringify(snap.boards[id]) !== JSON.stringify(get().boards[id])) dirty.add(id)
    // boards that exist now but not in the snapshot were created after it → their files must go
    const deleted = new Set([...get().deletedBoards].filter((id) => !snap.boards[id]))
    for (const id of Object.keys(get().boards)) if (!snap.boards[id]) deleted.add(id)
    const cur = get().currentBoardId
    set({ boards: snap.boards, dirtyBoards: dirty, deletedBoards: deleted, selection: new Set(), currentBoardId: cur && snap.boards[cur] ? cur : snap.currentBoardId })
    scheduleFlush()
  }

  function mutateBoard(boardId: string, fn: (b: Board) => Board) {
    const b = get().boards[boardId]
    if (!b || get().viewingRef) return
    const next = fn(b)
    if (next === b) return // a no-op (e.g. bringing the top card to front) must not mark anything unsaved
    record()
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

  /** re-read boards from the working tree (after pull / merge / restore); highlights what changed */
  async function reloadBoards(fs: PeepoFS) {
    const prev = get().boards
    undoStack.length = 0
    redoStack.length = 0
    // the workspace folder may have moved in the commits we just pulled (e.g. repo turned into a monorepo)
    if (!(await exists(fs, abs(fs, wp(WORKSPACE_FILE))))) {
      const found = await findWorkspaces(fs)
      if (found.length) {
        setWsPrefix(found[0])
        set({ wsRoot: found[0], wsCandidates: found })
      }
    }
    const { meta, boards } = await loadBoards(fs)
    const arrived = diffWorkspaces(prev, boards)
    useArrivals.getState().mark(arrived.cards, arrived.boards)
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

  /**
   * Fast-forward to `remote` while keeping uncommitted edits: for every board I changed, three-way merge
   * (base = my HEAD version, ours = my draft, theirs = remote version). Refuses (returns false, changes
   * nothing) when the same card / board setting was touched on both sides.
   */
  async function pullUnderDrafts(fs: PeepoFS, local: string, remote: string): Promise<boolean> {
    await get().flush()
    const s = get()
    const at = async (ref: string, rel: string) => {
      try {
        return await repo.readTextAt(fs, ref, wp(rel))
      } catch {
        return undefined
      }
    }
    const plan: { id: string; json: string }[] = []
    for (const id of s.dirtyBoards) {
      const mine = s.boards[id]
      if (!mine) continue
      const rel = boardPath(id)
      const [base, theirs] = await Promise.all([at(local, rel), at(remote, rel)])
      if (theirs === undefined) {
        if (base !== undefined) return false // they deleted a board I'm editing
        plan.push({ id, json: JSON.stringify(mine, null, 2) }) // my new board
        continue
      }
      if (base === theirs) {
        plan.push({ id, json: JSON.stringify(mine, null, 2) }) // untouched by them: keep my draft
        continue
      }
      const m = mergeBoardJson(base, JSON.stringify(mine, null, 2), theirs, 'ours')
      if (m.conflicts > 0) return false
      plan.push({ id, json: m.json })
    }
    for (const id of s.deletedBoards) {
      const rel = boardPath(id)
      const [base, theirs] = await Promise.all([at(local, rel), at(remote, rel)])
      if (theirs !== undefined && theirs !== base) return false // I deleted it, they changed it
    }
    let metaJson: string | undefined
    if (s.metaDirty && s.meta) {
      const [base, theirs] = await Promise.all([at(local, WORKSPACE_FILE), at(remote, WORKSPACE_FILE)])
      if (theirs !== undefined && theirs !== base) metaJson = mergeJsonShallow(base, JSON.stringify(s.meta, null, 2), theirs, 'ours')
    }

    // nothing clashes: move HEAD, then lay the drafts back on top
    await resetTo(fs, remote)
    await reloadBoards(fs)
    const boards = { ...get().boards }
    const dirty = new Set<string>()
    for (const p of plan) {
      boards[p.id] = parseBoard(p.json)
      dirty.add(p.id)
    }
    for (const id of s.deletedBoards) delete boards[id]
    const meta = metaJson ? parseWorkspace(metaJson) : s.metaDirty ? s.meta : get().meta
    set({ boards, dirtyBoards: dirty, deletedBoards: new Set(s.deletedBoards), meta, metaDirty: s.metaDirty, assetsTouched: s.assetsTouched })
    await get().flush()
    return true
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
    wsRoot: '',
    wsCandidates: [],
    navStack: [],
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
        toast.ok('Cloned!', 'peepoPog')
        await openFs(fs)
      } catch (e) {
        toast.fail('Clone failed', e, { url, transport: chooseTransport(url, useSettings.getState().transport) })
      } finally {
        set({ busy: null, busyDetail: null })
      }
    },

    setWsRoot: async (root) => {
      const fs = get().fs
      if (!fs) return
      localStorage.setItem(`peeponote-wsroot:${fs.label}`, root)
      await get().flush()
      await openFs(fs)
    },

    navigate: (boardId) =>
      set((s) => {
        if (boardId === s.currentBoardId) return s
        const stack = s.currentBoardId ? [...s.navStack.filter((id) => id !== boardId), s.currentBoardId].slice(-30) : s.navStack
        saveNav(s.meta?.rootBoardId, boardId, stack)
        return { currentBoardId: boardId, navStack: stack, selection: new Set() }
      }),
    goBack: () =>
      set((s) => {
        const stack = [...s.navStack]
        let target: string | undefined
        while (stack.length && !target) {
          const id = stack.pop()!
          if (s.boards[id]) target = id
        }
        if (!target) return s
        saveNav(s.meta?.rootBoardId, target, stack)
        return { currentBoardId: target, navStack: stack, selection: new Set() }
      }),
    select: (ids, additive) =>
      set((s) => {
        const sel = additive ? new Set(s.selection) : new Set<string>()
        const cards = s.currentBoardId ? (s.viewingRef ? s.viewingBoards : s.boards)[s.currentBoardId]?.cards ?? [] : []
        for (const id of expandGroups(cards, ids)) sel.add(id)
        return { selection: sel }
      }),

    groupCards: (boardId, ids) => {
      if (ids.length < 2) return
      const gid = newId()
      const set_ = new Set(ids)
      mutateBoard(boardId, (b) => ({ ...b, cards: dissolveSingletons(b.cards.map((c) => (set_.has(c.id) ? { ...c, groupId: gid } : c))) }))
    },
    ungroupCards: (boardId, ids) => {
      const set_ = new Set(ids)
      mutateBoard(boardId, (b) => ({
        ...b,
        cards: dissolveSingletons(
          b.cards.map((c) => {
            if (!set_.has(c.id) || !c.groupId) return c
            const { groupId: _g, ...rest } = c
            return rest as Card
          }),
        ),
      }))
    },
    clearSelection: () => set({ selection: new Set() }),

    // new cards start with the style you last gave a card of that kind
    addCard: (boardId, card) => mutateBoard(boardId, (b) => ({ ...b, cards: [...b.cards, withRemembered(card)] })),

    updateCard: (boardId, cardId, patch) => {
      if ('shape' in patch && patch.shape) useLastStyle.getState().rememberShape(patch.shape as ShapeKind)
      mutateBoard(boardId, (b) => ({
        ...b,
        cards: b.cards.map((c) => (c.id === cardId ? ({ ...c, ...patch } as Card) : c)),
      }))
    },

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
      if (!removed.length) return
      record(true)
      const nestedBoards = removed.filter((c) => c.type === 'board').length
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
        cards: dissolveSingletons(b.cards.filter((c) => !gone.has(c.id))),
        // drop connectors glued to removed cards
        connectors: b.connectors.filter((k) => !('cardId' in k.from && gone.has(k.from.cardId)) && !('cardId' in k.to && gone.has(k.to.cardId))),
      }
      dirtyBoards.add(boardId)
      set({ boards, deletedBoards: deleted, dirtyBoards, assetsTouched, selection: new Set() })
      scheduleFlush()
      const what = nestedBoards ? `${nestedBoards === 1 ? 'Board' : `${nestedBoards} boards`} and ${removed.length - nestedBoards ? `${removed.length - nestedBoards} more ` : ''}` : removed.length === 1 ? cardSummary(removed[0]) : `${removed.length} items`
      toast.action(`${what} deleted (⌘Z to undo)`, 'Undo', () => get().undoRemoval(), nestedBoards ? 'PepeHands' : 'peepoShy')
    },

    undo: () => {
      const snap = undoStack.pop()
      if (!snap) return false
      redoStack.push({ boards: get().boards, dirtyBoards: new Set(get().dirtyBoards), deletedBoards: new Set(get().deletedBoards), currentBoardId: get().currentBoardId })
      restore(snap)
      return true
    },
    redo: () => {
      const snap = redoStack.pop()
      if (!snap) return false
      undoStack.push({ boards: get().boards, dirtyBoards: new Set(get().dirtyBoards), deletedBoards: new Set(get().deletedBoards), currentBoardId: get().currentBoardId })
      lastMutationAt = 0
      restore(snap)
      return true
    },
    undoRemoval: () => get().undo(),

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
      record(true)
      const dirtyBoards = new Set(get().dirtyBoards)
      dirtyBoards.add(id)
      set({ boards: { ...get().boards, [id]: board }, dirtyBoards })
      scheduleFlush()
      lastMutationAt = Date.now() // the parent's card below is the same step
      mutateBoard(parentId, (b) => ({
        ...b,
        cards: [...b.cards, withRemembered({ id: newId(), type: 'board', boardId: id, x: at.x, y: at.y, w: 200, h: 96, z })],
      }))
      return id
    },

    renameBoard: (boardId, name) => mutateBoard(boardId, (b) => ({ ...b, name })),
    setBoardIcon: (boardId, icon) => mutateBoard(boardId, (b) => ({ ...b, icon })),
    setBoardSlug: (boardId, slugRaw) => {
      const slug = slugRaw.trim()
      const b = get().boards[boardId]
      if (!b) return false
      if (slug) {
        const siblings = Object.values(get().boards).filter((x) => x.parentId === b.parentId && x.id !== boardId)
        const err = validateSlug(slug, siblings.map(boardSlug), undefined)
        if (err) {
          toast.err(err)
          return false
        }
      }
      mutateBoard(boardId, (x) => {
        const { slug: _s, ...rest } = x
        return slug ? { ...rest, slug } : (rest as Board)
      })
      return true
    },
    setCardSlug: (boardId, cardId, slugRaw) => {
      const slug = slugRaw.trim()
      const b = get().boards[boardId]
      if (!b) return false
      if (slug) {
        const err = validateSlug(slug, b.cards.filter((c) => c.id !== cardId).map(cardSlug))
        if (err) {
          toast.err(err)
          return false
        }
      }
      mutateBoard(boardId, (x) => ({
        ...x,
        cards: x.cards.map((c) => {
          if (c.id !== cardId) return c
          const { slug: _s, ...rest } = c
          return (slug ? { ...rest, slug } : rest) as Card
        }),
      }))
      return true
    },

    updateMeta: (patch) => {
      const meta = get().meta
      if (!meta || get().viewingRef) return
      const settings = { ...(meta.settings ?? {}), ...(patch.settings ?? {}) }
      set({ meta: { ...meta, ...(patch.name !== undefined ? { name: patch.name } : {}), settings }, metaDirty: true })
      scheduleFlush()
    },

    styleCards: (boardId, ids, patch) => {
      const keys = new Set((get().boards[boardId]?.cards ?? []).filter((c) => ids.includes(c.id)).map(styleKeyOf))
      for (const k of keys) useLastStyle.getState().rememberCard(k, patch)
      mutateBoard(boardId, (b) => ({
        ...b,
        cards: b.cards.map((c) => (ids.includes(c.id) ? ({ ...c, style: mergeStyle(c.style, patch) } as Card) : c)),
      }))
    },
    styleConnectors: (boardId, ids, patch) => {
      useLastStyle.getState().rememberConnector(patch)
      mutateBoard(boardId, (b) => ({
        ...b,
        connectors: b.connectors.map((k) => (ids.includes(k.id) ? { ...k, style: mergeStyle(k.style, patch) } : k)),
      }))
    },
    setBoardStyle: (boardId, patch) => mutateBoard(boardId, (b) => ({ ...b, style: mergeStyle(b.style, patch) })),

    addConnector: (boardId, c) => {
      const last = useLastStyle.getState()
      const style = c.style ?? (Object.keys(last.connector).length ? { ...last.connector } : undefined)
      mutateBoard(boardId, (b) => ({ ...b, connectors: [...b.connectors, { ...c, style }] }))
    },
    updateConnector: (boardId, id, patch) => {
      if (patch.arrows) useLastStyle.getState().rememberArrows(patch.arrows)
      mutateBoard(boardId, (b) => ({ ...b, connectors: b.connectors.map((k) => (k.id === id ? { ...k, ...patch } : k)) }))
    },
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
        await writeBytes(fs, abs(fs, wp(path)), new Uint8Array(buf))
        const kind = detectKind(file.name, file.type)
        let size = kind === 'audio' ? { w: 300, h: 130 } : kind === 'code' || kind === 'data' ? { w: 320, h: 260 } : { w: 280, h: 280 }
        if (kind === 'image' || kind === 'texture') size = (await pictureSize(file)) ?? size
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
        await writeText(fs, abs(fs, wp(WORKSPACE_FILE)), JSON.stringify(meta, null, 2))
        if (get().meta === meta) set({ metaDirty: false })
      }
      const written: [string, Board][] = []
      for (const id of dirtyBoards) {
        const b = boards[id]
        if (!b) continue
        await writeText(fs, abs(fs, wp(boardPath(id))), JSON.stringify(b, null, 2))
        written.push([id, b])
      }
      const removed: string[] = []
      for (const id of deletedBoards) {
        const p = abs(fs, wp(boardPath(id)))
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
        toast.info('Nothing to save.', 'peepoSit')
        return false
      }
      set({ busy: 'saving' })
      try {
        await get().flush()
        const boards = get().boards
        // garbage-collect unreferenced assets
        const referenced = new Set<string>()
        for (const b of Object.values(boards)) for (const c of b.cards) if (c.type === 'asset') referenced.add(c.path)
        const assetsDir = abs(fs, wp(ASSETS_DIR))
        if (await exists(fs, assetsDir)) {
          for (const f of await fs.promises.readdir(assetsDir)) {
            if (!referenced.has(`${ASSETS_DIR}/${f}`)) await fs.promises.unlink(`${assetsDir}/${f}`)
          }
        }
        const changes = await repo.stageAll(fs)
        const n = changes.added.length + changes.modified.length + changes.deleted.length
        if (n === 0) {
          set({ dirtyBoards: new Set(), deletedBoards: new Set(), assetsTouched: false, metaDirty: false, treeDirty: false })
          toast.info('No changes in the tree.', 'peepoSit')
          return false
        }
        const msg = message?.trim() || defaultMessage(changes)
        await repo.commit(fs, msg, identity())
        set({ dirtyBoards: new Set(), deletedBoards: new Set(), assetsTouched: false, metaDirty: false, treeDirty: false })
        await get().refreshGit()
        toast.ok(`Committed: ${msg}`, 'peepoClap')
        // a save also syncs when a remote is set up: pull others' work, merge if needed, push
        if (get().remoteUrl && useSettings.getState().token) {
          set({ busy: null })
          await get().sync({ silent: true })
        }
        return true
      } catch (e) {
        console.error(e)
        toast.fail('Save failed', e, { storage: get().fs?.label, head: get().head?.oid, remote: get().remoteUrl })
        return false
      } finally {
        set({ busy: null })
      }
    },

    sync: async ({ silent } = {}) => {
      const ctx = syncCtx()
      if (!ctx) {
        toast.err('No remote configured. Open settings.', 'monkaS')
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
            if (!silent) toast.info('Already in sync.', 'peepoSit')
            break
          case 'remote-empty':
          case 'ahead': {
            if (!ctx.auth.token) throw new Error('A token is needed to push. Add one in Settings.')
            try {
              await pushRemote(ctx, progress)
            } catch (e) {
              if (!(e instanceof NotFastForwardError)) throw e
              // the remote moved while we were pushing: look again and offer the merge dialog instead of failing
              const remote2 = await fetchRemote(ctx, progress)
              const st2 = await compare(fs, await repo.headOid(fs), remote2)
              if (st2.relation === 'diverged') {
                set({ divergence: { ...st2, who: await authorsBetween(fs, remote2!, await repo.headOid(fs)), dirty: isDirty(get()) } })
                break
              }
              if (st2.relation === 'ahead') await pushRemote(ctx, progress)
              else if (st2.relation === 'behind') {
                await resetTo(fs, remote2!)
                await reloadBoards(fs)
              }
            }
            toast.ok(`Pushed ${st.ahead || ''} ${st.ahead === 1 ? 'commit' : 'commits'}.`.replace('  ', ' '), 'peepoRun')
            break
          }
          case 'local-empty':
          case 'behind':
            if (dirty) {
              if (local && (await pullUnderDrafts(fs, local, remote!))) {
                toast.ok(`Pulled ${st.behind} ${st.behind === 1 ? 'commit' : 'commits'} — your unsaved edits are still here.`, 'peepoGlad')
              } else toast.err('Others changed a card you are editing — Save yours first, then they get combined.', 'peepoShy')
              break
            }
            progress('updating working tree…')
            await resetTo(fs, remote!)
            await reloadBoards(fs)
            toast.ok(`Pulled ${st.behind} ${st.behind === 1 ? 'commit' : 'commits'}.`, 'peepoGlad')
            break
          case 'diverged': {
            if (dirty) {
              set({ divergence: { ...st, who: await authorsBetween(fs, remote!, local), dirty } })
              break
            }
            // no card edited by both sides → combine silently and push; otherwise ask which version wins
            const probe = await mergeRemote(fs, local!, remote!, 'ours', identity(), progress, true)
            const who = await authorsBetween(fs, remote!, local)
            if (probe.conflicts === 0) {
              await mergeRemote(fs, local!, remote!, 'ours', identity(), progress)
              await reloadBoards(fs)
              await pushRemote(ctx, progress)
              toast.ok(`Combined with ${who}'s changes and pushed.`, 'peepoClap')
            } else {
              set({ divergence: { ...st, who, dirty } })
            }
            break
          }
        }
        await get().refreshGit()
      } catch (e) {
        console.error(e)
        toast.fail('Sync failed', e, { remote: ctx.remoteUrl, transport: ctx.transport, head: get().head?.oid, hasToken: !!ctx.auth.token, storage: fs.label })
      } finally {
        set({ busy: null, busyDetail: null })
      }
    },

    autoSync: async () => {
      const ctx = syncCtx()
      if (!ctx || get().busy || get().viewingRef || get().divergence || document.visibilityState === 'hidden') return
      const { fs } = ctx
      try {
        const remote = await fetchRemote(ctx)
        const local = await repo.headOid(fs)
        if (!remote || remote === local) return
        const st = await compare(fs, local, remote)
        if (st.relation !== 'behind' && st.relation !== 'local-empty') {
          // diverged: something to decide — say so once per remote head, don't nag
          if (st.relation === 'diverged' && lastNotifiedRemote !== remote) {
            lastNotifiedRemote = remote
            const who = await authorsBetween(fs, remote, local)
            const dirty = isDirty(get())
            // both sides moved. Clean tree + nobody edited the same card → combine and push by ourselves
            if (!dirty && ctx.auth.token) {
              const probe = await mergeRemote(fs, local!, remote, 'ours', identity(), progress, true)
              if (probe.conflicts === 0) {
                set({ busy: 'syncing', busyDetail: 'combining changes…' })
                await mergeRemote(fs, local!, remote, 'ours', identity(), progress)
                await reloadBoards(fs)
                await pushRemote(ctx, progress)
                toast.ok(`Combined with ${who}'s changes and pushed.`, 'peepoClap')
                return
              }
            }
            // real clashes (or unsaved edits): ask, in plain words
            set({ divergence: { ...st, who, dirty } })
          }
          return
        }
        if (isDirty(get()) && useSettings.getState().autoPull && !get().busy) {
          // others' commits don't touch what I'm editing → pull them in and keep my drafts on top
          set({ busy: 'syncing', busyDetail: 'bringing in changes…' })
          const who = await authorsBetween(fs, remote, local)
          const ok = await pullUnderDrafts(fs, local!, remote)
          set({ busy: null, busyDetail: null })
          if (ok) {
            lastNotifiedRemote = remote
            toast.ok(`${who} added changes (${st.behind} ${st.behind === 1 ? 'commit' : 'commits'}) — your unsaved edits are still here.`, 'peepoHey')
            return
          }
        }
        if (isDirty(get()) || !useSettings.getState().autoPull) {
          // can't (or shouldn't) pull automatically — say so, once per remote head
          if (lastNotifiedRemote !== remote) {
            lastNotifiedRemote = remote
            const who = await authorsBetween(fs, remote, local)
            toast.action(
              isDirty(get()) ? `${who} pushed changes — Save yours to pull them in.` : `${who} pushed changes (${st.behind} ${st.behind === 1 ? 'commit' : 'commits'}).`,
              isDirty(get()) ? 'Save' : 'Pull',
              () => void (isDirty(get()) ? get().save() : get().sync()),
              'peepoShy',
            )
          }
          return
        }
        if (get().busy) return // a save started meanwhile
        set({ busy: 'syncing', busyDetail: 'pulling changes…' })
        const who = await authorsBetween(fs, remote, local)
        await resetTo(fs, remote)
        await reloadBoards(fs)
        lastNotifiedRemote = remote
        toast.ok(`${who} added changes (${st.behind} ${st.behind === 1 ? 'commit' : 'commits'}).`, 'peepoHey')
      } catch (e) {
        // background job: log, don't toast on every flaky network tick
        console.warn('auto-sync', e)
      } finally {
        if (get().busy === 'syncing') set({ busy: null, busyDetail: null })
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
          toast.ok('Remote overwritten with your version.', 'monkaS')
        } else if (mode === 'take-theirs') {
          await resetTo(fs, d.remote)
          await reloadBoards(fs)
          toast.ok('Took the remote version. Your commits are gone from this branch.', 'FeelsOkayMan')
        } else {
          const r = await mergeRemote(fs, d.local, d.remote, mode === 'merge-ours' ? 'ours' : 'theirs', identity(), progress)
          await reloadBoards(fs)
          await pushRemote(ctx, progress)
          toast.ok(
            `Merged${r.files ? ` ${r.files} file${r.files === 1 ? '' : 's'}` : ''}${r.conflicts ? `, ${r.conflicts} conflict${r.conflicts === 1 ? '' : 's'} resolved` : ''} and pushed.`,
            'peepoClap',
          )
        }
        await get().refreshGit()
      } catch (e) {
        console.error(e)
        toast.fail('Could not resolve', e, { mode, local: d.local, remote: d.remote, transport: ctx.transport })
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
          const rel = unwp(f)
          if (!rel || !rel.startsWith(`${BOARDS_DIR}/`) || !rel.endsWith('.json')) continue
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
        toast.fail('Could not load commit', e, { commit: oid })
      } finally {
        set({ busy: null })
      }
    },

    discardChanges: async () => {
      const fs = get().fs
      if (!fs || !isDirty(get())) return
      const n = get().dirtyBoards.size + get().deletedBoards.size
      const ok = await confirm({
        title: 'Throw away your unsaved changes?',
        message: `Everything since your last save goes${n ? ` — edits on ${n} board${n === 1 ? '' : 's'}${get().assetsTouched || get().treeDirty ? ', plus added files' : ''}` : ''}. This cannot be undone.`,
        confirmLabel: 'Discard changes',
        danger: true,
        peepo: 'peepoThink',
      })
      if (!ok) return
      // a pending draft flush must not write the edits back while we're resetting
      clearTimeout(flushTimer)
      set({ busy: 'loading', dirtyBoards: new Set(), deletedBoards: new Set(), metaDirty: false, assetsTouched: false })
      try {
        if (await repo.headOid(fs)) await repo.discardWorktree(fs)
        await reloadBoards(fs)
        toast.ok('Back to your last save.', 'peepoSit')
      } catch (e) {
        toast.fail('Discard failed', e)
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
        toast.ok('Restored. Time travel complete.', 'peepoPog')
      } catch (e) {
        toast.fail('Restore failed', e, { commit: oid })
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
  if (viewingRef) return repo.readBlobAt(fs, viewingRef, wp(path))
  return readBytes(fs, abs(fs, wp(path)))
}
