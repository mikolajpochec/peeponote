import { create } from 'zustand'

export type TextField = HTMLTextAreaElement | HTMLInputElement

/** What the format bar needs from whatever is being edited (CodeMirror editor or a plain field). */
export interface EditorHandle {
  /** wrap / unwrap the selection in markers (`**`, `_`, `~~`, `` ` ``) */
  wrap: (before: string, after?: string, placeholder?: string) => void
  /** `[text](url)` for the selection (or `fallbackText`) */
  link: (url: string, fallbackText?: string) => void
  /** toggle a line prefix (`# `, `- `, `> `) on the selected lines */
  linePrefix: (prefix: string) => void
  hasSelection: () => boolean
  focus: () => void
  /** identity for `end()` — the DOM element hosting the editor */
  key: object
}

interface EditingState {
  cardId: string | null
  boardId: string | null
  /** full markdown (notes) or inline-only (titles, text, labels, fields) */
  mode: 'block' | 'inline' | null
  handle: EditorHandle | null
  /** true while a popover (link picker) has focus: fields must not commit/close on that blur */
  hold: boolean
  setHold: (hold: boolean) => void
  /** bumped by ⌘K inside an editor → the format bar opens its link picker */
  linkRequest: number
  askLink: () => void
  begin: (boardId: string, cardId: string, handle: EditorHandle, mode: 'block' | 'inline') => void
  /** `force` ignores `hold` — used when the editor unmounts, so a stuck hold can never leave the bar hanging */
  end: (key: object, force?: boolean) => void
}

export const useEditing = create<EditingState>((set, get) => ({
  cardId: null,
  boardId: null,
  mode: null,
  handle: null,
  hold: false,
  setHold: (hold) => set({ hold }),
  linkRequest: 0,
  askLink: () => set((s) => ({ linkRequest: s.linkRequest + 1 })),
  begin: (boardId, cardId, handle, mode) => set({ boardId, cardId, handle, mode, hold: false }),
  // only the editor that registered may clear the state (blur of an old one after a new focus must not)
  end: (key, force = false) => {
    if (get().hold && !force) return
    if (get().handle?.key === key) set({ cardId: null, boardId: null, handle: null, mode: null, hold: false })
  },
}))
