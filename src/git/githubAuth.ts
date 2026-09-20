/**
 * "Sign in with GitHub" via the OAuth device flow.
 *
 * github.com/login/* has no CORS, so the two calls go through a tiny relay (proxy/worker.ts,
 * routes /github/device/code and /github/oauth/token). No client secret is involved — the device
 * flow only needs the OAuth App's public client id, which the host bakes in at build time
 * (VITE_GITHUB_CLIENT_ID) or the user pastes into Settings.
 */
import { useSettings } from '../store/settings'

export interface DeviceStart {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface GitHubAuthConfig {
  clientId: string
  relay: string
}

/** Build-time defaults (GitHub Pages workflow passes them from repository variables). */
const ENV_CLIENT_ID = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined) ?? ''
const ENV_RELAY = (import.meta.env.VITE_GITHUB_AUTH_RELAY as string | undefined) ?? ''

export function githubAuthConfig(): GitHubAuthConfig | null {
  const s = useSettings.getState()
  const clientId = (s.ghClientId || ENV_CLIENT_ID).trim()
  const relay = (s.ghAuthRelay || ENV_RELAY).trim().replace(/\/+$/, '')
  return clientId && relay ? { clientId, relay } : null
}

export const hasBuiltInGitHubAuth = () => !!(ENV_CLIENT_ID && ENV_RELAY)

async function relayPost<T>(relay: string, path: string, body: Record<string, string>): Promise<T> {
  const r = await fetch(`${relay}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Auth relay returned ${r.status}: ${text.slice(0, 200) || 'empty response'}`)
  }
  if (!r.ok) throw new Error(`Auth relay ${r.status}: ${(json as { error_description?: string; error?: string }).error_description ?? (json as { error?: string }).error ?? text}`)
  return json as T
}

export async function startDeviceFlow(cfg: GitHubAuthConfig): Promise<DeviceStart> {
  const res = await relayPost<DeviceStart & { error?: string; error_description?: string }>(cfg.relay, '/github/device/code', {
    client_id: cfg.clientId,
    scope: 'repo',
  })
  if (res.error) throw new Error(res.error_description ?? res.error)
  return res
}

export type PollResult = { status: 'pending' } | { status: 'ok'; token: string } | { status: 'denied' } | { status: 'expired' }

export async function pollDeviceToken(cfg: GitHubAuthConfig, deviceCode: string): Promise<PollResult & { slowDown?: boolean }> {
  const res = await relayPost<{ access_token?: string; error?: string; error_description?: string }>(cfg.relay, '/github/oauth/token', {
    client_id: cfg.clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  if (res.access_token) return { status: 'ok', token: res.access_token }
  switch (res.error) {
    case 'authorization_pending':
      return { status: 'pending' }
    case 'slow_down':
      return { status: 'pending', slowDown: true }
    case 'expired_token':
      return { status: 'expired' }
    case 'access_denied':
      return { status: 'denied' }
    default:
      throw new Error(res.error_description ?? res.error ?? 'unexpected response from GitHub')
  }
}

export interface GitHubUser {
  login: string
  name: string | null
  email: string | null
  id: number
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const r = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } })
  if (!r.ok) throw new Error(`GitHub /user → ${r.status}`)
  return (await r.json()) as GitHubUser
}

/** Runs the whole flow; `onCode` is called once the user has something to type into github.com/login/device. */
export async function signInWithGitHub(
  cfg: GitHubAuthConfig,
  onCode: (start: DeviceStart) => void,
  signal?: AbortSignal,
): Promise<{ token: string; user: GitHubUser }> {
  const start = await startDeviceFlow(cfg)
  onCode(start)
  let interval = Math.max(5, start.interval || 5)
  const deadline = Date.now() + start.expires_in * 1000
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, interval * 1000)
      signal?.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('cancelled', 'AbortError'))), { once: true })
    })
    const res = await pollDeviceToken(cfg, start.device_code)
    if (res.status === 'ok') {
      const user = await fetchGitHubUser(res.token)
      return { token: res.token, user }
    }
    if (res.status === 'denied') throw new Error('You cancelled the authorization on GitHub.')
    if (res.status === 'expired') throw new Error('The code expired — try again.')
    if (res.slowDown) interval += 5
  }
  throw new Error('The code expired — try again.')
}
