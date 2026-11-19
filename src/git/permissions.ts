/**
 * What this browser may do with the repo, straight from GitHub's own permissions: nobody invents a second
 * layer of roles. Push access means editing and collaboration; read access means look but don't touch; no
 * access at all means the workspace stays locked until you sign in.
 *
 * The answer is remembered per repo, so going offline (or GitHub having a bad day) never locks you out of
 * boards you were allowed to edit a minute ago.
 *
 * A key that stopped working (expired, revoked) is not an answer about the repo at all: GitHub says 401 to
 * everything. That never locks anyone out either. What was true last time stays true, and `badKey` tells the
 * app to ask for a new key.
 */
import { parseGitHubUrl } from './githubApi'

export type Access = 'write' | 'read' | 'locked'

const KEY = (url: string) => `peeponote-access:${url}`
const remembered = (url: string): Access | null => {
  const v = localStorage.getItem(KEY(url))
  return v === 'write' || v === 'read' || v === 'locked' ? v : null
}

export interface AccessAnswer {
  access: Access
  /** GitHub refused the key itself (401): it expired or was revoked, a new one is needed */
  badKey: boolean
}

interface Asked extends AccessAnswer {
  at: number
}
const cache = new Map<string, Asked>()
const FRESH_MS = 5 * 60_000

/** How much of this repo is mine? Public repos are readable by anyone, private ones need a token that reaches them. */
export async function repoAccess(remoteUrl: string | null, token: string, force = false): Promise<AccessAnswer> {
  const url = remoteUrl?.trim() ?? ''
  // nothing shared: a workspace that lives only here is yours to edit
  if (!url) return { access: 'write', badKey: false }
  const gh = parseGitHubUrl(url)
  // another host (GitLab, Gitea, a plain git server): it enforces its own rules on push, we don't guess
  if (!gh) return { access: 'write', badKey: false }

  const key = `${url}\n${token}`
  const seen = cache.get(key)
  if (!force && seen && Date.now() - seen.at < FRESH_MS) return { access: seen.access, badKey: seen.badKey }
  const answer = (access: Access, badKey = false): AccessAnswer => {
    cache.set(key, { access, badKey, at: Date.now() })
    return { access, badKey }
  }
  try {
    // without a token we still ask: a public repo answers, a private one is a 404 and stays locked
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`
    const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, { headers })
    // the key died: that says nothing about the repo, so what was true before stands (and is not overwritten)
    if (res.status === 401 && token.trim()) return answer(remembered(url) ?? 'read', true)
    // 403 with the rate limit used up is GitHub asking us to wait, not a verdict on this account
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') throw new Error('rate limited')
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      localStorage.setItem(KEY(url), 'locked')
      return answer('locked')
    }
    if (!res.ok) throw new Error(String(res.status))
    const j = (await res.json()) as { permissions?: { push?: boolean } }
    const access: Access = j.permissions?.push ? 'write' : 'read'
    localStorage.setItem(KEY(url), access)
    return answer(access)
  } catch {
    // offline or GitHub is down: trust what it said last time rather than locking someone out of their own boards
    return { access: remembered(url) ?? 'read', badKey: false }
  }
}

/** drop what we remember about a repo (signing out, changing the token) */
export function forgetAccess(remoteUrl?: string | null) {
  cache.clear()
  if (remoteUrl) localStorage.removeItem(KEY(remoteUrl.trim()))
}
