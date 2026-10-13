/**
 * "Make a GitHub key": the one technical step in peeponote, made as gentle as it can be. A button opens
 * GitHub's page with the right box ticked, three small drawings show what to do there, and the pasted key is
 * checked straight away, with problems explained in plain words. Used by the first-run wizard and by the
 * sign-in dialog.
 */
import { useState, type ReactNode } from 'react'
import { checkToken, commitEmail, GhError, MAKE_TOKEN_URL, plainGhError, type GhUser } from '../git/ghAccount'
import { useSettings, type GhIdentity } from '../store/settings'

const field = 'w-full rounded-md bg-swamp-700 px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const quiet = 'rounded-lg bg-swamp-600 px-3 py-2 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'

export const identityOf = (user: GhUser): GhIdentity => ({ login: user.login, id: user.id, name: user.name || user.login, avatarUrl: user.avatar_url, email: commitEmail(user) })

/** sign in with a pasted key: remembers it in this browser and hands the account back */
export function useSignIn(onDone: (token: string, user: GhUser) => void) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()

  const check = async (value: string) => {
    const k = value.trim()
    setProblem(undefined)
    if (!k) return
    if (k.startsWith('github_pat_')) {
      return setProblem(
        'That is one of GitHub’s new "fine-grained" keys, which can only be pointed at your own repos. peeponote needs the classic kind, which works with every repo you have access to. Press "Open GitHub" above: it opens the right page.',
      )
    }
    setBusy(true)
    try {
      const { user, hasRepoScope } = await checkToken(k)
      if (!hasRepoScope) return setProblem('This key cannot open private repos. Make a new one with "Open GitHub" above; the right box is ticked for you.')
      useSettings.getState().set({ token: k, username: user.login, github: identityOf(user) })
      onDone(k, user)
    } catch (e) {
      setProblem(e instanceof GhError && e.status === 401 ? 'GitHub does not recognise this key. Copy it again; it starts with "ghp_".' : plainGhError(e))
    } finally {
      setBusy(false)
    }
  }
  return { key, setKey, busy, problem, check }
}

export function Problem({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg bg-red-900/30 px-3 py-2 text-[12px] leading-relaxed text-red-100">
      {children}
    </p>
  )
}

/** the three things to do on GitHub's page, drawn rather than described */
export function KeyPictures() {
  const line = (w: string) => <span className="h-1.5 rounded-full bg-white/15" style={{ width: w }} />
  return (
    <div className="grid grid-cols-3 gap-2">
      <Picture n={1} caption="Scroll to the bottom of the page">
        {line('80%')}
        {line('60%')}
        {line('70%')}
        <span className="mt-0.5 text-center text-[13px] text-white/70 peepo-bounce">↓</span>
      </Picture>
      <Picture n={2} caption={<>Press the green <b className="text-frog-100">Generate token</b></>}>
        {line('50%')}
        <span className="mt-1 w-fit rounded-md bg-[#238636] px-2 py-1 text-[9px] font-bold text-white ring-2 ring-[#3fb950] ring-offset-2 ring-offset-[#0d1117]">Generate token</span>
      </Picture>
      <Picture n={3} caption="Copy the key it shows you">
        <span className="flex items-center gap-1 rounded-md border border-[#3fb950]/50 bg-[#3fb950]/10 px-2 py-1.5 font-mono text-[9px] text-white/80">
          ghp_•••••••• <span className="ml-auto">⧉</span>
        </span>
      </Picture>
    </div>
  )
}

function Picture({ n, caption, children }: { n: number; caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="flex h-20 flex-col justify-center gap-1.5 overflow-hidden rounded-lg border border-(--hair) bg-[#0d1117] p-2.5" aria-hidden>
        {children}
      </div>
      <figcaption className="text-[11px] leading-snug text-frog-200/60">
        <span className="mr-1 inline-flex size-4 items-center justify-center rounded-full bg-swamp-600 text-[9px] font-bold text-frog-100">{n}</span>
        {caption}
      </figcaption>
    </figure>
  )
}

/** Open GitHub + the three pictures + the paste box. `trailing` goes under the field (buttons live outside). */
export function KeyForm({ form }: { form: ReturnType<typeof useSignIn> }) {
  return (
    <>
      <a className={`${quiet} inline-block w-fit`} href={MAKE_TOKEN_URL} target="_blank" rel="noreferrer">
        Open GitHub ↗
      </a>
      <KeyPictures />
      <div>
        <label htmlFor="gh-key" className="mb-1 block text-[12px] font-semibold text-frog-200/80">
          Paste your key here
        </label>
        <input
          id="gh-key"
          className={`${field} font-mono`}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="ghp_…"
          value={form.key}
          onChange={(e) => form.setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void form.check(form.key)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (!text) return
            e.preventDefault()
            form.setKey(text.trim())
            void form.check(text)
          }}
        />
      </div>
      <Problem>{form.problem}</Problem>
    </>
  )
}
