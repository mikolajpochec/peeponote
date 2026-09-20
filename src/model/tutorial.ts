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

    note(cSave, 40, 610, 260, 170, '### 7 · Save & share\nConnect a GitHub repo in ⚙ Settings (paste a token). From then on Save does everything: brings in what others saved, combines it with yours, and pushes. It only asks when you both edited the same card.', {
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

  // a small story-planning example: scene, event and dialogue
  const storyId = id()
  const scene = id()
  const dlg = id()
  const dlg2 = id()
  const opt1 = id()
  const opt2 = id()
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
      { id: scene, type: 'story', kind: 'scene', slug: 'crossing', x: 60, y: 480, w: 300, h: 340, z: 2, title: 'Crossing the bog', fields: { location: 'the bog, at dusk', characters: 'Peepo, the heron', goal: 'get across before dark', conflict: 'the heron demands a riddle', outcome: 'yes, but — Peepo loses the map' } },
      { id: id(), type: 'story', kind: 'quest', slug: 'lily-pad', x: 380, y: 170, w: 300, h: 300, z: 2, title: 'Find the lily pad', fields: { giver: 'the old heron', objective: 'Bring the lost lily pad back before the frost.', steps: '[Crossing the bog](peepo://Home/How-to-use-peeponote/Story/crossing)\nask the heron\nfollow the map', reward: 'a dry spot for winter', failure: 'Peepo sleeps in the reeds' } },
      { id: id(), type: 'story', kind: 'event', x: 60, y: 170, w: 280, h: 230, z: 2, title: 'The lily pad is gone', fields: { when: 'day 1, morning', description: 'Someone took it overnight.', participants: 'Peepo', consequences: 'the search begins' } },
      { id: dlg, type: 'story', kind: 'dialogue', x: 400, y: 500, w: 300, h: 250, z: 2, title: 'At the water\'s edge', fields: { speaker: 'Heron', text: 'Every way is across, little one — if you answer me this.' }, options: [ { id: opt1, text: 'Ask the riddle', note: 'leads to the riddle node' }, { id: opt2, text: 'Try to swim around', note: 'lose the map' } ] },
      { id: dlg2, type: 'story', kind: 'dialogue', x: 760, y: 500, w: 300, h: 200, z: 2, title: 'The riddle', fields: { speaker: 'Heron', text: 'What has a bed but never sleeps?' }, options: [ { id: id(), text: 'A river', note: 'correct → crossing' }, { id: id(), text: 'A frog' } ] },
      { id: id(), type: 'text', x: 60, y: 850, w: 560, h: 60, z: 1, variant: 'body', autoSize: true, text: 'Right-click any card → **Properties…** to see its address and give it a short ID for links like `peepo://Home/…/crossing`.' },
    ],
    connectors: [{ id: id(), from: { cardId: dlg, side: 'right', itemId: opt1 }, to: { cardId: dlg2, side: 'left' }, arrows: 'end' }],
  }
  how.push({ id: id(), type: 'board', x: 630, y: 820, w: 260, h: 110, z: 1, boardId: storyId, style: { bg: '#c9a8f5' } })
  return [home, howBoard, sandbox, story]
}
