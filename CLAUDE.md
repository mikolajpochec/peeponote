# peeponote — working rules

`main` deploys straight to https://mikolajpochec.github.io/peeponote/ and **real people use it**.

## Releasing
- Push to `main` only a **complete, tested feature**. Never push half-built work or "let's see if it deploys".
- Work on a branch (`git switch -c feat/<name>`), commit there as often as you like.
- Before merging: `bunx tsc -b`, `bun run build`, and drive the real flow in the browser (dev server: `bun run dev -- --port 5199`;
  for two-person flows use two origins, e.g. ports 5298 and 5297 — separate IndexedDB/localStorage per origin).
- Merge with a short title, push once. A hotfix for a live crash is the only exception: minimal, tested, immediately.

## Commits
- Title line only, plain words. No AI attribution trailers.
- The app's own commits are stamped `[peeponote] …` — don't imitate that in source commits.

## Testing notes
- **Never drive the user's own Chrome** (the claude-in-chrome MCP tabs) — they work there. Use a private, **headless**
  browser: `bun add playwright-core` in the scratchpad, `chromium.launchPersistentContext('<scratchpad>/profile',
  { channel: 'chrome', headless: true })`, against `bunx vite preview --port 5299` of a fresh `bun run build`
  (the dev server's StrictMode double-mount closes editors opened by synthetic double-clicks). A headed window pops up
  over the user's screen — don't.
- The stores are on `window.peeponote` (`workspace`, `review`, `settings` — zustand stores, `.getState()`), so a test
  can drive the app without importing modules. Seed `localStorage['peeponote-settings']` with a name/email and
  `onboarded: true` to skip onboarding; a killed Chrome (`pkill -9`) simulates a power cut.
- The dev tab on :5199 shares storage with the user's own dev tab: clean up test cards / use Discard afterwards.
- `cli/peepo.mjs` reads a workspace from the terminal (`tree`, `show`, `comments`, `reviews`…) — handy for checking data.
