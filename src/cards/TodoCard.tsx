import { useEffect, useRef, useState } from 'react'
import { useItemRects } from '../canvas/itemRects'
import { useViewport } from '../canvas/viewport'
import { InlineMd } from './Inline'
import { useEditing } from '../store/editing'
import { fieldHandle } from '../ui/format'
import type { TodoCard as TodoCardT } from '../model/types'
import { newId } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'

export function TodoCard({ card, boardId, readOnly }: CardProps<TodoCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const [newText, setNewText] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const done = card.items.filter((i) => i.done).length

  const setItems = (items: TodoCardT['items']) => updateCard(boardId, card.id, { items })
  const list = useRef<HTMLUListElement>(null)

  // tell the connector layer where each row is (board units, relative to the card) — on layout, scroll and resize
  useEffect(() => {
    const ul = list.current
    const shell = ul?.closest('[data-card]') as HTMLElement | null
    if (!ul || !shell || ul.closest('[data-preview]')) return // previews must not report geometry for the real card
    const report = () => {
      const k = useViewport.getState().get(boardId).scale || 1
      const top = shell.getBoundingClientRect().top
      const rects: Record<string, { y: number; h: number }> = {}
      for (const li of ul.querySelectorAll<HTMLElement>('[data-item]')) {
        const r = li.getBoundingClientRect()
        rects[li.dataset.item!] = { y: (r.top - top) / k, h: r.height / k }
      }
      useItemRects.getState().report(card.id, rects)
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(ul)
    ul.addEventListener('scroll', report, { passive: true })
    return () => {
      ro.disconnect()
      ul.removeEventListener('scroll', report)
    }
  }, [boardId, card.id, card.items, card.w, card.h, card.style])
  useEffect(() => () => useItemRects.getState().forget(card.id), [card.id])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-current/10 px-3 py-2">
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.title}
          placeholder="To-do"
          onChange={(e) => updateCard(boardId, card.id, { title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-[1em] font-extrabold outline-none placeholder:opacity-40"
        />
        <span className="text-[0.8em] opacity-60">
          {done}/{card.items.length}
        </span>
      </div>
      <ul ref={list} className="min-h-0 flex-1 overflow-auto px-2 py-1 scrollbar-thin">
        {card.items.map((it) => (
          <li key={it.id} data-item={it.id} className="group/item flex items-start gap-2 px-1 py-0.5 text-[0.93em]">
            <input
              data-nodrag
              type="checkbox"
              checked={it.done}
              disabled={readOnly}
              onChange={(e) => setItems(card.items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)))}
              className="todo-check mt-[0.15em]"
            />
            {editingItem === it.id && !readOnly ? (
              <input
                data-nodrag
                autoFocus
                value={it.text}
                onChange={(e) => setItems(card.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
                onFocus={(e) => useEditing.getState().begin(boardId, card.id, fieldHandle(e.currentTarget), 'inline')}
                onBlur={(e) => {
                  if (useEditing.getState().hold) return
                  useEditing.getState().end(e.currentTarget)
                  setEditingItem(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') (e.currentTarget as HTMLInputElement).blur()
                  e.stopPropagation()
                }}
                className={`min-w-0 flex-1 bg-transparent outline-none ${it.done ? 'line-through opacity-50' : ''}`}
              />
            ) : (
              // rendered (bold / links…); click to edit the raw text
              <div
                data-nodrag
                onClick={() => !readOnly && setEditingItem(it.id)}
                className={`min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words ${it.done ? 'line-through opacity-50' : ''} ${it.text ? '' : 'opacity-40'}`}
              >
                {it.text ? <InlineMd text={it.text} /> : 'item'}
              </div>
            )}
            {!readOnly && (
              <button
                data-nodrag
                onClick={() => setItems(card.items.filter((x) => x.id !== it.id))}
                className="hidden opacity-50 group-hover/item:block hover:text-red-600 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form
          className="shrink-0 border-t border-current/10 px-3 py-1.5"
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
            className="w-full bg-transparent text-[0.93em] outline-none placeholder:text-current placeholder:opacity-50"
          />
        </form>
      )}
    </div>
  )
}
