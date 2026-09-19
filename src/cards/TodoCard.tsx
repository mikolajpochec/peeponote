import { useState } from 'react'
import type { TodoCard as TodoCardT } from '../model/types'
import { newId } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'

export function TodoCard({ card, boardId, readOnly }: CardProps<TodoCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const [newText, setNewText] = useState('')
  const done = card.items.filter((i) => i.done).length

  const setItems = (items: TodoCardT['items']) => updateCard(boardId, card.id, { items })

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2">
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.title}
          placeholder="To-do"
          onChange={(e) => updateCard(boardId, card.id, { title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-[14px] font-extrabold outline-none placeholder:text-ink/30"
        />
        <span className="text-[11px] text-ink/50">
          {done}/{card.items.length}
        </span>
      </div>
      <ul className="flex-1 overflow-auto px-2 py-1 scrollbar-thin">
        {card.items.map((it) => (
          <li key={it.id} className="group/item flex items-start gap-2 px-1 py-0.5 text-[13px]">
            <input
              data-nodrag
              type="checkbox"
              checked={it.done}
              disabled={readOnly}
              onChange={(e) => setItems(card.items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)))}
              className="mt-0.5 accent-frog-500"
            />
            <input
              data-nodrag
              readOnly={readOnly}
              value={it.text}
              onChange={(e) => setItems(card.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
              className={`min-w-0 flex-1 bg-transparent outline-none ${it.done ? 'line-through text-ink/40' : ''}`}
            />
            {!readOnly && (
              <button
                data-nodrag
                onClick={() => setItems(card.items.filter((x) => x.id !== it.id))}
                className="hidden text-ink/40 group-hover/item:block hover:text-red-600"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form
          className="border-t border-ink/10 px-3 py-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newText.trim()) return
            setItems([...card.items, { id: newId(), text: newText.trim(), done: false }])
            setNewText('')
          }}
        >
          <input
            data-nodrag
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="+ add item"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-ink/30"
          />
        </form>
      )}
    </div>
  )
}
