import { useRef, type PointerEvent as RPointerEvent } from 'react'

export interface DragHandlers {
  onStart?: (e: RPointerEvent) => boolean | void
  onMove: (dx: number, dy: number, e: PointerEvent) => void
  onEnd?: (moved: boolean, e: PointerEvent) => void
}

/**
 * Pointer-capture drag. `scale` converts screen px to board units.
 * Returns a pointerdown handler to spread onto the element.
 */
export function useDrag(handlers: DragHandlers, scale: () => number, threshold = 3) {
  const state = useRef<{ sx: number; sy: number; lx: number; ly: number; moved: boolean; id: number } | null>(null)

  return (e: RPointerEvent) => {
    if (e.button !== 0) return
    if (handlers.onStart?.(e) === false) return
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    state.current = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, id: e.pointerId }

    const move = (ev: PointerEvent) => {
      const s = state.current
      if (!s || ev.pointerId !== s.id) return
      if (!s.moved && Math.hypot(ev.clientX - s.sx, ev.clientY - s.sy) < threshold) return
      s.moved = true
      const k = scale()
      handlers.onMove((ev.clientX - s.lx) / k, (ev.clientY - s.ly) / k, ev)
      s.lx = ev.clientX
      s.ly = ev.clientY
    }
    const up = (ev: PointerEvent) => {
      const s = state.current
      if (!s || ev.pointerId !== s.id) return
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      try {
        el.releasePointerCapture(ev.pointerId)
      } catch {
        /* already released */
      }
      handlers.onEnd?.(s.moved, ev)
      state.current = null
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
}

/** True when the event started inside an interactive control that should not start a drag. */
export function isInteractiveTarget(e: RPointerEvent | PointerEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return !!t.closest('input, textarea, button, a, select, [contenteditable="true"], [data-nodrag]')
}
