# peeponote — working rules

`main` deploys straight to https://mikolajpochec.github.io/peeponote/ and **real people use it**.

## Branches
**Every** change lives on its own branch and reaches `main` through a pull request. Never commit on `main`, never push
to it directly: it is protected on GitHub, and a merge there is a release to real people.

- `git switch -c <kind>/<short-name>` first, before the first edit. `feat/` a new capability, `fix/` a bug,
  `ci/` or `chore/` the machinery around the app, `docs/` writing.
- Commit on the branch as often as you like; the title is the one that will show up in the history, so keep it plain.
- One branch = one coherent thing = one release. Two unrelated fixes are two branches, even on the same afternoon.
- A hotfix for a live crash takes the same path, just quickly: branch, minimal change, test, PR.

## Releasing
- Push to `main` only a **complete, tested feature**. Never push half-built work or "let's see if it deploys".
- Before opening the PR: `bunx tsc -b`, `bun run build`, and drive the real flow in the browser (dev server: `bun run dev -- --port 5199`;
  for two-person flows use two origins, e.g. ports 5298 and 5297 — separate IndexedDB/localStorage per origin).
- The version bump and the changelog entry belong in that same PR (see **Versions**); CI refuses a PR where they
  don't add up, and tags + publishes the release by itself once it is merged.
- **Ask before releasing.** When the work is finished and verified, say what the release contains and which version
  it would be, and wait for a yes. Never merge a PR into `main` on your own initiative.

## Versions
`MAJOR.MINOR.PATCH` (e.g. `1.12.3`) lives in `src/version.ts` — the one source of truth; `package.json` mirrors it and
`bun scripts/changelog.ts` rewrites `CHANGELOG.md` from it. The app shows the newest entry by itself after an update,
so notes are written for the person using peeponote ("Pictures keep their shape"), never as commit titles.

- **PATCH** (`0.0.x`): the usual one. A fix, wording, performance, a layout repair, machinery like CI and this file,
  a small improvement to something that already works. Nothing new to learn.
- **MINOR** (`0.x.0`): a bigger feature. A new capability, or a visible change to how something already works.
- **MAJOR**: the repo format changes (files under the workspace move or change meaning and older clients would
  misread them), or the way people work changes enough to break their habits.

**Every merge into `main` bumps the version, without exception: at least the PATCH digit.** `main` deploys to real
users, so there is no such thing as a free merge: a typo fix, a CI change, a refactor, even an edit to this file goes
out as `0.0.x`. Nothing ever rides along with "the next release"; this *is* the next release. CI enforces it: a pull
request whose version is already tagged is refused.

**Default to PATCH.** When the choice between patch and minor is not obvious, it is a patch: most merges are repairs,
polish and machinery, and the version should stay calm. `0.x.0` is reserved for a bigger feature, something you would
announce in a sentence of its own ("Maths in your cards", "Your GitHub account is your account"). Don't inflate the
minor digit for a small improvement to something that already works.

Pick the bump **before** merging and put it in the feature's own commit: version + a new entry at the top of
`CHANGELOG` (date = the day it ships) + the `package.json` mirror + `bun scripts/changelog.ts`. `bun scripts/release.ts`
says whether those four agree, and CI runs it on every pull request. Tagging and the GitHub Release are **automatic**
on merge (`.github/workflows/release.yml`): never create a tag or a release by hand.

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
