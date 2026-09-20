import { memo } from 'react'
import type { Card } from '../model/types'
import { CardShell } from '../canvas/CardShell'
import { NoteCard } from './NoteCard'
import { TextCard } from './TextCard'
import { TodoCard } from './TodoCard'
import { LinkCard } from './LinkCard'
import { BoardCard } from './BoardCard'
import { AssetCard, ImageAssetCard, isPicture } from './AssetCard'
import { ShapeCard } from './ShapeCard'
import { StoryCard } from './story/StoryCard'
import { isInternalLink, openLink, parseLink } from '../nav/links'
import { useWorkspace } from '../store/workspace'

export interface CardProps<C extends Card = Card> {
  card: C
  boardId: string
  readOnly: boolean
  selected: boolean
}

interface Props extends CardProps {
  scale: () => number
}

export const CardView = memo(function CardView({ card, boardId, readOnly, selected, scale }: Props) {
  const navigate = useWorkspace((s) => s.navigate)
  const common = { card, boardId, readOnly: readOnly || !!card.locked, selected }
  switch (card.type) {
    case 'note':
      return (
        <CardShell {...common} scale={scale} className="bg-paper text-ink">
          <NoteCard {...common} card={card} />
        </CardShell>
      )
    case 'text':
      return (
        <CardShell {...common} scale={scale} bare>
          <TextCard {...common} card={card} />
        </CardShell>
      )
    case 'todo':
      return (
        <CardShell {...common} scale={scale} className="bg-paper text-ink">
          <TodoCard {...common} card={card} />
        </CardShell>
      )
    case 'link': {
      // double-click on an internal link jumps to its target
      const t = isInternalLink(card.url) ? parseLink(card.url) : null
      return (
        <CardShell {...common} scale={scale} className="bg-paper text-ink" onOpen={t ? () => openLink(t) : undefined}>
          <LinkCard {...common} card={card} />
        </CardShell>
      )
    }
    case 'story':
      return (
        <CardShell {...common} scale={scale} className="bg-paper text-ink">
          <StoryCard {...common} card={card} />
        </CardShell>
      )
    case 'shape':
      return (
        <CardShell {...common} scale={scale} bare>
          <ShapeCard {...common} card={card} />
        </CardShell>
      )
    case 'board':
      return (
        <CardShell {...common} scale={scale} className="bg-frog-600 text-frog-50" onOpen={() => navigate(card.boardId)}>
          <BoardCard {...common} card={card} />
        </CardShell>
      )
    case 'asset':
      if (isPicture(card))
        return (
          <CardShell {...common} scale={scale} bare>
            <ImageAssetCard {...common} card={card} />
          </CardShell>
        )
      return (
        <CardShell {...common} scale={scale} className="bg-swamp-700 text-frog-50">
          <AssetCard {...common} card={card} />
        </CardShell>
      )
  }
})
