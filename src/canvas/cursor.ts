/** Force a cursor for the whole page during a drag (the captured element's cursor doesn't follow the pointer). */
export function setGlobalCursor(cursor: string | null) {
  document.body.style.cursor = cursor ?? ''
}
