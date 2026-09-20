---
name: peeponote-boards
description: Read the project's peeponote design boards (story, dialogue trees, quests, lore, to-dos) from the terminal. Use whenever a task refers to "the board", the story/lore designed in peeponote, a peepo:// link, or when implementing something that was planned on the boards.
---

# peeponote boards

The design lives in a peeponote workspace inside this repo (a folder with `peeponote.json` + `boards/*.json`,
usually `board/`). Never read those JSON files raw — use the CLI next to this file; it resolves `peepo://` links,
follows arrows between cards, and prints boards as markdown.

```bash
node .claude/skills/peeponote-boards/peepo.mjs tree                  # all boards, with their peepo:// paths
node .claude/skills/peeponote-boards/peepo.mjs show <target>         # a board: cards grouped, story nodes with fields, arrows, sub-boards
node .claude/skills/peeponote-boards/peepo.mjs show <target> --full  # don't truncate long notes
node .claude/skills/peeponote-boards/peepo.mjs card <target>         # one card in full
node .claude/skills/peeponote-boards/peepo.mjs search <words…>       # full text over every board → hits with addresses
node .claude/skills/peeponote-boards/peepo.mjs graph <target>        # story / dialogue flow (entry points, choice → next node); add --mermaid for a diagram
node .claude/skills/peeponote-boards/peepo.mjs json <target>         # raw JSON when you need a field the views don't show
```

`<target>` is a `peepo://Home/Path/Board` or `peepo://…/Board/card` address (as printed by every command and as used in
links inside cards), or just a board/card name, slug or id when unique. Run from anywhere in the repo.

## How the boards map to the game

- **Boards** are topics (Lore, Postacie, Historia, …); sub-boards nest. Start with `tree`, then `show` the relevant board.
- **Story cards** (`story/dialogue`, `story/event`, `story/quest`, `story/scene`) are the planned content. A *dialogue*
  node has `speaker`, `text` and **choices**; each choice's arrow (`→`) points at the next node — `graph` prints the whole
  tree. `(open end)` means the designer hasn't connected that choice yet — say so instead of inventing a continuation.
- **Quests** have `giver`, `objective`, `steps`, `reward`, `failure`; fields may contain `peepo://` links to other cards —
  follow them with `card`.
- **Text/notes** hold lore and decisions; **to-dos** are the designer's open items (don't treat them as done).
- Cards show in reading order (top→bottom, left→right). Positions themselves carry no meaning.

## Rules

- Quote the board as the source of truth for names, lore and dialogue lines; when the boards contradict the code, flag it.
- When something needed is missing on the boards, say which board/card should hold it (`peepo://…`) rather than guessing.
- Do not edit the board JSON files by hand — they are written by the peeponote app; suggest changes to the designer instead.
