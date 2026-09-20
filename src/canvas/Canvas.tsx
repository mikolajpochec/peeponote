import { useCallback, useEffect, useRef, useState } from 'react'
import type { Anchor, Board, Connector } from '../model/types'
import { newId } from '../model/types'
import { ConnectorLayer, type DraftConnector } from './ConnectorLayer'
import { anchorForDrop, anchorPoint } from './connectors'
import { useWorkspace } from '../store/workspace'
import { CardView } from '../cards/CardView'
import { MAX_SCALE, MIN_SCALE, screenToBoard, useViewport, zoomAt } from './viewport'
import { Peepo } from '../ui/Peepo'
import { autoEdit } from '../cards/autoEdit'
import { setGlobalCursor } from './cursor'
import { Palette, TOOL_MIME, placeTool, toolById } from '../ui/Palette'
import { StyleBar } from '../ui/StyleBar'
import { FormatBar } from '../ui/FormatBar'
import { useEditing } from '../store/editing'
import { ContextMenu, sep, type MenuItem } from '../ui/ContextMenu'
import { TOOLS } from '../ui/Palette'
import { copySelection, duplicateSelection, hasClipboard, pastePayload, readPayload } from './clipboard'
import { downloadAsset } from '../cards/AssetCard'
import { boardVars } from './styles'
import { bbox } from './arrange'
import { useLastStyle } from '../store/lastStyle'
import { copyLink } from '../nav/links'
import { toast } from '../store/toast'
import { removeCardsChecked } from '../store/removeCards'
import { useProperties } from '../ui/PropertiesDialog'
import { useSettings } from '../store/settings'
import { resolveTheme } from '../theme/themes'
import { LONG_PRESS_MS, LONG_PRESS_SLOP, activeTouches, isDuplicateDblClick, markLongPress, registerTap, shouldSwallowContextMenu, useIsMobile } from './touch'

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
  const [menu, setMenu] = useState<{ x: number; y: number; at: { x: number; y: number }; cardId: string | null; connectorId: string | null } | null>(null)
  const bringToFront = useWorkspace((s) => s.bringToFront)
  const sendToBack = useWorkspace((s) => s.sendToBack)
  const groupCards = useWorkspace((s) => s.groupCards)
  const ungroupCards = useWorkspace((s) => s.ungroupCards)
  const navigate = useWorkspace((s) => s.navigate)
  const goBack = useWorkspace((s) => s.goBack)
  const backTo = useWorkspace((s) => {
    for (let i = s.navStack.length - 1; i >= 0; i--) if (s.boards[s.navStack[i]]) return s.boards[s.navStack[i]]
    return undefined
  })
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

  // two fingers: pinch to zoom, drag to pan (touch events see both fingers even when one is captured by a card)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let prev: { cx: number; cy: number; d: number } | null = null
    const read = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]]
      return { cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        prev = read(e)
        e.preventDefault()
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const cur = read(e)
      if (prev) {
        const rect = el.getBoundingClientRect()
        let v = useViewport.getState().get(board.id)
        v = { ...v, x: v.x + cur.cx - prev.cx, y: v.y + cur.cy - prev.cy }
        if (prev.d > 0) v = zoomAt(v, cur.d / prev.d, cur.cx, cur.cy, rect)
        setVp(board.id, v)
      }
      prev = cur
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) prev = null
    }
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
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
          if (cardIds.length) void removeCardsChecked(board.id, cardIds)
        }
      }
      if (e.key === 'Escape') clearSelection()
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        select(board.cards.map((c) => c.id))
      }
      if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        centerView()
      }
      // ⌘1 is taken by the browser (tab switch), so fit-all is ⇧F
      if (e.key.toLowerCase() === 'f' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        fitView()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && !readOnly) {
        e.preventDefault()
        const live = useWorkspace.getState().boards[board.id]
        const sel = useWorkspace.getState().selection
        if (live && sel.size) duplicateSelection(live, sel)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g' && !readOnly) {
        e.preventDefault()
        const live = useWorkspace.getState().boards[board.id]
        const sel = useWorkspace.getState().selection
        const ids = live?.cards.filter((c) => sel.has(c.id)).map((c) => c.id) ?? []
        if (e.shiftKey) ungroupCards(board.id, ids)
        else if (ids.length > 1) groupCards(board.id, ids)
      }
    }
    // system clipboard integration (fires for ⌘C/⌘X/⌘V outside inputs)
    const onCopy = (e: ClipboardEvent) => {
      if (isTyping()) return
      const live = useWorkspace.getState().boards[board.id]
      const sel = useWorkspace.getState().selection
      if (!live || !sel.size) return
      e.preventDefault()
      copySelection(live, sel, e.clipboardData)
    }
    const onCut = (e: ClipboardEvent) => {
      if (isTyping() || readOnly) return
      const live = useWorkspace.getState().boards[board.id]
      const sel = useWorkspace.getState().selection
      if (!live || !sel.size) return
      e.preventDefault()
      const p = copySelection(live, sel, e.clipboardData)
      void removeCardsChecked(board.id, p.cards.map((c) => c.id))
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping() || readOnly) return
      const dt = e.clipboardData
      const payload = dt?.types.includes('application/x-peeponote') ? readPayload(dt) : null
      if (payload?.cards.length) {
        e.preventDefault()
        pastePayload(board.id, payload)
        return
      }
      const files = [...(dt?.files ?? [])]
      const c = viewCenter()
      if (files.length) {
        e.preventDefault()
        void addAssets(board.id, files, { x: c.x - 140, y: c.y - 140 })
        return
      }
      const text = dt?.getData('text/plain')?.trim()
      if (text) {
        e.preventDefault()
        const z = (useWorkspace.getState().boards[board.id]?.cards ?? []).reduce((m, k) => Math.max(m, k.z), 0) + 1
        const id = newId()
        if (/^(https?:\/\/|peepo:\/\/)\S+$/i.test(text)) addCard(board.id, { id, type: 'link', x: c.x - 130, y: c.y - 45, w: 260, h: 90, z, url: text, title: '' })
        else addCard(board.id, { id, type: 'note', x: c.x - 110, y: c.y - 60, w: 220, h: 120, z, md: text })
        select([id])
      }
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
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
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
  }, [board.id, board.cards, board.connectors, readOnly, removeCards, removeConnectors, clearSelection, select, setVp, addAssets, addCard, groupCards, ungroupCards])

  /** put the board origin (the ⌖ marker) in the middle of the canvas at 100% */
  const centerView = () => {
    const el = ref.current
    const w = el?.clientWidth ?? 800
    const h = el?.clientHeight ?? 600
    setVp(board.id, { x: w / 2, y: h / 2, scale: 1 })
  }
  /** zoom out/in so every card is visible */
  const fitView = () => {
    const el = ref.current
    const b = bbox(board.cards)
    if (!el || !b) return centerView()
    const w = el.clientWidth
    const h = el.clientHeight
    const pad = 60
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((w - pad * 2) / Math.max(b.w, 1), (h - pad * 2) / Math.max(b.h, 1), 1.5)))
    setVp(board.id, { scale, x: w / 2 - (b.x + b.w / 2) * scale, y: h / 2 - (b.y + b.h / 2) * scale })
  }

  /** board coords at the middle of the visible canvas */
  const viewCenter = () => {
    const el = ref.current
    const cur = useViewport.getState().get(board.id)
    const w = el?.clientWidth ?? 800
    const h = el?.clientHeight ?? 600
    return { x: (w / 2 - cur.x) / cur.scale, y: (h / 2 - cur.y) / cur.scale }
  }

  const openMenuAt = (clientX: number, clientY: number, t: HTMLElement) => {
    const rect = ref.current!.getBoundingClientRect()
    const at = screenToBoard(useViewport.getState().get(board.id), clientX, clientY, rect)
    const cardId = t.closest('[data-card]')?.getAttribute('data-card') ?? null
    const connectorId = t.closest('[data-connector]')?.getAttribute('data-connector') ?? null
    const sel = useWorkspace.getState().selection
    if (cardId && !sel.has(cardId)) select([cardId])
    if (connectorId && !sel.has(connectorId)) select([connectorId])
    setMenu({ x: clientX, y: clientY, at, cardId, connectorId })
  }

  const onContextMenu = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    // let native menus work inside text fields
    if (t.closest('input, textarea, [contenteditable="true"]')) return
    e.preventDefault()
    if (shouldSwallowContextMenu()) return // long-press already opened ours
    openMenuAt(e.clientX, e.clientY, t)
  }

  // touch: long-press → context menu, double-tap → edit/open (runs in capture phase so it also sees captured card drags)
  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || activeTouches() > 1) return
    const t = e.target as HTMLElement
    if (t.closest('input, textarea, button, a, select, [contenteditable="true"], [data-nodrag]')) return
    const el = ref.current!
    const { clientX: sx, clientY: sy, pointerId } = e
    let fired = false
    const cancel = () => {
      clearTimeout(timer)
      el.removeEventListener('pointermove', move, true)
      el.removeEventListener('pointerup', up, true)
      el.removeEventListener('pointercancel', cancel, true)
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId && Math.hypot(ev.clientX - sx, ev.clientY - sy) > LONG_PRESS_SLOP) cancel()
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cancel()
      if (fired || Math.hypot(ev.clientX - sx, ev.clientY - sy) > LONG_PRESS_SLOP) return
      if (registerTap(ev)) {
        const card = t.closest('[data-card]') as HTMLElement | null
        if (card) card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: ev.clientX, clientY: ev.clientY }))
        else if (t === el || t.dataset.layer) openNoteAt(ev.clientX, ev.clientY)
      }
    }
    const timer = setTimeout(() => {
      if (activeTouches() !== 1) return cancel() // a pinch, not a press
      fired = true
      cancel()
      markLongPress()
      if ('vibrate' in navigator) navigator.vibrate(10)
      openMenuAt(sx, sy, t)
    }, LONG_PRESS_MS)
    el.addEventListener('pointermove', move, true)
    el.addEventListener('pointerup', up, true)
    el.addEventListener('pointercancel', cancel, true)
  }

  const menuItems = (): MenuItem[] => {
    if (!menu) return []
    const live = useWorkspace.getState().boards[board.id] ?? board
    const sel = useWorkspace.getState().selection
    const selCards = live.cards.filter((c) => sel.has(c.id))
    const ids = selCards.map((c) => c.id)
    const n = selCards.length
    const paste: MenuItem = {
      kind: 'item',
      label: 'Paste here',
      icon: '📋',
      shortcut: '⌘V',
      disabled: readOnly || !hasClipboard(),
      onClick: () => {
        const p = readPayload()
        if (p) pastePayload(board.id, p, menu.at)
      },
    }
    if (menu.connectorId) {
      const k = live.connectors.find((x) => x.id === menu.connectorId)
      return [
        { kind: 'item', label: 'Flip direction', icon: '⇄', disabled: readOnly || !k, onClick: () => k && updateConnector(board.id, k.id, { from: k.to, to: k.from }) },
        { kind: 'item', label: 'Properties…', icon: 'ⓘ', onClick: () => useProperties.getState().open({ kind: 'connector', boardId: board.id, connectorId: menu.connectorId! }) },
        sep,
        { kind: 'item', label: 'Delete', icon: '✕', shortcut: '⌫', danger: true, disabled: readOnly, onClick: () => removeConnectors(board.id, [menu.connectorId!]) },
      ]
    }
    if (menu.cardId && n) {
      const one = n === 1 ? selCards[0] : null
      const items: MenuItem[] = []
      if (one?.type === 'board') items.push({ kind: 'item', label: 'Open board', icon: '🐸', shortcut: 'dbl-click', onClick: () => navigate(one.boardId) }, sep)
      if (one?.type === 'asset') items.push({ kind: 'item', label: 'Download original', icon: '⬇', onClick: () => void downloadAsset(one) }, sep)
      items.push(
        { kind: 'item', label: n > 1 ? `Copy ${n} items` : 'Copy', icon: '⧉', shortcut: '⌘C', onClick: () => copySelection(live, sel) },
        ...(one
          ? [
              {
                kind: 'item',
                label: 'Copy link to this card',
                icon: '🔗',
                onClick: async () => {
                  await copyLink({ kind: 'card', boardId: board.id, cardId: one.id })
                  toast.ok('Link copied — paste it on any board to make a link card. peepoHey', 'peepoHey')
                },
              } as MenuItem,
            ]
          : []),
        {
          kind: 'item',
          label: 'Cut',
          icon: '✂',
          shortcut: '⌘X',
          disabled: readOnly,
          onClick: async () => {
            if (await removeCardsChecked(board.id, ids)) copySelection(live, sel)
          },
        },
        { kind: 'item', label: 'Duplicate', icon: '⊕', shortcut: '⌘D', disabled: readOnly, onClick: () => duplicateSelection(live, sel) },
        paste,
        sep,
        { kind: 'item', label: 'Bring to front', icon: '⤒', disabled: readOnly, onClick: () => ids.forEach((id) => bringToFront(board.id, id)) },
        { kind: 'item', label: 'Send to back', icon: '⤓', disabled: readOnly, onClick: () => sendToBack(board.id, ids) },
        sep,
        ...(selCards.some((c) => c.groupId)
          ? [{ kind: 'item', label: 'Ungroup', icon: '⧉', shortcut: '⌘⇧G', disabled: readOnly, onClick: () => ungroupCards(board.id, ids) } as MenuItem]
          : []),
        ...(n > 1 && !(selCards.every((c) => c.groupId) && new Set(selCards.map((c) => c.groupId)).size === 1)
          ? [{ kind: 'item', label: `Group ${n} items`, icon: '⧉', shortcut: '⌘G', disabled: readOnly, onClick: () => groupCards(board.id, ids) } as MenuItem]
          : []),
        ...(n > 1 || selCards.some((c) => c.groupId) ? [sep] : []),
        ...(one ? [{ kind: 'item', label: 'Properties…', icon: 'ⓘ', onClick: () => useProperties.getState().open({ kind: 'card', boardId: board.id, cardId: one.id }) } as MenuItem, sep] : []),
        { kind: 'item', label: n > 1 ? `Delete ${n} items` : 'Delete', icon: '✕', shortcut: '⌫', danger: true, disabled: readOnly, onClick: () => void removeCardsChecked(board.id, ids) },
      )
      return items
    }
    // empty canvas
    return [
      paste,
      {
        kind: 'item',
        label: 'Copy link to this spot',
        icon: '🔗',
        onClick: async () => {
          await copyLink({ kind: 'place', boardId: board.id, x: menu.at.x, y: menu.at.y, scale: useViewport.getState().get(board.id).scale })
          toast.ok('Link copied — paste it anywhere to make a link card. peepoHey', 'peepoHey')
        },
      },
      sep,
      ...TOOLS.filter((t) => t.id !== 'file').map<MenuItem>((t) => ({
        kind: 'item',
        label: `Add ${t.label.toLowerCase()} here`,
        icon: t.icon,
        disabled: readOnly,
        onClick: () => placeTool(board.id, t, { x: menu.at.x, y: menu.at.y }),
      })),
      sep,
      { kind: 'item', label: 'Select all', icon: '▣', shortcut: '⌘A', onClick: () => select(live.cards.map((c) => c.id)) },
      { kind: 'item', label: 'Center view', icon: '⌖', shortcut: '⌘0', onClick: centerView },
      { kind: 'item', label: 'Fit everything', icon: '⤢', shortcut: '⇧F', onClick: fitView },
    ]
  }

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return // context menu
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.layer) return
    if (e.pointerType === 'touch' && activeTouches() > 1) return // second finger → pinch handler owns it
    const el = ref.current!
    const rect = el.getBoundingClientRect()
    // a finger on empty canvas pans; marquee stays a mouse/pen gesture
    const pan = e.button === 1 || spaceHeld.current || e.altKey || e.pointerType === 'touch'
    el.setPointerCapture(e.pointerId)
    let lx = e.clientX
    let ly = e.clientY
    const start = screenToBoard(useViewport.getState().get(board.id), e.clientX, e.clientY, rect)
    let moved = false
    if (!pan && !e.shiftKey) clearSelection()

    const move = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch' && activeTouches() > 1) {
        lx = ev.clientX
        ly = ev.clientY
        return
      }
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
          // connectors count when both ends are inside the marquee
          const cmap = new Map(board.cards.map((c) => [c.id, c]))
          const inside = (p: { x: number; y: number }) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1
          for (const k of board.connectors) {
            const a = anchorPoint(k.from, cmap)
            const b = anchorPoint(k.to, cmap)
            if (a && b && inside(a.pt) && inside(b.pt)) hit.push(k.id)
          }
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
    /** to-do row under the pointer, if any (DOM hit test — row positions only exist in layout) */
    const itemUnder = (ev: { clientX: number; clientY: number }) => {
      const li = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-item]')
      const cardId = li?.closest<HTMLElement>('[data-card]')?.dataset.card
      return li && cardId ? { cardId, itemId: li.dataset.item! } : null
    }
    /** where the end would land right now — same rule as the drop itself */
    const targetFor = (p: { x: number; y: number }, ev?: { clientX: number; clientY: number }): Anchor => {
      const live = useWorkspace.getState().boards[board.id]
      if (!live) return p
      const cards = new Map(live.cards.map((c) => [c.id, c]))
      const fixedPt = anchorPoint(fixed, cards)?.pt ?? p
      return anchorForDrop(live, p, fixedPt, excludeCard, ev ? itemUnder(ev) : null)
    }
    const p0 = toBoard(e)
    setDraft({ fixed, moving: p0, editing, target: targetFor(p0) })

    setGlobalCursor('crosshair')
    const move = (ev: PointerEvent) => {
      const p = toBoard(ev)
      setDraft((d) => (d ? { ...d, moving: p, target: targetFor(p, ev) } : d))
    }
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
      const dropped = targetFor(toBoard(ev), ev)
      if (editing) {
        updateConnector(board.id, editing.id, { [editing.end]: dropped } as Partial<Connector>)
        select([editing.id])
      } else {
        const id = newId()
        addConnector(board.id, { id, from: fixed, to: dropped, arrows: useLastStyle.getState().arrows })
        select([id])
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const openNoteAt = (clientX: number, clientY: number) => {
    if (readOnly) return
    const rect = ref.current!.getBoundingClientRect()
    const p = screenToBoard(useViewport.getState().get(board.id), clientX, clientY, rect)
    const z = board.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1
    const id = newId()
    autoEdit.id = id
    addCard(board.id, { id, type: 'note', x: p.x - 110, y: p.y - 40, w: 220, h: 120, z, md: '' })
    select([id])
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.layer) return
    if (isDuplicateDblClick()) return
    openNoteAt(e.clientX, e.clientY)
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
    if (url && /^(https?:\/\/|peepo:\/\/)/i.test(url)) {
      const z = board.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1
      addCard(board.id, { id: newId(), type: 'link', x: p.x, y: p.y, w: 260, h: 90, z, url, title: '' })
    }
  }

  const theme = useSettings((s) => resolveTheme(s.theme))
  const mobile = useIsMobile()

  // dashed frame around each group that has a selected (or hovered) member
  const activeGroups = new Set<string>()
  for (const c of board.cards) if (c.groupId && (selection.has(c.id) || c.id === hoveredCard)) activeGroups.add(c.groupId)
  const groupOutlines = [...activeGroups].flatMap((id) => {
    const b = bbox(board.cards.filter((c) => c.groupId === id))
    return b ? [{ id, ...b }] : []
  })

  // style bar floats (unscaled) above the selected cards; while a card's text is being edited the
  // format bar (bold / italic / link…) takes that spot instead
  const editingCardId = useEditing((s) => (s.boardId === board.id ? s.cardId : null))
  const selectedCards = board.cards.filter((c) => selection.has(c.id))
  const barCards = editingCardId ? board.cards.filter((c) => c.id === editingCardId) : selectedCards
  let styleBarPos: { x: number; y: number; below: boolean } | null = null
  if (!readOnly && !draft && !marquee && barCards.length) {
    const minX = Math.min(...barCards.map((c) => c.x))
    const maxX = Math.max(...barCards.map((c) => c.x + c.w))
    const minY = Math.min(...barCards.map((c) => c.y))
    const maxY = Math.max(...barCards.map((c) => c.y + c.h))
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
        ...boardVars(board, theme.canvas),
        backgroundSize: `${24 * vp.scale}px ${24 * vp.scale}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
        backgroundColor: 'var(--board-bg)',
        backgroundImage: board.style?.dots === false ? 'none' : undefined,
      }}
      onPointerDown={onBackgroundPointerDown}
      onPointerDownCapture={onPointerDownCapture}
      onContextMenu={onContextMenu}
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
        {/* board origin: the ⌖ button brings you back here */}
        <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, opacity: 0.55 }} width={1} height={1}>
          <g stroke="var(--board-line)" strokeWidth={1.5 / vp.scale} fill="none">
            <line x1={-14 / vp.scale} y1={0} x2={-5 / vp.scale} y2={0} />
            <line x1={5 / vp.scale} y1={0} x2={14 / vp.scale} y2={0} />
            <line x1={0} y1={-14 / vp.scale} x2={0} y2={-5 / vp.scale} />
            <line x1={0} y1={5 / vp.scale} x2={0} y2={14 / vp.scale} />
            <circle cx={0} cy={0} r={3 / vp.scale} />
          </g>
        </svg>
        {groupOutlines.map((g) => (
          <div
            key={g.id}
            className="pointer-events-none absolute rounded-2xl border border-dashed"
            style={{ left: g.x - 10, top: g.y - 10, width: g.w + 20, height: g.h + 20, borderColor: 'var(--board-line-sel)', opacity: 0.7 }}
          />
        ))}
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
          <div className="px-6 text-center text-sm">{mobile ? 'Double-tap to write a note · long-press for the menu · use the toolbar below' : 'Double-click to write a note · drop files anywhere · use the toolbar'}</div>
        </div>
      )}
      {!readOnly && <Palette board={board} />}
      {backTo && (
        <button
          onClick={goBack}
          title={`Back to ${backTo.name || 'Untitled'}`}
          className="absolute left-3 top-3 z-20 flex max-w-[60%] items-center gap-1.5 rounded-full border border-(--hair) bg-swamp-900/85 px-3 py-1.5 text-[12px] font-semibold text-frog-50 shadow-lg backdrop-blur hover:bg-swamp-800"
        >
          <span aria-hidden>←</span>
          <span className="truncate">{backTo.name || 'Untitled'}</span>
        </button>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
      {styleBarPos && (
        <div
          className="absolute z-30"
          style={{
            left: (() => {
              const cw = ref.current?.clientWidth ?? 800
              const half = Math.min(180, cw / 2 - 8)
              return Math.max(half, Math.min(styleBarPos.x, cw - half))
            })(),
            top: styleBarPos.y,
            transform: styleBarPos.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
        >
          {editingCardId ? <FormatBar /> : <StyleBar boardId={board.id} cards={selectedCards} />}
        </div>
      )}
      <div
        className="absolute bottom-2 right-3 flex items-center gap-0.5 rounded-lg p-0.5 text-[11px] max-md:bottom-20"
        style={{ color: 'var(--board-fg-muted)', background: 'color-mix(in srgb, var(--board-fg) 8%, transparent)' }}
      >
        <button onClick={centerView} title="Center on the board origin (⌘0)" className="h-7 w-7 rounded-md text-[15px] hover:bg-(--hover-strong)" style={{ color: 'var(--board-fg)' }}>
          ⌖
        </button>
        <button onClick={fitView} title="Fit everything (⇧F)" className="h-7 w-7 rounded-md text-[13px] hover:bg-(--hover-strong)" style={{ color: 'var(--board-fg)' }}>
          ⤢
        </button>
        <span className="px-1.5 tabular-nums max-md:hidden">{Math.round(vp.scale * 100)}%</span>
      </div>
    </div>
  )
}

