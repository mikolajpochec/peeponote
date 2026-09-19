# peeponote 🐸

A Milanote-style infinite-canvas board app where **Save is `git commit` (+ `git push` when a remote is connected)**.
Runs as a static web app, installs as a PWA, and needs no backend.

![peepoHappy](public/peepo/peepoHappy.webp)

## What it does

- **Boards** — infinite pan/zoom canvas, nested boards, sidebar tree, breadcrumbs.
- **Cards** — titles & free text, markdown notes, to-do lists, links, sub-boards, and **assets**. Add them from the floating palette (click, or drag onto the board).
- **Assets** — drop any file. Every asset card has a preview and a ⬇ button that downloads the original bytes.
  - images (photos) · **textures/spritesheets** (pixel-perfect, checkerboard, frame stepper) · audio · video
  - **3D models** (`.glb .gltf .obj .stl .fbx`, orbit controls, animation playback) · fonts (live specimen)
  - shaders / scripts / configs (`.glsl .frag .vert .wgsl .lua .gd …`) · data (`.json .yaml .csv .tmx .tscn …`) · anything else (generic card)
- **Styling** — select anything to get a style bar: fill, text color, border, font size/family (sans/serif/mono/hand), bold/italic, alignment, corner radius, opacity. Works on multi-select. Connectors get color/width/dashed; boards get a background color and a dot-grid toggle (🎨 in the top bar).
- **Connectors** — hover/select a card, drag from one of its 4 anchor points onto another card (snaps to the facing side) or into empty space. Select a line to flip arrowheads, delete, or drag its ends elsewhere.
- **Clipboard & context menu** — right-click anything: copy / cut / paste / duplicate (⌘C ⌘X ⌘V ⌘D, works across boards), bring to front / send to back, delete, add-here, select all. Pasting files, text or URLs from the system clipboard creates assets, notes or links.
- **Export** — Settings → *Download repo as .zip*: the whole repo including `.git`, so unzipping gives a working clone.
- **Git** — edits are written to the working tree as you go (uncommitted changes survive a refresh); every save is a commit. History panel lets you peek at any old version and restore it. Push/pull to any git-over-HTTPS remote.

## Storage modes

| mode | where the repo lives | works in |
| --- | --- | --- |
| **Browser** (default) | IndexedDB via LightningFS | every browser |
| **Folder on disk** | a real `.git` in a folder you pick (File System Access API) | Chromium browsers |

Both are full git repos — switch in ⚙ Settings. In folder mode you can `cd` into the folder and run normal `git` commands alongside the app.

## Repo layout (what gets committed)

```
peeponote.json           # { version, name, rootBoardId }
boards/<id>.json         # one file per board: name, parent, cards[]
assets/<sha1-8>-<name>   # binary assets, content-addressed prefix
```

Unreferenced assets are garbage-collected on save.

## Settings: repo vs. you

| where | what | who sees it |
| --- | --- | --- |
| `peeponote.json` (committed) | workspace name, snap-to-grid | everyone who clones |
| `.git/config` of this clone | remote URL | this clone only |
| this browser's `localStorage` | theme (Peepo / Dark), author, token, proxy, auto-push, storage mode | you only |

## Remotes

Browsers can't speak git smart-HTTP to GitHub directly (no CORS headers), so pushes go through a CORS proxy.
The default is the public `https://cors.isomorphic-git.org` demo proxy — fine for trying it out, but rate-limited
and run by strangers. For real use, deploy `proxy/worker.ts` to Cloudflare Workers and paste its URL into Settings.

Auth is a personal access token stored in `localStorage` of this browser only:

- **GitHub**: fine-grained PAT with *Contents: read & write* on the repo (or classic `repo` scope). Leave username empty.
- **GitLab**: token with `write_repository`; set username to `oauth2`.
- **Gitea/Forgejo**: token; leave username empty.

With a remote and token configured, **Save commits and pushes** in one go. Prefer them apart? Tick *Separate commit and push* in Settings to get a dedicated Push button.

## Develop

```sh
bun install
bun scripts/fetch-peepos.ts   # (re)download peepo emotes from 7TV into public/peepo
bun dev
bun run build && bun run preview
```

Deploys to GitHub Pages on push to `main` via `.github/workflows/pages.yml`.

## Shortcuts

⌘S save · ⌘A select all · ⌘0 reset zoom · ⌘, settings · Del delete · Esc deselect ·
double-click canvas = new note · Space/Alt + drag or middle mouse = pan · ⌘/Ctrl + wheel = zoom · Shift-click = multi-select

## Credits

Peepo emotes fetched from [7TV](https://7tv.app). Git in the browser by [isomorphic-git](https://isomorphic-git.org).
