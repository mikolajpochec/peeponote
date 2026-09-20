import { useEffect, useLayoutEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { livePreview } from './livePreview'
import { useEditing, type EditorHandle } from '../store/editing'

export interface MdEditorProps {
  value: string
  onChange: (v: string) => void
  /** editing is over (blur, Esc, ⌘⏎) */
  onDone: () => void
  boardId: string
  cardId: string
  mode: 'block' | 'inline'
  placeholder?: string
  className?: string
  /** Enter finishes editing instead of inserting a newline (single-line fields) */
  singleLine?: boolean
  autoFocus?: boolean
  /** select everything on focus (titles) */
  selectAll?: boolean
  /** the EditorView exists (lazy chunk loaded and mounted) */
  onReady?: () => void
}

function wrapSel(view: EditorView, before: string, after = before, placeholder = 'text') {
  const { from, to } = view.state.selection.main
  const sel = view.state.sliceDoc(from, to)
  const doc = view.state.doc
  if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) {
    const inner = sel.slice(before.length, sel.length - after.length)
    view.dispatch({ changes: { from, to, insert: inner }, selection: { anchor: from, head: from + inner.length } })
  } else if (doc.sliceString(from - before.length, from) === before && doc.sliceString(to, to + after.length) === after) {
    view.dispatch({ changes: { from: from - before.length, to: to + after.length, insert: sel }, selection: { anchor: from - before.length, head: from - before.length + sel.length } })
  } else {
    const inner = sel || placeholder
    view.dispatch({ changes: { from, to, insert: `${before}${inner}${after}` }, selection: { anchor: from + before.length, head: from + before.length + inner.length } })
  }
  view.focus()
}

function linePrefix(view: EditorView, prefix: string) {
  const { from, to } = view.state.selection.main
  const first = view.state.doc.lineAt(from)
  const last = view.state.doc.lineAt(to)
  const lines = []
  for (let n = first.number; n <= last.number; n++) lines.push(view.state.doc.line(n))
  const all = lines.every((l) => l.text.startsWith(prefix))
  view.dispatch({
    changes: lines.map((l) => (all ? { from: l.from, to: l.from + prefix.length, insert: '' } : l.text.startsWith(prefix) ? { from: l.from, insert: '' } : { from: l.from, insert: prefix })),
  })
  view.focus()
}

/** CodeMirror-based markdown editor with live preview; registers itself with the format bar. */
export function MdEditor({ value, onChange, onDone, boardId, cardId, mode, placeholder, className = '', singleLine, autoFocus = true, selectAll, onReady }: MdEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const latest = useRef({ onChange, onDone, onReady })
  latest.current = { onChange, onDone, onReady }

  useLayoutEffect(() => {
    const el = host.current!
    const done = (v: EditorView) => {
      if (useEditing.getState().hold) return false
      useEditing.getState().end(v.dom)
      latest.current.onDone()
      return true
    }
    const ext: Extension[] = [
      history(),
      markdown(),
      livePreview,
      EditorView.lineWrapping,
      cmPlaceholder(placeholder ?? ''),
      keymap.of([
        { key: 'Escape', run: (v) => done(v) },
        { key: 'Mod-Enter', run: (v) => done(v) },
        ...(singleLine ? [{ key: 'Enter', run: (v: EditorView) => done(v) }] : []),
        // formatting shortcuts live here so they win over browser defaults
        { key: 'Mod-b', run: (v) => (wrapSel(v, '**'), true) },
        { key: 'Mod-i', run: (v) => (wrapSel(v, '_'), true) },
        { key: 'Mod-k', run: () => (useEditing.getState().askLink(), true) },
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) latest.current.onChange(u.state.doc.toString())
      }),
      EditorView.domEventHandlers({
        blur: (_e, v) => {
          // let a click inside the format bar / picker settle first
          setTimeout(() => {
            if (!v.hasFocus) done(v)
          }, 0)
        },
      }),
    ]
    const v = new EditorView({ state: EditorState.create({ doc: value, extensions: ext }), parent: el })
    view.current = v
    const handle: EditorHandle = {
      key: v.dom,
      wrap: (b, a, ph) => wrapSel(v, b, a, ph),
      link: (url, text) => {
        const { from, to } = v.state.selection.main
        const label = v.state.sliceDoc(from, to) || text || 'link'
        v.dispatch({ changes: { from, to, insert: `[${label}](${url})` }, selection: { anchor: from + 1, head: from + 1 + label.length } })
        v.focus()
      },
      linePrefix: (p) => linePrefix(v, p),
      hasSelection: () => !v.state.selection.main.empty,
      focus: () => v.focus(),
    }
    useEditing.getState().begin(boardId, cardId, handle, mode)
    latest.current.onReady?.()
    if (autoFocus) {
      v.focus()
      if (selectAll) v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } })
      else v.dispatch({ selection: { anchor: v.state.doc.length } })
    }
    return () => {
      useEditing.getState().end(v.dom, true)
      v.destroy()
      view.current = null
    }
    // the editor is created once per mount; value updates are pushed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // external value change (e.g. format bar on a plain field elsewhere) → sync without losing the caret
  useEffect(() => {
    const v = view.current
    if (!v) return
    const cur = v.state.doc.toString()
    if (cur !== value) v.dispatch({ changes: { from: 0, to: cur.length, insert: value } })
  }, [value])

  return <div ref={host} data-nodrag className={`md-editor ${className}`} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} />
}
