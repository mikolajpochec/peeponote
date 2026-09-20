/**
 * Where the workspace lives inside the repo. Usually the repo root, but in a monorepo the boards
 * can sit in any subfolder — we find the folder that holds `peeponote.json`.
 */
import { abs, exists, type PeepoFS } from './types'
import { WORKSPACE_FILE } from '../model/types'

/** repo-relative prefix of the current workspace: '' (root) or e.g. 'docs/boards' */
let prefix = ''

export const wsPrefix = () => prefix
export const setWsPrefix = (p: string) => {
  prefix = p.replace(/^\/+|\/+$/g, '')
}
/** workspace-relative → repo-relative ('boards/x.json' → 'docs/boards/x.json') */
export const wp = (rel: string) => (prefix ? `${prefix}/${rel}` : rel)
/** repo-relative → workspace-relative, or null when the path is outside the workspace */
export const unwp = (repoRel: string): string | null => {
  if (!prefix) return repoRel
  return repoRel.startsWith(`${prefix}/`) ? repoRel.slice(prefix.length + 1) : null
}

const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'target', 'vendor'])

/** Every folder (repo-relative, '' = root) that contains peeponote.json, breadth-first, depth ≤ 4. */
export async function findWorkspaces(fs: PeepoFS, maxDepth = 4): Promise<string[]> {
  const found: string[] = []
  let level: string[] = ['']
  for (let depth = 0; depth <= maxDepth && level.length; depth++) {
    const next: string[] = []
    for (const dir of level) {
      const rel = dir ? `${dir}/${WORKSPACE_FILE}` : WORKSPACE_FILE
      if (await exists(fs, abs(fs, rel))) {
        found.push(dir)
        continue // a workspace doesn't nest another
      }
      let entries: string[] = []
      try {
        entries = await fs.promises.readdir(dir ? abs(fs, dir) : fs.dir)
      } catch {
        continue
      }
      for (const e of entries) {
        if (SKIP.has(e) || e.startsWith('.')) continue
        const p = dir ? `${dir}/${e}` : e
        try {
          if ((await fs.promises.stat(abs(fs, p))).isDirectory()) next.push(p)
        } catch {
          /* unreadable entry */
        }
      }
    }
    level = next
  }
  return found
}

/** True when the repo root already holds unrelated files (a monorepo) — a fresh workspace then goes into a subfolder. */
export async function rootHasOtherFiles(fs: PeepoFS): Promise<boolean> {
  try {
    const entries = (await fs.promises.readdir(fs.dir)).filter((e) => e !== '.git' && e !== '.gitignore' && e !== '.DS_Store')
    return entries.length > 0
  } catch {
    return false
  }
}
