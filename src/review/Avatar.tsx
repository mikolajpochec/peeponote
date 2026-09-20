import { useReview } from '../store/review'
import { initials, personColor, userKey, type Person } from './identity'

/** Profile picture when the person set one, else initials on a colour derived from the email. */
export function Avatar({ person, size = 24, className = '', title }: { person: Person; size?: number; className?: string; title?: string }) {
  const src = useReview((s) => s.pictures[userKey(person.email)])
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }
  if (src) return <img src={src} alt={person.name} title={title ?? person.name} className={`shrink-0 rounded-full object-cover ${className}`} style={style} draggable={false} />
  return (
    <span
      title={title ?? person.name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-black leading-none text-white ${className}`}
      style={{ ...style, background: personColor(person.email) }}
    >
      {initials(person.name)}
    </span>
  )
}
