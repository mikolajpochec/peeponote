import { useState } from 'react'
import Markdown from 'react-markdown'
import type { NoteCard as NoteCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'
import { autoEdit } from './autoEdit'
import { useEditRequest } from '../canvas/editRequest'
import { mdLink } from './Inline'
import { MdEditor } from '../editor'

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
      <MdEditor
        value={draft}
        onChange={setDraft}
        onDone={commit}
        boardId={boardId}
        cardId={card.id}
        mode="block"
        placeholder="Write markdown… (Esc or ⌘⏎ to finish)"
        className="h-full w-full overflow-auto p-3 leading-snug scrollbar-thin"
      />
    )
  }

  return (
    <div
      className="prose-note h-full w-full overflow-auto p-3 leading-snug scrollbar-thin"
      style={{ background: card.color }}
    >
      {card.md.trim() ? (
        <Markdown components={{ a: mdLink }}>{card.md}</Markdown>
      ) : (
        <span className="opacity-40">{readOnly ? 'Empty note' : 'Double-click to write…'}</span>
      )}
    </div>
  )
}
