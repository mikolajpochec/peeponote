// peeponote relay, deployable as a Cloudflare Worker (free tier is plenty). Two jobs:
//
//  1. CORS proxy for git smart-HTTP (isomorphic-git style: https://<worker>/<host>/<path>).
//     Only info/refs, git-upload-pack and git-receive-pack are forwarded, so it can't be abused
//     as a general-purpose proxy. Paste the worker URL into Settings → Transport → proxy.
//
//  2. "Sign in with GitHub" relay for the OAuth *device flow*: github.com/login/* has no CORS,
//     so the app POSTs to /github/device/code and /github/oauth/token here and we forward them.
//     No secret is stored anywhere — the device flow only needs the OAuth App's public client id.
//
// Deploy: bunx wrangler login && bunx wrangler deploy   (config in wrangler.toml)

const GIT_PATH = /\/(info\/refs|git-upload-pack|git-receive-pack)$/
const ALLOWED_HOSTS: string[] | null = null // e.g. ['github.com', 'gitlab.com'] to lock down

const GITHUB_AUTH_ROUTES: Record<string, string> = {
  '/github/device/code': 'https://github.com/login/device/code',
  '/github/oauth/token': 'https://github.com/login/oauth/access_token',
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, user-agent, accept, accept-encoding, pragma, cache-control, git-protocol, x-requested-with',
  'Access-Control-Expose-Headers': 'content-type, content-length, location, x-redirected-url',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(req.url)

    // GitHub device flow relay — JSON in, JSON out
    const authTarget = GITHUB_AUTH_ROUTES[url.pathname]
    if (authTarget) {
      if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: CORS })
      const upstream = await fetch(authTarget, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'peeponote-relay' },
        body: await req.text(),
      })
      return new Response(upstream.body, { status: upstream.status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' } })
    }

    if (url.pathname === '/' || url.pathname === '') return new Response('peeponote relay: git CORS proxy + GitHub sign-in relay', { headers: CORS })

    // isomorphic-git style: https://proxy/<host>/<path>
    const [, host, ...rest] = url.pathname.split('/')
    if (!host || !GIT_PATH.test(url.pathname)) return new Response('not a git request', { status: 400, headers: CORS })
    if (ALLOWED_HOSTS && !ALLOWED_HOSTS.includes(host)) return new Response('host not allowed', { status: 403, headers: CORS })

    const target = `https://${host}/${rest.join('/')}${url.search}`
    const headers = new Headers()
    for (const h of ['authorization', 'content-type', 'accept', 'user-agent', 'git-protocol', 'content-encoding']) {
      const v = req.headers.get(h)
      if (v) headers.set(h, v)
    }
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? req.body : undefined,
      redirect: 'manual',
    })
    const out = new Headers(CORS)
    for (const h of ['content-type', 'content-length', 'location', 'cache-control']) {
      const v = upstream.headers.get(h)
      if (v) out.set(h, v)
    }
    if (upstream.status >= 300 && upstream.status < 400) out.set('x-redirected-url', upstream.headers.get('location') ?? '')
    return new Response(upstream.body, { status: upstream.status, headers: out })
  },
}
