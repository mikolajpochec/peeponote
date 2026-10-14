import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { commitEmail, createRepo, GhError, listOrgs, listPushableRepos, plainGhError, slug, type GhRepo, type GhUser } from '../git/ghAccount'
import { KeyForm, useSignIn } from './KeyForm'
import { kbd } from './keys'
import { useReview } from '../store/review'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { Peepo } from './Peepo'
import type { PeepoName } from '../theme/peepos'
import { PluginPicker } from './PluginPicker'

const field = 'w-full rounded-md bg-swamp-700 px-3 py-2 text-[14px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const primary = 'rounded-lg bg-frog-500 px-4 py-2 text-[14px] font-bold text-white hover:bg-frog-400 disabled:opacity-40'
const ghost = 'rounded-lg px-4 py-2 text-[14px] font-semibold text-frog-200 hover:bg-(--hover-strong) disabled:opacity-40'

type Step = 'hello' | 'key' | 'repo' | 'local' | 'plugins' | 'done'
/** which of the three dots is lit on each screen */
const DOT: Record<Step, number> = { hello: 0, key: 1, local: 1, repo: 2, plugins: 3, done: 4 }

/** First run: say hello, paste a GitHub key, pick where the boards live, pick the plugins. */
export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const settings = useSettings()
  const [step, setStep] = useState<Step>('hello')
  const [me, setMe] = useState<GhUser | null>(null)

  const finish = () => {
    // skipping keeps the default plugins; either way the question is answered and won't come back as a dialog
    settings.set({ onboarded: true, pluginsChosen: true })
    onFinish()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-auto rounded-2xl border border-(--hair) bg-swamp-800 p-6 shadow-2xl scrollbar-thin">
        <div className="mb-5 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < DOT[step] ? 'bg-frog-400' : 'bg-swamp-600'}`} />
          ))}
        </div>

        {step === 'hello' && (
          <Screen
            peepo="peepoHey"
            title="Welcome to peeponote"
            sub="Endless boards for notes, pictures, to-dos and files. They live in a git repository, so every Save is a commit your team can pull."
            footer={
              <>
                <button className={primary} onClick={() => setStep('key')}>
                  Sign in with GitHub
                </button>
                <button className={ghost} onClick={() => setStep('local')}>
                  Just this browser
                </button>
              </>
            }
          >
            <p className="text-[13px] text-frog-200/70">
              With GitHub your boards are backed up, shared with whoever you invite, and you can comment and review each other's work. Without it, everything still works, it just
              stays on this device.
            </p>
          </Screen>
        )}

        {step === 'key' && (
          <KeyScreen
            onBack={() => setStep('hello')}
            onDone={(_token, user) => {
              settings.set({ authorName: user.name || user.login, authorEmail: commitEmail(user) })
              setMe(user)
              void useReview.getState().refreshIdentity()
              setStep('repo')
            }}
          />
        )}

        {step === 'repo' && <RepoScreen me={me} onBack={() => setStep('key')} onDone={() => setStep('plugins')} />}

        {step === 'local' && <LocalScreen onBack={() => setStep('hello')} onDone={() => setStep('plugins')} />}

        {step === 'plugins' && (
          <Screen
            peepo="peepoGlad"
            title="Pick your plugins"
            sub="A plugin adds a set of tools to the palette for one kind of work. Keep the ones you'll use; you can change this any time in Settings → Plugins."
            footer={
              <>
                <button className={primary} onClick={() => setStep('done')}>
                  Continue
                </button>
                <button className={ghost} onClick={() => setStep(me ? 'repo' : 'local')}>
                  Back
                </button>
              </>
            }
          >
            <PluginPicker />
          </Screen>
        )}

        {step === 'done' && <DoneScreen onDone={finish} />}

        {step !== 'done' && (
          <button onClick={finish} className="mt-4 self-start text-[12px] text-frog-200/40 hover:text-frog-200">
            Skip setup
          </button>
        )}
      </div>
    </div>
  )
}

