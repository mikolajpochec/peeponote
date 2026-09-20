import { useEffect, useRef, useState } from 'react'
import { parseGitHubUrl } from '../git/githubApi'
import { githubAuthConfig, signInWithGitHub, type DeviceStart } from '../git/githubAuth'
import { useSettings } from '../store/settings'
import { toast } from '../store/toast'
import { Peepo } from './Peepo'

type Host = 'github' | 'gitlab' | 'other'

function hostOf(remote: string): { host: Host; origin: string | null } {
  const r = remote.trim()
  if (!r || parseGitHubUrl(r)) return { host: 'github', origin: 'https://github.com' }
  try {
    const u = new URL(r)
    if (/(^|\.)gitlab\./i.test(u.hostname)) return { host: 'gitlab', origin: u.origin }
    return { host: 'other', origin: u.origin }
  } catch {
    return { host: 'other', origin: null }
  }
}

const link = 'font-semibold text-frog-300 underline decoration-frog-300/40 underline-offset-2 hover:text-frog-200'
const code = 'rounded bg-swamp-900/60 px-1 font-mono text-[11px]'

const FINE_GRAINED_URL = 'https://github.com/settings/personal-access-tokens/new'
const CLASSIC_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=peeponote'

// ---------------------------------------------------------------------------
// Sign in with GitHub (device flow)
// ---------------------------------------------------------------------------

type Phase = { kind: 'idle' } | { kind: 'starting' } | { kind: 'code'; start: DeviceStart } | { kind: 'error'; message: string }

