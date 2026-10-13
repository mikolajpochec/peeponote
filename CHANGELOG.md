# Changelog

Versions are `MAJOR.MINOR.PATCH`: major = the repo format or the way you work changes, minor = a new feature,
patch = fixes and polish. Written from `src/version.ts` by `bun scripts/changelog.ts`.

## 1.5.1 — Tidier on phones
*2026-10-13*

- The bottom toolbar fits the screen with every tool in view, File included, so it no longer slides sideways.
- The style and formatting bars wrap onto two rows instead of running off both edges of the screen.
- Settings shows all its tabs at once, the boards drawer is wider so names fit, and short board names like "Home" are no longer clipped in the top bar.
- Card properties stack their labels above the values on small phones.

## 1.5.0 — Better on phones
*2026-10-13*

- A board you open for the first time on a phone is zoomed so its cards fit the screen width, instead of running off the right edge.
- Shape and Story in the bottom toolbar open their list of variants again on phones.
- Turn your phone sideways and you keep the phone layout: toolbar at the bottom, boards in a drawer.
- While you type in a card, the toolbar steps aside so the keyboard has room.
- Settings fits a phone: the tabs scroll sideways and desktop keyboard shortcuts are no longer listed on touch screens.

## 1.4.0 — View only, for looking without touching
*2026-10-13*

- Tap 🔒 in the top bar (or ⋯ → View only, or ⇧⌘E) and your boards can be scrolled, zoomed and opened but not changed: a stray tap, drag or key press edits nothing.
- The blue View only button stays in the top bar while it is on; tap it again to go back to editing.
- It is kept in this browser, so a phone you only read on can stay locked.

## 1.3.0 — Maths in your cards
*2026-10-12*

- Write $E = mc^2$ in a note, a text card, a to-do row, a story field or a review comment and it is drawn as maths.
- For a centred formula of its own, put $$ on the line above and below it.
- Prices are still prices: "it costs $5 and $10" is left alone, and a backslash before a dollar sign always keeps it literal.
- The maths engine is only fetched by a board that actually holds a formula, so everything else opens as quickly as before.

## 1.2.0 — Themes, with or without frogs
*2026-10-12*

- Three more themes in Settings → Look: Slate, Plum and Mocha, next to Dark and Peepo.
- The mascots can be turned off there as well. Every peepo becomes a quiet line icon that means the same thing, and the frog disappears from the palette and the menus.
- Both are personal and kept in this browser, so your boards look the same to everyone else.

## 1.1.0 — Setting up takes one paste
*2026-10-12*

- Three screens instead of five: say hello, paste a GitHub key, pick the repo your boards live in.
- The key page opens with the right box already ticked, and the key is checked the moment you paste it; your name and email come from GitHub, so there is nothing to type.
- Your repos are listed for you, and a new private one can be made right there.
- peeponote asks for a classic GitHub key now. Unlike the fine-grained kind, it also works with a repo a teammate shared with you.
- You can still skip GitHub and keep the boards in this browser.

## 1.0.0 — First stable version
*2026-09-28*

- Released the first stable version
