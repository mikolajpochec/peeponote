import { create } from 'zustand'

export interface Viewport {
  x: number
  y: number
  scale: number
}

interface ViewportState {
  byBoard: Record<string, Viewport>
  get: (boardId: string) => Viewport
  set: (boardId: string, vp: Viewport) => void
}

const DEFAULT: Viewport = { x: 80, y: 80, scale: 1 }
export const MIN_SCALE = 0.15
export const MAX_SCALE = 3

export const useViewport = create<ViewportState>((set, get) => ({
  byBoard: {},
  get: (boardId) => get().byBoard[boardId] ?? DEFAULT,
  set: (boardId, vp) => set((s) => ({ byBoard: { ...s.byBoard, [boardId]: vp } })),
}))

export function screenToBoard(vp: Viewport, sx: number, sy: number, rect: DOMRect) {
  return { x: (sx - rect.left - vp.x) / vp.scale, y: (sy - rect.top - vp.y) / vp.scale }
}

export function zoomAt(vp: Viewport, factor: number, sx: number, sy: number, rect: DOMRect): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor))
  const px = sx - rect.left
  const py = sy - rect.top
  // keep the board point under the cursor fixed
  const bx = (px - vp.x) / vp.scale
  const by = (py - vp.y) / vp.scale
  return { scale, x: px - bx * scale, y: py - by * scale }
}
