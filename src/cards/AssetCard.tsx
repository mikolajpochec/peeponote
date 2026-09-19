import { lazy, Suspense } from 'react'
import type { AssetCard as AssetCardT } from '../model/types'
import { KIND_LABEL, formatBytes } from '../model/assetKind'
import { readAssetBytes, useWorkspace } from '../store/workspace'
import { toast } from '../store/toast'
import { Peepo } from '../ui/Peepo'
import type { CardProps } from './CardView'
import { ImagePreview } from './previews/ImagePreview'
import { TexturePreview } from './previews/TexturePreview'
import { AudioPreview } from './previews/AudioPreview'
import { VideoPreview } from './previews/VideoPreview'
import { FontPreview } from './previews/FontPreview'
import { CodePreview } from './previews/CodePreview'
import { GenericPreview } from './previews/GenericPreview'

const ModelPreview = lazy(() => import('./previews/ModelPreview'))

const KIND_ICON: Record<AssetCardT['kind'], string> = {
  image: '🖼️',
  texture: '🧩',
  audio: '🔊',
  video: '🎬',
  model3d: '🧊',
  font: '🔤',
  code: '📜',
  data: '🗂️',
  other: '📦',
}

export async function downloadAsset(card: AssetCardT) {
  try {
    const bytes = await readAssetBytes(card.path)
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: card.mime || 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url
    a.download = card.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e) {
    toast.err(`Download failed: ${(e as Error).message}`)
  }
}

export function AssetCard({ card, boardId, readOnly }: CardProps<AssetCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
        <span className="text-[13px]" title={KIND_LABEL[card.kind]}>
          {KIND_ICON[card.kind]}
        </span>
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.name}
          onChange={(e) => updateCard(boardId, card.id, { name: e.target.value })}
          title={card.path}
          className="min-w-0 flex-1 truncate bg-transparent text-[13px] font-bold outline-none"
        />
        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-frog-200">
          {KIND_LABEL[card.kind]}
        </span>
        <button
          data-nodrag
          title={`Download original (${formatBytes(card.size)})`}
          onClick={() => downloadAsset(card)}
          className="shrink-0 rounded-md bg-frog-600 px-2 py-0.5 text-[12px] font-bold text-white hover:bg-frog-500"
        >
          ⬇
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <Preview card={card} boardId={boardId} readOnly={readOnly} />
      </div>
      <div className="flex items-center justify-between px-2.5 py-1 text-[10px] text-frog-200/60">
        <span className="truncate">{card.mime || 'unknown type'}</span>
        <span>{formatBytes(card.size)}</span>
      </div>
    </div>
  )
}

function Preview({ card, boardId, readOnly }: { card: AssetCardT; boardId: string; readOnly: boolean }) {
  switch (card.kind) {
    case 'image':
      return <ImagePreview card={card} />
    case 'texture':
      return <TexturePreview card={card} boardId={boardId} readOnly={readOnly} />
    case 'audio':
      return <AudioPreview card={card} />
    case 'video':
      return <VideoPreview card={card} />
    case 'font':
      return <FontPreview card={card} />
    case 'code':
    case 'data':
      return <CodePreview card={card} />
    case 'model3d':
      return (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center gap-2 text-[12px] text-frog-200/70">
              <Peepo name="peepoThink" size={28} className="peepo-bounce" /> loading 3D…
            </div>
          }
        >
          <ModelPreview card={card} boardId={boardId} readOnly={readOnly} />
        </Suspense>
      )
    default:
      return <GenericPreview card={card} />
  }
}
