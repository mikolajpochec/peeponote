import { useEffect, useRef, useState } from 'react'
import type { DialogueLine, StoryCard as StoryCardT } from '../../model/types'
import { newId } from '../../model/types'
import { useWorkspace } from '../../store/workspace'
import { useEditing } from '../../store/editing'
import { useEditRequest } from '../../canvas/editRequest'
import { contrast } from '../../canvas/styles'
import type { CardProps } from '../CardView'
import { InlineMd } from '../Inline'
import { LinkPicker } from '../../ui/LinkPicker'
import { useAssetUrl } from '../useAssetUrl'
import { BEAT_STAGES, storyKind, type StoryField } from './kinds'

/**
 * Story-planning card. Header strip in the kind's color, then labeled fields. Fields render inline
 * markdown; clicking one turns it into a textarea (registered with the format bar like every editor).
 */
export function StoryCard({ card, boardId, readOnly }: CardProps<StoryCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const def = storyKind(card.kind)
  const [editing, setEditing] = useState<string | null>(null) // field key, 'title', or 'line:<id>:<col>'
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
        {(card.kind === 'character' || card.kind === 'location') && <Portrait card={card} boardId={boardId} readOnly={readOnly} />}
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

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-[0.93em] scrollbar-thin">
        {card.kind === 'beat' && (
          <div className="mb-2 flex flex-wrap gap-1" data-nodrag>
            {BEAT_STAGES.map((s) => (
              <button
                key={s}
                disabled={readOnly}
                onClick={() => updateCard(boardId, card.id, { stage: card.stage === s ? undefined : s })}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-current/20 ${card.stage === s ? 'bg-current/15' : 'opacity-60 hover:opacity-100'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
  useEffect(() => {
    if (editing && ta.current) {
      useEditing.getState().begin(boardId, cardId, ta.current, 'inline')
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
    <div className="mb-1.5">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-50">
        <span>{field.label}</span>
        {field.refs && !readOnly && (
          <span className="relative ml-auto" data-nodrag>
            <button onClick={() => setPicker((p) => !p)} className="rounded px-1 text-[10px] normal-case tracking-normal opacity-80 hover:bg-black/10 hover:opacity-100" title="Insert a link to a character, place, …">
              + link
            </button>
            {picker && (
              <div className="absolute right-0 top-full z-30 mt-1">
                <LinkPicker
                  onClose={() => setPicker(false)}
                  onPick={(url, label) => {
                    setPicker(false)
                    const sep = value && !/\s$/.test(value) ? ', ' : ''
                    onChange(`${value}${sep}[${label}](${url})`)
                  }}
                />
              </div>
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

function Dialogue({ card, boardId, readOnly }: { card: StoryCardT; boardId: string; readOnly: boolean }) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const lines = card.lines ?? []
  const setLines = (l: DialogueLine[]) => updateCard(boardId, card.id, { lines: l })
  const [editing, setEditing] = useState<string | null>(null) // `${id}:${col}`
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  const patch = (id: string, p: Partial<DialogueLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...p } : l)))

  return (
    <div className="mt-1 space-y-1.5" data-nodrag>
      {lines.map((l) => (
        <div key={l.id} className="group/line grid grid-cols-[minmax(70px,30%)_1fr_auto] gap-x-2 rounded px-1 py-0.5 hover:bg-black/5">
          <Cell
            value={l.speaker}
            placeholder="Speaker"
            bold
            editing={editing === `${l.id}:speaker`}
            readOnly={readOnly}
            onEdit={() => setEditing(`${l.id}:speaker`)}
            onDone={() => setEditing(null)}
            onChange={(v) => patch(l.id, { speaker: v })}
            boardId={boardId}
            cardId={card.id}
            onLink={() => setPickerFor(l.id)}
          />
          <div>
            <Cell
              value={l.text}
              placeholder="Line…"
              editing={editing === `${l.id}:text`}
              readOnly={readOnly}
              onEdit={() => setEditing(`${l.id}:text`)}
              onDone={() => setEditing(null)}
              onChange={(v) => patch(l.id, { text: v })}
              boardId={boardId}
              cardId={card.id}
            />
            <Cell
              value={l.note ?? ''}
              placeholder="(stage direction)"
              italic
              editing={editing === `${l.id}:note`}
              readOnly={readOnly}
              onEdit={() => setEditing(`${l.id}:note`)}
              onDone={() => setEditing(null)}
              onChange={(v) => patch(l.id, { note: v || undefined })}
              boardId={boardId}
              cardId={card.id}
            />
          </div>
          {!readOnly && (
            <button onClick={() => setLines(lines.filter((x) => x.id !== l.id))} className="self-start opacity-0 group-hover/line:opacity-60 hover:!opacity-100 hover:text-red-600">
              ✕
            </button>
          )}
          {pickerFor === l.id && (
            <div className="relative col-span-3">
              <div className="absolute left-0 top-0 z-30">
                <LinkPicker
                  onClose={() => setPickerFor(null)}
                  onPick={(url, label) => {
                    setPickerFor(null)
                    patch(l.id, { speaker: `[${label}](${url})` })
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          onClick={() => {
            const id = newId()
            setLines([...lines, { id, speaker: lines.length ? lines[lines.length - 1].speaker : '', text: '' }])
            setEditing(`${id}:text`)
          }}
          className="rounded px-1 py-0.5 text-[12px] opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          + line
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
  onLink,
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
  onLink?: () => void
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing && ta.current) {
      useEditing.getState().begin(boardId, cardId, ta.current, 'inline')
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
        {onLink && (
          <button onMouseDown={(e) => e.preventDefault()} onClick={onLink} title="Link a character" className="rounded px-1 text-[11px] opacity-60 hover:opacity-100">
            🔗
          </button>
        )}
      </div>
    )
  return (
    <div onClick={() => !readOnly && onEdit()} className={`min-h-[1.3em] cursor-text whitespace-pre-wrap break-words px-1 leading-snug ${cls} ${value ? '' : 'opacity-40'}`}>
      {value ? <InlineMd text={value} /> : placeholder}
    </div>
  )
}

/** Small round portrait picked from the workspace's image assets. */
function Portrait({ card, boardId, readOnly }: { card: StoryCardT; boardId: string; readOnly: boolean }) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const boards = useWorkspace((s) => s.boards)
  const [open, setOpen] = useState(false)
  const images = Object.values(boards).flatMap((b) => b.cards.filter((c) => c.type === 'asset' && (c.kind === 'image' || c.kind === 'texture')))
  return (
    <span className="relative" data-nodrag>
      <button
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        title={readOnly ? undefined : 'Portrait'}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-black/15 text-[13px] ring-1 ring-black/10"
      >
        {card.portrait ? <Thumb path={card.portrait} /> : '＋'}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-(--hair) bg-swamp-900 p-2 text-frog-50 shadow-2xl" onPointerDown={(e) => e.stopPropagation()}>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-frog-200/50">Pictures in this workspace</div>
          {images.length === 0 && <div className="text-[11px] text-frog-200/50">Drop an image onto any board first.</div>}
          <div className="grid grid-cols-4 gap-1">
            {images.map((c) => (
              <button key={c.id} title={c.type === 'asset' ? c.name : ''} onClick={() => (updateCard(boardId, card.id, { portrait: c.type === 'asset' ? c.path : undefined }), setOpen(false))} className="h-11 overflow-hidden rounded-md ring-1 ring-white/10 hover:ring-frog-300">
                {c.type === 'asset' && <Thumb path={c.path} />}
              </button>
            ))}
          </div>
          {card.portrait && (
            <button onClick={() => (updateCard(boardId, card.id, { portrait: undefined }), setOpen(false))} className="mt-2 rounded-md bg-(--hover) px-2 py-1 text-[11px] hover:bg-(--hover-strong)">
              remove
            </button>
          )}
        </div>
      )}
    </span>
  )
}

function Thumb({ path }: { path: string }) {
  const { url } = useAssetUrl(path, '')
  return url ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} /> : null
}
