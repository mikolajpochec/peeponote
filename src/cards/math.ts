/**
 * LaTeX in cards: `$x^2$` inline and `$$…$$` on its own lines, rendered by KaTeX wherever markdown is shown
 * (notes, text, to-do rows, story fields, shape labels, review comments).
 *
 * Boards are full of prices, so "it costs $5 and $10" must stay money: `protectCurrency` escapes a pair of
 * dollars whose contents read like an amount and hold nothing a formula needs. Everything else, including
 * `$5x^2$`, is still maths. A dollar you want to keep no matter what is `\$`.
 */

import { useEffect, useState } from 'react'
import type { PluggableList } from 'unified'

/** cheap test: no dollar sign, no maths, so KaTeX is never downloaded for an ordinary board */
export const hasMath = (text: string) => text.includes('$')

export interface MathPlugins {
  remark: PluggableList
  rehype: PluggableList
}

let loaded: MathPlugins | null = null
let pending: Promise<MathPlugins> | null = null
const waiting = new Set<() => void>()

function load(): Promise<MathPlugins> {
  pending ??= Promise.all([import('remark-math'), import('rehype-katex'), import('katex/dist/katex.min.css')]).then(([remarkMath, rehypeKatex]) => {
    // errors stay in the card as red source text instead of blowing up the render
    loaded = { remark: [remarkMath.default], rehype: [[rehypeKatex.default, { errorColor: '#ff9a9a', strict: false }]] }
    for (const w of [...waiting]) w()
    return loaded
  })
  return pending
}

/** The maths plugins for this text, once they have arrived; `null` means "render it as plain markdown". */
export function useMath(text: string): MathPlugins | null {
  const want = hasMath(text)
  const [, bump] = useState(0)
  useEffect(() => {
    if (!want || loaded) return
    const w = () => bump((n) => n + 1)
    waiting.add(w)
    void load()
    return () => void waiting.delete(w)
  }, [want])
  return want ? loaded : null
}

/** "$5 and $", "$20 bill $" — an amount and plain words, with nothing a formula would need */
const MONEY = /^\d[\d.,]*(\s|$)/
const FORMULA = /[\\^_{}=+*/<>]/

function protectLine(line: string): string {
  if (!line.includes('$')) return line
  // code spans are literal text: only touch what lives outside them (odd slots are the spans themselves)
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\$([^$\n]+)\$/g, (m, body: string) => (MONEY.test(body) && !FORMULA.test(body) ? `\\$${body}\\$` : m))))
    .join('')
}

/** keep money out of the maths parser; fenced code blocks are left exactly as they are */
export function protectCurrency(text: string): string {
  if (!text.includes('$')) return text
  let fenced = false
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced
        return line
      }
      return fenced ? line : protectLine(line)
    })
    .join('\n')
}

/** KaTeX's own markup, so inline cards (which allow a whitelist of tags) can show a formula */
export const MATH_TAGS = [
  'span', 'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mspace', 'msup', 'msub', 'msubsup',
  'mfrac', 'msqrt', 'mroot', 'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mpadded', 'mphantom', 'mstyle',
  'menclose', 'merror', 'mmultiscripts', 'mprescripts', 'none',
]
