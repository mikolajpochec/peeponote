import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextCard as TextCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { autoEdit } from './autoEdit'
import { useEditRequest } from '../canvas/editRequest'

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
        const w = Math.max(60, Math.ceil(m.offsetWidth))
        const h = Math.max(32, Math.ceil(m.offsetHeight))
        if (Math.abs(w - c.w) > 1 || Math.abs(h - c.h) > 1) updateCard(boardId, card.id, { w, h })
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
      className={`pointer-events-none invisible absolute left-0 top-0 whitespace-pre-wrap p-2 ${cls}`}
      style={{ width: 'max-content', maxWidth: maxW }}
    >
      {shown || placeholder}
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
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) commit()
          e.stopPropagation()
        }}
          placeholder={placeholder}
          className={`h-full w-full resize-none overflow-hidden bg-frog-300/10 p-2 text-inherit outline-none placeholder:text-frog-200/30 ${cls}`}
          style={{ font: 'inherit', color: 'inherit', textAlign: 'inherit' }}
        />
      </>
    )
  }

  return (
    <>
      {measurer}
      <div ref={view} className={`h-full w-full overflow-hidden whitespace-pre-wrap p-2 ${cls}`}>
        {card.text || <span className="text-frog-200/30">{placeholder}</span>}
      </div>
    </>
  )
}
