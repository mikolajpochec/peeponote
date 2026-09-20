import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import type { NoteCard as NoteCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { autoEdit } from './autoEdit'
import { useEditRequest } from '../canvas/editRequest'

export function NoteCard({ card, boardId, readOnly }: CardProps<NoteCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const [editing, setEditing] = useState(() => {
    if (autoEdit.id === card.id && !readOnly) {
      autoEdit.id = null
      return true
    }
    return false
  })
  const [draft, setDraft] = useState(card.md)
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      ta.current?.focus()
      ta.current?.setSelectionRange(ta.current.value.length, ta.current.value.length)
    }
  }, [editing])

  useEditRequest(() => {
    if (readOnly) return
    setDraft(card.md)
    setEditing(true)
  })

  const commit = () => {
    setEditing(false)
    if (draft !== card.md) updateCard(boardId, card.id, { md: draft })
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
          if (e.key === 'Escape') commit()
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commit()
          e.stopPropagation()
        }}
        placeholder="Write markdown… (Esc or ⌘⏎ to finish)"
        className="h-full w-full resize-none bg-transparent p-3 leading-snug outline-none placeholder:opacity-40"
        style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', letterSpacing: 'inherit', color: 'inherit', textAlign: 'inherit' }}
      />
    )
  }

  return (
    <div
      className="prose-note h-full w-full overflow-auto p-3 leading-snug scrollbar-thin"
      style={{ background: card.color }}
    >
      {card.md.trim() ? (
        <Markdown>{card.md}</Markdown>
      ) : (
        <span className="opacity-40">{readOnly ? 'Empty note' : 'Double-click to write…'}</span>
      )}
    </div>
  )
}
