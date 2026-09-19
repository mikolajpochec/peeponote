import type { AssetCard } from '../../model/types'
import { useAssetUrl } from '../useAssetUrl'
import { Loading } from './Loading'

export function VideoPreview({ card }: { card: AssetCard }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  if (!url) return <Loading error={error} />
  return <video data-nodrag controls src={url} className="h-full w-full bg-black object-contain" />
}
