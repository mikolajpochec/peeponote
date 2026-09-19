import { useState } from 'react'
import type { Board } from '../model/types'
import { selectBoards, selectDirty, useWorkspace } from '../store/workspace'
import { useSettings } from '../store/settings'
import { Peepo } from './Peepo'

export function TopBar({ onToggleHistory, historyOpen, onOpenSettings }: { onToggleHistory: () => void; historyOpen: boolean; onOpenSettings: () => void }) {
  const boards = useWorkspace(selectBoards)
  const currentId = useWorkspace((s) => s.currentBoardId)
  const navigate = useWorkspace((s) => s.navigate)
  const renameBoard = useWorkspace((s) => s.renameBoard)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const board = currentId ? boards[currentId] : undefined
  const readOnly = !!viewingRef

  const crumbs: Board[] = []
  for (let b = board; b; b = b.parentId ? boards[b.parentId] : undefined) crumbs.unshift(b)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-swamp-900 px-3">
      <nav className="flex min-w-0 items-center gap-1 text-[13px]">
        {crumbs.map((b, i) => (
          <span key={b.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-frog-200/40">/</span>}
            {i === crumbs.length - 1 ? (
              <input
                readOnly={readOnly}
                value={b.name}
                onChange={(e) => renameBoard(b.id, e.target.value)}
                className="min-w-0 rounded bg-transparent px-1 font-extrabold outline-none hover:bg-white/5 focus:bg-white/10"
                style={{ width: `${Math.max(4, b.name.length + 1)}ch` }}
              />
            ) : (
              <button onClick={() => navigate(b.id)} className="rounded px-1 text-frog-200/80 hover:bg-white/5 hover:text-white">
                {b.name || 'Untitled'}
              </button>
            )}
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      <SaveBar />
      <button
        onClick={onToggleHistory}
        title="History"
        className={`rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-white/10 ${historyOpen ? 'bg-white/10' : ''}`}
      >
        🕰 History
      </button>
      <button onClick={onOpenSettings} title="Settings (⌘,)" className="rounded-md px-2 py-1 text-[13px] font-semibold hover:bg-white/10">
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
  const autoPush = useSettings((s) => s.autoPush)
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
        title="Save = git commit (⌘S)"
        className="flex items-center gap-1.5 rounded-md bg-frog-500 px-3 py-1 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Peepo name="peepoClap" size={20} /> {busy === 'saving' ? 'Committing…' : 'peepoSave'}
      </button>
      <button
        onClick={push}
        disabled={!remoteUrl || !!busy || !!viewingRef}
        title={remoteUrl ? `git push → ${remoteUrl}${autoPush ? ' (auto after save)' : ''}` : 'No remote configured — open Settings'}
        className="flex items-center gap-1.5 rounded-md bg-swamp-600 px-3 py-1 text-[13px] font-bold text-frog-50 hover:bg-swamp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Peepo name="peepoRun" size={20} /> Yeet
      </button>
      <button
        onClick={pull}
        disabled={!remoteUrl || !!busy || !!viewingRef}
        title="git pull (fast-forward only)"
        className="rounded-md bg-swamp-600 px-2 py-1 text-[13px] font-bold text-frog-50 hover:bg-swamp-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⤓
      </button>
    </div>
  )
}
