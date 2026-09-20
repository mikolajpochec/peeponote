/**
 * Obsidian-style live preview for CodeMirror: markdown renders as formatted text, and the raw
 * markers (`**`, `_`, `~~`, backticks, `[…](url)`, `# `) only appear on the line / span the caret is in.
 */
import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

const marks = {
  strong: Decoration.mark({ class: 'cm-md-strong' }),
  em: Decoration.mark({ class: 'cm-md-em' }),
  strike: Decoration.mark({ class: 'cm-md-strike' }),
  code: Decoration.mark({ class: 'cm-md-code' }),
  link: Decoration.mark({ class: 'cm-md-link' }),
  h1: Decoration.mark({ class: 'cm-md-h1' }),
  h2: Decoration.mark({ class: 'cm-md-h2' }),
  h3: Decoration.mark({ class: 'cm-md-h3' }),
  quote: Decoration.mark({ class: 'cm-md-quote' }),
}
const hide = Decoration.replace({})

/** a node is "active" when the selection touches it — then its syntax stays visible */
function touches(view: EditorView, from: number, to: number): boolean {
  for (const r of view.state.selection.ranges) if (r.from <= to && r.to >= from) return true
  return false
}

function build(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const tree = syntaxTree(view.state)
  const doc = view.state.doc

  const hideChildren = (node: SyntaxNode, names: string[]) => {
    for (let c = node.firstChild; c; c = c.nextSibling) if (names.includes(c.name)) ranges.push(hide.range(c.from, c.to))
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (n) => {
        const active = touches(view, n.from, n.to)
        switch (n.name) {
          case 'StrongEmphasis':
            ranges.push(marks.strong.range(n.from, n.to))
            if (!active) hideChildren(n.node, ['EmphasisMark'])
            break
          case 'Emphasis':
            ranges.push(marks.em.range(n.from, n.to))
            if (!active) hideChildren(n.node, ['EmphasisMark'])
            break
          case 'Strikethrough':
            ranges.push(marks.strike.range(n.from, n.to))
            if (!active) hideChildren(n.node, ['StrikethroughMark'])
            break
          case 'InlineCode':
            ranges.push(marks.code.range(n.from, n.to))
            if (!active) hideChildren(n.node, ['CodeMark'])
            break
          case 'Link': {
            ranges.push(marks.link.range(n.from, n.to))
            if (!active) {
              // keep only the label: hide "[", "](", the URL and ")"
              const kids: SyntaxNode[] = []
              for (let c = n.node.firstChild; c; c = c.nextSibling) kids.push(c)
              const label = kids.find((k) => k.name === 'LinkLabel')
              const url = kids.find((k) => k.name === 'URL')
              const openMark = kids.find((k) => k.name === 'LinkMark')
              if (openMark && !label) ranges.push(hide.range(openMark.from, openMark.to))
              // everything from the closing "]" to the end is address syntax
              const closeMark = kids.filter((k) => k.name === 'LinkMark')[1]
              if (closeMark) ranges.push(hide.range(closeMark.from, n.to))
              else if (url) ranges.push(hide.range(url.from, n.to))
            }
            break
          }
          case 'ATXHeading1':
          case 'ATXHeading2':
          case 'ATXHeading3':
          case 'ATXHeading4':
          case 'ATXHeading5':
          case 'ATXHeading6': {
            const level = Number(n.name.slice(-1))
            const m = level === 1 ? marks.h1 : level === 2 ? marks.h2 : marks.h3
            ranges.push(m.range(n.from, n.to))
            if (!active) {
              // "# " incl. the space
              for (let c = n.node.firstChild; c; c = c.nextSibling) {
                if (c.name === 'HeaderMark') {
                  const end = doc.sliceString(c.to, c.to + 1) === ' ' ? c.to + 1 : c.to
                  ranges.push(hide.range(c.from, end))
                }
              }
            }
            break
          }
          case 'Blockquote':
            ranges.push(marks.quote.range(n.from, n.to))
            if (!active) hideChildren(n.node, ['QuoteMark'])
            break
        }
      },
    })
  }
  return Decoration.set(ranges, true) // sorts; marks and replacements may overlap
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)
