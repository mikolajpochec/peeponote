import { useLayoutEffect, useRef, useState } from 'react'
import type { TextCard as TextCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { autoEdit } from './autoEdit'
import { useEditRequest } from '../canvas/editRequest'
import { useViewport } from '../canvas/viewport'
import { InlineMd } from './Inline'
import { MdEditor } from '../editor'

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
  const view = useRef<HTMLDivElement>(null)
  const editorHost = useRef<HTMLDivElement>(null)
  // the editor is lazy-loaded; bump when it mounts so the measuring effect can find .cm-content
  const [editorReady, setEditorReady] = useState(0)
  const measure = useRef<HTMLDivElement>(null)
  const isTitle = card.variant === 'title'
  const auto = card.autoSize !== false
  const maxW = isTitle ? 640 : 420
  const shown = editing ? draft : card.text
  const placeholder = isTitle ? 'Title' : 'Text'
  const cls = isTitle ? 'leading-tight tracking-tight' : 'leading-snug'

  // auto: card hugs its content (wrapping at maxW). manual: keep user width, only grow height to fit.
  // Runs as a layout effect so the card is resized in the same frame the text changes — otherwise the
  // textarea wraps at the old width for one paint and the caret visibly jumps while typing. The
  // ResizeObserver on the hidden measurer catches the remaining reasons the box changes size:
  // style bar changes (font size / family / bold), late font loads.
  useLayoutEffect(() => {
    if (readOnly) return
    // while editing, the editor's own content box is the truth (it lays text out exactly as shown);
    // otherwise the hidden measurer
    const m = editing ? (editorHost.current?.querySelector('.cm-content') as HTMLElement | null) : measure.current
    if (!m || m.closest('[data-preview]')) return // a scaled preview must not resize the real card
    const apply = () => {
      const c = useWorkspace.getState().boards[boardId]?.cards.find((x) => x.id === card.id)
      if (!c || c.type !== 'text') return
      const k = useViewport.getState().get(boardId).scale || 1
      const r = m.getBoundingClientRect()
      // fractional measurement (offsetWidth rounds down → last word wraps), snapped to 0.1 px first so the
      // scale division can't flip a ceil by one between zoom levels (that dirtied boards just by opening them)
      const px = (v: number) => Math.ceil(Math.round((v / k) * 10) / 10)
      if (c.autoSize !== false) {
        const w = Math.max(60, px(r.width) + (editing ? 6 : 2))
        const h = Math.max(32, px(r.height) + 1)
        // the view lays text out at its own natural width, so a few px of drift never wraps or clips —
        // only resize past that tolerance (fixes boards turning "unsaved" just by being opened)
        if (Math.abs(w - c.w) > 3 || Math.abs(h - c.h) > 3) updateCard(boardId, card.id, { w, h })
      } else {
        const needed = editing ? px(r.height) : Math.ceil(view.current?.scrollHeight ?? 0)
        if (needed > c.h + 1) updateCard(boardId, card.id, { h: needed })
      }
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(m)
    return () => ro.disconnect()
  }, [shown, auto, editing, readOnly, boardId, card.id, card.style, card.w, updateCard, editorReady])

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
    // while editing the editor itself is the measurer: it lays text out exactly as shown (markers hidden)
    return (
      <div
        ref={editorHost}
        className={`bg-frog-300/10 ${auto ? '' : 'h-full w-full'}`}
        // auto-size: the editor is as wide as its longest line (up to maxW); the card follows via the observer
        style={auto ? { width: 'max-content', maxWidth: maxW, minWidth: 60 } : undefined}
      >
        <MdEditor
          value={draft}
          onChange={setDraft}
          onDone={commit}
          boardId={boardId}
          cardId={card.id}
          mode="inline"
          placeholder={placeholder}
          onReady={() => setEditorReady((n) => n + 1)}
          className={`p-2 ${cls} ${auto ? 'md-editor-auto' : 'h-full w-full'}`}
        />
      </div>
    )
  }

  return (
    <>
      {measurer}
      <div
        ref={view}
        className={`h-full whitespace-pre-wrap break-words p-2 ${cls} ${auto ? 'overflow-visible' : 'w-full overflow-hidden'}`}
        // auto-size: natural width (wrapping at maxW) instead of the card's, so a card a couple of px too narrow can't wrap the last word
        style={auto ? { width: 'max-content', maxWidth: maxW, minWidth: '100%' } : undefined}
      >
        {card.text ? <InlineMd text={card.text} /> : <span className="text-frog-200/30">{placeholder}</span>}
      </div>
    </>
  )
}
