/**
 * The mascot-free side of the app: every peepo stands for something (a cheer, a worry, an upload), so when the
 * frogs are turned off in Settings → Look we draw that meaning as a small colour-coded badge instead. One shape per
 * meaning, not one per emote, which is why several peepos share an icon.
 */
import { useId } from 'react'
import type { PeepoName } from './peepos'

/** how the mascot-free icons look: colour-coded badges, or monochrome icons in the text colour */
export type IconStyle = 'colour' | 'line'

export type GlyphRole = 'smile' | 'cheer' | 'ok' | 'think' | 'up' | 'down' | 'warn' | 'error' | 'ask' | 'rest' | 'smash' | 'love' | 'sad'

const ROLE: Record<PeepoName, GlyphRole> = {
  peepoHappy: 'smile',
  peepoGlad: 'smile',
  peepoHey: 'smile',
  peepoGiggles: 'smile',
  FeelsOkayMan: 'ok',
  peepoClap: 'cheer',
  peepoCheer: 'cheer',
  peepoPog: 'cheer',
  peepoLove: 'love',
  peepoThink: 'think',
  peepoShy: 'ask',
  peepoSad: 'sad',
  peepoRun: 'up',
  peepoLeave: 'down',
  PepeHands: 'error',
  monkaS: 'warn',
  peepoSit: 'rest',
  peepoSmash: 'smash',
}

export const roleOf = (name: PeepoName): GlyphRole => ROLE[name] ?? 'smile'

/**
 * Each meaning gets its own little badge: a rounded tile in a colour that says it at a glance (warm for a cheer,
 * blue for a worry, red for an error), with a bold symbol on top. Fixed colours rather than the theme accent, the
 * way the frogs are green on every theme.
 */
interface Look {
  /** gradient, light top-left to deep bottom-right */
  from: string
  to: string
  /** the symbol */
  fg: string
  /** small details cut into the symbol (the dots in a thought bubble, the "!" in a warning) */
  ink: string
}

const LOOK: Record<GlyphRole, Look> = {
  smile: { from: '#ffe27a', to: '#f5a524', fg: '#6b3a06', ink: '#ff8a7a' },
  cheer: { from: '#ffc457', to: '#ff5f7e', fg: '#ffffff', ink: '#ffffff' },
  ok: { from: '#7ee8a6', to: '#1fa35a', fg: '#ffffff', ink: '#ffffff' },
  think: { from: '#c2a8ff', to: '#7a4cf0', fg: '#ffffff', ink: '#7a4cf0' },
  up: { from: '#86d3ff', to: '#2f86ec', fg: '#ffffff', ink: '#ffffff' },
  down: { from: '#b2bcff', to: '#5a5fd6', fg: '#ffffff', ink: '#ffffff' },
  warn: { from: '#ffd866', to: '#f08a16', fg: '#ffffff', ink: '#c25e00' },
  error: { from: '#ff8a8a', to: '#d92f4b', fg: '#ffffff', ink: '#ffffff' },
  ask: { from: '#74e4f4', to: '#0d97b5', fg: '#ffffff', ink: '#ffffff' },
  rest: { from: '#929dff', to: '#3f35b8', fg: '#ffffff', ink: '#ffe9a8' },
  smash: { from: '#ffc24f', to: '#ff5a1f', fg: '#ffffff', ink: '#ffffff' },
  love: { from: '#ff9cc2', to: '#e5306e', fg: '#ffffff', ink: '#ffffff' },
  sad: { from: '#8fc3ff', to: '#3a67d8', fg: '#ffffff', ink: '#bfe0ff' },
}

