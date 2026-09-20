import type { TextAlign } from '../model/types'

export const ALIGNS: TextAlign[] = ['left', 'center', 'right', 'justify']
export const ALIGN_TITLE: Record<TextAlign, string> = { left: 'Align left', center: 'Center', right: 'Align right', justify: 'Justify' }

/** four-line glyph: line lengths/anchors say which alignment it is */
export function AlignIcon({ align }: { align: TextAlign }) {
  const widths = [14, 9, 12, 7]
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
      {widths.map((w, i) => {
        const x = align === 'left' ? 1 : align === 'right' ? 15 - w : align === 'center' ? 8 - w / 2 : 1
        return <rect key={i} x={x} y={1 + i * 3.6} width={align === 'justify' ? 14 : w} height="1.6" rx="0.8" fill="currentColor" />
      })}
    </svg>
  )
}

const btn = 'flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-frog-100 hover:bg-(--hover-strong)'
const on = 'bg-frog-600 text-white hover:bg-frog-500'

/** Left / centre / right / justify as one button group. `left` is stored as "no alignment". */
export function AlignButtons({ value, onChange, keepFocus }: { value: TextAlign | undefined; onChange: (a: TextAlign | undefined) => void; keepFocus?: (e: React.PointerEvent) => void }) {
  const cur = value ?? 'left'
  return (
    <div className="flex items-center gap-0.5">
      {ALIGNS.map((a) => (
        <button key={a} className={`${btn} ${cur === a ? on : ''}`} title={ALIGN_TITLE[a]} onPointerDown={keepFocus} onClick={() => onChange(a === 'left' ? undefined : a)}>
          <AlignIcon align={a} />
        </button>
      ))}
    </div>
  )
}
