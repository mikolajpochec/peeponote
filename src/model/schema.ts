import { z } from 'zod'
import type { Board, WorkspaceMeta } from './types'

const base = {
  id: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  z: z.number().default(0),
}

const cardSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('note'), md: z.string(), color: z.string().optional() }),
  z.object({ ...base, type: z.literal('text'), text: z.string(), style: z.enum(['title', 'body']), autoSize: z.boolean().optional() }),
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
})

export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  cards: z.array(cardSchema),
  connectors: z.array(connectorSchema).default([]),
})

export const workspaceSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  rootBoardId: z.string(),
})

export function parseBoard(json: string): Board {
  return boardSchema.parse(JSON.parse(json)) as Board
}

export function parseWorkspace(json: string): WorkspaceMeta {
  return workspaceSchema.parse(JSON.parse(json)) as WorkspaceMeta
}
