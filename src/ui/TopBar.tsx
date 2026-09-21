import { useEffect, useState } from 'react'
import type { Board } from '../model/types'
import { selectBoards, selectDirty, useWorkspace } from '../store/workspace'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'
import { ColorPicker } from './ColorPicker'
import { resolveTheme } from '../theme/themes'
import { useReview } from '../store/review'
import { useUnseenCount } from '../review/notifications'
import { Avatar } from '../review/Avatar'

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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--hair) bg-swamp-900 px-3 max-md:gap-1 max-md:px-2">
      {onToggleSidebar && (
        <button onClick={onToggleSidebar} title="Boards" className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg hover:bg-(--hover-strong)">
          ☰
        </button>
      )}
      {onToggleSidebar && crumbs.length > 1 && (
        <button onClick={() => navigate(crumbs[crumbs.length - 2].id)} title="Up" className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-lg hover:bg-(--hover-strong)">
          ‹
        </button>
      )}
      <nav className="flex min-w-0 items-center gap-1 text-[13px]">
        {(onToggleSidebar ? crumbs.slice(-1) : crumbs).map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-frog-200/40">/</span>}
            {i === crumbs.length - 1 ? (
              <input
                readOnly={readOnly}
                value={b.name}
                onChange={(e) => renameBoard(b.id, e.target.value)}
                className="min-w-0 max-w-[40vw] rounded bg-transparent px-1 font-extrabold outline-none hover:bg-(--hover) focus:bg-(--hover-strong)"
                style={{ width: `${Math.max(4, b.name.length + 1)}ch` }}
              />
            ) : (
              <button onClick={() => navigate(b.id)} className="rounded px-1 text-frog-200/80 hover:bg-(--hover) hover:text-white">
                {b.name || 'Untitled'}
              </button>
            )}
          </span>
        ))}
      </nav>
      {board && !readOnly && (
        <div className="ml-1 flex items-center gap-0.5 rounded-lg bg-swamp-700/60 px-1 max-md:hidden" title="Board style">
          <ColorPicker
            title="Board background"
            icon="◼"
            value={board.style?.bg}
            fallback={themeCanvas}
            onChange={(bg) => setBoardStyle(board.id, { bg })}
          />
          <button
            title="Toggle dot grid"
            onClick={() => setBoardStyle(board.id, { dots: board.style?.dots === false ? undefined : false })}
            className={`h-7 w-7 rounded-md text-[13px] ${board.style?.dots === false ? 'text-frog-200/40' : 'text-frog-100'} hover:bg-(--hover-strong)`}
          >
            ⁘
          </button>
        </div>
      )}
      <div className="flex-1" />
      {reviewOn ? <ReviewToggle compact={!!onToggleSidebar} /> : <SaveBar compact={!!onToggleSidebar} />}
      {!reviewOn && <ReviewToggle compact={!!onToggleSidebar} />}
      <Bell compact={!!onToggleSidebar} />
      <Identity compact={!!onToggleSidebar} />
      <button
        onClick={onToggleHistory}
        title="History"
        className={`rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong) max-md:h-9 max-md:w-9 max-md:px-0 ${historyOpen ? 'bg-(--hover-strong)' : ''}`}
      >
        🕰<span className="max-md:hidden"> History</span>
      </button>
      <button onClick={onOpenSettings} title="Settings (⌘,)" className="rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong) max-md:h-9 max-md:w-9 max-md:px-0">
        ⚙
      </button>
    </header>
  )
}