const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}z`

/** the symbol of each badge, drawn on a 24×24 tile; `cut` is a mask id for shapes with a bite taken out */
function symbol(role: GlyphRole, { fg, ink }: Look, cut: string) {
  const line = { fill: 'none', stroke: fg, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  const solid = { fill: fg, stroke: fg, strokeWidth: 1.2, strokeLinejoin: 'round' } as const
  switch (role) {
    case 'smile':
      return (
        <>
          <ellipse cx="8.9" cy="10" rx="1.25" ry="1.65" fill={fg} />
          <ellipse cx="15.1" cy="10" rx="1.25" ry="1.65" fill={fg} />
          <path d="M7.7 13.1h8.6a4.3 4.3 0 0 1-8.6 0z" fill={fg} />
          <circle cx="6.4" cy="13.6" r="1.1" fill={ink} opacity=".75" />
          <circle cx="17.6" cy="13.6" r="1.1" fill={ink} opacity=".75" />
        </>
      )
    case 'sad':
      return (
        <>
          <ellipse cx="8.9" cy="10.4" rx="1.25" ry="1.6" fill={fg} />
          <ellipse cx="15.1" cy="10.4" rx="1.25" ry="1.6" fill={fg} />
          <path d="M8.6 17c1-1.3 2.1-1.9 3.4-1.9s2.4.6 3.4 1.9" {...line} strokeWidth={1.9} />
          <path d="M17.4 12.3s1.4 1.7 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.9 1.4-2.6 1.4-2.6z" fill={ink} />
        </>
      )
    case 'ok':
      return <path d="M7 12.5l3.4 3.4L17.2 8.8" {...line} strokeWidth={2.8} />
    case 'cheer':
      return (
        <>
          <path d="M12 6.4l1.6 4.1 4.4.2-3.5 2.8 1.2 4.3L12 15.3l-3.7 2.5 1.2-4.3L6 10.7l4.4-.2z" {...solid} />
          <path d={sparkle(18.4, 5.6, 1.7)} fill={ink} />
          <path d={sparkle(5.4, 16.8, 1.2)} fill={ink} opacity=".85" />
        </>
      )
    case 'love':
      return (
        <>
          <path
            d="M12 18.4l-.9-.8C7.9 14.7 5.8 12.8 5.8 10.4c0-1.9 1.5-3.4 3.4-3.4 1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 1.9 0 3.4 1.5 3.4 3.4 0 2.4-2.1 4.3-5.3 7.2z"
            fill={fg}
          />
          <path d={sparkle(18.6, 5.4, 1.5)} fill={ink} opacity=".9" />
        </>
      )
    case 'think':
      return (
        <>
          <rect x="4.8" y="5.6" width="14.4" height="9.4" rx="4.7" fill={fg} />
          <circle cx="8.1" cy="17.3" r="1.35" fill={fg} />
          <circle cx="5.9" cy="19.3" r=".85" fill={fg} />
          <circle cx="8.8" cy="10.3" r="1.15" fill={ink} />
          <circle cx="12" cy="10.3" r="1.15" fill={ink} />
          <circle cx="15.2" cy="10.3" r="1.15" fill={ink} />
        </>
      )
    case 'ask':
      return (
        <>
          <path d="M9.3 9.6a2.8 2.8 0 1 1 4.3 2.3c-1 .7-1.6 1.2-1.6 2.4" {...line} strokeWidth={2.6} />
          <circle cx="12" cy="17.6" r="1.45" fill={fg} />
        </>
      )
    case 'up':
      return <path d="M12 5.6l5.6 5.9h-3.5V18H9.9v-6.5H6.4z" {...solid} strokeWidth={1.4} />
    case 'down':
      return <path d="M12 18.4l5.6-5.9h-3.5V6H9.9v6.5H6.4z" {...solid} strokeWidth={1.4} />
    case 'warn':
      return (
        <>
          <path d="M12 5.4l7 12.4H5z" {...solid} strokeWidth={2.2} />
          <path d="M12 10.2v3.4" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.05" fill={ink} />
        </>
      )
    case 'error':
      return <path d="M8.3 8.3l7.4 7.4M15.7 8.3l-7.4 7.4" {...line} strokeWidth={2.8} />
    case 'rest':
      return (
        <>
          <mask id={cut}>
            <rect width="24" height="24" fill="#fff" />
            <circle cx="14.4" cy="10.2" r="4.9" fill="#000" />
          </mask>
          <circle cx="11" cy="13.2" r="5.8" fill={fg} mask={`url(#${cut})`} />
          <path d="M15.4 5.2h2.9l-2.9 3.2h2.9" fill="none" stroke={ink} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
          <path d={sparkle(18.6, 13.4, 1.2)} fill={ink} opacity=".85" />
        </>
      )
    case 'smash':
      return <path d="M13.5 4.6 6.9 13.2h4.7l-1.1 6.2 6.8-8.8h-4.7z" {...solid} />
  }
}

/**
 * The monochrome set: drawn in the current text colour like the rest of the chrome, each shape outlined and
 * washed with a faint fill of the same colour, with the small details (eyes, dots, the "!") solid.
 */
