# peeponote 🐸

A Milanote-style infinite-canvas board app where **Save is `git commit`** and **Yeet is `git push`**.
Runs as a static web app, installs as a PWA, and needs no backend.

![peepoHappy](public/peepo/peepoHappy.webp)

## What it does

- **Boards** — infinite pan/zoom canvas, nested boards, sidebar tree, breadcrumbs.
- **Cards** — titles & free text, markdown notes, to-do lists, links, sub-boards, and **assets**. Add them from the floating palette (click, or drag onto the board).
- **Assets** — drop any file. Every asset card has a preview and a ⬇ button that downloads the original bytes.
  - images (photos) · **textures/spritesheets** (pixel-perfect, checkerboard, frame stepper) · audio · video
  - **3D models** (`.glb .gltf .obj .stl .fbx`, orbit controls, animation playback) · fonts (live specimen)
  - shaders / scripts / configs (`.glsl .frag .vert .wgsl .lua .gd …`) · data (`.json .yaml .csv .tmx .tscn …`) · anything else (generic card)
- **Git** — every save is a commit. History panel lets you peek at any old version and restore it. Push/pull to any git-over-HTTPS remote.

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

## Remotes

Browsers can't speak git smart-HTTP to GitHub directly (no CORS headers), so pushes go through a CORS proxy.
The default is the public `https://cors.isomorphic-git.org` demo proxy — fine for trying it out, but rate-limited
and run by strangers. For real use, deploy `proxy/worker.ts` to Cloudflare Workers and paste its URL into Settings.

Auth is a personal access token stored in `localStorage` of this browser only:

- **GitHub**: fine-grained PAT with *Contents: read & write* on the repo (or classic `repo` scope). Leave username empty.
- **GitLab**: token with `write_repository`; set username to `oauth2`.
- **Gitea/Forgejo**: token; leave username empty.

Turn on *Auto-yeet after every save* if you want commit + push in one click.

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
