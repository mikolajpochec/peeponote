import { useEffect, useRef, useState } from 'react'
import type { Board } from '../model/types'
import { selectBoards, useWorkspace } from '../store/workspace'
import { Peepo } from './Peepo'
import { BoardIconView } from './BoardIcon'
import { useArrivals } from '../canvas/arrivals'
import { contrast } from '../canvas/styles'
import { ContextMenu, sep, type MenuItem } from './ContextMenu'

interface Menu {
  x: number
  y: number
  boardId: string | null
  confirmDelete?: boolean
}

export function Sidebar({ onOpenSettings, onNavigate, onClose }: { onOpenSettings: () => void; onNavigate?: () => void; onClose?: () => void }) {
  const boards = useWorkspace(selectBoards)
  const meta = useWorkspace((s) => s.meta)
  const current = useWorkspace((s) => s.currentBoardId)
  const navigateRaw = useWorkspace((s) => s.navigate)
  const navigate = (id: string) => {
    navigateRaw(id)
    onNavigate?.()
  }
  const createBoard = useWorkspace((s) => s.createBoard)
  const removeCards = useWorkspace((s) => s.removeCards)
  const readOnly = useWorkspace((s) => !!s.viewingRef)
  const fs = useWorkspace((s) => s.fs)
  const head = useWorkspace((s) => s.head)
  const [collapsed, setCollapsed] = useState(false)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  const root = meta ? boards[meta.rootBoardId] : undefined

  /** new sub-board under `parentId`, placed below whatever is there; opens it */
  const addSubBoard = (parentId: string) => {
    const parent = boards[parentId]
    if (!parent) return
    const y = parent.cards.length ? Math.max(...parent.cards.map((c) => c.y + c.h)) + 40 : 100
    const x = parent.cards.length ? Math.min(...parent.cards.map((c) => c.x)) : 100
    const id = createBoard(parentId, 'New board', { x, y })
    navigate(id)
    setRenaming(id)
  }

  /** deleting a board = removing its card from the parent (cascades to nested boards) */
  const deleteBoard = (boardId: string) => {
    const b = boards[boardId]
    if (!b?.parentId) return
    const parent = boards[b.parentId]
    const card = parent?.cards.find((c) => c.type === 'board' && c.boardId === boardId)
    if (!parent || !card) return
    if (current === boardId || isInside(current, boardId, boards)) navigate(parent.id)
    removeCards(parent.id, [card.id])
  }

  const menuItems = (): MenuItem[] => {
    if (!menu) return []
    const b = menu.boardId ? boards[menu.boardId] : undefined
    if (!b) {
      return [{ kind: 'item', label: 'Add board', icon: '🐸', disabled: readOnly || !root, onClick: () => root && addSubBoard(root.id) }]
    }
    const isRoot = !b.parentId
    const count = countItems(b, boards)
    if (menu.confirmDelete) {
      return [
        {
          kind: 'item',
          label: `Delete "${b.name || 'Untitled'}"${count ? ` and ${count} item${count === 1 ? '' : 's'}` : ''}`,
          icon: '✕',
          danger: true,
          onClick: () => deleteBoard(b.id),
        },
        { kind: 'item', label: 'Cancel', icon: '←', onClick: () => {} },
      ]
    }
    return [
      { kind: 'item', label: 'Open', icon: '→', disabled: b.id === current, onClick: () => navigate(b.id) },
      { kind: 'item', label: 'Rename', icon: '✎', shortcut: 'dbl-click', disabled: readOnly, onClick: () => setRenaming(b.id) },
      sep,
      { kind: 'item', label: 'Add sub-board', icon: '🐸', disabled: readOnly, onClick: () => addSubBoard(b.id) },
      sep,
      {
        kind: 'item',
        label: 'Delete board',
        icon: '✕',
        danger: true,
        disabled: readOnly || isRoot,
        onClick: () => {
          // ask once inside the menu instead of a blocking dialog
          if (count === 0) deleteBoard(b.id)
          else setTimeout(() => setMenu({ ...menu, confirmDelete: true }), 0)
        },
      },
    ]
  }

  if (collapsed && !onClose) {
    return (
      <div className="flex w-12 flex-col items-center gap-3 border-r border-(--hair) bg-swamp-900 py-3">
        <button onClick={() => setCollapsed(false)} title="Expand">
          <Peepo name="peepoHappy" size={30} />
        </button>
      </div>
    )
  }

  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col border-r border-(--hair) bg-swamp-900"
      onContextMenu={(e) => {
        const t = e.target as HTMLElement
        if (t.closest('input')) return
        e.preventDefault()
        const boardId = t.closest('[data-board]')?.getAttribute('data-board') ?? null
        setMenu({ x: e.clientX, y: e.clientY, boardId })
      }}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <Peepo name="peepoHappy" size={34} />
        <div className="flex-1 leading-tight">
          <div className="truncate text-lg font-black tracking-tight" title="peeponote">
            {meta?.name || 'peeponote'}
          </div>
          <div className="truncate text-[11px] text-frog-200/60">{fs?.label}</div>
        </div>
        <button onClick={() => (onClose ? onClose() : setCollapsed(true))} className="px-2 py-1 text-frog-200/50 hover:text-frog-100" title={onClose ? 'Close' : 'Collapse'}>
          {onClose ? '✕' : '«'}
        </button>
      </div>
      <div className="flex items-center px-3 pb-1">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-wider text-frog-200/50">Boards</span>
        {root && !readOnly && (
          <button onClick={() => addSubBoard(root.id)} title="Add board" className="rounded px-1 text-[13px] leading-none text-frog-200/60 hover:bg-(--hover-strong) hover:text-frog-50">
            +
          </button>
        )}
      </div>
      <nav className="min-h-0 flex-1 overflow-auto px-1 scrollbar-thin">
        {root ? (
          <BoardNode board={root} boards={boards} depth={0} current={current} navigate={navigate} renaming={renaming} setRenaming={setRenaming} readOnly={readOnly} />
        ) : (
          <div className="px-3 text-sm text-frog-200/50">no boards</div>
        )}
      </nav>
      <div className="border-t border-(--hair) p-2 text-[11px] text-frog-200/60">
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
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </aside>
  )
}

