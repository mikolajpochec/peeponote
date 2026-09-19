import type { AssetCard } from '../../model/types'
import { useAssetUrl } from '../useAssetUrl'
import { Loading } from './Loading'

export function AudioPreview({ card }: { card: AssetCard }) {
  const { url, error } = useAssetUrl(card.path, card.mime)
  if (!url) return <Loading error={error} />
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3">
      <div className="text-2xl">🎵</div>
      <audio data-nodrag controls src={url} className="w-full" style={{ height: 32 }} />
    </div>
  )
}
