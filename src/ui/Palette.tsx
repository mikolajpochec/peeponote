import { useEffect, useRef, useState } from 'react'
import type { Board, Card, ShapeKind, StoryKind } from '../model/types'
import { newId } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { useLastStyle } from '../store/lastStyle'
import { useViewport } from '../canvas/viewport'
import { autoEdit } from '../cards/autoEdit'
import { SHAPES } from '../cards/ShapeCard'
import { STORY_KINDS } from '../cards/story/kinds'
import { isCoarse } from '../canvas/touch'

export const TOOL_MIME = 'application/x-peeponote-tool'

/** top-level tools, plus `shape:<kind>` and `story:<kind>` children */
export type ToolId = 'title' | 'text' | 'note' | 'todo' | 'link' | 'shape' | 'story' | 'board' | 'file' | `shape:${ShapeKind}` | `story:${StoryKind}`

export interface Tool {
  id: ToolId
  label: string
  icon: string
  hint: string
  w: number
  h: number
  /** returns the card to add; undefined for tools that don't create a plain card (board/file) or that only group children */
  make?: (base: { id: string; x: number; y: number; w: number; h: number; z: number }) => Card
  autoEdit?: boolean
  /** a flyout of variants (hover on desktop, tap on touch) */
  children?: Tool[]
  /** which child stands in for the parent when clicked directly */
  defaultChild?: () => ToolId
}

const shapeTools: Tool[] = SHAPES.map((s) => ({
  id: `shape:${s.kind}` as ToolId,
  label: s.label,
  icon: s.icon,
  hint: `${s.label} outline`,
  w: 160,
  h: 110,
  make: (b) => ({ ...b, type: 'shape', shape: s.kind, label: '' }),
}))

const storyTools: Tool[] = STORY_KINDS.map((k) => ({
  id: `story:${k.kind}` as ToolId,
  label: k.label,
  icon: k.icon,
  hint: k.hint,
  w: k.w,
  h: k.h,
  make: (b) => ({ ...b, type: 'story', kind: k.kind, title: '', fields: {}, ...(k.kind === 'dialogue' ? { lines: [] } : {}) }),
}))

export const TOOLS: Tool[] = [
  { id: 'title', label: 'Title', icon: 'T', hint: 'Big heading text', w: 320, h: 56, autoEdit: true, make: (b) => ({ ...b, type: 'text', text: '', variant: 'title' }) },
  { id: 'text', label: 'Text', icon: '¶', hint: 'Plain paragraph', w: 260, h: 80, autoEdit: true, make: (b) => ({ ...b, type: 'text', text: '', variant: 'body' }) },
  { id: 'note', label: 'Note', icon: '📝', hint: 'Markdown note card', w: 220, h: 120, autoEdit: true, make: (b) => ({ ...b, type: 'note', md: '' }) },
  { id: 'todo', label: 'To-do', icon: '☑', hint: 'Checklist', w: 240, h: 200, make: (b) => ({ ...b, type: 'todo', title: '', items: [] }) },
  { id: 'link', label: 'Link', icon: '🔗', hint: 'Bookmark a URL or a place in this project', w: 260, h: 90, make: (b) => ({ ...b, type: 'link', url: '', title: '' }) },
  {
    id: 'shape',
    label: 'Shape',
    icon: '◇',
    hint: 'Outline shapes — hover / tap for the list',
    w: 160,
    h: 110,
    children: shapeTools,
    defaultChild: () => `shape:${useLastStyle.getState().shape}` as ToolId,
  },
  {
    id: 'story',
    label: 'Story',
    icon: '📖',
    hint: 'Story planning: characters, places, events, dialogue, scenes, beats',
    w: 280,
    h: 240,
    children: storyTools,
    defaultChild: () => 'story:scene',
  },
  { id: 'board', label: 'Board', icon: '🐸', hint: 'Nested board', w: 200, h: 96 },
  { id: 'file', label: 'File', icon: '📎', hint: 'Upload image / audio / 3D / anything', w: 280, h: 280 },
]

export function toolById(id: string): Tool | undefined {
  for (const t of TOOLS) {
    if (t.id === id) return t
    const c = t.children?.find((x) => x.id === id)
    if (c) return c
  }
  return undefined
}

/** Creates the card for a tool at a board position (top-left). Returns the created card id if any. */
export function placeTool(boardId: string, tool: Tool, at: { x: number; y: number }): string | null {
  const ws = useWorkspace.getState()
  const board = ws.boards[boardId]
  if (!board) return null
  if (tool.children && tool.defaultChild) {
    const child = toolById(tool.defaultChild())
    if (child) return placeTool(boardId, child, at)
  }
  const z = board.cards.reduce((m, c) => Math.max(m, c.z), 0) + 1
  if (tool.id === 'board') {
    ws.createBoard(boardId, 'New board', at)
    return null
  }
  if (!tool.make) return null
  const id = newId()
  if (tool.autoEdit) autoEdit.id = id
  ws.addCard(boardId, tool.make({ id, x: Math.round(at.x), y: Math.round(at.y), w: tool.w, h: tool.h, z }))
  ws.select([id])
  return id
}

