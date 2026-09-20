import type { AssetCard } from '../../model/types'
import { useAssetUrl } from '../useAssetUrl'
import { Loading } from './Loading'

export function ImagePreview({ card, onDims }: { card: AssetCard; onDims?: (w: number, h: number) => void }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  if (!url) return <Loading error={error} />
  return (
    <img
      src={url}
      alt={card.name}
      draggable={false}
      onLoad={(e) => onDims?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
      className="h-full w-full rounded-[inherit] object-contain"
    />
  )
}
