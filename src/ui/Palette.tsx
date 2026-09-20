import { useRef, useState } from 'react'
import type { Board, Card } from '../model/types'
import { newId } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { useLastStyle } from '../store/lastStyle'
import { useViewport } from '../canvas/viewport'
import { autoEdit } from '../cards/autoEdit'

export const TOOL_MIME = 'application/x-peeponote-tool'

export type ToolId = 'title' | 'text' | 'note' | 'todo' | 'link' | 'shape' | 'board' | 'file'

interface Tool {
  id: ToolId
  label: string
  icon: string
  hint: string
  w: number
  h: number
  /** returns the card to add; undefined for tools that don't create a plain card (board/file) */
  make?: (base: { id: string; x: number; y: number; w: number; h: number; z: number }) => Card
  autoEdit?: boolean
}

export const TOOLS: Tool[] = [
  { id: 'title', label: 'Title', icon: 'T', hint: 'Big heading text', w: 320, h: 56, autoEdit: true, make: (b) => ({ ...b, type: 'text', text: '', variant: 'title' }) },
  { id: 'text', label: 'Text', icon: '¶', hint: 'Plain paragraph', w: 260, h: 80, autoEdit: true, make: (b) => ({ ...b, type: 'text', text: '', variant: 'body' }) },
  { id: 'note', label: 'Note', icon: '📝', hint: 'Markdown note card', w: 220, h: 120, autoEdit: true, make: (b) => ({ ...b, type: 'note', md: '' }) },
  { id: 'todo', label: 'To-do', icon: '☑', hint: 'Checklist', w: 240, h: 200, make: (b) => ({ ...b, type: 'todo', title: '', items: [] }) },
  { id: 'link', label: 'Link', icon: '🔗', hint: 'Bookmark a URL', w: 260, h: 90, make: (b) => ({ ...b, type: 'link', url: '', title: '' }) },
  { id: 'shape', label: 'Shape', icon: '◇', hint: 'Outline shape: rectangle, ellipse, diamond, arrow… (switch shape / add fill in the style bar)', w: 160, h: 110, make: (b) => ({ ...b, type: 'shape', shape: useLastStyle.getState().shape, label: '' }) },
  { id: 'board', label: 'Board', icon: '🐸', hint: 'Nested board', w: 200, h: 96 },
  { id: 'file', label: 'File', icon: '📎', hint: 'Upload image / audio / 3D / anything', w: 280, h: 280 },
]

export function toolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id)
}

/** Creates the card for a tool at a board position (top-left). Returns the created card id if any. */
export function placeTool(boardId: string, tool: Tool, at: { x: number; y: number }): string | null {
  const ws = useWorkspace.getState()
  const board = ws.boards[boardId]
  if (!board) return null
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

  const activate = (tool: Tool) => {
    if (tool.id === 'file') {
      fileInput.current?.click()
      return
    }
    placeTool(board.id, tool, centerOfView(board.id, tool.w, tool.h))
  }

  return (
    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center max-md:inset-x-2 max-md:inset-y-auto max-md:bottom-3 max-md:justify-center">
      <div className="pointer-events-auto flex flex-col gap-0.5 rounded-2xl border border-(--hair) bg-swamp-900/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur max-md:max-w-full max-md:flex-row max-md:overflow-x-auto">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            draggable={tool.id !== 'file'}
            title={`${tool.label} — ${tool.hint}\nClick to add, or drag onto the board`}
            onClick={() => activate(tool)}
            onDragStart={(e) => {
              e.dataTransfer.setData(TOOL_MIME, tool.id)
              e.dataTransfer.effectAllowed = 'copy'
              setDragging(tool.id)
            }}
            onDragEnd={() => setDragging(null)}
            className={`group/tool flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-frog-100 transition hover:bg-frog-700 hover:text-white active:scale-95 ${
              dragging === tool.id ? 'bg-frog-700' : ''
            }`}
          >
            <span className={`leading-none ${tool.id === 'title' ? 'font-serif text-[20px] font-black' : tool.id === 'text' ? 'text-[18px]' : 'text-[16px]'}`}>
              {tool.icon}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70 group-hover/tool:opacity-100">{tool.label}</span>
          </button>
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
