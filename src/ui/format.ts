import type { EditorHandle, TextField } from '../store/editing'

/**
 * Markdown formatting on a textarea selection. Writes through `setRangeText` and fires an `input`
 * event so React's controlled value updates as if the user typed.
 */

/** inputs report null selections when unfocused; treat that as "at the end" */
function range(ta: TextField): { s: number; e: number; value: string } {
  const value = ta.value
  return { s: ta.selectionStart ?? value.length, e: ta.selectionEnd ?? value.length, value }
}

function commit(ta: TextField, text: string, start: number, end: number, selStart: number, selEnd: number) {
  ta.focus()
  ta.setRangeText(text, start, end, 'preserve')
  ta.setSelectionRange(selStart, selEnd)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Wrap the selection in `before`…`after`; if it is already wrapped, unwrap it. Empty selection wraps `placeholder`. */
export function toggleWrap(ta: TextField, before: string, after = before, placeholder = 'text') {
  const { s, e, value } = range(ta)
  const sel = value.slice(s, e)
  // wrapped inside the selection: **bold**
  if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) {
    const inner = sel.slice(before.length, sel.length - after.length)
    commit(ta, inner, s, e, s, s + inner.length)
    return
  }
  // wrapped just outside the selection: **|bold|**
  if (value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after) {
    commit(ta, sel, s - before.length, e + after.length, s - before.length, s - before.length + sel.length)
    return
  }
  const inner = sel || placeholder
  commit(ta, `${before}${inner}${after}`, s, e, s + before.length, s + before.length + inner.length)
}

/** Insert a markdown link for the selection (or a placeholder text) pointing at `url`. */
export function insertLink(ta: TextField, url: string, fallbackText = 'link') {
  const { s, e, value } = range(ta)
  const text = value.slice(s, e) || fallbackText
  const md = `[${text}](${url})`
  // leave the visible text selected so the user can keep typing over it
  commit(ta, md, s, e, s + 1, s + 1 + text.length)
}

/** Prefix every selected line (headings, lists, quotes); toggles when all lines already have it. */
export function toggleLinePrefix(ta: TextField, prefix: string) {
  const { s, e, value } = range(ta)
  const lineStart = value.lastIndexOf('\n', s - 1) + 1
  const lineEndIdx = value.indexOf('\n', e)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const lines = value.slice(lineStart, lineEnd).split('\n')
  const all = lines.every((l) => l.startsWith(prefix))
  const out = lines.map((l) => (all ? l.slice(prefix.length) : l.startsWith(prefix) ? l : prefix + l)).join('\n')
  commit(ta, out, lineStart, lineEnd, lineStart, lineStart + out.length)
}

/** EditorHandle over a plain <textarea> / <input> */
export function fieldHandle(el: TextField): EditorHandle {
  return {
    key: el,
    wrap: (b, a, ph) => toggleWrap(el, b, a, ph),
    link: (url, text) => insertLink(el, url, text),
    linePrefix: (p) => toggleLinePrefix(el, p),
    hasSelection: () => (el.selectionStart ?? 0) !== (el.selectionEnd ?? 0),
    focus: () => el.focus(),
  }
}
