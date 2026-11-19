# peeponote — working rules

`main` deploys straight to https://mikolajpochec.github.io/peeponote/ and **real people use it**.

## Branches
Pull requests are optional. A finished, tested change may be committed and pushed straight to `main`; a branch and a
pull request are there for when they help (bigger work, something to look over first), not a requirement. Either way a
push to `main` is a release to real people, so the rules under **Releasing** apply to it in full.

- Work that takes more than one sitting still belongs on a branch (`feat/`, `fix/`, `ci/`, `chore/`, `docs/`), so
  `main` never holds half-built work.
- Commit titles show up in the history, so keep them plain.
- Several small repairs finished together may ship as one release, with one note each.

## Releasing
- Push to `main` only a **complete, tested feature**. Never push half-built work or "let's see if it deploys".
- Before pushing: `bunx tsc -b`, `bun run build`, and drive the real flow in the browser (dev server: `bun run dev -- --port 5199`;
  for two-person flows use two origins, e.g. ports 5298 and 5297 — separate IndexedDB/localStorage per origin).
- The version bump and the changelog entry belong in that same push (see **Versions**); run `bun scripts/release.ts`
  first, since CI only tags + publishes the release when they add up.
- **Ask before releasing.** When the work is finished and verified, say what the release contains and which version
  it would be, and wait for a yes. Never push or merge into `main` on your own initiative.

## Versions
`MAJOR.MINOR.PATCH` (e.g. `1.12.3`) lives in `src/version.ts` — the one source of truth; `package.json` mirrors it and
`bun scripts/changelog.ts` rewrites `CHANGELOG.md` from it. The app shows the newest entry by itself after an update,
so notes are written for the person using peeponote ("Pictures keep their shape"), never as commit titles.

- **PATCH** (`0.0.x`): the usual one. A fix, wording, performance, a layout repair, machinery like CI and this file,
  a small improvement to something that already works. Nothing new to learn.
- **MINOR** (`0.x.0`): a bigger feature. A new capability, or a visible change to how something already works.
- **MAJOR**: the repo format changes (files under the workspace move or change meaning and older clients would
  misread them), or the way people work changes enough to break their habits.

**Every push or merge into `main` bumps the version, without exception: at least the PATCH digit.** `main` deploys to real
users, so there is no such thing as a free merge: a typo fix, a CI change, a refactor, even an edit to this file goes
out as `0.0.x`. Nothing ever rides along with "the next release"; this *is* the next release. CI checks it on pull
requests (one whose version is already tagged is refused); on a direct push nothing stops you, so check it yourself.

**Default to PATCH.** When the choice between patch and minor is not obvious, it is a patch: most merges are repairs,
polish and machinery, and the version should stay calm. `0.x.0` is reserved for a bigger feature, something you would
announce in a sentence of its own ("Maths in your cards", "Your GitHub account is your account"). Don't inflate the
minor digit for a small improvement to something that already works.

Pick the bump **before** merging and put it in the feature's own commit: version + a new entry at the top of
`CHANGELOG` (date = the day it ships) + the `package.json` mirror + `bun scripts/changelog.ts`. `bun scripts/release.ts`
says whether those four agree; CI runs it on every pull request and on every push to `main`. Tagging and the GitHub
Release are **automatic** on `main` (`.github/workflows/release.yml`): never create a tag or a release by hand.

One release = one coherent thing you can describe in a sentence; two unrelated features ready at once are two releases,
so two branches and two bumps. Every release carries at least one note, written for the person using peeponote: when
the work is invisible to them, say that in one honest line ("Housekeeping: nothing changes on your boards") rather
than describing the commit.

## Who may do what
Identity is the **GitHub account behind the token** (`settings.github`, from `GET /user`): there is no peeponote
password any more and no second layer of roles. `src/git/permissions.ts` asks GitHub what this token may do with the
repo and the answer drives everything: `write` (collaborator) edits, saves, comments and reviews; `read` shows the
boards and nothing else; `locked` (private repo, no access) shows `LockedScreen` instead of the app. A workspace with
no remote, or one on another host, is always writable: that host enforces its own rules on push. The answer is
remembered per repo so going offline never locks anyone out.

Accounts live in `review/people/<login>.json`, written by their owner. Accounts from before 1.7 (password-derived
keys, named after an email) migrate the first time that person signs in: `adoptPasswordAccount` in
`src/store/review.ts` rewrites their own objects to carry the login and deletes the old files. Keep that path working
whenever the review model changes.

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
