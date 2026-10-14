/**
 * What `main` would publish right now. `src/version.ts` is the one source of truth, and this checks that
 * everything else agrees with it: the mirror in package.json and the generated CHANGELOG.md. Run by CI on
 * every pull request (so drift never reaches `main`) and again on merge, where it also hands the version,
 * the title and the notes to the workflow that tags the release.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { APP_VERSION, latestRelease } from '../src/version'
import { CHANGELOG_PATH, renderChangelog } from './changelog'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
const top = latestRelease()

const problems: string[] = []
if (pkg.version !== APP_VERSION) problems.push(`package.json says ${pkg.version}, src/version.ts says ${APP_VERSION}. Make them match.`)
if (top.version !== APP_VERSION) problems.push(`the newest CHANGELOG entry is ${top.version}, but the app ships ${APP_VERSION}. Add the entry for ${APP_VERSION}.`)
if (!/^\d{4}-\d{2}-\d{2}$/.test(top.date)) problems.push(`the date on ${top.version} is "${top.date}", not YYYY-MM-DD.`)
if (!top.notes.length) problems.push(`${top.version} has no notes. Say what changed, for the person using peeponote.`)
if (readFileSync(CHANGELOG_PATH, 'utf8') !== renderChangelog()) problems.push('CHANGELOG.md is out of date. Run `bun scripts/changelog.ts`.')

if (problems.length) {
  console.error(`✗ ${APP_VERSION} is not ready to release:`)
  for (const p of problems) console.error(`  · ${p}`)
  process.exit(1)
}

console.log(`✓ ${APP_VERSION}: ${top.title} (${top.notes.length} note${top.notes.length === 1 ? '' : 's'})`)

// CI: hand the release over to the workflow
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${APP_VERSION}\ntitle=${top.title}\n`)
  writeFileSync(new URL('../release-notes.md', import.meta.url), `${top.notes.map((n) => `- ${n}`).join('\n')}\n`)
}
