import { useState } from 'react'
import type { Board } from '../model/types'
import { selectBoards, selectDirty, useWorkspace } from '../store/workspace'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'
import { ColorPicker } from './ColorPicker'
import { resolveTheme } from '../theme/themes'

export function TopBar({ onToggleHistory, historyOpen, onOpenSettings }: { onToggleHistory: () => void; historyOpen: boolean; onOpenSettings: () => void }) {
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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--hair) bg-swamp-900 px-3">
      <nav className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-frog-200/40">/</span>}
            {i === crumbs.length - 1 ? (
              <input
                readOnly={readOnly}
                value={b.name}
                onChange={(e) => renameBoard(b.id, e.target.value)}
                className="min-w-0 rounded bg-transparent px-1 font-extrabold outline-none hover:bg-(--hover) focus:bg-(--hover-strong)"
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
        <div className="ml-1 flex items-center gap-0.5 rounded-lg bg-swamp-700/60 px-1" title="Board style">
          <ColorPicker
            title="Board background"
            icon="◼"
            value={board.style?.bg}
            fallback={themeCanvas}
            swatches={['#171f18', '#101610', '#1c2a1e', '#2a3a2c', '#1e1b2e', '#2a1f1f', '#fbf8ef', '#eef7ec', '#e7e5e4', '#fff3b0', '#dbeafe', '#fce7f3']}
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
      <SaveBar />
      <button
        onClick={onToggleHistory}
        title="History"
        className={`rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong) ${historyOpen ? 'bg-(--hover-strong)' : ''}`}
      >
        🕰 History
      </button>
      <button onClick={onOpenSettings} title="Settings (⌘,)" className="rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-(--hover-strong)">
        ⚙
      </button>
    </header>
  )
}

function SaveBar() {
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
      <button
        onClick={doSave}
        disabled={!dirty || !!busy || !!viewingRef}
        title={willPush ? `Save = git commit + push → ${remoteUrl} (⌘S)` : 'Save = git commit (⌘S)'}
        className="flex items-center gap-1.5 rounded-md bg-frog-500 px-3 py-1 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Peepo name={willPush ? 'peepoRun' : 'peepoClap'} size={20} />
        {busy === 'saving' ? 'Saving…' : busy === 'syncing' ? 'Syncing…' : willPush ? 'Save & push' : 'Save'}
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
        className="rounded-md bg-swamp-600 px-2 py-1 text-[13px] font-bold text-frog-50 hover:bg-swamp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⇅
      </button>
    </div>
  )
}
