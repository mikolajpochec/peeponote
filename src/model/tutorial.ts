import type { Board, Card, Connector } from './types'
import { newId } from './types'

/** Boards seeded into a fresh workspace: Home + a "How to use peeponote" walkthrough. */
export function tutorialBoards(rootId: string): Board[] {
  const now = new Date().toISOString()
  const howId = newId()
  const sandboxId = newId()
  const id = () => newId()

  // --- ids we connect later
  const cTitle = id()
  const cPalette = id()
  const cCards = id()
  const cFiles = id()
  const cArrows = id()
  const cGit = id()
  const cSave = id()
  const cSync = id()
  const cStyle = id()
  const cTodo = id()
  const cSandbox = id()

  const note = (cid: string, x: number, y: number, w: number, h: number, md: string, extra: Partial<Card> = {}): Card =>
    ({ id: cid, type: 'note', x, y, w, h, z: 1, md, ...extra }) as Card

  const how: Card[] = [
    { id: cTitle, type: 'text', x: 40, y: 20, w: 520, h: 50, z: 1, text: 'How to use peeponote', variant: 'title', autoSize: true },
    { id: id(), type: 'text', x: 40, y: 80, w: 560, h: 60, z: 1, variant: 'body', autoSize: true, text: 'A visual board that lives in a git repo. Everything you see here is a card — drag it, resize it, right-click it. This board is yours: edit or delete anything.' },

    note(cPalette, 40, 170, 260, 185, '### 1 · The palette\nThe floating bar on the left. **Click** an item to drop it in the middle of the view, or **drag** it exactly where you want it.\n\nDouble-click empty canvas for a quick note.'),
    note(cCards, 330, 170, 260, 185, '### 2 · Cards\n**Title / Text** — free-floating, size follows content.\n**Note** — markdown (double-click to edit).\n**To-do**, **Link**, **Board** (nested boards!).'),
    note(cFiles, 620, 170, 280, 185, '### 3 · Any file\nDrop files anywhere. Images, spritesheets, audio, video, **3D models** (glb/obj/stl/fbx), fonts, shaders, code, JSON… Every asset gets a preview and a ⬇ download button.'),

    note(cArrows, 40, 390, 260, 185, '### 4 · Arrows\nHover a card → four dots appear on its edges. Drag from a dot to another card (or into empty space). Click an arrow to change direction, color, width, or delete it.'),
    note(cStyle, 330, 390, 260, 185, '### 5 · Style anything\nSelect a card and a style bar appears: fill, text color, font, size, border, radius, opacity. Works on multi-select. 🎨 in the top bar styles the board itself.', {
      style: { bg: '#ddd6fe', radius: 24 },
    }),
    note(cGit, 620, 390, 280, 185, '### 6 · It\'s all git\nEdits are written to the working tree as you go — a refresh never loses anything. **Save (⌘S)** makes a commit. History (top right) lets you peek at and restore any version.'),

    note(cSave, 40, 610, 260, 170, '### 7 · Save & push\nConnect a GitHub repo in ⚙ Settings (paste a token). From then on Save also pushes. ⇅ syncs: pulls if the remote moved, merges cards if both sides changed.', {
      style: { bg: '#c8f2d4' },
    }),
    note(cSync, 330, 610, 260, 170, '### 8 · Two ways to talk to GitHub\n**GitHub API** — direct, no middleman (default for github.com).\n**git over HTTP** — standard protocol via a CORS proxy, for any host.'),
    {
      id: cTodo,
      type: 'todo',
      x: 620,
      y: 610,
      w: 280,
      h: 200,
      z: 1,
      title: 'Try it now',
      items: [
        { id: id(), text: 'Drag this card somewhere else', done: false },
        { id: id(), text: 'Double-click a note and edit it', done: false },
        { id: id(), text: 'Drop an image onto the board', done: false },
        { id: id(), text: 'Draw an arrow between two cards', done: false },
        { id: id(), text: 'Press ⌘S to commit', done: false },
      ],
    },
    { id: id(), type: 'link', x: 40, y: 820, w: 260, h: 90, z: 1, url: 'https://github.com/isomorphic-git/isomorphic-git', title: 'Powered by isomorphic-git' },
    { id: cSandbox, type: 'board', x: 330, y: 820, w: 260, h: 110, z: 1, boardId: sandboxId, style: { bg: '#fff3b0' } },
    { id: id(), type: 'text', x: 40, y: 960, w: 560, h: 40, z: 1, variant: 'body', autoSize: true, text: 'Shortcuts: ⌘S save · ⌘C/⌘X/⌘V/⌘D clipboard · ⌘A select all · ⌘0 reset zoom · Space+drag pans · ⌘+wheel zooms · Del deletes · right-click for more.' },
  ]

  const arrow = (from: string, to: string, extra: Partial<Connector> = {}): Connector =>
    ({ id: id(), from: { cardId: from, side: 'right' }, to: { cardId: to, side: 'left' }, arrows: 'end', ...extra }) as Connector

  const howConnectors: Connector[] = [
    arrow(cPalette, cCards),
    arrow(cCards, cFiles),
    arrow(cArrows, cStyle, { style: { dashed: true } }),
    { id: id(), from: { cardId: cGit, side: 'bottom' }, to: { cardId: cSync, side: 'top' }, arrows: 'end', style: { color: '#8ac47e' } },
    { id: id(), from: { cardId: cSave, side: 'right' }, to: { cardId: cSync, side: 'left' }, arrows: 'both' },
  ]

  const home: Board = {
    id: rootId,
    name: 'Home',
    parentId: null,
    createdAt: now,
    cards: [
      { id: id(), type: 'text', x: 80, y: 60, w: 400, h: 50, z: 1, text: 'Welcome to peeponote', variant: 'title', autoSize: true },
      { id: id(), type: 'text', x: 80, y: 120, w: 420, h: 40, z: 1, variant: 'body', autoSize: true, text: 'Your home board. Open the guide below, then make this place yours.' },
      { id: id(), type: 'board', x: 80, y: 190, w: 260, h: 130, z: 2, boardId: howId, style: { bg: '#5d9b4c' } },
    ],
    connectors: [],
  }

  const howBoard: Board = { id: howId, name: 'How to use peeponote', parentId: rootId, createdAt: now, cards: how, connectors: howConnectors }
  const sandbox: Board = { id: sandboxId, name: 'Sandbox', parentId: howId, createdAt: now, cards: [], connectors: [] }

  // a small story-planning example: character + location linked from a scene by peepo:// paths
  const storyId = id()
  const hero = id()
  const bog = id()
  const scene = id()
  const beat = id()
  const dlg = id()
  const story: Board = {
    id: storyId,
    name: 'Story example',
    slug: 'Story',
    parentId: howId,
    createdAt: now,
    icon: '📖',
    cards: [
      { id: id(), type: 'text', x: 60, y: 40, w: 520, h: 44, z: 1, variant: 'title', autoSize: true, text: 'Planning a story' },
      { id: id(), type: 'text', x: 60, y: 90, w: 560, h: 60, z: 1, variant: 'body', autoSize: true, text: 'Story cards live under **📖 Story** in the palette (hover or tap). Fields take inline markdown and `peepo://` links — click a link to jump.' },
      { id: hero, type: 'story', kind: 'character', slug: 'peepo', x: 60, y: 170, w: 280, h: 280, z: 2, title: 'Peepo', fields: { role: 'protagonist', traits: 'small, brave, easily distracted', motivation: 'wants to find the lost lily pad', arc: 'timid → trusts the swamp' } },
      { id: bog, type: 'story', kind: 'location', slug: 'the-bog', x: 380, y: 170, w: 280, h: 220, z: 2, title: 'The Bog', fields: { description: 'Mist, reeds, one very old heron.', mood: 'uneasy but familiar' } },
      { id: scene, type: 'story', kind: 'scene', slug: 'crossing', x: 60, y: 480, w: 300, h: 340, z: 2, title: 'Crossing the bog', fields: { location: '[The Bog](peepo://Home/How-to-use-peeponote/Story/the-bog)', characters: '[Peepo](peepo://Home/How-to-use-peeponote/Story/peepo)', goal: 'get across before dark', conflict: 'the heron demands a riddle', outcome: 'yes, but — Peepo loses the map' } },
      { id: beat, type: 'story', kind: 'beat', x: 400, y: 480, w: 260, h: 170, z: 2, title: 'Inciting incident', stage: 'setup', fields: { description: 'The lily pad is gone. Someone took it.' } },
      { id: dlg, type: 'story', kind: 'dialogue', x: 400, y: 680, w: 320, h: 220, z: 2, title: 'At the water\'s edge', fields: { context: 'Peepo meets the heron' }, lines: [ { id: id(), speaker: '[Peepo](peepo://Home/How-to-use-peeponote/Story/peepo)', text: 'Is this the way across?', note: 'nervous' }, { id: id(), speaker: 'Heron', text: 'Every way is across, if you answer me this…' } ] },
      { id: id(), type: 'text', x: 60, y: 850, w: 560, h: 60, z: 1, variant: 'body', autoSize: true, text: 'Right-click any card → **Properties…** to see its id and give it a short slug for links like `peepo://Home/…/peepo`.' },
    ],
    connectors: [
      { id: id(), from: { cardId: scene, side: 'top' }, to: { cardId: hero, side: 'bottom' }, arrows: 'end', style: { dashed: true } },
      { id: id(), from: { cardId: scene, side: 'right' }, to: { cardId: beat, side: 'left' }, arrows: 'end' },
    ],
  }
  how.push({ id: id(), type: 'board', x: 630, y: 820, w: 260, h: 110, z: 1, boardId: storyId, style: { bg: '#c9a8f5' } })
  return [home, howBoard, sandbox, story]
}
