import { create } from 'zustand'

export type TextField = HTMLTextAreaElement | HTMLInputElement

/** Which card's textarea has focus right now — the FormatBar attaches to it. */
interface EditingState {
  cardId: string | null
  boardId: string | null
  /** full markdown (notes) or inline-only (titles, text, labels, fields) */
  mode: 'block' | 'inline' | null
  el: TextField | null
  /** true while a popover (link picker) has focus: fields must not commit/close on that blur */
  hold: boolean
  setHold: (hold: boolean) => void
  begin: (boardId: string, cardId: string, el: TextField, mode: 'block' | 'inline') => void
  end: (el: TextField) => void
}

export const useEditing = create<EditingState>((set, get) => ({
  cardId: null,
  boardId: null,
  mode: null,
  el: null,
  hold: false,
  setHold: (hold) => set({ hold }),
  begin: (boardId, cardId, el, mode) => set({ boardId, cardId, el, mode }),
  // only the textarea that registered may clear the state (blur of an old one after a new focus must not)
  end: (el) => {
    if (get().hold) return
    if (get().el === el) set({ cardId: null, boardId: null, el: null, mode: null })
  },
}))
