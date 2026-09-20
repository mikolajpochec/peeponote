import { lazy, Suspense } from 'react'
import type { AssetCard } from '../../model/types'
import { useAssetText } from '../useAssetUrl'
import { Loading } from './Loading'

const Highlighted = lazy(() => import('./HighlightedCode'))

export function CodePreview({ card }: { card: AssetCard }) {
  const text = useAssetText(card.path, card.mime)
  if (text === null) return <Loading />
  return (
    <Suspense
      fallback={
        <pre data-nodrag className="h-full w-full overflow-auto bg-black/30 p-2 font-mono text-[11px] leading-snug scrollbar-thin select-text">
          {text}
        </pre>
      }
    >
      <Highlighted code={text} name={card.path} />
    </Suspense>
  )
}
