import type { BoardCard as BoardCardT } from '../model/types'
import { selectBoards, useWorkspace } from '../store/workspace'
import { Peepo } from '../ui/Peepo'
import type { CardProps } from './CardView'

export function BoardCard({ card, readOnly }: CardProps<BoardCardT>) {
  const board = useWorkspace((s) => selectBoards(s)[card.boardId])
  const renameBoard = useWorkspace((s) => s.renameBoard)
  const navigate = useWorkspace((s) => s.navigate)
  const count = board?.cards.length ?? 0
  return (
    <div className="flex h-full w-full flex-col p-3">
      <div className="flex items-center gap-2">
        <Peepo name="peepoGlad" size={26} />
        <input
          data-nodrag
          readOnly={readOnly || !board}
          value={board?.name ?? '(missing board)'}
          onChange={(e) => renameBoard(card.boardId, e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-extrabold outline-none"
        />
      </div>
      <div className="mt-1 text-[12px] text-frog-100/80">
        {count} item{count === 1 ? '' : 's'}
      </div>
      <button
        data-nodrag
        onClick={() => navigate(card.boardId)}
        className="mt-auto self-end rounded-md bg-frog-800/60 px-2 py-1 text-[12px] font-semibold hover:bg-frog-800"
      >
        Open →
      </button>
    </div>
  )
}
