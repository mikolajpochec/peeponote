import { parseGitHubUrl } from '../git/githubApi'

type Host = 'github' | 'gitlab' | 'other'

function hostOf(remote: string): { host: Host; origin: string | null } {
  const r = remote.trim()
  if (parseGitHubUrl(r)) return { host: 'github', origin: 'https://github.com' }
  try {
    const u = new URL(r)
    if (/(^|\.)gitlab\./i.test(u.hostname)) return { host: 'gitlab', origin: u.origin }
    return { host: 'other', origin: u.origin }
  } catch {
    return { host: 'other', origin: null }
  }
}

const link = 'font-semibold text-frog-300 underline decoration-frog-300/40 underline-offset-2 hover:text-frog-200'

/** where to get a token for the host in `remote`, with the right scopes spelled out */
export function TokenHelp({ remote, className = '' }: { remote: string; className?: string }) {
  const { host, origin } = hostOf(remote)
  const gh = parseGitHubUrl(remote)
  const wrap = `text-[11px] leading-relaxed text-frog-200/60 ${className}`

  if (host === 'github') {
    const fine = 'https://github.com/settings/personal-access-tokens/new'
    const classic = 'https://github.com/settings/tokens/new?scopes=repo&description=peeponote'
    return (
      <p className={wrap}>
        <b className="text-frog-200/80">GitHub token:</b>{' '}
        <a className={link} href={fine} target="_blank" rel="noreferrer">
          create a fine-grained token ↗
        </a>
        , pick <i>Only select repositories</i>
        {gh ? (
          <>
            {' '}
            → <code className="rounded bg-swamp-900/60 px-1">{gh.owner}/{gh.repo}</code>
          </>
        ) : null}
        , set <i>Repository permissions → Contents: Read and write</i>, generate and paste it here. Or a{' '}
        <a className={link} href={classic} target="_blank" rel="noreferrer">
          classic token with the <code>repo</code> scope ↗
        </a>
        . Leave username empty.
      </p>
    )
  }

  if (host === 'gitlab') {
    const url = `${origin}/-/user_settings/personal_access_tokens?name=peeponote&scopes=write_repository,read_repository`
    return (
      <p className={wrap}>
        <b className="text-frog-200/80">GitLab token:</b>{' '}
        <a className={link} href={url} target="_blank" rel="noreferrer">
          create a personal access token ↗
        </a>{' '}
        with <code>read_repository</code> + <code>write_repository</code>, paste it here and set username to <code>oauth2</code>.
      </p>
    )
  }

  return (
    <p className={wrap}>
      <b className="text-frog-200/80">Token:</b> a personal access token with read/write access to the repository. GitHub → fine-grained token
      (<i>Contents: read & write</i>); GitLab → <code>write_repository</code> with username <code>oauth2</code>; Gitea/Forgejo →{' '}
      {origin ? (
        <a className={link} href={`${origin}/user/settings/applications`} target="_blank" rel="noreferrer">
          Settings → Applications ↗
        </a>
      ) : (
        'Settings → Applications'
      )}
      . It stays in this browser's localStorage and is only ever sent to that git host.
    </p>
  )
}
