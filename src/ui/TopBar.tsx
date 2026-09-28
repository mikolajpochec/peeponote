import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Board } from '../model/types'
import { selectBoards, selectDirty, useWorkspace } from '../store/workspace'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'
import { ColorPicker } from './ColorPicker'
import { resolveTheme } from '../theme/themes'
import { useReview } from '../store/review'
import { useUnseenCount } from '../review/notifications'
import { Avatar } from '../review/Avatar'
import { ContextMenu, sep, type MenuItem } from './ContextMenu'
import { SaveDialog } from './SaveDialog'

/**
 * One row that has to survive any width — a phone, a split screen, or a desktop window with the sidebar and a
 * side panel open. It gives way in this order as it narrows (measured on the header itself via `@container`,
 * so an open panel counts, not just the viewport):
 *   1. the path shrinks to the current board only,
 *   2. the board-style group and the button labels go, and the commit message box moves into the Save button (✎),
 *   3. below ~570px everything else — Review, 🔔, you, History, Discard, Settings — folds into one ⋯ menu.
 * What never leaves: the board name, the unsaved dot and Save (in review mode, the amber chip that gets you out).
 */
export function TopBar({
  onToggleHistory,
  historyOpen,
  onOpenSettings,
  onToggleSidebar,
}: {
  onToggleHistory: () => void
  historyOpen: boolean
  onOpenSettings: () => void
  /** present on phones: the sidebar is a drawer behind this button */
  onToggleSidebar?: () => void
}) {
  const boards = useWorkspace(selectBoards)
  const currentId = useWorkspace((s) => s.currentBoardId)
  const navigate = useWorkspace((s) => s.navigate)
  const renameBoard = useWorkspace((s) => s.renameBoard)
  const setBoardStyle = useWorkspace((s) => s.setBoardStyle)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const themeCanvas = useSettings((s) => resolveTheme(s.theme).canvas)
  const board = currentId ? boards[currentId] : undefined
  const reviewOn = useReview((s) => s.mode.on)
  const readOnly = !!viewingRef || reviewOn

  const crumbs: Board[] = []
  for (let b = board; b; b = b.parentId ? boards[b.parentId] : undefined) crumbs.unshift(b)

  return (
    <header className="@container flex h-12 shrink-0 items-center gap-2 border-b border-(--hair) bg-swamp-900 px-3 max-md:gap-1 max-md:px-2">
      {onToggleSidebar && (
        <button onClick={onToggleSidebar} title="Boards" className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg hover:bg-(--hover-strong)">
          ☰
        </button>
      )}
      {crumbs.length > 1 && (
        <button
          onClick={() => navigate(crumbs[crumbs.length - 2].id)}
          title={`Up to ${crumbs[crumbs.length - 2].name || 'Untitled'}`}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-lg hover:bg-(--hover-strong) @[52rem]:hidden"
        >
          ‹
        </button>
      )}
      <nav className="flex min-w-0 flex-1 items-center gap-1 text-[13px]">
        {crumbs.map((b, i) => (
          // the whole path only when there's room; otherwise just the board you're on
          <span key={b.id} className={`flex min-w-0 items-center gap-1 ${i === crumbs.length - 1 ? '' : 'hidden @[52rem]:flex'}`}>
            {i > 0 && <span className="hidden text-frog-200/40 @[52rem]:inline">/</span>}
            {i === crumbs.length - 1 ? (
              <input
                readOnly={readOnly}
                value={b.name}
                onChange={(e) => renameBoard(b.id, e.target.value)}
                className="min-w-0 max-w-full rounded bg-transparent px-1 font-extrabold outline-none hover:bg-(--hover) focus:bg-(--hover-strong)"
                style={{ width: `${Math.max(4, b.name.length + 1)}ch` }}
              />
            ) : (
              <button onClick={() => navigate(b.id)} className="min-w-0 truncate rounded px-1 text-frog-200/80 hover:bg-(--hover) hover:text-white">
                {b.name || 'Untitled'}
              </button>
            )}
          </span>
        ))}
      </nav>
      {board && !readOnly && (
        <div className="ml-1 hidden items-center gap-0.5 rounded-lg bg-swamp-700/60 px-1 @[56rem]:flex" title="Board style">
          <ColorPicker title="Board background" icon="◼" value={board.style?.bg} fallback={themeCanvas} onChange={(bg) => setBoardStyle(board.id, { bg })} />
          <button
            title="Toggle dot grid"
            onClick={() => setBoardStyle(board.id, { dots: board.style?.dots === false ? undefined : false })}
            className={`h-7 w-7 rounded-md text-[13px] ${board.style?.dots === false ? 'text-frog-200/40' : 'text-frog-100'} hover:bg-(--hover-strong)`}
          >
            ⁘
          </button>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {reviewOn ? <ReviewToggle /> : <SaveBar />}
        {/* below the fold this whole group lives in the ⋯ menu — it's all of it or none of it */}
        <div className="hidden items-center gap-1 @[34rem]:flex">
          {!reviewOn && <ReviewToggle />}
          <Bell />
          <Identity />
          <button
            onClick={onToggleHistory}
            title="History"
            className={`rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong) max-md:h-9 max-md:w-9 max-md:px-0 ${historyOpen ? 'bg-(--hover-strong)' : ''}`}
          >
            🕰<span className="hidden @[46rem]:inline"> History</span>
          </button>
          <button onClick={onOpenSettings} title="Settings (⌘,)" className="rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong) max-md:h-9 max-md:w-9 max-md:px-0">
            ⚙
          </button>
        </div>
        <MoreMenu board={board} readOnly={readOnly} historyOpen={historyOpen} onToggleHistory={onToggleHistory} onOpenSettings={onOpenSettings} />
      </div>
    </header>
  )
}

/** Everything that didn't fit, one tap away. Only rendered while the header is narrow. */
function MoreMenu({
  board,
  readOnly,
  historyOpen,
  onToggleHistory,
  onOpenSettings,
}: {
  board?: Board
  readOnly: boolean
  historyOpen: boolean
  onToggleHistory: () => void
  onOpenSettings: () => void
}) {
  const btn = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const identity = useReview((s) => s.identity)
  const reviewOn = useReview((s) => s.mode.on)
  const setMode = useReview((s) => s.setMode)
  const setBoardStyle = useWorkspace((s) => s.setBoardStyle)
  const dirty = useWorkspace(selectDirty)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const busy = useWorkspace((s) => s.busy)
  const discardChanges = useWorkspace((s) => s.discardChanges)
  const unseen = useUnseenCount()
  const panelOpen = useReview((s) => s.panelOpen)
  const setPanelOpen = useReview((s) => s.setPanelOpen)

  const items: MenuItem[] = [
    { kind: 'item', icon: '🔍', label: reviewOn ? 'Leave review mode' : 'Review mode', onClick: () => setMode({ on: !reviewOn }) },
    { kind: 'item', icon: '🔔', label: unseen > 0 ? `Notifications (${unseen > 99 ? '99+' : unseen} new)` : panelOpen ? 'Hide notifications' : 'Notifications', onClick: () => setPanelOpen(!panelOpen) },
    {
      kind: 'item',
      icon: identity.kind === 'verified' ? '🙂' : identity.kind === 'mismatch' ? '⚠️' : '👤',
      label: identity.kind === 'verified' ? identity.account.name : identity.kind === 'mismatch' ? 'Wrong password — fix it' : 'Guest — set a password',
      onClick: () => window.dispatchEvent(new CustomEvent('peeponote:identify')),
    },
    { kind: 'item', icon: '🕰', label: historyOpen ? 'Hide history' : 'History', onClick: onToggleHistory },
    ...(dirty && !viewingRef ? [{ kind: 'item', icon: '↺', label: 'Discard changes', danger: true, disabled: !!busy, onClick: () => void discardChanges() } as MenuItem] : []),
    ...(board && !readOnly
      ? [sep, { kind: 'item', icon: '⁘', label: board.style?.dots === false ? 'Show dot grid' : 'Hide dot grid', onClick: () => setBoardStyle(board.id, { dots: board.style?.dots === false ? undefined : false }) } as MenuItem]
      : []),
    sep,
    { kind: 'item', icon: '⚙', label: 'Settings', shortcut: '⌘,', onClick: onOpenSettings },
  ]

  const open = () => {
    const r = btn.current?.getBoundingClientRect()
    setAt(r ? { x: r.right - 224, y: r.bottom + 6 } : { x: 0, y: 48 })
  }

  return (
    <>
      <button
        ref={btn}
        onClick={() => (at ? setAt(null) : open())}
        title="More"
        className={`relative flex h-9 w-9 items-center justify-center rounded-md text-[15px] font-bold hover:bg-(--hover-strong) @[34rem]:hidden ${at ? 'bg-(--hover-strong)' : ''}`}
      >
        ⋯
        {unseen > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-black leading-4 text-black">{unseen > 99 ? '99+' : unseen}</span>
        ) : (
          identity.kind === 'mismatch' && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>
      {/* the header is a container (`@container`), which would anchor a fixed menu to it — so it goes to the body */}
      {at && createPortal(<ContextMenu x={at.x} y={at.y} items={items} onClose={() => setAt(null)} />, document.body)}
    </>
  )
}

/** Review mode: the board is read-only, you comment. Toggles from anywhere. */
function ReviewToggle() {
  const on = useReview((s) => s.mode.on)
  const setMode = useReview((s) => s.setMode)
  return (
    <button
      onClick={() => setMode({ on: !on })}
      title={on ? 'Leave review mode (back to editing)' : 'Review mode: look and comment without changing anything'}
      className={`h-8 shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-bold max-md:h-9 ${
        on ? 'flex bg-amber-500 text-black hover:bg-amber-400' : 'flex hover:bg-(--hover-strong)'
      }`}
    >
      🔍
      {/* …except the way out of review mode, which earns its words sooner */}
      <span className={on ? 'hidden @[34rem]:inline' : 'hidden @[46rem]:inline'}>{on ? 'Reviewing — exit' : 'Review'}</span>
    </button>
  )
}

function Bell() {
  const n = useUnseenCount()
  const open = useReview((s) => s.panelOpen)
  const setOpen = useReview((s) => s.setPanelOpen)
  return (
    <button
      onClick={() => setOpen(!open)}
      title="Notifications: review requests, comments, mentions"
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold hover:bg-(--hover-strong) ${open ? 'bg-(--hover-strong)' : ''}`}
    >
      🔔
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-black leading-4 text-black">{n > 99 ? '99+' : n}</span>}
    </button>
  )
}

/** who you are here: avatar + name when verified, "Guest" otherwise; click opens the identity dialog */
function Identity() {
  const identity = useReview((s) => s.identity)
  const open = () => window.dispatchEvent(new CustomEvent('peeponote:identify'))
  if (identity.kind === 'verified')
    return (
      <button
        onClick={open}
        title={`${identity.account.name} <${identity.account.email}> — verified on this device. Click for picture / log out.`}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1.5 hover:bg-(--hover-strong)"
      >
        <Avatar person={identity.account} size={24} />
        <span className="hidden max-w-28 truncate text-[13px] font-semibold @[46rem]:inline">{identity.account.name}</span>
      </button>
    )
  return (
    <button
      onClick={open}
      title={identity.kind === 'mismatch' ? 'Your saved password does not fit your account — fix it' : 'You are a guest: editing works, comments and reviews need a password'}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold ${
        identity.kind === 'mismatch' ? 'bg-red-900/50 text-red-100 hover:bg-red-900/70' : 'bg-swamp-700 text-frog-200 hover:bg-swamp-600'
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-swamp-500 text-[11px]">?</span>
      <span className="hidden @[46rem]:inline">{identity.kind === 'mismatch' ? 'Wrong password' : 'Guest'}</span>
    </button>
  )
}

/** navigator.onLine, live */
function useOnline() {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOn(navigator.onLine)
    window.addEventListener('online', up)
    window.addEventListener('offline', up)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', up)
    }
  }, [])
  return on
}

function SaveBar() {
  const dirty = useWorkspace(selectDirty)
  const busy = useWorkspace((s) => s.busy)
  const save = useWorkspace((s) => s.save)
  const discardChanges = useWorkspace((s) => s.discardChanges)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const token = useSettings((s) => s.token)
  const willPush = !!remoteUrl && !!token
  const [msg, setMsg] = useState('')
  const [writing, setWriting] = useState(false)
  const online = useOnline()
  const pendingSync = useWorkspace((s) => s.pendingSync)

  const doSave = async () => {
    const ok = await save(msg)
    if (ok) setMsg('')
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!online ? (
        <span
          className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-swamp-700 px-1.5 text-[11px] font-bold text-frog-200"
          title={`No connection: saves stay on this device and go out when you're back online${pendingSync ? ' (something is waiting to be sent)' : ''}`}
        >
          ⚡<span className="hidden @[34rem]:inline">Offline{pendingSync ? ' · to sync' : ''}</span>
        </span>
      ) : (
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dirty ? 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]' : pendingSync ? 'bg-sky-400' : 'bg-frog-400'}`}
          title={dirty ? 'Unsaved changes' : pendingSync ? 'Saved here, not yet sent' : 'All committed'}
        />
      )}
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') doSave()
        }}
        placeholder={dirty ? 'commit message (optional)' : 'nothing to commit'}
        disabled={!!viewingRef}
        className="hidden w-52 rounded-md bg-swamp-700 px-2 py-1 text-[13px] outline-none placeholder:text-frog-200/40 focus:ring-1 focus:ring-frog-400 @[56rem]:block"
      />
      {dirty && !viewingRef && (
        <button
          onClick={discardChanges}
          disabled={!!busy}
          title="Discard changes: throw away everything since the last save (asks first)"
          className="hidden h-8 shrink-0 items-center rounded-md px-2 text-[13px] font-semibold text-frog-200 hover:bg-red-900/40 hover:text-red-100 disabled:opacity-40 @[34rem]:flex"
        >
          <span className="@[46rem]:hidden">↺</span>
          <span className="hidden @[46rem]:inline">Discard</span>
        </button>
      )}
      {/* one control: Save, plus ✎ for the message once the box above no longer fits */}
      <div className="flex shrink-0 items-stretch overflow-hidden rounded-md">
        <button
          onClick={doSave}
          disabled={!dirty || !!busy || !!viewingRef}
          title={willPush ? `Save: commit, then bring in others' changes and push → ${remoteUrl} (⌘S)` : 'Save (⌘S)'}
          className="flex h-8 shrink-0 items-center gap-1.5 bg-frog-500 px-3 py-1 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40 max-md:px-2"
        >
          <Peepo name={willPush ? 'peepoRun' : 'peepoClap'} size={20} />
          {busy === 'saving' ? 'Saving…' : busy === 'syncing' ? 'Syncing…' : 'Save'}
        </button>
        <button
          onClick={() => setWriting(true)}
          disabled={!dirty || !!busy || !!viewingRef}
          title="Save with a commit message"
          className="flex h-8 w-7 shrink-0 items-center justify-center border-l border-black/20 bg-frog-500 text-[12px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40 @[56rem]:hidden"
        >
          ✎
        </button>
      </div>
      {writing && <SaveDialog onClose={() => setWriting(false)} />}
    </div>
  )
}
