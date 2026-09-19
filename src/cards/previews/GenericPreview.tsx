import type { AssetCard } from '../../model/types'
import { extOf } from '../../model/assetKind'

export function GenericPreview({ card }: { card: AssetCard }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-frog-200/80">
      <div className="text-4xl">📦</div>
      <div className="rounded bg-(--hover-strong) px-2 py-0.5 font-mono text-[12px] uppercase">.{extOf(card.name) || '?'}</div>
      <div className="text-[11px] opacity-70">no preview — download to inspect</div>
    </div>
  )
}
