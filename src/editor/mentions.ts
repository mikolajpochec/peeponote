import { autocompletion, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { keymap, tooltips } from '@codemirror/view'
import { listPeople, mentionToken } from '../review/people'
import { fuzzyFilter } from '../review/fuzzy'

/** `@` in any board text → fuzzy list of known people; picking one inserts `@Name` / `@[Full Name]` */
function mentionSource(ctx: CompletionContext): CompletionResult | null {
  const word = ctx.matchBefore(/(^|[^\p{L}\p{N}_])@[\p{L}\p{N}_ ]{0,30}/u)
  if (!word) return null
  const at = word.text.indexOf('@')
  const from = word.from + at
  const query = word.text.slice(at + 1)
  if (!ctx.explicit && query.length === 0 && word.to - from < 1) return null
  const people = fuzzyFilter(query, listPeople(), (p) => `${p.name} ${p.email}`).slice(0, 8)
  if (!people.length) return null
  return {
    from,
    to: word.to,
    filter: false,
    options: people.map((p) => ({
      label: `@${p.name}`,
      detail: p.email,
      apply: `${mentionToken(p)} `,
      type: 'variable',
    })),
    // no `validFor`: every keystroke re-runs the fuzzy search (with it, CodeMirror would keep the first list unfiltered)
  }
}

export const mentions = [
  autocompletion({ override: [mentionSource], icons: false, activateOnTyping: true, defaultKeymap: false }),
  // Enter/Tab/arrows pick from the list while it's open; the editor's own Enter binding runs when it isn't
  keymap.of(completionKeymap),
  // the list is rendered into <body>: cards clip and scale their content
  tooltips({ parent: document.body, position: 'fixed' }),
]
