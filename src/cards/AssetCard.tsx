import { lazy, Suspense } from 'react'
import type { AssetCard as AssetCardT } from '../model/types'
import { KIND_LABEL, detectKind, extOf, formatBytes } from '../model/assetKind'
import { readAssetBytes, useWorkspace } from '../store/workspace'
import { pictureAspect } from '../canvas/pictureAspect'
import { MIN_H } from '../canvas/CardShell'
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
    toast.fail('Download failed', e, { path: card.path, size: card.size })
  }
}

/** Split "name.ext" using the stored file's real extension, so renaming can't break format detection. */
function splitName(card: AssetCardT): { stem: string; ext: string } {
  const ext = extOf(card.path)
  const suffix = ext ? `.${ext}` : ''
  const stem = suffix && card.name.toLowerCase().endsWith(suffix) ? card.name.slice(0, -suffix.length) : card.name
  return { stem, ext }
}

/** Pictures render without the file-card chrome: just the image, board showing through transparency. */
export const isPicture = (card: AssetCardT) => {
  const kind = card.kind === 'other' ? detectKind(card.path, card.mime) : card.kind
  return kind === 'image' || kind === 'texture'
}

export function ImageAssetCard({ card: stored, boardId, readOnly }: CardProps<AssetCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const card = stored.kind === 'other' ? { ...stored, kind: detectKind(stored.path, stored.mime) } : stored
  const { stem, ext } = splitName(card)
  const pixel = card.kind === 'texture'
  // the card box follows the picture's aspect ratio (plain view only — the pixel view has its own control strip),
  // so a frame/outline hugs the image instead of a letterboxed square
  const onDims = (nw: number, nh: number) => {
    if (!nw || !nh) return
    pictureAspect.set(card.id, nw / nh)
    if (readOnly || pixel) return
    const h = Math.max(MIN_H, Math.round((card.w * nh) / nw))
    if (Math.abs(h - card.h) > 1) updateCard(boardId, card.id, { h }, { quiet: true })
  }
  return (
    <div className="group/img relative h-full w-full">
      {pixel ? <TexturePreview card={card} boardId={boardId} readOnly={readOnly} onDims={onDims} /> : <ImagePreview card={card} onDims={onDims} />}
      {/* hover / selection toolbar: name, pixel view toggle, download */}
      <div
        data-nodrag
        className="absolute inset-x-1 bottom-1 flex items-center gap-1 rounded-lg bg-swamp-900/85 px-1.5 py-1 text-frog-50 opacity-0 shadow backdrop-blur transition-opacity group-hover:opacity-100 group-hover/img:opacity-100 pointer-coarse:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 items-baseline">
          <input
            readOnly={readOnly}
            value={stem}
            onChange={(e) => updateCard(boardId, card.id, { name: `${e.target.value}${ext ? `.${ext}` : ''}` })}
            title={`${card.path} · ${formatBytes(card.size)}`}
            className="min-w-0 flex-1 truncate bg-transparent text-[12px] font-semibold outline-none"
          />
          {ext && <span className="shrink-0 text-[11px] opacity-50">.{ext}</span>}
        </div>
        {!readOnly && (
          <button
            title={pixel ? 'Show as picture' : 'Pixel view: crisp pixels, spritesheet frames'}
            onClick={() => updateCard(boardId, card.id, { kind: pixel ? 'image' : 'texture' })}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] hover:bg-(--hover-strong) ${pixel ? 'bg-frog-600 text-white' : ''}`}
          >
            ▦
          </button>
        )}
        <button title={`Download original (${formatBytes(card.size)})`} onClick={() => downloadAsset(card)} className="shrink-0 rounded-md bg-frog-600 px-1.5 py-0.5 text-[12px] font-bold text-white hover:bg-frog-500">
          ⬇
        </button>
      </div>
    </div>
  )
}

export function AssetCard({ card: stored, boardId, readOnly }: CardProps<AssetCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  // kind is detected at drop time; re-detect files we didn't know how to preview back then
  const card = stored.kind === 'other' ? { ...stored, kind: detectKind(stored.path, stored.mime) } : stored
  const { stem, ext } = splitName(card)
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-(--hair) px-2.5 py-1.5">
        <span className="text-[13px]" title={KIND_LABEL[card.kind]}>
          {KIND_ICON[card.kind]}
        </span>
        <div className="flex min-w-0 flex-1 items-baseline">
          <input
            data-nodrag
            readOnly={readOnly}
            value={stem}
            onChange={(e) => updateCard(boardId, card.id, { name: `${e.target.value}${ext ? `.${ext}` : ''}` })}
            title={card.path}
            className="min-w-0 flex-1 truncate bg-transparent text-[13px] font-bold outline-none"
          />
          {ext && <span className="shrink-0 text-[12px] font-semibold opacity-50">.{ext}</span>}
        </div>
        <span className="shrink-0 rounded bg-(--hover-strong) px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-frog-200">
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
