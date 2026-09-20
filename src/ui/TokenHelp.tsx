import { parseGitHubUrl } from '../git/githubApi'

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
          <b className="text-frog-200/80">GitHub token:</b>{' '}
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
