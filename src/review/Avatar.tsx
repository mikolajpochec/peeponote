import { useReview } from '../store/review'
import { initials, personColor, userKey, type Account, type Person } from './identity'

/** The picture committed next to someone's account, else their GitHub avatar, else initials on a colour. */
export function Avatar({ person, size = 24, className = '', title }: { person: Person | Account; size?: number; className?: string; title?: string }) {
  const key = userKey(person)
  const committed = useReview((s) => s.pictures[key])
  const account = useReview((s) => s.accounts[key])
  const src = committed ?? (person as Account).avatarUrl ?? account?.avatarUrl
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }
  if (src) return <img src={src} alt={person.name} title={title ?? person.name} className={`shrink-0 rounded-full object-cover ${className}`} style={style} draggable={false} />
  return (
    <span
      title={title ?? person.name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-black leading-none text-white ${className}`}
      style={{ ...style, background: personColor(key) }}
    >
      {initials(person.name)}
    </span>
  )
}
