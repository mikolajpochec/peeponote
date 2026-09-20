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

Two transports (Settings → Remote → Transport):

- **GitHub API** (default for github.com remotes) — talks to `api.github.com` directly, no proxy. Push recreates
  the local git objects through the Git Data API (blobs → trees → commits → ref); pull downloads objects into the
  local `.git`. Object ids are verified to match on both sides, so the repo stays interchangeable with plain git.
- **git over HTTP** — standard smart-HTTP through a CORS proxy, for any host. The default proxy is the public
  `https://cors.isomorphic-git.org` demo (rate-limited); deploy `proxy/worker.ts` to Cloudflare Workers for your own.

**Sync** (⇅, and automatically after Save when a remote is set): fetch, then push if you're ahead, fast-forward if
you're behind, and if both sides have new commits a dialog offers a **card-level merge** (cards edited on only one
side are combined; a card changed on both sides goes to whichever side you pick), force-push, or reset to remote.

Auth is a personal access token stored in `localStorage` of this browser only:

- **GitHub**: [create a fine-grained token](https://github.com/settings/personal-access-tokens/new) → *Only select
  repositories* → your boards repo → *Repository permissions → Contents: Read and write*. (Or a
  [classic token with the `repo` scope](https://github.com/settings/tokens/new?scopes=repo&description=peeponote).)
  Leave username empty.
- **GitLab**: [personal access token](https://gitlab.com/-/user_settings/personal_access_tokens?name=peeponote&scopes=write_repository,read_repository)
  with `read_repository` + `write_repository`; set username to `oauth2`.
- **Gitea/Forgejo**: *Settings → Applications → Generate token* with repository read/write; leave username empty.

The Settings dialog and the onboarding wizard show these links — plus a step-by-step guide — for whichever host
your remote URL points at.

### Sign in with GitHub (one click instead of a token)

Optional, set up once by whoever hosts peeponote. It uses the GitHub OAuth **device flow**: the app shows a short
code, you type it at github.com/login/device, done. No client secret exists anywhere; the only moving part is a tiny
relay, because `github.com/login/*` has no CORS headers.

1. **Create an OAuth App**: [github.com/settings/applications/new](https://github.com/settings/applications/new)
   → name `peeponote`, homepage and callback URL = where you host it (the callback is required but unused)
   → *Register* → tick **Enable Device Flow** → *Update application* → copy the **Client ID**.
2. **Deploy the relay** (Cloudflare Workers free tier; needs Node ≥ 22 for wrangler):
   `bunx wrangler login && bunx wrangler deploy` — config is in `wrangler.toml`, code in `proxy/worker.ts`
   (it doubles as the git CORS proxy). Note the `https://peeponote-relay.<you>.workers.dev` URL.
3. **Tell the build**: for GitHub Pages set two repository variables and re-run the deploy —
   `gh variable set PEEPONOTE_GH_CLIENT_ID -b <client id>` and `gh variable set PEEPONOTE_AUTH_RELAY -b <relay url>`.
   Self-hosting? Put them in `.env` as `VITE_GITHUB_CLIENT_ID` / `VITE_GITHUB_AUTH_RELAY`.

Users can also paste a client id + relay URL under *Settings → Sign in with GitHub — setup* to use a build that has
none baked in. The resulting token has the OAuth `repo` scope and is revocable at github.com → Settings →
Applications → Authorized OAuth Apps.

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
