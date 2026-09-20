#!/usr/bin/env node
/**
 * peepo — read a peeponote workspace from the terminal (for humans and for Claude).
 *
 *   peepo tree                       boards as a tree, with peepo:// paths
 *   peepo show <target>              one board as markdown (cards, story nodes, arrows, sub-boards)
 *   peepo card <target>              one card in full
 *   peepo search <words…>            full-text search over every board → hits with addresses
 *   peepo graph <target> [--mermaid] story / dialogue flow of a board (nodes + arrows)
 *   peepo json <target>              raw JSON of a board or card
 *
 * <target> = peepo://Path/To/Board[/card], a board name, a slug, or an id. Run from anywhere inside the
 * repo — the workspace (folder holding peeponote.json) is found automatically; or pass --root <dir>.
 * No dependencies: node ≥ 18 or bun.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

// ------------------------------------------------------------------------------------- workspace

function findWorkspace(start) {
  // walk up looking for peeponote.json here or in a shallow subfolder (monorepo: board/peeponote.json)
  let dir = resolve(start)
  for (let up = 0; up < 8; up++) {
    const hit = findBelow(dir, 3)
    if (hit) return hit
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}
function findBelow(dir, depth) {
  if (existsSync(join(dir, 'peeponote.json'))) return dir
  if (depth === 0) return null
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }
  for (const e of entries) {
    if (e.startsWith('.') || ['node_modules', 'dist', 'build', 'target', 'vendor'].includes(e)) continue
    const p = join(dir, e)
    try {
      if (statSync(p).isDirectory()) {
        const hit = findBelow(p, depth - 1)
        if (hit) return hit
      }
    } catch {
      /* skip */
    }
  }
  return null
}

function loadWorkspace(root) {
  const meta = JSON.parse(readFileSync(join(root, 'peeponote.json'), 'utf8'))
  const boards = {}
  const dir = join(root, 'boards')
  if (existsSync(dir))
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue
      try {
        const b = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        if (b && b.id) boards[b.id] = b
      } catch (e) {
        console.error(`skipping ${f}: ${e.message}`)
      }
    }
  return { root, meta, boards }
}

// ----------------------------------------------------------------------------------- addressing

