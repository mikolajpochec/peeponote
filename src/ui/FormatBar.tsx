import { useEffect, useState } from 'react'
import { useEditing } from '../store/editing'
import { insertLink, toggleLinePrefix, toggleWrap } from './format'
import { LinkPicker } from './LinkPicker'

const btn = 'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] font-bold text-frog-100 hover:bg-(--hover-strong)'

/**
 * Formats the *selection* of the textarea being edited: **bold**, _italic_, ~~strike~~, `code`, links,
 * and block syntax for full-markdown notes. Also wires ⌘B / ⌘I / ⌘K while a card is being edited.
 */
export function FormatBar() {
  const el = useEditing((s) => s.el)
  const mode = useEditing((s) => s.mode)
  const [linkOpen, setLinkOpen] = useState(false)
  const setHold = useEditing((s) => s.setHold)
  useEffect(() => setHold(linkOpen), [linkOpen, setHold])

  // keyboard shortcuts on the focused field
  useEffect(() => {
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'b') (e.preventDefault(), toggleWrap(el, '**'))
      else if (k === 'i') (e.preventDefault(), toggleWrap(el, '_'))
      else if (k === 'k') (e.preventDefault(), setLinkOpen(true))
    }
    const target = el as HTMLElement
    target.addEventListener('keydown', onKey)
    return () => target.removeEventListener('keydown', onKey)
  }, [el])

  if (!el) return null
  // keep focus in the field: buttons must not steal it
  const keep = (e: React.PointerEvent) => e.preventDefault()

  return (
    <div className="relative" data-nodrag onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5 rounded-xl border border-(--hair) bg-swamp-900/95 p-1 shadow-2xl shadow-black/50 backdrop-blur">
        <button className={btn} title="Bold (⌘B)" onPointerDown={keep} onClick={() => toggleWrap(el, '**')}>
          B
        </button>
        <button className={`${btn} italic`} title="Italic (⌘I)" onPointerDown={keep} onClick={() => toggleWrap(el, '_')}>
          I
        </button>
        <button className={`${btn} line-through`} title="Strikethrough" onPointerDown={keep} onClick={() => toggleWrap(el, '~~')}>
          S
        </button>
        <button className={`${btn} font-mono text-[12px]`} title="Code" onPointerDown={keep} onClick={() => toggleWrap(el, '`')}>
          {'</>'}
        </button>
        <button className={`${btn} ${linkOpen ? 'bg-frog-600 text-white' : ''}`} title="Link (⌘K) — web URL or a place in this project" onPointerDown={keep} onClick={() => setLinkOpen((o) => !o)}>
          🔗
        </button>
        {mode === 'block' && (
          <>
            <span className="mx-0.5 h-5 w-px bg-(--hover-strong)" />
            <button className={btn} title="Heading" onPointerDown={keep} onClick={() => toggleLinePrefix(el, '# ')}>
              H1
            </button>
            <button className={`${btn} text-[12px]`} title="Subheading" onPointerDown={keep} onClick={() => toggleLinePrefix(el, '## ')}>
              H2
            </button>
            <button className={btn} title="Bullet list" onPointerDown={keep} onClick={() => toggleLinePrefix(el, '- ')}>
              •
            </button>
            <button className={btn} title="Checklist" onPointerDown={keep} onClick={() => toggleLinePrefix(el, '- [ ] ')}>
              ☑
            </button>
            <button className={btn} title="Quote" onPointerDown={keep} onClick={() => toggleLinePrefix(el, '> ')}>
              ❝
            </button>
          </>
        )}
        <span className="ml-1 px-1 text-[10px] uppercase tracking-wider text-frog-200/40">markdown</span>
      </div>
      {linkOpen && (
        <div className="absolute left-0 top-full z-20 mt-1">
          <LinkPicker
            onClose={() => (setLinkOpen(false), el.focus())}
            onPick={(url, label) => {
              setLinkOpen(false)
              const hasSel = (el.selectionStart ?? 0) !== (el.selectionEnd ?? 0)
              insertLink(el, url, hasSel ? undefined : label)
            }}
          />
        </div>
      )}
    </div>
  )
}
