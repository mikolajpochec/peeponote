import { useEffect, useRef, useState } from 'react'
import type { DialogueOption, StoryCard as StoryCardT } from '../../model/types'
import { newId } from '../../model/types'
import { useWorkspace } from '../../store/workspace'
import { useEditing } from '../../store/editing'
import { fieldHandle } from '../../ui/format'
import { useEditRequest } from '../../canvas/editRequest'
import { contrast } from '../../canvas/styles'
import type { CardProps } from '../CardView'
import { InlineMd } from '../Inline'
import { LinkPicker } from '../../ui/LinkPicker'
import { Popover } from '../../ui/Popover'
import { storyKind, type StoryField } from './kinds'
import { useItemRectsReporter } from '../../canvas/itemRects'

/**
 * Story-planning card. Header strip in the kind's color, then labeled fields. Fields render inline
 * markdown; clicking one turns it into a textarea (registered with the format bar like every editor).
 */
export function StoryCard({ card, boardId, readOnly }: CardProps<StoryCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const def = storyKind(card.kind)
  const [editing, setEditing] = useState<string | null>(null) // field key being edited
  const body = useRef<HTMLDivElement>(null)
  // every field and every dialogue choice is a row connectors can attach to
  useItemRectsReporter(boardId, card.id, body, [card.fields, card.options, card.lines, card.w, card.h, card.style])
  const strip = card.style?.bg ? undefined : def.color
  const stripInk = contrast(card.style?.bg ?? def.color)
  const setField = (key: string, value: string) => updateCard(boardId, card.id, { fields: { ...card.fields, [key]: value } })

  useEditRequest(() => {
    if (readOnly) return
    setEditing(card.kind === 'dialogue' ? 'context' : def.fields[0]?.key ?? 'title')
  })

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2" style={{ background: strip, color: strip ? stripInk : undefined }}>
        <span className="text-[15px]" title={def.label}>
          {def.icon}
        </span>
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.title}
          placeholder={def.label}
          onChange={(e) => updateCard(boardId, card.id, { title: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-[1.05em] font-extrabold outline-none placeholder:opacity-50"
        />
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{def.label}</span>
      </div>

      <div ref={body} className="min-h-0 flex-1 overflow-auto px-3 py-2 text-[0.93em] scrollbar-thin">
        {def.fields.map((f) => (
          <Field
            key={f.key}
            field={f}
            value={card.fields[f.key] ?? ''}
            editing={editing === f.key}
            readOnly={readOnly}
            onEdit={() => setEditing(f.key)}
            onDone={() => setEditing((e) => (e === f.key ? null : e))}
            onChange={(v) => setField(f.key, v)}
            boardId={boardId}
            cardId={card.id}
          />
        ))}
        {card.kind === 'dialogue' && <Dialogue card={card} boardId={boardId} readOnly={readOnly} />}
      </div>
    </div>
  )
}

function Field({
  field,
  value,
  editing,
  readOnly,
  onEdit,
  onDone,
  onChange,
  boardId,
  cardId,
}: {
  field: StoryField
  value: string
  editing: boolean
  readOnly: boolean
  onEdit: () => void
  onDone: () => void
  onChange: (v: string) => void
  boardId: string
  cardId: string
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const [picker, setPicker] = useState(false)
  const linkBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (editing && ta.current) {
      useEditing.getState().begin(boardId, cardId, fieldHandle(ta.current), 'inline')
      ta.current.focus()
      ta.current.setSelectionRange(ta.current.value.length, ta.current.value.length)
    }
  }, [editing, boardId, cardId])
  // grow with content
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value, editing])

  return (
    <div className="mb-1.5" data-item={field.key}>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-50">
        <span>{field.label}</span>
        {field.refs && !readOnly && (
          <span className="relative ml-auto" data-nodrag>
            <button ref={linkBtn} onClick={() => setPicker((p) => !p)} className="rounded px-1 text-[10px] normal-case tracking-normal opacity-80 hover:bg-black/10 hover:opacity-100" title="Insert a link to a character, scene, …">
              + link
            </button>
            {picker && (
              <Popover anchor={linkBtn.current} onClose={() => setPicker(false)} align="right">
                <LinkPicker
                  onClose={() => setPicker(false)}
                  onPick={(url, label) => {
                    setPicker(false)
                    const sep = value && !/\s$/.test(value) ? ', ' : ''
                    onChange(`${value}${sep}[${label}](${url})`)
                  }}
                />
              </Popover>
            )}
          </span>
        )}
      </div>
      {editing && !readOnly ? (
        <textarea
          ref={ta}
          data-nodrag
          value={value}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            if (useEditing.getState().hold) return
            useEditing.getState().end(e.currentTarget)
            onDone()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) e.currentTarget.blur()
            e.stopPropagation()
          }}
          placeholder={field.placeholder}
          className="w-full resize-none overflow-hidden rounded bg-black/5 px-1 py-0.5 leading-snug outline-none placeholder:opacity-40"
          style={{ fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}
        />
      ) : (
        <div
          data-nodrag
          onClick={() => !readOnly && onEdit()}
          className={`min-h-[1.4em] cursor-text whitespace-pre-wrap break-words rounded px-1 py-0.5 leading-snug hover:bg-black/5 ${value ? '' : 'opacity-40'}`}
        >
          {value ? <InlineMd text={value} /> : field.placeholder}
        </div>
      )}
    </div>
  )
}

