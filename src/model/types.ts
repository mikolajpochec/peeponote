export type AssetKind =
  | 'image'
  | 'texture'
  | 'audio'
  | 'video'
  | 'model3d'
  | 'font'
  | 'code'
  | 'data'
  | 'other'

export type FontFamily = 'sans' | 'serif' | 'mono' | 'hand'
export type TextAlign = 'left' | 'center' | 'right'

/** Visual overrides; every field optional, absent = type default */
export interface CardStyle {
  bg?: string
  fg?: string
  fontSize?: number
  font?: FontFamily
  bold?: boolean
  italic?: boolean
  align?: TextAlign
  border?: string
  radius?: number
  opacity?: number
  /** outline / shape stroke width in px (shapes default to 2) */
  strokeWidth?: number
  dashed?: boolean
}

export interface ConnectorStyle {
  color?: string
  width?: number
  dashed?: boolean
}

export interface BoardStyle {
  bg?: string
  dots?: boolean
}

export interface CardBase {
  id: string
  x: number
  y: number
  w: number
  h: number
  z: number
  style?: CardStyle
  /** cards sharing a groupId select and move together */
  groupId?: string
}

export interface NoteCard extends CardBase {
  type: 'note'
  md: string
  color?: string
}

export interface TextCard extends CardBase {
  type: 'text'
  text: string
  variant: 'title' | 'body'
  /** size follows content until the user resizes by hand (default true) */
  autoSize?: boolean
}

export interface TodoItem {
  id: string
  text: string
  done: boolean
}

export interface TodoCard extends CardBase {
  type: 'todo'
  title: string
  items: TodoItem[]
}

export interface LinkCard extends CardBase {
  type: 'link'
  url: string
  title: string
}

export interface BoardCard extends CardBase {
  type: 'board'
  boardId: string
}

export interface AssetCard extends CardBase {
  type: 'asset'
  path: string
  name: string
  mime: string
  size: number
  kind: AssetKind
  /** optional user override for spritesheet frame size */
  frame?: { w: number; h: number }
  /** saved 3D preview camera (model-space, after centering) */
  view?: { pos: [number, number, number]; target: [number, number, number] }
}

export type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'hexagon' | 'star' | 'arrow' | 'parallelogram' | 'cloud'

export interface ShapeCard extends CardBase {
  type: 'shape'
  shape: ShapeKind
  /** optional centered label */
  label: string
}

export type Card = NoteCard | TextCard | TodoCard | LinkCard | BoardCard | AssetCard | ShapeCard
export type CardType = Card['type']

export type Side = 'top' | 'right' | 'bottom' | 'left'
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

/** where a connector end lives: glued to a card side, or a free point on the board */
/** a card side; with `itemId` the left/right edge of one row inside the card (to-do items) */
export type Anchor = { cardId: string; side: Side; itemId?: string } | { x: number; y: number }
export type ArrowStyle = 'end' | 'start' | 'both' | 'none'

export interface Connector {
  id: string
  from: Anchor
  to: Anchor
  arrows: ArrowStyle
  style?: ConnectorStyle
}

export interface Board {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  cards: Card[]
  connectors: Connector[]
  style?: BoardStyle
  /** board card / sidebar icon: a peepo name ("peepo:peepoGlad"), any emoji, or "" for none. Default: peepo */
  icon?: string
}

/** Shared, committed workspace settings (everyone who clones gets these) */
export interface WorkspaceSettings {
  snapToGrid?: boolean
}

export interface WorkspaceMeta {
  version: 1
  name: string
  rootBoardId: string
  settings?: WorkspaceSettings
}

export const WORKSPACE_FILE = 'peeponote.json'
export const BOARDS_DIR = 'boards'
export const ASSETS_DIR = 'assets'

export const boardPath = (id: string) => `${BOARDS_DIR}/${id}.json`

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
