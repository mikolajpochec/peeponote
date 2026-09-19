import type { AssetCard } from '../../model/types'
import { useAssetUrl } from '../useAssetUrl'
import { Loading } from './Loading'

export function ImagePreview({ card }: { card: AssetCard }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  if (!url) return <Loading error={error} />
  return <img src={url} alt={card.name} draggable={false} className="h-full w-full object-contain" />
}
