/** CHANGELOG.md from src/version.ts, so the file on GitHub and the dialog in the app never drift apart. */
import { writeFileSync } from 'node:fs'
import { CHANGELOG } from '../src/version'

const md = [
  '# Changelog',
  '',
  'Versions are `MAJOR.MINOR.PATCH`: major = the repo format or the way you work changes, minor = a new feature,',
  'patch = fixes and polish. Written from `src/version.ts` by `bun scripts/changelog.ts`.',
  '',
  ...CHANGELOG.flatMap((r) => [`## ${r.version} — ${r.title}`, `*${r.date}*`, '', ...r.notes.map((n) => `- ${n}`), '']),
].join('\n')

writeFileSync(new URL('../CHANGELOG.md', import.meta.url), md)
console.log(`CHANGELOG.md · ${CHANGELOG.length} release${CHANGELOG.length === 1 ? '' : 's'}, newest ${CHANGELOG[0].version}`)