/** A board's identity color: the fill of its card in the parent board, else its own canvas background. */
function boardColor(board: Board, boards: Record<string, Board>): string | undefined {
  const parent = board.parentId ? boards[board.parentId] : undefined
  const card = parent?.cards.find((c) => c.type === 'board' && c.boardId === board.id)
  return card?.style?.bg ?? board.style?.bg
}

function isInside(id: string | null, ancestorId: string, boards: Record<string, Board>): boolean {
  for (let b = id ? boards[id] : undefined; b; b = b.parentId ? boards[b.parentId] : undefined) if (b.id === ancestorId) return true
  return false
}

/** cards in this board and every nested board */
function countItems(board: Board, boards: Record<string, Board>): number {
  let n = board.cards.length
  for (const c of board.cards) if (c.type === 'board' && boards[c.boardId]) n += countItems(boards[c.boardId], boards)
  return n
}

function BoardNode({
  board,
  boards,
  depth,
  current,
  navigate,
  renaming,
  setRenaming,
  readOnly,
}: {
  board: Board
  boards: Record<string, Board>
  depth: number
  current: string | null
  navigate: (id: string) => void
  renaming: string | null
  setRenaming: (id: string | null) => void
  readOnly: boolean
}) {
  const renameBoard = useWorkspace((s) => s.renameBoard)
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState(board.name)
  const input = useRef<HTMLInputElement>(null)
  const isRenaming = renaming === board.id
  const children = board.cards.filter((c) => c.type === 'board').map((c) => (c.type === 'board' ? boards[c.boardId] : undefined)).filter(Boolean) as Board[]
  const active = board.id === current
  const flash = useArrivals((s) => !!s.boards[board.id])
  const bg = boardColor(board, boards)

  useEffect(() => {
    if (isRenaming) {
      setDraft(board.name)
      requestAnimationFrame(() => {
        input.current?.focus()
        input.current?.select()
      })
    }
  }, [isRenaming, board.name])

  const commit = () => {
    if (draft.trim() && draft !== board.name) renameBoard(board.id, draft.trim())
    setRenaming(null)
  }

  return (
    <div>
      <div
        data-board={board.id}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-[13px] ${flash ? 'row-flash' : ''} ${active ? 'font-bold' : 'text-frog-100 hover:bg-swamp-700'} ${active && !bg ? 'bg-frog-700 text-white' : ''}`}
        style={{
          paddingLeft: 8 + depth * 12,
          // the active row wears the board's own color
          ...(active && bg ? { background: bg, color: contrast(bg), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' } : {}),
        }}
      >
        <button onClick={() => setOpen((o) => !o)} className={`w-4 text-[10px] opacity-60 ${children.length ? '' : 'invisible'}`}>
          {open ? '▾' : '▸'}
        </button>
        {isRenaming ? (
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setRenaming(null)
              e.stopPropagation()
            }}
            className="min-w-0 flex-1 rounded bg-black/20 px-1 outline-none ring-1 ring-frog-400"
            style={{ color: 'inherit' }}
          />
        ) : (
          <button
            onClick={() => navigate(board.id)}
            onDoubleClick={() => !readOnly && setRenaming(board.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
          >
            {bg && !active && <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20" style={{ background: bg }} />}
            <BoardIconView icon={board.icon} size={16} className="shrink-0" />
            <span className="truncate">{board.name || 'Untitled'}</span>
          </button>
        )}
        <span className={`text-[10px] ${active && bg ? 'opacity-60' : 'text-frog-200/40'}`}>{board.cards.length}</span>
      </div>
      {open &&
        children.map((c) => (
          <BoardNode key={c.id} board={c} boards={boards} depth={depth + 1} current={current} navigate={navigate} renaming={renaming} setRenaming={setRenaming} readOnly={readOnly} />
        ))}
    </div>
  )
}
