import type { LinkCard as LinkCardT } from '../model/types'
import { useWorkspace } from '../store/workspace'
import type { CardProps } from './CardView'

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function LinkCard({ card, boardId, readOnly }: CardProps<LinkCardT>) {
  const updateCard = useWorkspace((s) => s.updateCard)
  const host = hostOf(card.url)
  return (
    <div className="flex h-full w-full items-stretch gap-3 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-frog-100">
        {host ? (
          <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" className="h-6 w-6" />
        ) : (
          <span>🔗</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.title}
          placeholder={host || 'Title'}
          onChange={(e) => updateCard(boardId, card.id, { title: e.target.value })}
          className="min-w-0 bg-transparent text-[1em] font-bold outline-none placeholder:opacity-50"
        />
        <input
          data-nodrag
          readOnly={readOnly}
          value={card.url}
          placeholder="https://…"
          onChange={(e) => updateCard(boardId, card.id, { url: e.target.value })}
          className="min-w-0 bg-transparent text-[0.86em] opacity-70 outline-none"
        />
        {card.url && (
          <a
            data-nodrag
            href={card.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-auto self-start text-[0.86em] font-semibold text-frog-600 hover:underline"
          >
            Open ↗
          </a>
        )}
      </div>
    </div>
  )
}
