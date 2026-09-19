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

export interface CardBase {
  id: string
  x: number
  y: number
  w: number
  h: number
  z: number
}

export interface NoteCard extends CardBase {
  type: 'note'
  md: string
  color?: string
}

export interface TextCard extends CardBase {
  type: 'text'
  text: string
  style: 'title' | 'body'
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
}

export type Card = NoteCard | TextCard | TodoCard | LinkCard | BoardCard | AssetCard
export type CardType = Card['type']

export interface Board {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  cards: Card[]
}

export interface WorkspaceMeta {
  version: 1
  name: string
  rootBoardId: string
}

export const WORKSPACE_FILE = 'peeponote.json'
export const BOARDS_DIR = 'boards'
export const ASSETS_DIR = 'assets'

export const boardPath = (id: string) => `${BOARDS_DIR}/${id}.json`

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