/** Review mode: the board is read-only, you comment. Toggles from anywhere. */
function ReviewToggle({ compact }: { compact: boolean }) {
  const on = useReview((s) => s.mode.on)
  const setMode = useReview((s) => s.setMode)
  return (
    <button
      onClick={() => setMode({ on: !on })}
      title={on ? 'Leave review mode (back to editing)' : 'Review mode: look and comment without changing anything'}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-bold ${on ? 'bg-amber-500 text-black hover:bg-amber-400' : 'hover:bg-(--hover-strong)'} max-md:h-9 ${compact && !on ? 'w-9 px-0' : ''}`}
    >
      🔍{(!compact || on) && <span>{on ? 'Reviewing — exit' : 'Review'}</span>}
    </button>
  )
}

function Bell({ compact }: { compact: boolean }) {
  const n = useUnseenCount()
  const open = useReview((s) => s.panelOpen)
  const setOpen = useReview((s) => s.setPanelOpen)
  return (
    <button
      onClick={() => setOpen(!open)}
      title="Notifications: review requests, comments, mentions"
      className={`relative rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong) max-md:h-9 max-md:w-9 max-md:px-0 ${open ? 'bg-(--hover-strong)' : ''}`}
    >
      🔔
      {n > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-black leading-4 text-black">{n > 99 ? '99+' : n}</span>}
      {!compact && <span className="max-md:hidden"> </span>}
    </button>
  )
}

/** who you are here: avatar + name when verified, "Guest" otherwise; click opens the identity dialog */
function Identity({ compact }: { compact: boolean }) {
  const identity = useReview((s) => s.identity)
  const open = () => window.dispatchEvent(new CustomEvent('peeponote:identify'))
  if (identity.kind === 'verified')
    return (
      <button onClick={open} title={`${identity.account.name} <${identity.account.email}> — verified on this device. Click for picture / log out.`} className="flex h-8 items-center gap-1.5 rounded-md px-1.5 hover:bg-(--hover-strong)">
        <Avatar person={identity.account} size={24} />
        {!compact && <span className="max-w-28 truncate text-[13px] font-semibold">{identity.account.name}</span>}
      </button>
    )
  return (
    <button
      onClick={open}
      title={identity.kind === 'mismatch' ? 'Your saved password does not fit your account — fix it' : 'You are a guest: editing works, comments and reviews need a password'}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold ${identity.kind === 'mismatch' ? 'bg-red-900/50 text-red-100 hover:bg-red-900/70' : 'bg-swamp-700 text-frog-200 hover:bg-swamp-600'}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-swamp-500 text-[11px]">?</span>
      {!compact && <span>{identity.kind === 'mismatch' ? 'Wrong password' : 'Guest'}</span>}
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

function SaveBar({ compact }: { compact: boolean }) {
  const dirty = useWorkspace(selectDirty)
  const busy = useWorkspace((s) => s.busy)
  const save = useWorkspace((s) => s.save)
  const discardChanges = useWorkspace((s) => s.discardChanges)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const token = useSettings((s) => s.token)
  const willPush = !!remoteUrl && !!token
  const [msg, setMsg] = useState('')
  const online = useOnline()
  const pendingSync = useWorkspace((s) => s.pendingSync)

  const doSave = async () => {
    const ok = await save(msg)
    if (ok) setMsg('')
  }

  return (
    <div className="flex items-center gap-2">
      {!online ? (
        <span className="flex h-7 items-center gap-1 rounded-md bg-swamp-700 px-2 text-[11px] font-bold text-frog-200" title="No connection: saves stay on this device and go out when you're back online">
          ⚡ Offline{pendingSync ? ' · to sync' : ''}
        </span>
      ) : (
        <span
          className={`h-2.5 w-2.5 rounded-full ${dirty ? 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]' : pendingSync ? 'bg-sky-400' : 'bg-frog-400'}`}
          title={dirty ? 'Unsaved changes' : pendingSync ? 'Saved here, not yet sent' : 'All committed'}
        />
      )}
      {!compact && (
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') doSave()
          }}
          placeholder={dirty ? 'commit message (optional)' : 'nothing to commit'}
          disabled={!!viewingRef}
          className="w-52 rounded-md bg-swamp-700 px-2 py-1 text-[13px] outline-none placeholder:text-frog-200/40 focus:ring-1 focus:ring-frog-400"
        />
      )}
      {dirty && !viewingRef && (
        <button
          onClick={discardChanges}
          disabled={!!busy}
          title="Discard changes: throw away everything since the last save (asks first)"
          className="flex h-8 items-center rounded-md px-2 text-[13px] font-semibold text-frog-200 hover:bg-red-900/40 hover:text-red-100 disabled:opacity-40"
        >
          {compact ? '↺' : 'Discard'}
        </button>
      )}
      <button
        onClick={doSave}
        disabled={!dirty || !!busy || !!viewingRef}
        title={willPush ? `Save: commit, then bring in others' changes and push → ${remoteUrl} (⌘S)` : 'Save (⌘S)'}
        className="flex h-8 items-center gap-1.5 rounded-md bg-frog-500 px-3 py-1 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40 max-md:px-2"
      >
        <Peepo name={willPush ? 'peepoRun' : 'peepoClap'} size={20} />
        {busy === 'saving' ? 'Saving…' : busy === 'syncing' ? 'Syncing…' : 'Save'}
      </button>
    </div>
  )
}
