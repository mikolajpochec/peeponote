import { z } from 'zod'
import type { Board, WorkspaceMeta } from './types'

const cardStyleSchema = z.object({
  bg: z.string().optional(),
  fg: z.string().optional(),
  fontSize: z.number().optional(),
  font: z.enum(['sans', 'serif', 'mono', 'hand']).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  border: z.string().optional(),
  radius: z.number().optional(),
  opacity: z.number().optional(),
  strokeWidth: z.number().optional(),
  dashed: z.boolean().optional(),
})

const base = {
  id: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  z: z.number().default(0),
  style: cardStyleSchema.optional(),
  groupId: z.string().optional(),
}

const cardSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('note'), md: z.string(), color: z.string().optional() }),
  z.object({ ...base, type: z.literal('text'), text: z.string(), variant: z.enum(['title', 'body']), autoSize: z.boolean().optional() }),
  z.object({
    ...base,
    type: z.literal('todo'),
    title: z.string(),
    items: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })),
  }),
  z.object({ ...base, type: z.literal('link'), url: z.string(), title: z.string() }),
  z.object({ ...base, type: z.literal('board'), boardId: z.string() }),
  z.object({
    ...base,
    type: z.literal('shape'),
    shape: z.enum(['rect', 'ellipse', 'diamond', 'triangle', 'hexagon', 'star', 'arrow', 'parallelogram', 'cloud']),
    label: z.string().default(''),
  }),
  z.object({
    ...base,
    type: z.literal('asset'),
    path: z.string(),
    name: z.string(),
    mime: z.string(),
    size: z.number(),
    kind: z.enum(['image', 'texture', 'audio', 'video', 'model3d', 'font', 'code', 'data', 'other']),
    frame: z.object({ w: z.number(), h: z.number() }).optional(),
    view: z
      .object({ pos: z.tuple([z.number(), z.number(), z.number()]), target: z.tuple([z.number(), z.number(), z.number()]) })
      .optional(),
  }),
])

const anchorSchema = z.union([
  z.object({ cardId: z.string(), side: z.enum(['top', 'right', 'bottom', 'left']) }),
  z.object({ x: z.number(), y: z.number() }),
])

const connectorSchema = z.object({
  id: z.string(),
  from: anchorSchema,
  to: anchorSchema,
  arrows: z.enum(['end', 'start', 'both', 'none']).default('end'),
  style: z.object({ color: z.string().optional(), width: z.number().optional(), dashed: z.boolean().optional() }).optional(),
})

export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  cards: z.array(cardSchema),
  connectors: z.array(connectorSchema).default([]),
  style: z.object({ bg: z.string().optional(), dots: z.boolean().optional() }).optional(),
  icon: z.string().optional(),
})

export const workspaceSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  rootBoardId: z.string(),
  settings: z.object({ snapToGrid: z.boolean().optional() }).optional(),
})

/** Older files stored the text variant under `style`. */
function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const b = raw as { cards?: Record<string, unknown>[] }
  if (Array.isArray(b.cards)) {
    for (const c of b.cards) {
      if (c.type === 'text' && typeof c.style === 'string') {
        c.variant = c.style
        delete c.style
      }
    }
  }
  return raw
}

export function parseBoard(json: string): Board {
  return boardSchema.parse(migrate(JSON.parse(json))) as Board
}

export function parseWorkspace(json: string): WorkspaceMeta {
  return workspaceSchema.parse(JSON.parse(json)) as WorkspaceMeta
}
