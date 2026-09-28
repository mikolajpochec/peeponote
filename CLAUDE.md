# peeponote — working rules

`main` deploys straight to https://mikolajpochec.github.io/peeponote/ and **real people use it**.

## Releasing
- Push to `main` only a **complete, tested feature**. Never push half-built work or "let's see if it deploys".
- Work on a branch (`git switch -c feat/<name>`), commit there as often as you like.
- Before merging: `bunx tsc -b`, `bun run build`, and drive the real flow in the browser (dev server: `bun run dev -- --port 5199`;
  for two-person flows use two origins, e.g. ports 5298 and 5297 — separate IndexedDB/localStorage per origin).
- Merge with a short title, push once. A hotfix for a live crash is the only exception: minimal, tested, immediately.

## Versions
`MAJOR.MINOR.PATCH` (e.g. `1.12.3`) lives in `src/version.ts` — the one source of truth; `package.json` mirrors it and
`bun scripts/changelog.ts` rewrites `CHANGELOG.md` from it. The app shows the newest entry by itself after an update,
so notes are written for the person using peeponote ("Pictures keep their shape"), never as commit titles.

- **PATCH** — fixes, wording, performance, a layout repair. Nothing new to learn.
- **MINOR** — a new capability, or a visible change to how something already works.
- **MAJOR** — the repo format changes (files under the workspace move or change meaning and older clients would
  misread them), or the way people work changes enough to break their habits.

Every merge into `main` is a release, because `main` deploys to real users: pick the bump **before** merging and put
it in the feature's own commit — version + a new entry at the top of `CHANGELOG` (date = the day it ships) + the
`package.json` mirror + `bun scripts/changelog.ts`. One release = one coherent thing you can describe in a sentence;
two unrelated features ready at once are two releases. Source-only work (this file, tests, invisible refactors) does
not bump anything — it rides along with the next release.

## Commits
- Title line only, plain words. No AI attribution trailers.
- The app's own commits are stamped `[peeponote] …` — don't imitate that in source commits.

## Testing notes
- **Never drive the user's own Chrome** (the claude-in-chrome MCP tabs) — they work there. Use a private, **headless**
  browser: `bun add playwright-core` in the scratchpad, `chromium.launchPersistentContext('<scratchpad>/profile',
  { channel: 'chrome', headless: true })`, against `bunx vite preview --port 5299` of a fresh `bun run build`
  (the dev server's StrictMode double-mount closes editors opened by synthetic double-clicks). A headed window pops up
  over the user's screen — don't.
- Block the service worker in tests (`launchPersistentContext(…, { serviceWorkers: 'block' })`) — otherwise the PWA
  cache serves the *previous* build from the persistent profile and you test stale code.
- The stores are on `window.peeponote` (`workspace`, `review`, `settings` — zustand stores, `.getState()`), so a test
  can drive the app without importing modules. Seed `localStorage['peeponote-settings']` with a name/email and
  `onboarded: true` to skip onboarding; a killed Chrome (`pkill -9`) simulates a power cut.
- The dev tab on :5199 shares storage with the user's own dev tab: clean up test cards / use Discard afterwards.
- `cli/peepo.mjs` reads a workspace from the terminal (`tree`, `show`, `comments`, `reviews`…) — handy for checking data.
