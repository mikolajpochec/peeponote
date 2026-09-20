import type { CSSProperties } from 'react'
import type { Board, Card, CardStyle, FontFamily } from '../model/types'

export const FONT_FAMILY: Record<FontFamily, string> = {
  sans: 'var(--font-sans)',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  mono: 'var(--font-mono)',
  hand: '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive',
}

export const FONT_LABEL: Record<FontFamily, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', hand: 'Hand' }

// ---- color palette -----------------------------------------------------------
// One shared palette for fills, inks, borders, connectors and board backgrounds:
// a neutral row plus 12 hues in 5 shades (pastel → deep). Text contrast is derived
// automatically from whatever fill is picked (see `contrast`).

function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const HUES = [0, 22, 42, 60, 95, 150, 180, 205, 235, 265, 300, 335]
const SHADES: [number, number][] = [
  [85, 91], // pastel
  [75, 80],
  [65, 64],
  [60, 46],
  [55, 30], // deep
]
export const NEUTRALS = ['#ffffff', '#fbf8ef', '#ece9e1', '#d3d0c8', '#a8a59e', '#7a7872', '#4f4d49', '#32312e', '#1f1e1c', '#15181c', '#0f1113', '#000000']
/** rows of 12, light to dark */
export const PALETTE: string[][] = [NEUTRALS, ...SHADES.map(([s, l]) => HUES.map((h) => hsl(h, s, l)))]
/** flat palette */
export const SWATCHES = PALETTE.flat()
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
    // explicit text color, else auto-contrast against a custom fill, else the board ink for free text
    color: s.fg ?? (s.bg ? contrast(s.bg) : card.type === 'text' ? 'var(--board-fg)' : undefined),
    fontSize: s.fontSize ?? defaultFontSize(card),
    fontFamily: s.font ? FONT_FAMILY[s.font] : undefined,
    fontWeight: s.bold !== undefined || card.type === 'text' ? (bold ? 800 : 400) : undefined,
    fontStyle: s.italic ? 'italic' : undefined,
    textAlign: s.align,
  }
  return { shell, inner }
}

/** Perceived brightness 0..1 of a #rrggbb / #rgb / #rrggbbaa color (null when not parseable). */
export function luminance(c: string | undefined): number | null {
  const rgb = parseHex(c)
  if (!rgb) return null
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
}

function parseHex(c: string | undefined): [number, number, number] | null {
  const m = c && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = [...h].map((x) => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance (linear light) — what contrast ratios are computed from. */
function relLuminance(rgb: [number, number, number]): number {
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

export function isLight(c: string | undefined): boolean {
  const l = luminance(c)
  return l !== null && l > 0.6
}

/** Ink color that reads on the given background: whichever of near-black / white has the higher WCAG contrast. */
export function contrast(bg: string): string {
  const rgb = parseHex(bg)
  if (!rgb) return '#1b1d1a'
  const L = relLuminance(rgb)
  const dark = relLuminance([0x1b, 0x1d, 0x1a])
  const onDark = (L + 0.05) / (dark + 0.05)
  const onWhite = (1 + 0.05) / (L + 0.05)
  return onDark >= onWhite ? '#1b1d1a' : '#ffffff'
}

export const DEFAULT_BOARD_BG = '#15181c'

/** CSS variables that adapt canvas chrome (text, lines, dots, handles) to the board background. */
export function boardVars(board: Board, defaultBg = DEFAULT_BOARD_BG): Record<string, string> {
  const bg = board.style?.bg ?? defaultBg
  const light = isLight(bg)
  return {
    '--board-bg': bg,
    '--board-fg': light ? '#1b1d1a' : '#eef7ec',
    '--board-fg-muted': light ? 'rgba(27, 29, 26, 0.55)' : 'rgba(238, 247, 236, 0.55)',
    '--board-line': light ? '#3d7030' : '#8ac47e',
    '--board-line-sel': light ? '#1b1d1a' : '#d6ebd1',
    '--board-dot': light ? 'rgba(27, 29, 26, 0.18)' : 'rgba(138, 196, 126, 0.16)',
  }
}
