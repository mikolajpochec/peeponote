import { useCallback, useEffect, useRef, useState } from 'react'
import type { Anchor, Board, Connector } from '../model/types'
import { newId } from '../model/types'
import { ConnectorLayer, type DraftConnector } from './ConnectorLayer'
import { anchorForDrop, anchorPoint } from './connectors'
import { useWorkspace } from '../store/workspace'
import { CardView } from '../cards/CardView'
import { screenToBoard, useViewport, zoomAt } from './viewport'
import { Peepo } from '../ui/Peepo'
import { autoEdit } from '../cards/autoEdit'
import { setGlobalCursor } from './cursor'
import { Palette, TOOL_MIME, placeTool, toolById } from '../ui/Palette'
import { StyleBar } from '../ui/StyleBar'
import { boardVars } from './styles'

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
  const addConnector = useWorkspace((s) => s.addConnector)
  const updateConnector = useWorkspace((s) => s.updateConnector)
  const removeConnectors = useWorkspace((s) => s.removeConnectors)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftConnector | null>(null)
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
          const cardIds = board.cards.filter((c) => sel.has(c.id)).map((c) => c.id)
          const connIds = board.connectors.filter((k) => sel.has(k.id)).map((k) => k.id)
          if (connIds.length) removeConnectors(board.id, connIds)
          if (cardIds.length) removeCards(board.id, cardIds)
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
  }, [board.id, board.cards, board.connectors, readOnly, removeCards, removeConnectors, clearSelection, select, setVp])

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
      setGlobalCursor(pan ? 'grabbing' : 'crosshair')
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
      setGlobalCursor(null)
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

  /** Drag a connector end (new or existing) until pointer-up, then glue it to a card side or a free point. */
  const startConnectorDrag = (e: React.PointerEvent, fixed: Anchor, editing?: DraftConnector['editing'], excludeCard?: string) => {
    if (readOnly || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = ref.current!
    const rect = el.getBoundingClientRect()
    el.setPointerCapture(e.pointerId)
    const start = { x: e.clientX, y: e.clientY }
    const toBoard = (ev: { clientX: number; clientY: number }) => screenToBoard(useViewport.getState().get(board.id), ev.clientX, ev.clientY, rect)
    setDraft({ fixed, moving: toBoard(e), editing })

    setGlobalCursor('crosshair')
    const move = (ev: PointerEvent) => setDraft((d) => (d ? { ...d, moving: toBoard(ev) } : d))
    const up = (ev: PointerEvent) => {
      setGlobalCursor(null)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      try {
        el.releasePointerCapture(ev.pointerId)
      } catch {
        /* released */
      }
      setDraft(null)
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) return // just a click
      const live = useWorkspace.getState().boards[board.id]
      if (!live) return
      const cards = new Map(live.cards.map((c) => [c.id, c]))
      const fixedPt = anchorPoint(fixed, cards)?.pt ?? toBoard(ev)
      const dropped = anchorForDrop(live, toBoard(ev), fixedPt, excludeCard)
      if (editing) {
        updateConnector(board.id, editing.id, { [editing.end]: dropped } as Partial<Connector>)
        select([editing.id])
      } else {
        const id = newId()
        addConnector(board.id, { id, from: fixed, to: dropped, arrows: 'end' })
        select([id])
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
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
    const toolId = e.dataTransfer.getData(TOOL_MIME)
    if (toolId) {
      const tool = toolById(toolId)
      if (tool) placeTool(board.id, tool, { x: p.x - tool.w / 2, y: p.y - tool.h / 2 })
      return
    }
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

  // style bar floats (unscaled) above the selected cards
  const selectedCards = board.cards.filter((c) => selection.has(c.id))
  let styleBarPos: { x: number; y: number; below: boolean } | null = null
  if (!readOnly && !draft && !marquee && selectedCards.length) {
    const minX = Math.min(...selectedCards.map((c) => c.x))
    const maxX = Math.max(...selectedCards.map((c) => c.x + c.w))
    const minY = Math.min(...selectedCards.map((c) => c.y))
    const maxY = Math.max(...selectedCards.map((c) => c.y + c.h))
    const sx = vp.x + ((minX + maxX) / 2) * vp.scale
    const top = vp.y + minY * vp.scale - 12
    const below = top < 56
    styleBarPos = { x: sx, y: below ? vp.y + maxY * vp.scale + 12 : top, below }
  }

  return (
    <div
      ref={ref}
      className={`canvas-bg relative h-full w-full overflow-hidden touch-none ${dragOver ? 'outline outline-4 -outline-offset-4 outline-frog-300/60' : ''}`}
      style={{
        ...boardVars(board),
        backgroundSize: `${24 * vp.scale}px ${24 * vp.scale}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
        backgroundColor: 'var(--board-bg)',
        backgroundImage: board.style?.dots === false ? 'none' : undefined,
      }}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={(e) => {
        if (draft) return
        const id = (e.target as HTMLElement).closest?.('[data-card]')?.getAttribute('data-card') ?? null
        if (id !== hoveredCard) setHoveredCard(id)
      }}
      onPointerLeave={() => setHoveredCard(null)}
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
        <ConnectorLayer
          board={board}
          scale={vp.scale}
          readOnly={readOnly}
          selection={selection}
          hoveredCard={hoveredCard}
          draft={draft}
          onAnchorDown={(e, anchor) => startConnectorDrag(e, anchor, undefined, 'cardId' in anchor ? anchor.cardId : undefined)}
          onEndpointDown={(e, k, end) => {
            const fixed = end === 'from' ? k.to : k.from
            startConnectorDrag(e, fixed, { id: k.id, end }, 'cardId' in fixed ? fixed.cardId : undefined)
          }}
          onSelect={(id, additive) => select([id], additive)}
        />
        {board.cards.map((card) => (
          <CardView key={card.id} card={card} boardId={board.id} selected={selection.has(card.id)} readOnly={readOnly} scale={scale} />
        ))}
        {marquee && (
          <div
            className="absolute border"
            style={{
              borderColor: 'var(--board-line)',
              background: 'color-mix(in srgb, var(--board-line) 12%, transparent)',
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}
      </div>
      {board.cards.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--board-fg-muted)' }}>
          <Peepo name="peepoSit" size={96} className="peepo-bounce opacity-80" />
          <div className="text-lg font-bold">Empty board. peepoSit</div>
          <div className="text-sm">Double-click to write a note · drop files anywhere · use the toolbar</div>
        </div>
      )}
      {!readOnly && <Palette board={board} />}
      {styleBarPos && (
        <div
          className="absolute z-30"
          style={{
            left: Math.max(180, Math.min(styleBarPos.x, (ref.current?.clientWidth ?? 800) - 180)),
            top: styleBarPos.y,
            transform: styleBarPos.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
        >
          <StyleBar boardId={board.id} cards={selectedCards} />
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 right-3 rounded px-2 py-0.5 text-[11px]" style={{ color: 'var(--board-fg-muted)', background: 'color-mix(in srgb, var(--board-fg) 8%, transparent)' }}>
        {Math.round(vp.scale * 100)}%
      </div>
    </div>
  )
}

