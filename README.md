<p align="center"><img src="public/icon-512.png" width="112" alt=""></p>

<h1 align="center">peeponote</h1>

<p align="center"><b>Visual boards on an infinite canvas where Save = <code>git commit</code>.</b><br>
Your repo is the backend: no server, no database, just a static PWA.</p>

<p align="center">
  <a href="https://mikolajpochec.github.io/peeponote/"><b>▶ Open peeponote</b></a> &nbsp;·&nbsp;
  <a href="CHANGELOG.md">What's new</a> &nbsp;·&nbsp;
  <a href="#develop">Develop</a>
</p>

<p align="center">
  <a href="https://github.com/mikolajpochec/peeponote/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/mikolajpochec/peeponote?style=flat-square&color=4caf50"></a>
  <img alt="PWA" src="https://img.shields.io/badge/PWA-installable-5a0fc8?style=flat-square">
  <img alt="No backend" src="https://img.shields.io/badge/backend-your_git_repo-f05032?style=flat-square">
  <a href="https://github.com/mikolajpochec/peeponote/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/mikolajpochec/peeponote?style=flat-square&color=d4ff4f"></a>
</p>

<p align="center"><img src="docs/canvas.webp" width="900" alt="Notes, to-dos, links, nested boards and arrows on an infinite canvas"></p>

## What it does

- **Put anything on the canvas.** Text, markdown, to-dos, links, shapes, nested boards and any file
  with a live preview (images, audio, video, 3D models, fonts, code). Connect them with arrows.
  Works on phones too.
- **It's all git.** Boards are plain JSON in `boards/`, files go in `assets/`. Diff, branch and
  merge them, in any repo, even a monorepo subfolder.
- **Save is a commit.** Connect a GitHub repo (or any git host via the CORS proxy) and Save
  commits, pulls, merges card by card and pushes. It only asks when two people edited the same
  card, and unsaved typing survives a crash.
- **Review on the board.** Ask for a review, leave comment bubbles that point at cards, approve
  or request changes and `@mention` people. Reviews are files in the repo and notifications come
  straight from it.
- **Plugins for your kind of work.** **Story** plans scenes, quests and dialogue with choices;
  **Code** draws flowcharts with decisions, loops and labelled lines.
- **Reads well for Claude and the terminal.** `cli/peepo.mjs` prints boards as markdown (`tree`,
  `show`, `search`, `graph --mermaid`), and `cli/SKILL.md` makes it a Claude Code skill.

<table>
  <tr>
    <td width="33%"><img src="docs/review.webp" alt="Review mode: a request, comment bubbles pointing at cards, a verdict"></td>
    <td width="33%"><img src="docs/notifications.webp" alt="Notifications: requests, verdicts, replies and mentions"></td>
    <td width="33%"><img src="docs/story.webp" alt="Story planning: scenes, quests, dialogue nodes with choices"></td>
  </tr>
  <tr>
    <td align="center"><b>Review</b> in the repo</td>
    <td align="center"><b>Notifications</b> from git</td>
    <td align="center"><b>Story</b> planning</td>
  </tr>
</table>

## Develop

```sh
bun install && bun dev        # http://localhost:5173
bun run build                 # → dist/, deployed to GitHub Pages on push to main
bun scripts/fetch-peepos.ts   # refresh peepo emotes from 7TV
```

Peepos from [7TV](https://7tv.app) · git in the browser by [isomorphic-git](https://isomorphic-git.org)
