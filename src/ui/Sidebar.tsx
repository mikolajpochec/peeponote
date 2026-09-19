import { useState } from 'react'
import type { Board } from '../model/types'
import { selectBoards, useWorkspace } from '../store/workspace'
import { Peepo } from './Peepo'

export function Sidebar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const boards = useWorkspace(selectBoards)
  const meta = useWorkspace((s) => s.meta)
  const current = useWorkspace((s) => s.currentBoardId)
  const navigate = useWorkspace((s) => s.navigate)
  const fs = useWorkspace((s) => s.fs)
  const head = useWorkspace((s) => s.head)
  const [collapsed, setCollapsed] = useState(false)

  const root = meta ? boards[meta.rootBoardId] : undefined

  if (collapsed) {
    return (
      <div className="flex w-12 flex-col items-center gap-3 border-r border-white/10 bg-swamp-900 py-3">
        <button onClick={() => setCollapsed(false)} title="Expand">
          <Peepo name="peepoHappy" size={30} />
        </button>
      </div>
    )
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-swamp-900">
      <div className="flex items-center gap-2 px-3 py-3">
        <Peepo name="peepoHappy" size={34} />
        <div className="flex-1 leading-tight">
          <div className="text-lg font-black tracking-tight">peeponote</div>
          <div className="truncate text-[11px] text-frog-200/60">{fs?.label}</div>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-frog-200/50 hover:text-frog-100" title="Collapse">
          «
        </button>
      </div>
      <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-frog-200/50">Boards</div>
      <nav className="min-h-0 flex-1 overflow-auto px-1 scrollbar-thin">
        {root ? (
          <BoardNode board={root} boards={boards} depth={0} current={current} navigate={navigate} />
        ) : (
          <div className="px-3 text-sm text-frog-200/50">no boards</div>
        )}
      </nav>
      <div className="border-t border-white/10 p-2 text-[11px] text-frog-200/60">
        {head ? (
          <div className="truncate" title={head.commit.message}>
            <span className="font-mono text-frog-300">{head.oid.slice(0, 7)}</span> {head.commit.message.split('\n')[0]}
          </div>
        ) : (
          <div>no commits yet</div>
        )}
        <button onClick={onOpenSettings} className="mt-1 w-full rounded-md bg-swamp-700 px-2 py-1 text-left text-[12px] font-semibold text-frog-100 hover:bg-swamp-600">
          ⚙ Settings
        </button>
      </div>
    </aside>
  )
}

function BoardNode({
  board,
  boards,
  depth,
  current,
  navigate,
}: {
  board: Board
  boards: Record<string, Board>
  depth: number
  current: string | null
  navigate: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const children = board.cards.filter((c) => c.type === 'board').map((c) => (c.type === 'board' ? boards[c.boardId] : undefined)).filter(Boolean) as Board[]
  const active = board.id === current
  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[13px] ${active ? 'bg-frog-700 font-bold text-white' : 'text-frog-100 hover:bg-swamp-700'}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <button onClick={() => setOpen((o) => !o)} className={`w-4 text-[10px] text-frog-200/60 ${children.length ? '' : 'invisible'}`}>
          {open ? '▾' : '▸'}
        </button>
        <button onClick={() => navigate(board.id)} className="min-w-0 flex-1 truncate text-left">
          {board.name || 'Untitled'}
        </button>
        <span className="text-[10px] text-frog-200/40">{board.cards.length}</span>
      </div>
      {open && children.map((c) => <BoardNode key={c.id} board={c} boards={boards} depth={depth + 1} current={current} navigate={navigate} />)}
    </div>
  )
}
