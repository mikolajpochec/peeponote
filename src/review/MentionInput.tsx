import { useEffect, useMemo, useRef, useState } from 'react'
import { Popover } from '../ui/Popover'
import { Avatar } from './Avatar'
import { fuzzyFilter } from './fuzzy'
import { mentionToken, usePeople } from './people'

/**
 * Textarea with @mentions: typing `@` opens a fuzzy list of people; Enter/Tab inserts `@Name` (or `@[Full Name]`).
 * Enter alone submits (Shift+Enter = newline), Escape cancels.
 */
export function MentionInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus,
  className = '',
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  rows?: number
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const people = usePeople(false)
  const [caret, setCaret] = useState(0)
  const [sel, setSel] = useState(0)
  const [closedFor, setClosedFor] = useState<string | null>(null)

  // "@que" right before the caret, not preceded by a word char
  const q = useMemo(() => {
    const before = value.slice(0, caret)
    const m = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_ ]{0,30})$/u.exec(before)
    if (!m) return null
    return { start: caret - m[2].length - 1, text: m[2] }
  }, [value, caret])
  const matches = useMemo(() => (q ? fuzzyFilter(q.text, people, (p) => `${p.name} ${p.email}`).slice(0, 6) : []), [q, people])
  const open = !!q && matches.length > 0 && closedFor !== `${q.start}:${q.text}`

  useEffect(() => setSel(0), [q?.text])
  useEffect(() => {
    if (autoFocus) setTimeout(() => ta.current?.focus(), 0)
  }, [autoFocus])

  const insert = (i: number) => {
    const p = matches[i]
    if (!p || !q) return
    const token = mentionToken(p) + ' '
    const next = value.slice(0, q.start) + token + value.slice(caret)
    onChange(next)
    const pos = q.start + token.length
    setTimeout(() => {
      ta.current?.setSelectionRange(pos, pos)
      setCaret(pos)
    }, 0)
  }

  return (
    <>
      <textarea
        ref={ta}
        rows={rows}
        value={value}
        placeholder={placeholder}
        className={`w-full resize-none rounded-md bg-black/20 px-2 py-1.5 text-[13px] outline-none placeholder:text-current/40 focus:ring-1 focus:ring-frog-400 ${className}`}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart ?? e.target.value.length)
        }}
        onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown') return (e.preventDefault(), setSel((s) => (s + 1) % matches.length))
            if (e.key === 'ArrowUp') return (e.preventDefault(), setSel((s) => (s - 1 + matches.length) % matches.length))
            if (e.key === 'Enter' || e.key === 'Tab') return (e.preventDefault(), insert(sel))
            if (e.key === 'Escape') return (e.preventDefault(), setClosedFor(q ? `${q.start}:${q.text}` : null))
          }
          if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
            e.preventDefault()
            onSubmit()
          } else if (e.key === 'Escape' && onCancel) {
            e.preventDefault()
            onCancel()
          }
          e.stopPropagation()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        data-nodrag
      />
      {open && (
        <Popover anchor={ta.current} onClose={() => setClosedFor(q ? `${q.start}:${q.text}` : null)} sticky className="w-64 rounded-xl border border-(--hair) bg-swamp-800 p-1 shadow-2xl">
          {matches.map((p, i) => (
            <button
              key={p.email}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(i)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${i === sel ? 'bg-frog-700/50' : 'hover:bg-(--hover)'}`}
            >
              <Avatar person={p} size={20} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-frog-50">{p.name}</span>
              <span className="truncate text-[11px] text-frog-200/50">{p.email}</span>
            </button>
          ))}
        </Popover>
      )}
    </>
  )
}
