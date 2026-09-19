import { peepoSrc, type PeepoName } from '../theme/peepos'

export function Peepo({ name, size = 28, className = '', title }: { name: PeepoName; size?: number; className?: string; title?: string }) {
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
