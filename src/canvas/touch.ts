import { useEffect, useState } from 'react'

/** True on devices whose primary pointer is a finger (phones, tablets). */
export const isCoarse = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Reactive media query. */
export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof matchMedia !== 'undefined' ? matchMedia(q).matches : false))
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export const MOBILE_QUERY = '(max-width: 767px)'
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY)

// ---- active touch tracking -------------------------------------------------
// Card drags use pointer capture, so a second finger landing on the canvas never
// reaches them. We count touches globally so a drag can freeze while a pinch is on.
const touches = new Set<number>()
if (typeof document !== 'undefined') {
  const add = (e: PointerEvent) => {
    if (e.pointerType === 'touch') touches.add(e.pointerId)
  }
  const del = (e: PointerEvent) => touches.delete(e.pointerId)
  document.addEventListener('pointerdown', add, true)
  document.addEventListener('pointerup', del, true)
  document.addEventListener('pointercancel', del, true)
}
export const activeTouches = () => touches.size

// ---- long press → context menu ----------------------------------------------
let suppressContextMenuUntil = 0
/** After a synthetic long-press menu, swallow the native contextmenu Android fires for the same press. */
export const shouldSwallowContextMenu = () => Date.now() < suppressContextMenuUntil
export const markLongPress = () => {
  suppressContextMenuUntil = Date.now() + 1200
}

export const LONG_PRESS_MS = 450
export const LONG_PRESS_SLOP = 8

// ---- double tap -------------------------------------------------------------
let lastTap: { x: number; y: number; t: number; target: EventTarget | null } | null = null
let lastSyntheticDbl = 0
/**
 * Call on every touch pointerup. Returns true when this tap completes a double tap
 * on the same target; the caller then runs its double-click action.
 */
export function registerTap(e: PointerEvent | { clientX: number; clientY: number; target: EventTarget | null }): boolean {
  const now = Date.now()
  const prev = lastTap
  lastTap = { x: e.clientX, y: e.clientY, t: now, target: e.target }
  if (prev && now - prev.t < 320 && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 30) {
    lastTap = null
    lastSyntheticDbl = now
    return true
  }
  return false
}
/** True when a native dblclick arrives right after we already handled the double tap ourselves. */
export const isDuplicateDblClick = () => Date.now() - lastSyntheticDbl < 600
