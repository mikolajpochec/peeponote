import { useEffect, useRef, useState } from 'react'
import { useEditing } from '../store/editing'
import { LinkPicker } from './LinkPicker'
import { Popover } from './Popover'
import { AlignButtons } from './AlignButtons'
import { useWorkspace } from '../store/workspace'

const btn = 'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] font-bold text-frog-100 hover:bg-(--hover-strong)'

/**
 * Formats the *selection* of whatever is being edited: **bold**, _italic_, ~~strike~~, `code`, links,
 * and block syntax for full-markdown notes. (⌘B / ⌘I / ⌘K are bound inside the editor itself.)
 */
export function FormatBar() {
  const handle = useEditing((s) => s.handle)
  const mode = useEditing((s) => s.mode)
  const hold = useEditing((s) => s.hold)
  const setHold = useEditing((s) => s.setHold)
  const [linkOpen, setLinkOpen] = useState(false)
  const bar = useRef<HTMLDivElement>(null)
  const linkRequest = useEditing((s) => s.linkRequest)
  const boardId = useEditing((s) => s.boardId)
  const cardId = useEditing((s) => s.cardId)
  const align = useWorkspace((s) => (boardId && cardId ? s.boards[boardId]?.cards.find((c) => c.id === cardId)?.style?.align : undefined))
  const styleCards = useWorkspace((s) => s.styleCards)
  useEffect(() => {
    if (linkRequest && handle) {
      setHold(true)
      setLinkOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkRequest])

  if (!handle) return null
  // buttons must not steal focus from the editor
  const keep = (e: React.PointerEvent) => e.preventDefault()

  const openLink = () => {
    // hold BEFORE the picker mounts: its input takes focus synchronously and the editor's blur must not commit
    setHold(true)
    setLinkOpen(true)
  }
  const closeLink = () => {
    setLinkOpen(false)
    setHold(false)
    handle.focus()
  }

  return (
    <div className="relative" data-nodrag onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div ref={bar} className="flex items-center gap-0.5 rounded-xl border border-(--hair) bg-swamp-900/95 p-1 shadow-2xl shadow-black/50 backdrop-blur">
        <button className={btn} title="Bold (⌘B)" onPointerDown={keep} onClick={() => handle.wrap('**')}>
          B
        </button>
        <button className={`${btn} italic`} title="Italic (⌘I)" onPointerDown={keep} onClick={() => handle.wrap('_')}>
          I
        </button>
        <button className={`${btn} line-through`} title="Strikethrough" onPointerDown={keep} onClick={() => handle.wrap('~~')}>
          S
        </button>
        <button className={`${btn} font-mono text-[12px]`} title="Code" onPointerDown={keep} onClick={() => handle.wrap('`')}>
          {'</>'}
        </button>
        {boardId && cardId && (
          <>
            <span className="mx-0.5 h-5 w-px bg-(--hair)" />
            <AlignButtons value={align} onChange={(a) => styleCards(boardId, [cardId], { align: a })} keepFocus={keep} />
            <span className="mx-0.5 h-5 w-px bg-(--hair)" />
          </>
        )}
        <button
          className={`${btn} ${linkOpen || hold ? 'bg-frog-600 text-white' : ''}`}
          title="Link (⌘K) — web URL or a place in this project"
          onPointerDown={keep}
          onClick={() => (linkOpen ? closeLink() : openLink())}
        >
          🔗
        </button>
        {mode === 'block' && (
          <>
            <span className="mx-0.5 h-5 w-px bg-(--hover-strong)" />
            <button className={btn} title="Heading" onPointerDown={keep} onClick={() => handle.linePrefix('# ')}>
              H1
            </button>
            <button className={`${btn} text-[12px]`} title="Subheading" onPointerDown={keep} onClick={() => handle.linePrefix('## ')}>
              H2
            </button>
            <button className={btn} title="Bullet list" onPointerDown={keep} onClick={() => handle.linePrefix('- ')}>
              •
            </button>
            <button className={btn} title="Checklist" onPointerDown={keep} onClick={() => handle.linePrefix('- [ ] ')}>
              ☑
            </button>
            <button className={btn} title="Quote" onPointerDown={keep} onClick={() => handle.linePrefix('> ')}>
              ❝
            </button>
          </>
        )}
        <span className="ml-1 px-1 text-[10px] uppercase tracking-wider text-frog-200/40">markdown</span>
      </div>
      {linkOpen && (
        <Popover anchor={bar.current} onClose={closeLink}>
          <LinkPicker
            onClose={closeLink}
            onPick={(url, label) => {
              setLinkOpen(false)
              setHold(false)
              handle.link(url, handle.hasSelection() ? undefined : label)
            }}
          />
        </Popover>
      )}
    </div>
  )
}
