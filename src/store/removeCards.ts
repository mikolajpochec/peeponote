import type { Board, Card } from '../model/types'
import { confirm } from '../ui/confirm'
import { useWorkspace } from './workspace'

/** everything inside a board, recursively (cards on nested boards count too) */
export function countItems(board: Board, boards: Record<string, Board>): number {
  let n = board.cards.length
  for (const c of board.cards) if (c.type === 'board' && boards[c.boardId]) n += countItems(boards[c.boardId], boards)
  return n
}

/**
 * Delete cards, but ask first when that would take non-empty boards down with them.
 * Resolves true when the cards were removed.
 */
export async function removeCardsChecked(boardId: string, ids: string[]): Promise<boolean> {
  const ws = useWorkspace.getState()
  const board = ws.boards[boardId]
  if (!board) return false
  const cards = board.cards.filter((c) => ids.includes(c.id))
  const nested = cards
    .filter((c): c is Extract<Card, { type: 'board' }> => c.type === 'board')
    .map((c) => ({ card: c, board: ws.boards[c.boardId] }))
    .filter((x) => x.board && countItems(x.board, ws.boards) > 0)
  if (nested.length) {
    const total = nested.reduce((n, x) => n + countItems(x.board!, ws.boards), 0)
    const names = nested.map((x) => `"${x.board!.name || 'Untitled'}"`)
    const which = names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`
    const ok = await confirm({
      title: `Delete ${nested.length === 1 ? 'board' : `${nested.length} boards`} ${which}?`,
      message: `${total} item${total === 1 ? '' : 's'} inside ${nested.length === 1 ? 'it' : 'them'} (including sub-boards) will be deleted too. This is only final once you Save — until then it can be undone from History.`,
      confirmLabel: `Delete ${total + cards.length} item${total + cards.length === 1 ? '' : 's'}`,
      danger: true,
      peepo: 'PepeHands',
    })
    if (!ok) return false
  }
  useWorkspace.getState().removeCards(boardId, ids)
  return true
}