/** the frame every screen shares: a peepo, a title, the content, the buttons */
function Screen({ peepo, title, sub, children, footer }: { peepo: PeepoName; title: string; sub?: string; children?: ReactNode; footer: ReactNode }) {
  return (
    <>
      <div className="mb-4 flex items-start gap-3">
        <Peepo name={peepo} size={48} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight">{title}</h2>
          {sub && <p className="text-[13px] text-frog-200/70">{sub}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      <div className="mt-6 flex flex-wrap items-center gap-2">{footer}</div>
    </>
  )
}

function Problem({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg bg-red-900/30 px-3 py-2 text-[12px] leading-relaxed text-red-100">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------------------- the key

function KeyScreen({ onDone, onBack }: { onDone: (token: string, user: GhUser) => void; onBack: () => void }) {
  const form = useSignIn(onDone)
  return (
    <Screen
      peepo="peepoThink"
      title="Make a GitHub key"
      sub="One button, one paste. The key lets peeponote save to GitHub for you and never leaves this browser."
      footer={
        <>
          <button className={primary} disabled={form.busy || !form.key.trim()} onClick={() => void form.check(form.key)}>
            {form.busy ? 'Checking…' : 'Continue'}
          </button>
          <button className={ghost} onClick={onBack}>
            Back
          </button>
        </>
      }
    >
      <KeyForm form={form} />
    </Screen>
  )
}

// ------------------------------------------------------------------------------------- the repo

function RepoScreen({ me, onBack, onDone }: { me: GhUser | null; onBack: () => void; onDone: () => void }) {
  const settings = useSettings()
  const token = settings.token
  const switchRepo = useWorkspace((s) => s.switchRepo)
  const busy = useWorkspace((s) => s.busy)
  const [repos, setRepos] = useState<GhRepo[] | null>(null)
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState<string>()
  const [making, setMaking] = useState(false)

  useEffect(() => {
    listPushableRepos(token).then(setRepos, (e: unknown) => {
      setRepos([])
      setProblem(plainGhError(e))
    })
  }, [token])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (repos ?? []).filter((r) => !q || r.full_name.toLowerCase().includes(q)).slice(0, 40)
  }, [repos, query])

  const openUrl = async (url: string, repoToken: string) => {
    const ok = await switchRepo(url, repoToken || token)
    if (ok) onDone()
  }
  const open = (fullName: string) => openUrl(`https://github.com/${fullName}.git`, token)

  if (making) return <NewRepoScreen me={me} onBack={() => setMaking(false)} onDone={onDone} />

  return (
    <Screen
      peepo="peepoRun"
      title="Where should the boards live?"
      sub={me ? `Signed in as ${me.name || me.login} (@${me.login}). Pick a repo, or make a fresh one.` : 'Pick a repo, or make a fresh one.'}
      footer={
        <>
          <button className={primary} disabled={!!busy} onClick={() => setMaking(true)}>
            New repo…
          </button>
          <button className={ghost} onClick={onBack}>
            Back
          </button>
          <button className={`${ghost} ml-auto`} disabled={!!busy} onClick={onDone}>
            Later
          </button>
        </>
      }
    >
      <Problem>{problem}</Problem>
      {settings.repos.length > 0 && (
        <div>
          <Label>Opened before</Label>
          {settings.repos.slice(0, 3).map((r) => (
            <Row key={r.url} title={shortUrl(r.url)} icon="🕑" disabled={!!busy} onClick={() => void openUrl(r.url, r.token)} />
          ))}
        </div>
      )}
      <div>
        <Label>Your repos</Label>
        <input className={`${field} mb-1`} placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-56 overflow-auto scrollbar-thin">
          {repos === null && <p className="px-2 py-1.5 text-[12px] text-frog-200/50">Looking…</p>}
          {repos && !shown.length && <p className="px-2 py-1.5 text-[12px] text-frog-200/50">Nothing found. Make a new one below.</p>}
          {shown.map((r) => (
            <Row key={r.full_name} title={r.full_name} icon={r.private ? '🔒' : '📂'} disabled={!!busy} onClick={() => void open(r.full_name)} />
          ))}
        </div>
      </div>
      <p className="text-[11px] text-frog-200/50">An empty repo is set up for you. One with boards in it is downloaded as it is.</p>
    </Screen>
  )
}

function NewRepoScreen({ me, onBack, onDone }: { me: GhUser | null; onBack: () => void; onDone: () => void }) {
  const token = useSettings((s) => s.token)
  const switchRepo = useWorkspace((s) => s.switchRepo)
  const busy = useWorkspace((s) => s.busy)
  const [orgs, setOrgs] = useState<string[]>([])
  const [owner, setOwner] = useState(me?.login ?? '')
  const [name, setName] = useState('peeponote-boards')
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    listOrgs(token).then(setOrgs, () => {})
  }, [token])

  const repoName = slug(name)

  const create = async () => {
    if (!me || !repoName) return
    setWorking(true)
    setProblem(undefined)
    try {
      await createRepo(token, owner, me.login, repoName)
      const ok = await switchRepo(`https://github.com/${owner}/${repoName}.git`, token)
      if (ok) return onDone()
      setProblem('The repo was created, but opening it failed. Try it again from Settings → Sync.')
    } catch (e) {
      setProblem(
        e instanceof GhError && e.status === 422
          ? `There is already a repo called ${owner}/${repoName}. Pick another name, or open that one on the previous screen.`
          : e instanceof GhError && e.status === 403
            ? `You cannot create repos in ${owner}. Choose yourself as the owner, or ask an admin there.`
            : plainGhError(e),
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <Screen
      peepo="peepoHey"
      title="A new repo for your boards"
      sub="Private, empty, and set up on the first Save."
      footer={
        <>
          <button className={primary} disabled={working || !!busy || !repoName} onClick={() => void create()}>
            {working || busy ? 'Creating…' : 'Create and open'}
          </button>
          <button className={ghost} onClick={onBack}>
            Back
          </button>
        </>
      }
    >
      <div>
        <Label>Owner</Label>
        <select className={field} value={owner} onChange={(e) => setOwner(e.target.value)}>
          {me && <option value={me.login}>You (@{me.login})</option>}
          {orgs.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Name</Label>
        <input className={`${field} font-mono`} autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
        <p className="mt-1 text-[11px] text-frog-200/50">
          github.com/{owner}/{repoName || '…'}
        </p>
      </div>
      <Problem>{problem}</Problem>
    </Screen>
  )
}

const Label = ({ children }: { children: ReactNode }) => <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-frog-200/50">{children}</div>

function Row({ title, icon, onClick, disabled }: { title: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-(--hover) disabled:opacity-40">
      <span className="text-[13px]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</span>
      <span className="text-[11px] text-frog-200/40">open</span>
    </button>
  )
}

const shortUrl = (u: string) => u.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '')

// ------------------------------------------------------------------------------------- no GitHub

function LocalScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const settings = useSettings()
  return (
    <Screen
      peepo="peepoHey"
      title="Who is making the changes?"
      sub="Every Save is a git commit, and a commit carries a name. This stays in this browser."
      footer={
        <>
          <button className={primary} disabled={!settings.authorName.trim()} onClick={onDone}>
            Continue
          </button>
          <button className={ghost} onClick={onBack}>
            Back
          </button>
        </>
      }
    >
      <input className={field} autoFocus placeholder="Your name" value={settings.authorName} onChange={(e) => settings.set({ authorName: e.target.value })} />
      <input className={field} type="email" placeholder="Email (optional)" value={settings.authorEmail} onChange={(e) => settings.set({ authorEmail: e.target.value })} />
      <p className="text-[11px] text-frog-200/50">
        The boards are kept in this browser. You can connect GitHub any time in Settings → Sync, or keep them in a folder on your disk from Settings → Storage.
      </p>
    </Screen>
  )
}

// ----------------------------------------------------------------------------------------- done

function DoneScreen({ onDone }: { onDone: () => void }) {
  const name = useSettings((s) => s.authorName)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  return (
    <>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <Peepo name="peepoClap" size={88} className="peepo-bounce" />
        <h2 className="text-2xl font-black tracking-tight">You're set{name ? `, ${name}` : ''}!</h2>
        <ul className="text-left text-[13px] text-frog-200/80">
          <li>· Grab items from the palette on the left, or double-click the canvas for a note</li>
          <li>· Drop any file onto the board: images, audio, 3D, code, fonts…</li>
          <li>· Drag from a card's edge dots to draw arrows</li>
          <li>
            · <b>{kbd('⌘S')}</b> saves = commit{remoteUrl ? ' + push' : ''}
          </li>
          <li>· Right-click for copy / paste / duplicate</li>
        </ul>
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={onDone} className={primary}>
          Start
        </button>
      </div>
    </>
  )
}
