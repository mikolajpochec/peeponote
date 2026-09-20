# peeponote 🐸

**→ [mikolajpochec.github.io/peeponote](https://mikolajpochec.github.io/peeponote/)**

Milanote-style boards where **Save = `git commit`** (and push, if a remote is set). Static web app + installable PWA, no backend.

- Infinite canvas, nested boards, connectors, styling, grouping & alignment, works on phones.
- Cards: text, markdown notes, to-dos, links, sub-boards and **any file** with a preview (images, textures, audio, video, 3D models, fonts, code) and a download button.
- Repo lives in the browser (IndexedDB) or in a real folder on disk. Plain JSON in `boards/`, files in `assets/` — diffs and merges like any repo.
- Remotes: GitHub via its REST API (no proxy) or any git host over HTTP through a CORS proxy (`proxy/worker.ts`). Sync does fast-forward, push, or a card-level merge when histories diverge.
- Auth: a personal access token kept in your browser only — the app walks you through creating one.

## Develop

```sh
bun install && bun dev        # http://localhost:5173
bun run build                 # → dist/, deployed to GitHub Pages on push to main
bun scripts/fetch-peepos.ts   # refresh peepo emotes from 7TV
```

Peepos from [7TV](https://7tv.app) · git in the browser by [isomorphic-git](https://isomorphic-git.org)