export function GitHubSignIn({ className = '' }: { className?: string }) {
  const settings = useSettings()
  const cfg = githubAuthConfig()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  if (!cfg) return null

  const signedIn = settings.tokenSource === 'github-signin' && !!settings.token

  const begin = async () => {
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setPhase({ kind: 'starting' })
    try {
      const { token, user } = await signInWithGitHub(cfg, (start) => setPhase({ kind: 'code', start }), ac.signal)
      if (ac.signal.aborted) return
      const patch: Parameters<typeof settings.set>[0] = { token, username: '', tokenSource: 'github-signin', ghLogin: user.login }
      if (!settings.authorName) patch.authorName = user.name || user.login
      if (!settings.authorEmail) patch.authorEmail = user.email || `${user.id}+${user.login}@users.noreply.github.com`
      settings.set(patch)
      setPhase({ kind: 'idle' })
      toast.ok(`Signed in as @${user.login}`, 'peepoHappy')
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }

  const cancel = () => {
    abort.current?.abort()
    setPhase({ kind: 'idle' })
  }

  const signOut = () => {
    settings.set({ token: '', tokenSource: 'manual', ghLogin: '' })
    toast.info('Signed out — the token was removed from this browser', 'peepoLeave')
  }

  if (signedIn) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-frog-500/30 bg-frog-900/20 px-3 py-2 text-[13px] ${className}`}>
        <Peepo name="peepoHappy" size={22} />
        <span className="flex-1">
          Signed in with GitHub as <b>@{settings.ghLogin || '…'}</b>
        </span>
        <button onClick={signOut} className="rounded-md bg-swamp-700 px-2 py-1 text-[12px] font-semibold hover:bg-swamp-600">
          Sign out
        </button>
      </div>
    )
  }

  if (phase.kind === 'code') {
    const { start } = phase
    const open = async () => {
      try {
        await navigator.clipboard.writeText(start.user_code)
      } catch {
        /* clipboard may be unavailable; the code is on screen anyway */
      }
      window.open(start.verification_uri, '_blank', 'noopener')
    }
    return (
      <div className={`rounded-lg border border-frog-500/30 bg-swamp-900/60 p-3 ${className}`}>
        <div className="mb-1 text-[12px] text-frog-200/70">
          1. Open{' '}
          <a className={link} href={start.verification_uri} target="_blank" rel="noreferrer">
            {start.verification_uri.replace(/^https?:\/\//, '')} ↗
          </a>{' '}
          — 2. type this code — 3. click <i>Authorize</i>
        </div>
        <div className="flex items-center gap-3">
          <div className="select-all rounded-lg bg-swamp-950 px-3 py-2 font-mono text-2xl font-black tracking-[0.2em] text-frog-100">{start.user_code}</div>
          <button onClick={open} className="rounded-md bg-frog-500 px-3 py-2 text-[13px] font-bold text-white hover:bg-frog-400">
            Copy code & open GitHub ↗
          </button>
          <button onClick={cancel} className="text-[12px] text-frog-200/60 hover:text-frog-100">
            Cancel
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-frog-200/60">
          <Peepo name="peepoThink" size={18} className="peepo-bounce" /> Waiting for you to authorize on GitHub… this panel updates by itself.
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        onClick={begin}
        disabled={phase.kind === 'starting'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#24292f] px-3 py-2 text-[13px] font-bold text-white ring-1 ring-white/15 hover:bg-[#32383f] disabled:opacity-60"
      >
        <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        {phase.kind === 'starting' ? 'Contacting GitHub…' : 'Sign in with GitHub'}
      </button>
      {phase.kind === 'error' && <div className="mt-1 text-[12px] text-red-300">{phase.message}</div>}
      <div className="mt-1 text-[11px] text-frog-200/50">One click, no token juggling. Grants the app access to your repos (OAuth <code className={code}>repo</code> scope); revoke any time at github.com → Settings → Applications.</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual token: short hint + step-by-step guide
// ---------------------------------------------------------------------------

/** where to get a token for the host in `remote`, with the right scopes spelled out */
export function TokenHelp({ remote, className = '' }: { remote: string; className?: string }) {
  const { host, origin } = hostOf(remote)
  const gh = parseGitHubUrl(remote)
  const repoLabel = gh ? `${gh.owner}/${gh.repo}` : 'your boards repo'
  const wrap = `text-[11px] leading-relaxed text-frog-200/60 ${className}`

  if (host === 'github') {
    return (
      <div className={wrap}>
        <p>
          <b className="text-frog-200/80">{githubAuthConfig() ? 'Or paste a token:' : 'GitHub token:'}</b>{' '}
          <a className={link} href={FINE_GRAINED_URL} target="_blank" rel="noreferrer">
            fine-grained token ↗
          </a>{' '}
          with <i>Contents: Read and write</i> on <code className={code}>{repoLabel}</code>, or a{' '}
          <a className={link} href={CLASSIC_URL} target="_blank" rel="noreferrer">
            classic token with <code className={code}>repo</code> ↗
          </a>
          . Leave username empty.
        </p>
        <details className="mt-1 rounded-lg bg-swamp-900/40 px-2 py-1 open:pb-2">
          <summary className="cursor-pointer select-none font-semibold text-frog-200/80">Step by step: how to create the token</summary>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-frog-200/70">
            <li>
              Make sure the repository exists (
              <a className={link} href="https://github.com/new" target="_blank" rel="noreferrer">
                github.com/new ↗
              </a>
              , private is fine). Paste its URL into the <i>Remote</i> field above.
            </li>
            <li>
              Open{' '}
              <a className={link} href={FINE_GRAINED_URL} target="_blank" rel="noreferrer">
                github.com/settings/personal-access-tokens/new ↗
              </a>{' '}
              (Settings → Developer settings → Personal access tokens → Fine-grained tokens → <i>Generate new token</i>).
            </li>
            <li>
              <b>Token name:</b> anything, e.g. <code className={code}>peeponote</code>. <b>Expiration:</b> pick a long one — when it expires, Save stops pushing until you paste a new
              token.
            </li>
            <li>
              <b>Resource owner:</b> your account (or the organization that owns the repo).
            </li>
            <li>
              <b>Repository access:</b> <i>Only select repositories</i> → choose <code className={code}>{repoLabel}</code>.
            </li>
            <li>
              <b>Permissions → Repository permissions → Contents:</b> set to <i>Read and write</i>. (<i>Metadata: Read-only</i> gets added automatically.) Nothing else is needed.
            </li>
            <li>
              Click <i>Generate token</i>, copy the <code className={code}>github_pat_…</code> string — GitHub shows it only once — and paste it into the token field here. Leave <i>Username</i> empty.
            </li>
          </ol>
          <div className="mt-2 font-semibold text-frog-200/80">Shortcut: classic token</div>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-frog-200/70">
            <li>
              Open{' '}
              <a className={link} href={CLASSIC_URL} target="_blank" rel="noreferrer">
                this link ↗
              </a>{' '}
              — the <code className={code}>repo</code> scope is already ticked.
            </li>
            <li>Pick an expiration, click <i>Generate token</i>.</li>
            <li>
              Copy the <code className={code}>ghp_…</code> string and paste it here. A classic token works for <em>all</em> your repos, so the fine-grained one above is the safer pick.
            </li>
          </ol>
          <p className="mt-2 text-frog-200/50">The token is kept in this browser's localStorage only and is sent exclusively to api.github.com.</p>
        </details>
      </div>
    )
  }

  if (host === 'gitlab') {
    const url = `${origin}/-/user_settings/personal_access_tokens?name=peeponote&scopes=write_repository,read_repository`
    return (
      <div className={wrap}>
        <p>
          <b className="text-frog-200/80">GitLab token:</b>{' '}
          <a className={link} href={url} target="_blank" rel="noreferrer">
            create a personal access token ↗
          </a>{' '}
          (name and scopes are pre-filled: <code className={code}>read_repository</code> + <code className={code}>write_repository</code>), pick an expiration, click <i>Create</i>, paste the{' '}
          <code className={code}>glpat-…</code> value here and set <b>Username</b> to <code className={code}>oauth2</code>.
        </p>
        <p className="mt-1">GitLab is reached through the git proxy (Transport below) — the public default works, your own worker is faster and private.</p>
      </div>
    )
  }

  return (
    <div className={wrap}>
      <p>
        <b className="text-frog-200/80">Token:</b> a personal access token with read/write access to the repository, plus the username if the host wants one. Gitea/Forgejo:{' '}
        {origin ? (
          <a className={link} href={`${origin}/user/settings/applications`} target="_blank" rel="noreferrer">
            Settings → Applications → Generate token ↗
          </a>
        ) : (
          'Settings → Applications → Generate token'
        )}{' '}
        with <i>repository: read and write</i>; leave username empty.
      </p>
      <p className="mt-1">Non-GitHub hosts are reached through the git proxy (Transport below).</p>
    </div>
  )
}
