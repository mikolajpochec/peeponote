// Minimal CORS proxy for git smart-HTTP, deployable as a Cloudflare Worker (free tier is plenty).
// isomorphic-git style: https://<worker>/<host>/<path>. Paste the worker URL into Settings → Transport → proxy.
//
// Only forwards git protocol paths (info/refs, git-upload-pack, git-receive-pack) to https hosts,
// so it can't be abused as a general-purpose proxy.
//
// Deploy: bunx wrangler login && bunx wrangler deploy   (config in wrangler.toml; wrangler needs Node ≥ 22)

const GIT_PATH = /\/(info\/refs|git-upload-pack|git-receive-pack)$/
const ALLOWED_HOSTS: string[] | null = null // e.g. ['github.com', 'gitlab.com'] to lock down

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

    if (url.pathname === '/' || url.pathname === '') return new Response('peeponote git CORS proxy', { headers: CORS })

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
