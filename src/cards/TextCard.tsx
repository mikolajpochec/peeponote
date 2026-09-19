import { useEffect, useRef, useState } from 'react'
import type { TextCard as TextCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { autoEdit } from './autoEdit'

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
  const isTitle = card.style === 'title'
  const cls = isTitle
    ? 'text-[28px] font-black leading-tight tracking-tight text-frog-50'
    : 'text-[15px] leading-snug text-frog-100'

  useEffect(() => {
    if (editing) {
      ta.current?.focus()
      ta.current?.select()
    }
  }, [editing])

  // grow the card to fit its text (width stays user-controlled)
  useEffect(() => {
    if (editing || readOnly) return
    const el = view.current
    if (!el) return
    const needed = Math.ceil(el.scrollHeight)
    if (needed > card.h + 1) updateCard(boardId, card.id, { h: needed })
  }, [card.text, card.w, card.h, editing, readOnly, boardId, card.id, updateCard])

  const commit = () => {
    setEditing(false)
    if (draft !== card.text) updateCard(boardId, card.id, { text: draft })
  }

  if (editing) {
    return (
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
        placeholder={isTitle ? 'Title' : 'Text'}
        className={`h-full w-full resize-none bg-frog-300/10 p-2 outline-none placeholder:text-frog-200/30 ${cls}`}
      />
    )
  }

  return (
    <div
      ref={view}
      className={`h-full w-full cursor-text overflow-hidden whitespace-pre-wrap p-2 ${cls}`}
      onDoubleClick={(e) => {
        if (readOnly) return
        e.stopPropagation()
        setDraft(card.text)
        setEditing(true)
      }}
    >
      {card.text || <span className="text-frog-200/30">{isTitle ? 'Title' : 'Text'}</span>}
    </div>
  )
}