function centerOfView(boardId: string, w: number, h: number): { x: number; y: number } {
  const vp = useViewport.getState().get(boardId)
  const el = document.querySelector('.canvas-bg') as HTMLElement | null
  const cw = el?.clientWidth ?? 800
  const ch = el?.clientHeight ?? 600
  const jitter = () => (Math.random() - 0.5) * 60
  return { x: (cw / 2 - vp.x) / vp.scale - w / 2 + jitter(), y: (ch / 2 - vp.y) / vp.scale - h / 2 + jitter() }
}

export function Palette({ board }: { board: Board }) {
  const addAssets = useWorkspace((s) => s.addAssets)
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState<ToolId | null>(null)
  const [open, setOpen] = useState<ToolId | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const coarse = isCoarse()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // tap outside closes a flyout (touch has no hover-out)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null)
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [open])

  const activate = (tool: Tool) => {
    if (tool.id === 'file') {
      fileInput.current?.click()
      return
    }
    placeTool(board.id, tool, centerOfView(board.id, tool.w, tool.h))
    setOpen(null)
  }
  const hoverOpen = (tool: Tool) => {
    if (coarse || !tool.children) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(tool.id)
  }
  const hoverClose = () => {
    if (coarse) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(null), 160)
  }

  const dragProps = (tool: Tool) =>
    tool.id === 'file' || (tool.children && !tool.defaultChild)
      ? {}
      : {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData(TOOL_MIME, tool.children && tool.defaultChild ? tool.defaultChild() : tool.id)
            e.dataTransfer.effectAllowed = 'copy'
            setDragging(tool.id)
            setOpen(null)
          },
          onDragEnd: () => setDragging(null),
        }

  return (
    <div ref={root} className="pointer-events-none absolute inset-y-0 left-4 flex items-center max-md:inset-x-2 max-md:inset-y-auto max-md:bottom-3 max-md:justify-center">
      <div className="pointer-events-auto flex flex-col gap-0.5 rounded-2xl border border-(--hair) bg-swamp-900/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur max-md:max-w-full max-md:flex-row max-md:overflow-x-auto">
        {TOOLS.map((tool) => (
          <div key={tool.id} className="relative" onPointerEnter={() => hoverOpen(tool)} onPointerLeave={hoverClose}>
            <button
              {...dragProps(tool)}
              title={`${tool.label} — ${tool.hint}${tool.children ? '' : '\nClick to add, or drag onto the board'}`}
              onClick={() => {
                // touch: first tap opens the flyout; desktop: click places the default variant
                if (tool.children && (coarse || !tool.defaultChild)) setOpen((o) => (o === tool.id ? null : tool.id))
                else activate(tool)
              }}
              className={`group/tool relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-frog-100 transition hover:bg-frog-700 hover:text-white active:scale-95 ${
                dragging === tool.id || open === tool.id ? 'bg-frog-700 text-white' : ''
              }`}
            >
              <span className={`leading-none ${tool.id === 'title' ? 'font-serif text-[20px] font-black' : tool.id === 'text' ? 'text-[18px]' : 'text-[16px]'}`}>
                {tool.icon}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70 group-hover/tool:opacity-100">{tool.label}</span>
              {tool.children && <span className="absolute right-1 top-1 text-[8px] opacity-50">▸</span>}
            </button>
            {tool.children && open === tool.id && (
              <div
                className="absolute left-full top-0 z-30 ml-2 grid gap-0.5 rounded-2xl border border-(--hair) bg-swamp-900/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur max-md:bottom-full max-md:left-1/2 max-md:top-auto max-md:mb-2 max-md:ml-0 max-md:-translate-x-1/2"
                style={{ gridTemplateColumns: `repeat(${tool.children.length > 6 ? 3 : 2}, 3.6rem)` }}
              >
                {tool.children.map((c) => (
                  <button
                    key={c.id}
                    {...dragProps(c)}
                    title={`${c.label} — ${c.hint}\nClick to add, or drag onto the board`}
                    onClick={() => activate(c)}
                    className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-frog-100 hover:bg-frog-700 hover:text-white active:scale-95 ${dragging === c.id ? 'bg-frog-700' : ''}`}
                  >
                    <span className="text-[17px] leading-none">{c.icon}</span>
                    <span className="max-w-full truncate text-[9px] font-semibold uppercase tracking-wide opacity-70">{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) await addAssets(board.id, files, centerOfView(board.id, 280, 280))
          }}
        />
      </div>
    </div>
  )
}
