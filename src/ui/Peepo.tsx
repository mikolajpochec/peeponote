import { useSettings } from '../store/settings'
import { Glyph, roleOf } from '../theme/glyphs'
import { peepoSrc, type PeepoName } from '../theme/peepos'

/**
 * A peepo, or the colour-coded icon that means the same thing when the mascots are off (Settings → Look).
 * Every call site keeps asking for an emote by name; what gets drawn is a personal setting.
 */
export function Peepo({ name, size = 28, className = '', title }: { name: PeepoName; size?: number; className?: string; title?: string }) {
  const mascots = useSettings((s) => s.mascots)
  if (!mascots) return <Glyph role={roleOf(name)} size={size} className={className} title={title} />
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
