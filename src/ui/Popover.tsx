import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Floating panel rendered into <body>, positioned under (or above) an anchor element.
 * Cards clip and scale their content, so anything that must not be cut off goes through here.
 * Closes on Escape and on pointerdown outside (unless `sticky`).
 */
export function Popover({
  anchor,
  onClose,
  children,
  align = 'left',
  gap = 6,
  sticky = false,
  className = '',
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  align?: 'left' | 'right' | 'center'
  gap?: number
  /** don't close on outside clicks (the caller manages it) */
  sticky?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const place = () => {
    const el = ref.current
    if (!el || !anchor) return
    const a = anchor.getBoundingClientRect()
    const p = el.getBoundingClientRect()
    let left = align === 'right' ? a.right - p.width : align === 'center' ? a.left + a.width / 2 - p.width / 2 : a.left
    left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8))
    const below = a.bottom + gap
    const top = below + p.height > window.innerHeight - 8 ? Math.max(8, a.top - gap - p.height) : below
    setPos({ left, top })
  }
  useLayoutEffect(place, [anchor, align, gap])
  useEffect(() => {
    const ro = ref.current ? new ResizeObserver(place) : null
    if (ref.current && ro) ro.observe(ref.current)
    window.addEventListener('resize', place)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', place)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor])

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (sticky) return
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor?.contains(t)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [onClose, anchor, sticky])

  return createPortal(
    <div
      ref={ref}
      data-nodrag
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`fixed z-[60] select-none ${className}`}
      style={pos ?? { left: 0, top: 0, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  )
}
