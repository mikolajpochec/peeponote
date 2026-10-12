/**
 * The few GitHub calls that are about *you* rather than one repository: who a token belongs to, which repos you
 * can save to, and making a new one. Used by the first-run wizard, where every error ends up on screen, so the
 * messages are written for people.
 */

const API = 'https://api.github.com'

/** a classic token with the `repo` scope: one key, every repo you can reach (including other people's) */
export const MAKE_TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=peeponote'

export class GhError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GhError'
    this.status = status
  }
}

/** fetch itself failed, or the browser knows it is offline */
export const isOffline = (e: unknown) => e instanceof TypeError || !navigator.onLine

/** any GitHub problem, in words a person understands */
export function plainGhError(e: unknown): string {
  if (isOffline(e)) return 'You seem to be offline. Connect to the internet and try again.'
  if (e instanceof GhError && e.status === 401) return 'GitHub does not recognise this key any more. Make a new one and paste it again.'
  if (e instanceof GhError && e.status === 403) return 'GitHub asks us to wait a moment. Try again in a minute.'
  if (e instanceof GhError && e.status >= 500) return 'GitHub is having trouble right now. Try again in a few minutes.'
  return (e as Error).message || 'Something went wrong talking to GitHub.'
}

async function req<T>(token: string, method: string, path: string, body?: unknown): Promise<{ data: T; res: Response }> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!res.ok) {
    let msg = `GitHub answered ${res.status}.`
    try {
      const j = (await res.json()) as { message?: string }
      if (j.message) msg = j.message
    } catch {
      /* no body */
    }
    throw new GhError(res.status, msg)
  }
  return { data: res.status === 204 ? (undefined as T) : ((await res.json()) as T), res }
}

const get = async <T>(token: string, path: string) => (await req<T>(token, 'GET', path)).data

export interface GhUser {
  login: string
  id: number
  name: string | null
  email: string | null
  avatar_url: string
}

export interface TokenCheck {
  user: GhUser
  /** the classic `repo` scope: may read and write every repository you have access to */
  hasRepoScope: boolean
}

/** Whose key is this, and does it cover private repos? */
export async function checkToken(token: string): Promise<TokenCheck> {
  const { data, res } = await req<GhUser>(token, 'GET', '/user')
  const scopes = (res.headers.get('x-oauth-scopes') ?? '').split(',').map((s) => s.trim())
  return { user: data, hasRepoScope: scopes.includes('repo') }
}

/** the email git should put in your commits: your public one, or the address GitHub keeps for you */
export const commitEmail = (u: GhUser) => u.email || `${u.id}+${u.login}@users.noreply.github.com`

export interface GhRepo {
  name: string
  full_name: string
  private: boolean
  owner: { login: string }
  pushed_at: string | null
  permissions?: { push?: boolean }
}

/** every repository you can save to, most recently touched first */
export async function listPushableRepos(token: string): Promise<GhRepo[]> {
  const out: GhRepo[] = []
  for (let page = 1; page <= 4; page++) {
    const batch = await get<GhRepo[]>(token, `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`)
    out.push(...batch.filter((r) => r.permissions?.push !== false))
    if (batch.length < 100) break
  }
  return out
}

/** the organizations you belong to, so a shared board repo can live in one */
export const listOrgs = (token: string) => get<{ login: string }[]>(token, '/user/orgs?per_page=100').then((o) => o.map((x) => x.login))

/** a new, empty, private repository under you or one of your organizations */
export async function createRepo(token: string, owner: string, me: string, name: string): Promise<GhRepo> {
  const path = owner === me ? '/user/repos' : `/orgs/${owner}/repos`
  const body = { name, private: true, description: 'peeponote boards', has_issues: false, has_wiki: false, has_projects: false, auto_init: false }
  return (await req<GhRepo>(token, 'POST', path, body)).data
}

/** "My Boards!" → "my-boards" */
export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
