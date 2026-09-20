import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextCard as TextCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { autoEdit } from './autoEdit'
import { useEditRequest } from '../canvas/editRequest'
import { useViewport } from '../canvas/viewport'
import { InlineMd } from './Inline'
import { useEditing } from '../store/editing'

/** Free-floating text on the board: a big title or a plain paragraph, no card background. */
export function TextCard({ card, boardId, readOnly }: CardProps<TextCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const [editing, setEditing] = useState(() => {
    if (autoEdit.id === card.id && !readOnly) {
      autoEdit.id = null
      return true
    }
    return false
  })
  const [draft, setDraft] = useState(card.text)
  const ta = useRef<HTMLTextAreaElement>(null)
  const view = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const isTitle = card.variant === 'title'
  const auto = card.autoSize !== false
  const maxW = isTitle ? 640 : 420
  const shown = editing ? draft : card.text
  const placeholder = isTitle ? 'Title' : 'Text'
  const cls = isTitle ? 'leading-tight tracking-tight' : 'leading-snug'

  useEffect(() => {
    if (editing) {
      // register before focusing: a background window doesn't fire focus events, the bar must still appear
      if (ta.current) useEditing.getState().begin(boardId, card.id, ta.current, 'inline')
      ta.current?.focus()
      ta.current?.select()
    }
  }, [editing])

  // auto: card hugs its content (wrapping at maxW). manual: keep user width, only grow height to fit.
  // Runs as a layout effect so the card is resized in the same frame the text changes — otherwise the
  // textarea wraps at the old width for one paint and the caret visibly jumps while typing. The
  // ResizeObserver on the hidden measurer catches the remaining reasons the box changes size:
  // style bar changes (font size / family / bold), late font loads.
  useLayoutEffect(() => {
    if (readOnly) return
    const m = measure.current
    if (!m) return
    const apply = () => {
      const c = useWorkspace.getState().boards[boardId]?.cards.find((x) => x.id === card.id)
      if (!c || c.type !== 'text') return
      if (c.autoSize !== false) {
        // offsetWidth is rounded to whole px — a 213.6px line reported as 213 makes the last word wrap.
        // Measure fractionally (undoing the canvas zoom) and round up with a little slack.
        const k = useViewport.getState().get(boardId).scale || 1
        const r = m.getBoundingClientRect()
        const w = Math.max(60, Math.ceil(r.width / k) + 2)
        const h = Math.max(32, Math.ceil(r.height / k) + 1)
        if (w !== c.w || h !== c.h) updateCard(boardId, card.id, { w, h })
      } else {
        const needed = Math.ceil(editing ? (ta.current?.scrollHeight ?? 0) : (view.current?.scrollHeight ?? 0))
        if (needed > c.h + 1) updateCard(boardId, card.id, { h: needed })
      }
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(m)
    return () => ro.disconnect()
  }, [shown, auto, editing, readOnly, boardId, card.id, card.style, card.w, updateCard])

  const measurer = (
    <div
      ref={measure}
      aria-hidden
      className={`pointer-events-none invisible absolute left-0 top-0 whitespace-pre-wrap break-words p-2 ${cls}`}
      style={{ width: 'max-content', maxWidth: maxW }}
    >
      {editing ? shown || placeholder : shown ? <InlineMd text={shown} /> : placeholder}
    </div>
  )

  useEditRequest(() => {
    if (readOnly) return
    setDraft(card.text)
    setEditing(true)
  })

  const commit = () => {
    setEditing(false)
    if (draft !== card.text) updateCard(boardId, card.id, { text: draft })
  }

  if (editing) {
    return (
      <>
        {measurer}
        <textarea
        ref={ta}
        data-nodrag
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => useEditing.getState().begin(boardId, card.id, e.currentTarget, 'inline')}
        onBlur={(e) => {
          if (useEditing.getState().hold) return // the link picker took focus; we're still editing
          useEditing.getState().end(e.currentTarget)
          commit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) commit()
          e.stopPropagation()
        }}
          placeholder={placeholder}
          className={`h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-frog-300/10 p-2 text-inherit outline-none placeholder:text-frog-200/30 ${cls}`}
          style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', letterSpacing: 'inherit', color: 'inherit', textAlign: 'inherit' }}
        />
      </>
    )
  }

  return (
    <>
      {measurer}
      <div ref={view} className={`h-full w-full overflow-hidden whitespace-pre-wrap break-words p-2 ${cls}`}>
        {card.text ? <InlineMd text={card.text} /> : <span className="text-frog-200/30">{placeholder}</span>}
      </div>
    </>
  )
}
