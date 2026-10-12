/**
 * The mascot-free side of the app: every peepo stands for something (a cheer, a worry, an upload), so when the
 * frogs are turned off in Settings → Look we draw that meaning as a quiet line icon instead. One shape per
 * meaning, not one per emote, which is why several peepos share an icon.
 */
import type { PeepoName } from './peepos'

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

/** 24×24 line art, drawn in the current text colour so it fits whatever theme is on */
const PATHS: Record<GlyphRole, string> = {
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.5 10h.01M15.5 10h.01M8 14.5c1 1.2 2.4 1.8 4 1.8s3-.6 4-1.8',
  sad: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.5 10h.01M15.5 10h.01M8 16.2c1-1.2 2.4-1.8 4-1.8s3 .6 4 1.8',
  ok: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8 12.4l2.6 2.6L16.4 9.2',
  cheer: 'M12 3.5l1.9 4.3 4.6.5-3.4 3.1.9 4.6-4-2.3-4 2.3.9-4.6L5.5 8.3l4.6-.5zM5 19l1.5-1.5M19 19l-1.5-1.5M12 20.5V19',
  love: 'M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20',
  think: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M8.2 12h.01M12 12h.01M15.8 12h.01',
  up: 'M12 19V6M12 5.5l-4.5 4.5M12 5.5l4.5 4.5M5 20h14',
  down: 'M12 5v13M12 18.5l-4.5-4.5M12 18.5l4.5-4.5M5 3h14',
  warn: 'M12 4.5 3.5 19h17zM12 10v4.2M12 16.8h.01',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7.8V13M12 16.2h.01',
  ask: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9.6 9.3A2.5 2.5 0 0 1 14.5 10c0 1.7-2.5 2-2.5 3.6M12 16.8h.01',
  rest: 'M4 20h16M6 20v-5.5a6 6 0 0 1 12 0V20M9 8.5V5M15 8.5V6',
  smash: 'M13 3 5.5 13h5l-1.5 8L16.5 11h-5z',
}

export function Glyph({ role, size = 28, className = '', title }: { role: GlyphRole; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={title ?? role}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title && <title>{title}</title>}
      <path d={PATHS[role]} />
    </svg>
  )
}

/** "a board", as one character for menus and the palette: a frog, or a plain folder with the mascots off */
export const boardMark = (mascots: boolean) => (mascots ? '🐸' : '🗂')