const slugify = (s) =>
  String(s ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
const norm = (s) =>
  slugify(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
const boardSlug = (b) => b.slug || slugify(b.name) || b.id
const cardSlug = (c) => c.slug || c.id
const boardMatches = (b, seg) => b.id === seg || (b.slug && norm(b.slug) === norm(seg)) || norm(b.name) === norm(seg)
const cardMatches = (c, seg) => c.id === seg || (c.slug && norm(c.slug) === norm(seg)) || norm(cardTitle(c)) === norm(seg)

function chain(ws, b) {
  const out = []
  for (let cur = b; cur; cur = cur.parentId ? ws.boards[cur.parentId] : null) out.unshift(cur)
  return out
}
const boardPath = (ws, b) => 'peepo://' + chain(ws, b).map(boardSlug).join('/')
const cardPath = (ws, b, c) => `${boardPath(ws, b)}/${cardSlug(c)}`
const root = (ws) => ws.boards[ws.meta.rootBoardId] ?? Object.values(ws.boards).find((b) => !b.parentId)

/** peepo://…, a name, a slug or an id → { board } | { board, card } | null */
function resolveTarget(ws, target) {
  if (!target) return { board: root(ws) }
  let t = String(target).trim()
  const all = Object.values(ws.boards)
  if (/^peepo:\/\//i.test(t)) {
    const segs = t
      .slice('peepo://'.length)
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .filter((s) => !s.startsWith('@'))
      .map(decodeURIComponent)
    let cur = root(ws)
    let i = 0
    if (cur && segs[0] && boardMatches(cur, segs[0])) i = 1
    for (; cur && i < segs.length; i++) {
      const seg = segs[i]
      const child = all.find((b) => b.parentId === cur.id && boardMatches(b, seg))
      if (child) {
        cur = child
        continue
      }
      if (i === segs.length - 1) {
        const card = cur.cards.find((c) => cardMatches(c, seg))
        if (card) return { board: cur, card }
      }
      cur = null
    }
    if (cur) return { board: cur }
    t = segs[segs.length - 1] ?? ''
  }
  // loose: unique board or card anywhere
  const boards = all.filter((b) => boardMatches(b, t))
  if (boards.length === 1) return { board: boards[0] }
  const cards = all.flatMap((b) => b.cards.filter((c) => cardMatches(c, t)).map((c) => ({ board: b, card: c })))
  if (cards.length === 1) return cards[0]
  if (boards.length > 1) return { ambiguous: boards.map((b) => boardPath(ws, b)) }
  if (cards.length > 1) return { ambiguous: cards.map((x) => cardPath(ws, x.board, x.card)) }
  return null
}

// -------------------------------------------------------------------------------------- content

const stripMd = (s) =>
  String(s ?? '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 <$2>')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')

function cardTitle(c) {
  switch (c.type) {
    case 'text':
      return firstLine(c.text)
    case 'note':
      return firstLine(c.md).replace(/^#+\s*/, '')
    case 'todo':
      return c.title || 'To-do'
    case 'link':
      return c.title || c.url
    case 'shape':
      return c.label || c.shape
    case 'story':
      return c.title || `(${c.kind})`
    case 'asset':
      return c.name
    case 'board':
      return `↳ board ${c.boardId}`
    default:
      return c.id
  }
}
const firstLine = (s) => stripMd(String(s ?? '').split('\n').find((l) => l.trim()) ?? '')
const oneLine = (s) => stripMd(String(s ?? '')).replace(/\s+/g, ' ').trim()

const anchorCard = (a) => (a && 'cardId' in a ? a : null)

/** arrows leaving a card: from one row/choice (`itemId`), or from the card itself (`null`) → [{ to, toItem, label }] */
function arrowsFrom(ws, b, cardId, itemId) {
  const out = []
  for (const k of b.connectors ?? []) {
    const ends = [
      [k.from, k.to, k.arrows === 'start' ? 'in' : 'out'],
      [k.to, k.from, k.arrows === 'start' ? 'out' : 'in'],
    ]
    for (const [a, z, dir] of ends) {
      const fa = anchorCard(a)
      if (!fa || fa.cardId !== cardId) continue
      if ((itemId ?? undefined) !== fa.itemId) continue
      if (dir !== 'out' && k.arrows !== 'both' && k.arrows !== 'none') continue
      const tz = anchorCard(z)
      out.push({ to: tz ? b.cards.find((c) => c.id === tz.cardId) : null, toItem: tz?.itemId, label: k.label, free: tz ? null : z })
    }
  }
  return out
}

function describeTarget(ws, b, hit) {
  if (!hit.to) return hit.free ? `a point (${Math.round(hit.free.x)}, ${Math.round(hit.free.y)})` : '?'
  let s = `${cardTitle(hit.to)}`
  if (hit.toItem && hit.to.type === 'story') {
    const opt = hit.to.options?.find((o) => o.id === hit.toItem)
    const field = hit.toItem
    s += opt ? ` › choice "${oneLine(opt.text)}"` : ` › ${field}`
  } else if (hit.toItem && hit.to.type === 'todo') {
    const it = hit.to.items?.find((i) => i.id === hit.toItem)
    if (it) s += ` › "${oneLine(it.text)}"`
  }
  return `${s}  <${cardPath(ws, b, hit.to)}>`
}

function renderCard(ws, b, c, { full = false } = {}) {
  const lines = []
  const head = `${icon(c)} **${cardTitle(c)}**  \`${c.type}${c.type === 'story' ? '/' + c.kind : ''}\`  <${cardPath(ws, b, c)}>`
  lines.push(head)
  switch (c.type) {
    case 'text': {
      const rest = String(c.text ?? '').split('\n').slice(1).join('\n').trim()
      if (rest) lines.push(indent(stripMd(rest)))
      break
    }
    case 'note': {
      const body = String(c.md ?? '')
      lines.push(indent(full ? body : body.split('\n').slice(0, 12).join('\n') + (body.split('\n').length > 12 ? '\n…' : '')))
      break
    }
    case 'todo':
      for (const it of c.items ?? []) {
        const arrows = arrowsFrom(ws, b, c.id, it.id)
        lines.push(indent(`- [${it.done ? 'x' : ' '}] ${oneLine(it.text)}${arrows.map((a) => `  → ${describeTarget(ws, b, a)}`).join('')}`))
      }
      break
    case 'link':
      lines.push(indent(c.url))
      break
    case 'board': {
      const sub = ws.boards[c.boardId]
      if (sub) lines.push(indent(`sub-board: ${sub.name}  <${boardPath(ws, sub)}>  (${sub.cards.length} cards)`))
      break
    }
    case 'asset':
      lines.push(indent(`file: ${c.path} (${c.mime || c.kind}, ${c.size ?? '?'} bytes)`))
      break
    case 'story': {
      for (const [k, v] of Object.entries(c.fields ?? {})) {
        if (!String(v ?? '').trim()) continue
        const arrows = arrowsFrom(ws, b, c.id, k)
        const val = String(v)
        lines.push(indent(`${k}: ${val.includes('\n') ? '\n' + indent(stripMd(val), '    ') : stripMd(val)}${arrows.map((a) => `  → ${describeTarget(ws, b, a)}`).join('')}`))
      }
      if (c.options?.length) {
        lines.push(indent('choices:'))
        for (const o of c.options) {
          const arrows = arrowsFrom(ws, b, c.id, o.id)
          lines.push(indent(`- ${oneLine(o.text)}${o.note ? `  _(${oneLine(o.note)})_` : ''}${arrows.length ? arrows.map((a) => `  → ${describeTarget(ws, b, a)}`).join('') : '  → (open end)'}`))
        }
      }
      if (c.lines?.length) for (const l of c.lines) lines.push(indent(`- ${l.speaker ? l.speaker + ': ' : ''}${oneLine(l.text)}`))
      break
    }
  }
  // arrows from the card itself (not from a row)
  for (const a of arrowsFrom(ws, b, c.id, null)) lines.push(indent(`→ ${describeTarget(ws, b, a)}${a.label ? `  "${a.label}"` : ''}`))
  return lines.join('\n')
}

const icon = (c) => ({ text: '¶', note: '📝', todo: '☑', link: '🔗', board: '🐸', asset: '📎', shape: '◇', story: { dialogue: '💬', event: '⚡', quest: '📜', scene: '🎬' }[c.kind] ?? '📖' })[c.type] ?? '•'
const indent = (s, pad = '  ') =>
  String(s)
    .split('\n')
    .map((l) => pad + l)
    .join('\n')

/** reading order: top-to-bottom, then left-to-right, in rows of ~200 board px */
const byPosition = (cards) => [...cards].sort((a, b) => Math.round(a.y / 200) - Math.round(b.y / 200) || a.x - b.x)

// -------------------------------------------------------------------------------------- commands

function cmdTree(ws) {
  const r = root(ws)
  if (!r) return console.log('no boards')
  const walk = (b, depth) => {
    const kids = Object.values(ws.boards)
      .filter((x) => x.parentId === b.id)
      .sort((a, z) => a.name.localeCompare(z.name))
    const story = b.cards.filter((c) => c.type === 'story').length
    console.log(`${'  '.repeat(depth)}${depth ? '└ ' : ''}${b.name}  <${boardPath(ws, b)}>  ${b.cards.length} cards${story ? `, ${story} story` : ''}`)
    for (const k of kids) walk(k, depth + 1)
  }
  walk(r, 0)
}

function cmdShow(ws, target, opts) {
  const hit = need(ws, target)
  if (hit.card) return console.log(renderCard(ws, hit.board, hit.card, { full: true }))
  const b = hit.board
  console.log(`# ${b.name}  <${boardPath(ws, b)}>\n`)
  const subs = Object.values(ws.boards).filter((x) => x.parentId === b.id)
  if (subs.length) {
    console.log('Sub-boards: ' + subs.map((s) => `${s.name} <${boardPath(ws, s)}>`).join(', ') + '\n')
  }
  const groups = [
    ['Story', (c) => c.type === 'story'],
    ['Notes & text', (c) => c.type === 'note' || c.type === 'text'],
    ['To-do', (c) => c.type === 'todo'],
    ['Links & files', (c) => c.type === 'link' || c.type === 'asset'],
    ['Shapes', (c) => c.type === 'shape' && c.label],
  ]
  for (const [title, pred] of groups) {
    const cards = byPosition(b.cards.filter((c) => c.type !== 'board' && pred(c)))
    if (!cards.length) continue
    console.log(`## ${title}\n`)
    for (const c of cards) console.log(renderCard(ws, b, c, { full: opts.full }) + '\n')
  }
  const free = (b.connectors ?? []).filter((k) => !anchorCard(k.from) || !anchorCard(k.to))
  if (free.length) console.log(`(${free.length} arrow${free.length === 1 ? '' : 's'} end on free points)`)
}

function cmdSearch(ws, words) {
  const q = words.join(' ').toLowerCase()
  if (!q) return console.error('search: give some words')
  const terms = q.split(/\s+/).filter(Boolean)
  let n = 0
  for (const b of Object.values(ws.boards)) {
    for (const c of b.cards) {
      const hay = textOf(c).toLowerCase()
      if (!terms.every((t) => hay.includes(t))) continue
      n++
      const i = hay.indexOf(terms[0])
      const snippet = textOf(c).replace(/\s+/g, ' ').slice(Math.max(0, i - 40), i + 80)
      console.log(`${icon(c)} ${cardTitle(c)}  <${cardPath(ws, b, c)}>\n  …${snippet}…`)
    }
    if (b.name.toLowerCase().includes(q)) console.log(`🐸 board ${b.name}  <${boardPath(ws, b)}>`)
  }
  if (!n) console.log('nothing found')
}
function textOf(c) {
  const parts = [cardTitle(c)]
  if (c.type === 'text') parts.push(c.text)
  if (c.type === 'note') parts.push(c.md)
  if (c.type === 'todo') parts.push(...(c.items ?? []).map((i) => i.text))
  if (c.type === 'link') parts.push(c.url)
  if (c.type === 'story') parts.push(...Object.values(c.fields ?? {}), ...(c.options ?? []).flatMap((o) => [o.text, o.note]), ...(c.lines ?? []).flatMap((l) => [l.speaker, l.text]))
  return parts.filter(Boolean).join('\n')
}

function cmdGraph(ws, target, opts) {
  const hit = need(ws, target)
  const b = hit.board
  const nodes = b.cards.filter((c) => c.type === 'story' || c.type === 'note' || c.type === 'text' || c.type === 'todo')
  const edges = []
  for (const c of nodes) {
    const rows = c.type === 'story' ? [...(c.options ?? []).map((o) => ({ id: o.id, label: oneLine(o.text) })), ...Object.keys(c.fields ?? {}).map((k) => ({ id: k, label: k }))] : c.type === 'todo' ? (c.items ?? []).map((i) => ({ id: i.id, label: oneLine(i.text) })) : []
    for (const r of rows) for (const a of arrowsFrom(ws, b, c.id, r.id)) if (a.to) edges.push({ from: c, to: a.to, label: r.label })
    for (const a of arrowsFrom(ws, b, c.id, null)) if (a.to) edges.push({ from: c, to: a.to, label: a.label ?? '' })
  }
  if (opts.mermaid) {
    const id = (c) => 'n' + c.id.replace(/[^a-z0-9]/gi, '')
    console.log('flowchart TD')
    for (const c of nodes) console.log(`  ${id(c)}["${escapeM(cardTitle(c))}"]`)
    for (const e of edges) console.log(`  ${id(e.from)} -->${e.label ? `|${escapeM(e.label)}|` : ''} ${id(e.to)}`)
    return
  }
  console.log(`# Flow of ${b.name}\n`)
  const incoming = new Set(edges.map((e) => e.to.id))
  const starts = nodes.filter((c) => c.type === 'story' && !incoming.has(c.id))
  if (starts.length) console.log('Entry points (nothing leads here): ' + starts.map((c) => cardTitle(c)).join(', ') + '\n')
  for (const c of byPosition(nodes)) {
    const out = edges.filter((e) => e.from.id === c.id)
    if (!out.length && c.type !== 'story') continue
    console.log(`${icon(c)} ${cardTitle(c)}  <${cardPath(ws, b, c)}>`)
    for (const e of out) console.log(`    ${e.label ? `[${e.label}] ` : ''}→ ${cardTitle(e.to)}`)
  }
}
const escapeM = (s) => String(s).replace(/"/g, "'")

function cmdJson(ws, target) {
  const hit = need(ws, target)
  console.log(JSON.stringify(hit.card ?? hit.board, null, 2))
}

function need(ws, target) {
  const hit = resolveTarget(ws, target)
  if (!hit) {
    console.error(`not found: ${target}\nTry \`peepo tree\` or \`peepo search …\``)
    process.exit(2)
  }
  if (hit.ambiguous) {
    console.error(`ambiguous: ${target}\n` + hit.ambiguous.map((p) => '  ' + p).join('\n'))
    process.exit(2)
  }
  return hit
}

// ------------------------------------------------------------------------------------------ main

const argv = process.argv.slice(2)
const opts = { full: false, mermaid: false, root: null }
const args = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--full') opts.full = true
  else if (a === '--mermaid') opts.mermaid = true
  else if (a === '--root') opts.root = argv[++i]
  else args.push(a)
}
const [cmd, ...rest] = args
const wsRoot = opts.root ? resolve(opts.root) : findWorkspace(process.cwd())
if (!wsRoot || !existsSync(join(wsRoot, 'peeponote.json'))) {
  console.error('No peeponote workspace found (peeponote.json). Run inside the repo or pass --root <dir>.')
  process.exit(1)
}
const ws = loadWorkspace(wsRoot)

switch (cmd) {
  case 'tree':
  case undefined:
    cmdTree(ws)
    break
  case 'show':
    cmdShow(ws, rest.join(' '), opts)
    break
  case 'card':
    cmdShow(ws, rest.join(' '), { ...opts, full: true })
    break
  case 'search':
    cmdSearch(ws, rest)
    break
  case 'graph':
    cmdGraph(ws, rest.join(' '), opts)
    break
  case 'json':
    cmdJson(ws, rest.join(' '))
    break
  default:
    console.error(`unknown command: ${cmd}\ncommands: tree, show, card, search, graph, json`)
    process.exit(1)
}