/** Choices at this node — each row is an anchor: drag from its edge to the next dialogue card. */
function Dialogue({ card, boardId, readOnly }: { card: StoryCardT; boardId: string; readOnly: boolean }) {
  const updateCard = useWorkspace((s) => s.updateCard)
  // old files stored "lines" — show them as options once, so nothing is lost
  const options: DialogueOption[] = card.options ?? (card.lines ?? []).map((l) => ({ id: l.id, text: l.speaker ? `${l.speaker}: ${l.text}` : l.text, note: l.note }))
  const setOptions = (o: DialogueOption[]) => updateCard(boardId, card.id, { options: o, lines: undefined })
  const [editing, setEditing] = useState<string | null>(null) // `${id}:text` | `${id}:note`
  const patch = (id: string, p: Partial<DialogueOption>) => setOptions(options.map((o) => (o.id === id ? { ...o, ...p } : o)))

  return (
    <div className="mt-1" data-nodrag>
      <div className="mb-1 flex items-center text-[10px] font-bold uppercase tracking-wider opacity-50">
        <span>Choices</span>
        <span className="ml-auto normal-case tracking-normal opacity-70">→ drag an arrow from a choice to the next node</span>
      </div>
      <div className="space-y-1">
        {options.map((o, i) => (
          <div key={o.id} data-item={o.id} className="group/line flex items-start gap-2 rounded px-1 py-0.5 hover:bg-black/5">
            <span className="mt-0.5 w-4 shrink-0 text-center text-[11px] font-bold opacity-50">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Cell
                value={o.text}
                placeholder="Choice…"
                editing={editing === `${o.id}:text`}
                readOnly={readOnly}
                onEdit={() => setEditing(`${o.id}:text`)}
                onDone={() => setEditing(null)}
                onChange={(v) => patch(o.id, { text: v })}
                boardId={boardId}
                cardId={card.id}
              />
              <Cell
                value={o.note ?? ''}
                placeholder="(condition / effect)"
                italic
                editing={editing === `${o.id}:note`}
                readOnly={readOnly}
                onEdit={() => setEditing(`${o.id}:note`)}
                onDone={() => setEditing(null)}
                onChange={(v) => patch(o.id, { note: v || undefined })}
                boardId={boardId}
                cardId={card.id}
              />
            </div>
            {!readOnly && (
              <button onClick={() => setOptions(options.filter((x) => x.id !== o.id))} className="self-start opacity-0 group-hover/line:opacity-60 hover:!opacity-100 hover:text-red-600">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <button
          onClick={() => {
            const id = newId()
            setOptions([...options, { id, text: '' }])
            setEditing(`${id}:text`)
          }}
          className="mt-1 rounded px-1 py-0.5 text-[12px] opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          + choice
        </button>
      )}
    </div>
  )
}

function Cell({
  value,
  placeholder,
  bold,
  italic,
  editing,
  readOnly,
  onEdit,
  onDone,
  onChange,
  boardId,
  cardId,
}: {
  value: string
  placeholder: string
  bold?: boolean
  italic?: boolean
  editing: boolean
  readOnly: boolean
  onEdit: () => void
  onDone: () => void
  onChange: (v: string) => void
  boardId: string
  cardId: string
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing && ta.current) {
      useEditing.getState().begin(boardId, cardId, fieldHandle(ta.current), 'inline')
      ta.current.focus()
    }
  }, [editing, boardId, cardId])
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [value, editing])
  const cls = `${bold ? 'font-bold' : ''} ${italic ? 'italic opacity-70' : ''}`
  if (editing && !readOnly)
    return (
      <div className="flex items-start gap-1">
        <textarea
          ref={ta}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            if (useEditing.getState().hold) return
            useEditing.getState().end(e.currentTarget)
            onDone()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
            e.stopPropagation()
          }}
          placeholder={placeholder}
          className={`w-full resize-none overflow-hidden rounded bg-black/5 px-1 leading-snug outline-none placeholder:opacity-40 ${cls}`}
          style={{ fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}
        />
      </div>
    )
  return (
    <div onClick={() => !readOnly && onEdit()} className={`min-h-[1.3em] cursor-text whitespace-pre-wrap break-words px-1 leading-snug ${cls} ${value ? '' : 'opacity-40'}`}>
      {value ? <InlineMd text={value} /> : placeholder}
    </div>
  )
}