function lineSymbol(role: GlyphRole) {
  const wash = { fill: 'currentColor', fillOpacity: 0.16, stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: 'round' } as const
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  const dot = { fill: 'currentColor' } as const
  const circle = <circle cx="12" cy="12" r="8.6" {...wash} />
  /** a shape borrowed from the badge set, scaled up around the centre with the stroke kept the same width */
  const grow = (k: number, cy = 12.3) => ({ transform: `translate(12 ${cy}) scale(${k}) translate(-12 -${cy})`, strokeWidth: 1.7 / k })
  switch (role) {
    case 'smile':
      return (
        <>
          {circle}
          <ellipse cx="9.1" cy="10.2" rx="1.1" ry="1.4" {...dot} />
          <ellipse cx="14.9" cy="10.2" rx="1.1" ry="1.4" {...dot} />
          <path d="M8.4 13.9c.9 1.4 2.1 2.1 3.6 2.1s2.7-.7 3.6-2.1" {...line} />
        </>
      )
    case 'sad':
      return (
        <>
          {circle}
          <ellipse cx="9.1" cy="10.4" rx="1.1" ry="1.4" {...dot} />
          <ellipse cx="14.9" cy="10.4" rx="1.1" ry="1.4" {...dot} />
          <path d="M8.8 16.4c.9-1.1 1.9-1.6 3.2-1.6s2.3.5 3.2 1.6" {...line} />
          <path d="M16.8 12.4s1.1 1.3 1.1 2a1.1 1.1 0 0 1-2.2 0c0-.7 1.1-2 1.1-2z" {...dot} opacity=".7" />
        </>
      )
    case 'ok':
      return (
        <>
          {circle}
          <path d="M8.2 12.3l2.6 2.6 5-5.2" {...line} strokeWidth={1.9} />
        </>
      )
    case 'cheer':
      return (
        <>
          <path d="M12 6.4l1.6 4.1 4.4.2-3.5 2.8 1.2 4.3L12 15.3l-3.7 2.5 1.2-4.3L6 10.7l4.4-.2z" {...wash} {...grow(1.22)} />
          <path d={sparkle(19.4, 4.6, 1.5)} {...dot} />
          <path d={sparkle(4.6, 18.6, 1.1)} {...dot} opacity=".7" />
        </>
      )
    case 'love':
      return (
        <>
          <path
            d="M12 18.4l-.9-.8C7.9 14.7 5.8 12.8 5.8 10.4c0-1.9 1.5-3.4 3.4-3.4 1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 1.9 0 3.4 1.5 3.4 3.4 0 2.4-2.1 4.3-5.3 7.2z"
            {...wash}
            {...grow(1.25, 12.8)}
          />
        </>
      )
    case 'think':
      return (
        <>
          <rect x="3.6" y="4.4" width="16.8" height="11.2" rx="5.6" {...wash} />
          <circle cx="7.6" cy="18.4" r="1.3" {...dot} />
          <circle cx="5" cy="20.6" r=".8" {...dot} opacity=".7" />
          <circle cx="8.6" cy="10" r="1.1" {...dot} />
          <circle cx="12" cy="10" r="1.1" {...dot} />
          <circle cx="15.4" cy="10" r="1.1" {...dot} />
        </>
      )
    case 'ask':
      return (
        <>
          {circle}
          <path d="M9.8 9.9a2.3 2.3 0 1 1 3.5 1.9c-.8.5-1.3 1-1.3 1.9" {...line} />
          <circle cx="12" cy="16.3" r="1.1" {...dot} />
        </>
      )
    case 'up':
      return (
        <>
          {circle}
          <path d="M12 16.4V7.8M8.4 11.3 12 7.6l3.6 3.7" {...line} strokeWidth={1.9} />
        </>
      )
    case 'down':
      return (
        <>
          {circle}
          <path d="M12 7.6v8.6M8.4 12.7l3.6 3.7 3.6-3.7" {...line} strokeWidth={1.9} />
        </>
      )
    case 'warn':
      return (
        <>
          <path d="M10.3 4.8a2 2 0 0 1 3.4 0l7.1 12.2a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3z" {...wash} />
          <path d="M12 9.6v3.9" {...line} strokeWidth={1.9} />
          <circle cx="12" cy="16.6" r="1.1" {...dot} />
        </>
      )
    case 'error':
      return (
        <>
          <path d="M8.4 3.4h7.2l5 5v7.2l-5 5H8.4l-5-5V8.4z" {...wash} />
          <path d="M9.4 9.4l5.2 5.2M14.6 9.4l-5.2 5.2" {...line} strokeWidth={1.9} />
        </>
      )
    case 'rest':
      return (
        <>
          <path d="M19.4 14.2A7.8 7.8 0 1 1 9.8 4.6a6.2 6.2 0 0 0 9.6 9.6z" {...wash} />
          <path d="M15 3.8h3.4L15 7.6h3.4" {...line} strokeWidth={1.5} />
        </>
      )
    case 'smash':
      return <path d="M13.5 4.6 6.9 13.2h4.7l-1.1 6.2 6.8-8.8h-4.7z" {...wash} {...grow(1.25, 12)} />
  }
}

export function Glyph({
  role,
  variant = 'colour',
  size = 28,
  className = '',
  title,
}: {
  role: GlyphRole
  variant?: IconStyle
  size?: number
  className?: string
  title?: string
}) {
  const id = `${role}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const look = LOOK[role]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? role}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {title && <title>{title}</title>}
      {variant === 'line' ? (
        lineSymbol(role)
      ) : (
        <>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={look.from} />
          <stop offset="1" stopColor={look.to} />
        </linearGradient>
        <filter id={`${id}s`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy=".6" stdDeviation=".45" floodColor="#000" floodOpacity=".28" />
        </filter>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill={`url(#${id}g)`} />
      <path d="M8 1.5h8A6.5 6.5 0 0 1 22.5 8v.6C18.8 10.4 15.3 11 12 11S5.2 10.4 1.5 8.6V8A6.5 6.5 0 0 1 8 1.5z" fill="#fff" opacity=".16" />
      <rect x="1.9" y="1.9" width="20.2" height="20.2" rx="6.1" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth=".7" />
      <g filter={`url(#${id}s)`}>{symbol(role, look, `${id}m`)}</g>
        </>
      )}
    </svg>
  )
}

/** "a board", as one character for menus and the palette: a frog, or a plain folder with the mascots off */
export const boardMark = (mascots: boolean) => (mascots ? '🐸' : '🗂')
