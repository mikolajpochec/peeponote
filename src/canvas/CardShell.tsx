import { memo, useState, type ReactNode } from 'react'
import { EditRequestContext } from './editRequest'
import type { Card } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { isInteractiveTarget, useDrag } from './useDrag'
import { setGlobalCursor } from './cursor'
import { cardStyles } from './styles'

export const GRID = 20
export const MIN_W = 120
export const MIN_H = 60

interface Props {
  card: Card
  boardId: string
  selected: boolean
  readOnly: boolean
  scale: () => number
  children: ReactNode
  className?: string
  /** no paper/frame: used for free-floating text */
  bare?: boolean
  onOpen?: () => void
}

export const CardShell = memo(function CardShell({ card, boardId, selected, readOnly, scale, children, className = '', bare = false, onOpen }: Props) {
  const select = useWorkspace((s) => s.select)
  const moveCards = useWorkspace((s) => s.moveCards)
  const updateCard = useWorkspace((s) => s.updateCard)
  const bringToFront = useWorkspace((s) => s.bringToFront)
  const removeCards = useWorkspace((s) => s.removeCards)
  const [editTick, setEditTick] = useState(0)

  const onDragStart = useDrag(
    {
      onStart: (e) => {
        if (isInteractiveTarget(e)) return false
        e.stopPropagation()
        const sel = useWorkspace.getState().selection
        if (e.shiftKey) select([card.id], true)
        else if (!sel.has(card.id)) select([card.id])
        if (!readOnly) bringToFront(boardId, card.id)
      },
      onMove: (dx, dy) => {
        if (readOnly) return
        setGlobalCursor('grabbing')
        const sel = useWorkspace.getState().selection
        const ids = sel.has(card.id) ? [...sel] : [card.id]
        const deltas: Record<string, { x: number; y: number }> = {}
        for (const id of ids) deltas[id] = { x: dx, y: dy }
        moveCards(boardId, deltas)
      },
      onEnd: (moved) => {
        setGlobalCursor(null)
        if (!moved || readOnly) return
        if (useWorkspace.getState().meta?.settings?.snapToGrid) {
          const b = useWorkspace.getState().boards[boardId]
          const sel = useWorkspace.getState().selection
          const ids = sel.has(card.id) ? [...sel] : [card.id]
          for (const id of ids) {
            const c = b?.cards.find((x) => x.id === id)
            if (c) updateCard(boardId, id, { x: Math.round(c.x / GRID) * GRID, y: Math.round(c.y / GRID) * GRID })
          }
        }
      },
    },
    scale,
  )

  const onResizeStart = useDrag(
    {
      onStart: (e) => {
        e.stopPropagation()
        if (readOnly) return false
      },
      onMove: (dx, dy) => {
        setGlobalCursor('nwse-resize')
        const c = useWorkspace.getState().boards[boardId]?.cards.find((x) => x.id === card.id)
        if (!c) return
        const minW = c.type === 'text' ? 60 : MIN_W
        const minH = c.type === 'text' ? 32 : MIN_H
        const patch: Partial<Card> = { w: Math.max(minW, c.w + dx), h: Math.max(minH, c.h + dy) }
        // hand-resizing a text card pins its size
        if (c.type === 'text' && c.autoSize !== false) (patch as Partial<Extract<Card, { type: 'text' }>>).autoSize = false
        updateCard(boardId, card.id, patch)
      },
      onEnd: () => setGlobalCursor(null),
    },
    scale,
  )

  const styles = cardStyles(card)

  return (
    <div
      data-card={card.id}
      className={`absolute group rounded-xl select-none ${readOnly ? '' : 'cursor-grab'} ${bare ? '' : 'shadow-lg shadow-black/30'} ${
        selected ? 'ring-2 ring-offset-2' : bare ? 'ring-1 ring-transparent hover:ring-(--board-line)/40' : 'ring-1'
      } ${className}`}
      style={{
        left: card.x,
        top: card.y,
        width: card.w,
        height: card.h,
        zIndex: card.z,
        ...styles.shell,
        ...({
          '--tw-ring-color': selected ? 'var(--board-line-sel)' : bare ? undefined : 'rgba(0,0,0,0.2)',
          '--tw-ring-offset-color': 'var(--board-bg)',
        } as React.CSSProperties),
      }}
      onPointerDown={onDragStart}
      onDoubleClick={(e) => {
        if (isInteractiveTarget(e as unknown as PointerEvent)) return
        e.stopPropagation()
        if (onOpen) onOpen()
        else if (!readOnly) setEditTick((t) => t + 1)
      }}
    >
      <EditRequestContext.Provider value={editTick}>
        <div className="h-full w-full overflow-hidden rounded-xl" style={styles.inner}>
          {children}
        </div>
      </EditRequestContext.Provider>
      {!readOnly && (
        <>
          <button
            data-nodrag
            title="Delete (Del)"
            onClick={(e) => {
              e.stopPropagation()
              removeCards(boardId, [card.id])
            }}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-swamp-600 text-xs text-frog-100 shadow group-hover:flex hover:bg-red-700"
          >
            ✕
          </button>
          <div
            data-nodrag
            onPointerDown={onResizeStart}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (card.type === 'text') updateCard(boardId, card.id, { autoSize: true } as Partial<Card>)
            }}
            title={card.type === 'text' ? 'Drag to resize · double-click to fit content' : 'Drag to resize'}
            className="absolute -bottom-1 -right-1 hidden h-4 w-4 cursor-nwse-resize rounded-sm bg-frog-300 group-hover:block"
            style={{ display: selected ? 'block' : undefined }}
          />
        </>
      )}
    </div>
  )
})
