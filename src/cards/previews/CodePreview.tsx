import type { AssetCard } from '../../model/types'
import { useAssetText } from '../useAssetUrl'
import { Loading } from './Loading'

export function CodePreview({ card }: { card: AssetCard }) {
  const text = useAssetText(card.path, card.mime)
  if (text === null) return <Loading />
  return (
    <pre data-nodrag className="h-full w-full overflow-auto bg-black/30 p-2 font-mono text-[11px] leading-snug text-frog-100 scrollbar-thin select-text">
      {text}
    </pre>
  )
}
