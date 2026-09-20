import { useState } from 'react'
import type { ShapeCard as ShapeCardT, ShapeKind } from '../model/types'
import { useWorkspace } from '../store/workspace'
import { useEditRequest } from '../canvas/editRequest'
import { contrast } from '../canvas/styles'
import type { CardProps } from './CardView'
import { InlineMd } from './Inline'
import { MdEditor } from '../editor'

export const SHAPES: { kind: ShapeKind; label: string; icon: string }[] = [
  { kind: 'rect', label: 'Rectangle', icon: '▭' },
  { kind: 'ellipse', label: 'Ellipse', icon: '◯' },
  { kind: 'diamond', label: 'Diamond', icon: '◇' },
  { kind: 'triangle', label: 'Triangle', icon: '△' },
  { kind: 'hexagon', label: 'Hexagon', icon: '⬡' },
  { kind: 'star', label: 'Star', icon: '☆' },
  { kind: 'arrow', label: 'Arrow', icon: '⇨' },
  { kind: 'parallelogram', label: 'Parallelogram', icon: '▱' },
  { kind: 'callout', label: 'Speech bubble', icon: '💬' },
]

/** shapes start as an outline in the board's ink; fill is opt-in via the style bar */
export const DEFAULT_SHAPE_STROKE = 2
const NO_FILL = (c: string | undefined) => !c || c === 'transparent' || c === '#00000000'

/** Path for a shape in a w×h box (stroke inset by half the width so it isn't clipped). */
export function shapePath(kind: ShapeKind, w: number, h: number, inset: number, radius: number): string {
  const x0 = inset
  const y0 = inset
  const x1 = w - inset
  const y1 = h - inset
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const W = x1 - x0
  const H = y1 - y0
  const P = (pts: [number, number][]) => `M${pts.map((p) => p.join(',')).join('L')}Z`
  switch (kind) {
    case 'rect': {
      const r = Math.min(radius, W / 2, H / 2)
      if (r <= 0) return P([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
      return `M${x0 + r},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y0 + r}V${y1 - r}A${r},${r} 0 0 1 ${x1 - r},${y1}H${x0 + r}A${r},${r} 0 0 1 ${x0},${y1 - r}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}Z`
    }
    case 'ellipse':
      return `M${x0},${cy}A${W / 2},${H / 2} 0 1 0 ${x1},${cy}A${W / 2},${H / 2} 0 1 0 ${x0},${cy}Z`
    case 'diamond':
      return P([[cx, y0], [x1, cy], [cx, y1], [x0, cy]])
    case 'triangle':
      return P([[cx, y0], [x1, y1], [x0, y1]])
    case 'hexagon': {
      const d = Math.min(W / 4, H / 2)
      return P([[x0 + d, y0], [x1 - d, y0], [x1, cy], [x1 - d, y1], [x0 + d, y1], [x0, cy]])
    }
    case 'star': {
      const pts: [number, number][] = []
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const k = i % 2 === 0 ? 1 : 0.42
        pts.push([cx + Math.cos(a) * (W / 2) * k, cy + Math.sin(a) * (H / 2) * k])
      }
      return P(pts)
    }
    case 'arrow': {
      const head = Math.min(W * 0.4, H)
      const shaft = H * 0.3
      return P([[x0, cy - shaft], [x1 - head, cy - shaft], [x1 - head, y0], [x1, cy], [x1 - head, y1], [x1 - head, cy + shaft], [x0, cy + shaft]])
    }
    case 'parallelogram': {
      const d = Math.min(W * 0.22, H)
      return P([[x0 + d, y0], [x1, y0], [x1 - d, y1], [x0, y1]])
    }
    case 'callout':
    case 'cloud': {
      // rounded box with a tail at the bottom-left
      const tail = Math.min(H * 0.22, 26)
      const by = y1 - tail // bottom edge of the box
      const r = Math.min(radius, W / 2, (by - y0) / 2)
      const tx = x0 + Math.min(W * 0.18, 40)
      return `M${x0 + r},${y0}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y0 + r}V${by - r}A${r},${r} 0 0 1 ${x1 - r},${by}H${tx + tail * 0.9}L${tx},${y1}L${tx + tail * 0.25},${by}H${x0 + r}A${r},${r} 0 0 1 ${x0},${by - r}V${y0 + r}A${r},${r} 0 0 1 ${x0 + r},${y0}Z`
    }
  }
}

export function ShapeCard({ card, boardId, readOnly }: CardProps<ShapeCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(card.label)
  const s = card.style ?? {}
  const filled = !NO_FILL(s.bg)
  const fill = filled ? s.bg! : 'none'
  const stroke = s.border ?? 'var(--board-fg)'
  const sw = s.strokeWidth ?? DEFAULT_SHAPE_STROKE
  const inset = Math.max(sw / 2, 1)
  const d = shapePath(card.shape, card.w, card.h, inset, s.radius ?? 12)
  const ink = s.fg ?? (filled ? contrast(fill) : 'var(--board-fg)')

  useEditRequest(() => {
    if (readOnly) return
    setDraft(card.label)
    setEditing(true)
  })

  const commit = () => {
    setEditing(false)
    if (draft !== card.label) updateCard(boardId, card.id, { label: draft })
  }

  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${card.w} ${card.h}`} preserveAspectRatio="none">
        <path
          d={d}
          fill={fill}
          stroke={sw ? stroke : 'none'}
          strokeWidth={sw}
          strokeDasharray={s.dashed ? `${sw * 3} ${sw * 2}` : undefined}
          strokeLinejoin="round"
          fillRule="evenodd"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center p-3" style={{ color: ink, textAlign: s.align ?? 'center' }}>
        {editing ? (
          <MdEditor
            value={draft}
            onChange={setDraft}
            onDone={commit}
            boardId={boardId}
            cardId={card.id}
            mode="inline"
            placeholder="Label"
            className="h-full w-full text-center"
          />
        ) : (
          <div className="whitespace-pre-wrap break-words">
            <InlineMd text={card.label} />
          </div>
        )}
      </div>
    </div>
  )
}
