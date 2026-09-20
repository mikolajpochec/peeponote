/** Tiny fuzzy matcher for pickers: subsequence match, accent/case-insensitive, higher = better; null = no match. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function fuzzyScore(query: string, text: string): number | null {
  const q = fold(query.trim())
  const t = fold(text)
  if (!q) return 0
  if (t.startsWith(q)) return 100 + q.length
  const at = t.indexOf(q)
  if (at >= 0) return 60 + (at === 0 || /\s/.test(t[at - 1]) ? 20 : 0)
  // subsequence: every query char in order, bonus for word starts
  let i = 0
  let score = 0
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) {
      score += j === 0 || /\s/.test(t[j - 1]) ? 5 : 1
      i++
    }
  }
  return i === q.length ? score : null
}

export function fuzzyFilter<T>(query: string, items: T[], text: (t: T) => string): T[] {
  return items
    .map((it) => ({ it, s: fuzzyScore(query, text(it)) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => (b.s as number) - (a.s as number))
    .map((x) => x.it)
}
