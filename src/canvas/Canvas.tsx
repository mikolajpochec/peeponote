import { useCallback, useEffect, useRef, useState } from 'react'
import type { Board } from '../model/types'
import { newId } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { CardView } from '../cards/CardView'
import { screenToBoard, useViewport, zoomAt } from './viewport'
import { Peepo } from '../ui/Peepo'
import { autoEdit } from '../cards/autoEdit'

interface Marquee {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function Canvas({ board, readOnly }: { board: Board; readOnly: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const vp = useViewport((s) => s.byBoard[board.id]) ?? { x: 80, y: 80, scale: 1 }
  const setVp = useViewport((s) => s.set)
  const selection = useWorkspace((s) => s.selection)
  const select = useWorkspace((s) => s.select)
  const clearSelection = useWorkspace((s) => s.clearSelection)
  const addCard = useWorkspace((s) => s.addCard)
  const removeCards = useWorkspace((s) => s.removeCards)
  const addAssets = useWorkspace((s) => s.addAssets)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const spaceHeld = useRef(false)
  const scale = useCallback(() => useViewport.getState().get(board.id).scale, [board.id])

  // wheel: pan / zoom (needs non-passive listener)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const cur = useViewport.getState().get(board.id)
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        setVp(board.id, zoomAt(cur, factor, e.clientX, e.clientY, rect))
      } else {
        setVp(board.id, { ...cur, x: cur.x - e.deltaX, y: cur.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [board.id, setVp])

  // keyboard
  useEffect(() => {
    const isTyping = () => {
      const a = document.activeElement as HTMLElement | null
      return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping()) {
        spaceHeld.current = true
        if (ref.current) ref.current.style.cursor = 'grab'
        e.preventDefault()
      }
      if (isTyping()) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
        const sel = useWorkspace.getState().selection
        if (sel.size) {
          e.preventDefault()
          removeCards(board.id, [...sel])
        }
      }
      if (e.key === 'Escape') clearSelection()
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        select(board.cards.map((c) => c.id))
      }
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setVp(board.id, { x: 80, y: 80, scale: 1 })
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        if (ref.current) ref.current.style.cursor = ''
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [board.id, board.cards, readOnly, removeCards, clearSelection, select, setVp])

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.layer) return
    const el = ref.current!
    const rect = el.getBoundingClientRect()
    const pan = e.button === 1 || spaceHeld.current || e.altKey
    el.setPointerCapture(e.pointerId)
    let lx = e.clientX
    let ly = e.clientY
    const start = screenToBoard(useViewport.getState().get(board.id), e.clientX, e.clientY, rect)
    let moved = false
    if (!pan && !e.shiftKey) clearSelection()

    const move = (ev: PointerEvent) => {
      moved = true
      if (pan) {
        const cur = useViewport.getState().get(board.id)
        setVp(board.id, { ...cur, x: cur.x + ev.clientX - lx, y: cur.y + ev.clientY - ly })
        lx = ev.clientX
        ly = ev.clientY
      } else {
        const p = screenToBoard(useViewport.getState().get(board.id), ev.clientX, ev.clientY, rect)
        setMarquee({ x0: start.x, y0: start.y, x1: p.x, y1: p.y })
      }
    }
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.releasePointerCapture(ev.pointerId)
      setMarquee((m) => {
        if (m && moved && !pan) {
          const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1)
          const y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1)
          const hit = board.cards.filter((c) => c.x < x1 && c.x + c.w > x0 && c.y < y1 && c.y + c.h > y0).map((c) => c.id)
          select(hit, ev.shiftKey)
        }
        return null
      })
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.layer) return
    const rect = ref.current!.getBoundingClientRect()
    const p = screenToBoard(vp, e.clientX, e.clientY, rect)
    const z = board.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1
    const id = newId()
    autoEdit.id = id
    addCard(board.id, { id, type: 'note', x: p.x - 110, y: p.y - 40, w: 220, h: 120, z, md: '' })
    select([id])
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (readOnly) return
    const rect = ref.current!.getBoundingClientRect()
    const p = screenToBoard(vp, e.clientX, e.clientY, rect)
    const files = [...e.dataTransfer.files]
    if (files.length) {
      await addAssets(board.id, files, { x: p.x, y: p.y })
      return
    }
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (url && /^https?:\/\//.test(url)) {
      const z = board.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1
      addCard(board.id, { id: newId(), type: 'link', x: p.x, y: p.y, w: 260, h: 90, z, url, title: '' })
    }
  }

  return (
    <div
      ref={ref}
      className={`canvas-bg relative h-full w-full overflow-hidden touch-none ${dragOver ? 'outline outline-4 -outline-offset-4 outline-frog-300/60' : ''}`}
      style={{ backgroundSize: `${24 * vp.scale}px ${24 * vp.scale}px`, backgroundPosition: `${vp.x}px ${vp.y}px` }}
      onPointerDown={onBackgroundPointerDown}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div
        data-layer="1"
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`, width: 1, height: 1 }}
      >
        {board.cards.map((card) => (
          <CardView key={card.id} card={card} boardId={board.id} selected={selection.has(card.id)} readOnly={readOnly} scale={scale} />
        ))}
        {marquee && (
          <div
            className="absolute border border-frog-300 bg-frog-300/10"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}
      </div>
      {board.cards.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-frog-200/70">
          <Peepo name="peepoSit" size={96} className="peepo-bounce opacity-80" />
          <div className="text-lg font-bold">Empty board. peepoSit</div>
          <div className="text-sm">Double-click to write a note · drop files anywhere · use the toolbar</div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-black/30 px-2 py-0.5 text-[11px] text-frog-200/70">
        {Math.round(vp.scale * 100)}%
      </div>
    </div>
  )
}

