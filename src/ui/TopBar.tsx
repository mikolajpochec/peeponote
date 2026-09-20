import { useState } from 'react'
import type { Board } from '../model/types'
import { selectBoards, selectDirty, useWorkspace } from '../store/workspace'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'
import { ColorPicker } from './ColorPicker'
import { resolveTheme } from '../theme/themes'

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
  const readOnly = !!viewingRef

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
      <SaveBar compact={!!onToggleSidebar} />
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

function SaveBar({ compact }: { compact: boolean }) {
  const dirty = useWorkspace(selectDirty)
  const busy = useWorkspace((s) => s.busy)
  const save = useWorkspace((s) => s.save)
  const push = useWorkspace((s) => s.push)
  const pull = useWorkspace((s) => s.pull)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const separatePush = useSettings((s) => s.separatePush)
  const token = useSettings((s) => s.token)
  const willPush = !separatePush && !!remoteUrl && !!token
  const [msg, setMsg] = useState('')

  const doSave = async () => {
    const ok = await save(msg)
    if (ok) setMsg('')
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${dirty ? 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]' : 'bg-frog-400'}`}
        title={dirty ? 'Unsaved changes' : 'All committed'}
      />
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
      <button
        onClick={doSave}
        disabled={!dirty || !!busy || !!viewingRef}
        title={willPush ? `Save = git commit + push → ${remoteUrl} (⌘S)` : 'Save = git commit (⌘S)'}
        className="flex h-8 items-center gap-1.5 rounded-md bg-frog-500 px-3 py-1 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40 max-md:px-2"
      >
        <Peepo name={willPush ? 'peepoRun' : 'peepoClap'} size={20} />
        {busy === 'saving' ? 'Saving…' : busy === 'syncing' ? 'Syncing…' : compact ? 'Save' : willPush ? 'Save & push' : 'Save'}
      </button>
      {separatePush && (
        <button
          onClick={push}
          disabled={!remoteUrl || !!busy || !!viewingRef}
          title={remoteUrl ? `git push → ${remoteUrl}` : 'No remote configured — open Settings'}
          className="flex items-center gap-1.5 rounded-md bg-swamp-600 px-3 py-1 text-[13px] font-bold text-frog-50 hover:bg-swamp-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Peepo name="peepoRun" size={20} /> {busy === 'syncing' ? 'Syncing…' : 'Push'}
        </button>
      )}
      <button
        onClick={pull}
        disabled={!remoteUrl || !!busy || !!viewingRef}
        title="Sync: fetch, then pull or push (asks if histories diverged)"
        className="h-8 rounded-md bg-swamp-600 px-2 py-1 text-[13px] font-bold text-frog-50 hover:bg-swamp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⇅
      </button>
    </div>
  )
}
