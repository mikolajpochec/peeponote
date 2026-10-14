/**
 * Shortcut labels that match the keyboard in front of you. Every handler in the app already accepts both
 * Ctrl and ⌘ (`e.metaKey || e.ctrlKey`), but the labels were written in Mac notation, so Windows and Linux
 * users saw ⌘S and reasonably concluded there was no shortcut for them (issue #1).
 *
 * Shortcuts are still written in Mac notation at the call site, because that is the compact one; `kbd` turns
 * "⇧⌘Z" into "Ctrl+Shift+Z" off Apple hardware.
 */
const APPLE = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent + ' ' + (navigator.platform ?? ''))

/** ⌘ on Apple keyboards, Ctrl everywhere else: the modifier peeponote's own shortcuts hang off */
export const MOD = APPLE ? '⌘' : 'Ctrl'

const KEYS: Record<string, string> = { '⏎': 'Enter', '⌫': 'Backspace', '⎋': 'Esc' }

/** "⇧⌘Z" → "⇧⌘Z" on a Mac, "Ctrl+Shift+Z" on Windows and Linux */
export function kbd(combo: string): string {
  if (APPLE) return combo
  const mods: string[] = []
  let key = ''
  for (const ch of combo) {
    if (ch === '⌘' || ch === '⌃') mods.push('Ctrl')
    else if (ch === '⇧') mods.push('Shift')
    else if (ch === '⌥') mods.push('Alt')
    else key += KEYS[ch] ?? ch
  }
  const ordered = ['Ctrl', 'Shift', 'Alt'].filter((m) => mods.includes(m))
  return [...ordered, key].filter(Boolean).join('+')
}
