/**
 * "Last used" memory: the style you last applied to a note / text / shape / connector…
 * becomes the default for the next one you create. Per object type, per browser.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ArrowStyle, Card, CardStyle, ConnectorStyle, ShapeKind } from '../model/types'

/** styles are remembered per "kind of thing" — titles and body text separately, pictures apart from files */
export type StyleKey = 'note' | 'title' | 'text' | 'todo' | 'link' | 'board' | 'asset' | 'picture' | 'shape' | 'story' | 'connector'

interface LastStyleState {
  cards: Partial<Record<StyleKey, CardStyle>>
  connector: ConnectorStyle
  arrows: ArrowStyle
  shape: ShapeKind
  rememberCard: (key: StyleKey, patch: Partial<CardStyle>) => void
  rememberConnector: (patch: Partial<ConnectorStyle>) => void
  rememberArrows: (arrows: ArrowStyle) => void
  rememberShape: (shape: ShapeKind) => void
}

export const useLastStyle = create<LastStyleState>()(
  persist(
    (set) => ({
      cards: {},
      connector: {},
      arrows: 'end',
      shape: 'rect',
      rememberCard: (key, patch) =>
        set((s) => {
          const cur = { ...(s.cards[key] ?? {}) } as Record<string, unknown>
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) delete cur[k]
            else cur[k] = v
          }
          return { cards: { ...s.cards, [key]: cur as CardStyle } }
        }),
      rememberConnector: (patch) =>
        set((s) => {
          const cur = { ...s.connector } as Record<string, unknown>
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) delete cur[k]
            else cur[k] = v
          }
          return { connector: cur as ConnectorStyle }
        }),
      rememberArrows: (arrows) => set({ arrows }),
      rememberShape: (shape) => set({ shape }),
    }),
    { name: 'peeponote-last-style' },
  ),
)

export function styleKeyOf(card: Card): StyleKey {
  if (card.type === 'text') return card.variant === 'title' ? 'title' : 'text'
  if (card.type === 'asset') return card.kind === 'image' || card.kind === 'texture' ? 'picture' : 'asset'
  return card.type
}

/** style to give a freshly created card of this kind (undefined when nothing was remembered) */
export function rememberedStyle(key: StyleKey): CardStyle | undefined {
  const s = useLastStyle.getState().cards[key]
  return s && Object.keys(s).length ? { ...s } : undefined
}
