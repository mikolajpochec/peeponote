import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import { parseGitHubUrl } from './githubApi'
import { chooseTransport, type TransportPref } from './sync'

export type AccessResult =
  | { ok: true; name: string; canPush: boolean; empty: boolean; note?: string }
  | { ok: false; error: string }

/**
 * Can this token open (and save to) this repo? Asked before switching, so a typo never leaves you on a
 * repo you can't reach. GitHub: one API call, which also tells us whether you may push. Other hosts: a
 * ref listing through the proxy.
 */
export async function checkAccess(url: string, token: string, pref: TransportPref, corsProxy?: string, username?: string): Promise<AccessResult> {
  const u = url.trim()
  if (!/^https?:\/\//.test(u)) return { ok: false, error: 'The address should start with https://' }
  const gh = parseGitHubUrl(u)
  if (gh && chooseTransport(u, pref) === 'api') {
    if (!token.trim()) return { ok: false, error: 'A token is needed to save to GitHub.' }
    const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.trim()}`, 'X-GitHub-Api-Version': '2022-11-28' },
    }).catch(() => null)
    if (!res) return { ok: false, error: 'Could not reach GitHub — are you online?' }
    if (res.status === 401) return { ok: false, error: 'GitHub rejected this token.' }
    if (res.status === 404) return { ok: false, error: `Repo not found, or this token has no access to ${gh.owner}/${gh.repo}. For someone else's repo a classic token (repo scope) is needed.` }
    if (!res.ok) return { ok: false, error: `GitHub answered ${res.status}.` }
    const j = (await res.json()) as { full_name: string; permissions?: { push?: boolean }; size?: number }
    const canPush = !!j.permissions?.push
    return { ok: true, name: j.full_name, canPush, empty: j.size === 0, note: canPush ? undefined : 'Read-only: you can look, but saving will fail until the owner adds you as a collaborator.' }
  }
  try {
    const info = await git.getRemoteInfo2({
      http,
      url: u,
      corsProxy: corsProxy?.trim() || undefined,
      onAuth: token.trim() ? () => ({ username: username?.trim() || token.trim(), password: username?.trim() ? token.trim() : 'x-oauth-basic' }) : undefined,
      onAuthFailure: () => ({ cancel: true }),
    })
    const refs = info.refs ?? []
    return { ok: true, name: u.replace(/^https?:\/\//, '').replace(/\.git$/, ''), canPush: true, empty: refs.length === 0, note: 'Write access can only be confirmed on the first save with this host.' }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Could not reach the repository.' }
  }
}
