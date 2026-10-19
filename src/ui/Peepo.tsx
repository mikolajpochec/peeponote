import { useSettings } from '../store/settings'
import { Glyph, roleOf, type GlyphRole } from '../theme/glyphs'
import { peepoSrc, type PeepoName } from '../theme/peepos'
import { lookOf } from '../theme/themes'

/**
 * A peepo, or the colour-coded icon that means the same thing when the mascots are off (Settings → Look).
 * Every call site keeps asking for an emote by name; what gets drawn is a personal setting. `plain` overrides the
 * icon for spots where the frog stands for a thing rather than a mood (the app's logo, a board).
 */
export function Peepo({
  name,
  plain,
  size = 28,
  className = '',
  title,
}: {
  name: PeepoName
  plain?: GlyphRole
  size?: number
  className?: string
  title?: string
}) {
  const look = lookOf(useSettings((s) => s.look))
  if (look.icons !== 'peepo')
    return <Glyph role={plain ?? roleOf(name)} variant={look.icons} tint={look.badge} size={size} className={className} title={title} />
  return (
    <img
      src={peepoSrc(name)}
      alt={name}
      title={title ?? name}
      width={size}
      height={size}
      draggable={false}
      className={`inline-block select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
