import type { CSSProperties } from 'react'
import type { Card, CardStyle, FontFamily } from '../model/types'

export const FONT_FAMILY: Record<FontFamily, string> = {
  sans: 'var(--font-sans)',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  mono: 'var(--font-mono)',
  hand: '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive',
}

export const FONT_LABEL: Record<FontFamily, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', hand: 'Hand' }

/** Card fills — light paper tones first, then a few bold ones */
export const FILLS = [
  '#fbf8ef', '#ffffff', '#fff3b0', '#ffd6c2', '#f9c5d5', '#ddd6fe', '#bfe3ff', '#c8f2d4',
  '#5d9b4c', '#2f5726', '#2a3a2c', '#1b1d1a', '#7c2d12', '#1e3a8a',
]
/** Text / line colors */
export const INKS = ['#1b1d1a', '#4b5563', '#ffffff', '#eef7ec', '#8ac47e', '#3d7030', '#b91c1c', '#c2410c', '#a16207', '#1d4ed8', '#7e22ce', '#db2777']
export const RADII = [0, 8, 12, 24]

export function defaultFontSize(card: Card): number {
  if (card.type === 'text') return card.variant === 'title' ? 28 : 15
  if (card.type === 'asset') return 13
  return 14
}

export function defaultBold(card: Card): boolean {
  return card.type === 'text' && card.variant === 'title'
}

/** Inline styles derived from a card's style overrides. */
export function cardStyles(card: Card): { shell: CSSProperties; inner: CSSProperties } {
  const s: CardStyle = card.style ?? {}
  const radius = s.radius ?? 12
  const bold = s.bold ?? defaultBold(card)
  const shell: CSSProperties = {
    borderRadius: radius,
    opacity: s.opacity !== undefined ? s.opacity / 100 : undefined,
    outline: s.border ? `2px solid ${s.border}` : undefined,
    outlineOffset: s.border ? -1 : undefined,
  }
  const inner: CSSProperties = {
    borderRadius: radius,
    background: s.bg,
    color: s.fg,
    fontSize: s.fontSize ?? defaultFontSize(card),
    fontFamily: s.font ? FONT_FAMILY[s.font] : undefined,
    fontWeight: s.bold !== undefined || card.type === 'text' ? (bold ? 800 : 400) : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textAlign: s.align,
  }
  return { shell, inner }
}
