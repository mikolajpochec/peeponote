# peeponote 🐸

**→ [mikolajpochec.github.io/peeponote](https://mikolajpochec.github.io/peeponote/)**

Visual boards on an infinite canvas where **Save = `git commit`** (and push, if a remote is set). Static web app + installable PWA, no backend.

- Infinite canvas, nested boards, connectors, styling, grouping & alignment, works on phones.
- Cards: text, markdown notes, to-dos, links, sub-boards and **any file** with a preview (images, textures, audio, video, 3D models, fonts, code) and a download button.
- Repo lives in the browser (IndexedDB) or in a real folder on disk. Plain JSON in `boards/`, files in `assets/` — diffs and merges like any repo. Works inside a monorepo: the workspace is wherever `peeponote.json` sits (root or any subfolder, found automatically); a fresh workspace in a non-empty repo goes into `peeponote/`.
- Remotes: GitHub via its REST API (no proxy) or any git host over HTTP through a CORS proxy (`proxy/worker.ts`). Save commits, pulls what others pushed, merges card-by-card and pushes — it only asks when the same card was edited on both sides. Every 15 s the app checks the remote; commits that don't touch what you're editing slide in under your unsaved edits. Commits made by the app are titled `[peeponote] …` and carry a `Co-Authored-By: peeponote` trailer, so they're easy to spot in a shared repo.
- Several repos: Settings → Sync → **Change repo…** takes a URL + token, checks the access on the spot and only then opens it (each repo keeps its own local clone and token; previous repos are one click away).
- Updates: the installed app checks GitHub Pages for a new build every minute and switches over by itself once your work is saved (or right away via the toast).
- Auth: a personal access token kept in your browser only — the app walks you through creating one. Collaborators on someone else's repo need a *classic* token with `repo` scope (fine-grained tokens can only target repos you or your org own).
- Text takes inline markdown everywhere (`**bold**`, `_italic_`, `[links](…)`) with a selection toolbar (⌘B ⌘I ⌘K). Links can point at the web or into the project: `peepo://Home/Styl-Graficzny/Obrazki/image1` (boards by name or slug, then a card slug — set slugs via *PPM → Properties*).
- Story planning cards under **📖 Story**: dialogue nodes (what's said + choices — drag an arrow from a choice to the next node), events, quests, scenes. Every field and choice is an arrow anchor; fields link to each other with `peepo://` paths.

## Develop

```sh
bun install && bun dev        # http://localhost:5173
bun run build                 # → dist/, deployed to GitHub Pages on push to main
bun scripts/fetch-peepos.ts   # refresh peepo emotes from 7TV
```

Peepos from [7TV](https://7tv.app) · git in the browser by [isomorphic-git](https://isomorphic-git.org)
