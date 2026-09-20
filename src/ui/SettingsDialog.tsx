import { useEffect, useState, type ReactNode } from 'react'
import { revealFolder, supportsFolderAccess } from '../fs'
import { wipeBrowserFS } from '../fs/lightning'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import { TokenHelp } from './TokenHelp'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { toast } from '../store/toast'
import { clearAssetCache } from '../cards/useAssetUrl'
import { exportRepoZip } from '../git/exportZip'
import { Peepo } from './Peepo'
import { THEMES, type ThemeName } from '../theme/themes'
import { confirm } from './confirm'
import { ChangeRepoDialog } from './ChangeRepoDialog'
import { useReview } from '../store/review'
import { Avatar } from '../review/Avatar'

const field = 'w-full rounded-md bg-swamp-700 px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const btn = 'rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'
const hint = 'text-[11px] leading-relaxed text-frog-200/50'

type Tab = 'you' | 'sync' | 'board' | 'storage' | 'look'
const TABS: { id: Tab; title: string; icon: string }[] = [
  { id: 'you', title: 'You', icon: '🙂' },
  { id: 'sync', title: 'Sync', icon: '☁️' },
  { id: 'board', title: 'Workspace', icon: '🐸' },
  { id: 'storage', title: 'Storage', icon: '💾' },
  { id: 'look', title: 'Look', icon: '🎨' },
]

/**
 * Settings, one tab per question: "how do I share?" (Sync), "what's in this repo?" (Workspace),
 * "where does it live on this machine?" (Storage), "how does it look?" (Look). Rarely-needed knobs sit
 * behind an "Advanced" fold so the first screen is just remote + token + your name.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const [tab, setTab] = useState<Tab>(() => (remoteUrl ? 'you' : 'sync'))

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-(--hair) bg-swamp-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-4">
          <Peepo name="peepoShy" size={36} />
          <div className="flex-1 text-xl font-black">Settings</div>
          <button onClick={onClose} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-[13px] font-bold ${tab === t.id ? 'bg-swamp-700 text-white' : 'text-frog-200/70 hover:bg-swamp-700/50 hover:text-white'}`}
            >
              <span className="text-[13px]">{t.icon}</span>
              {t.title}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-swamp-700/60 p-5 scrollbar-thin">
          {tab === 'you' && <YouTab />}
          {tab === 'sync' && <SyncTab />}
          {tab === 'board' && <WorkspaceTab />}
          {tab === 'storage' && <StorageTab />}
          {tab === 'look' && <LookTab />}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-(--hair) px-5 py-2.5">
          <span className="text-[11px] text-frog-200/50">⌘S save · ⌘Z undo · ⌘0 reset zoom · ⌘/Ctrl+wheel zoom · Space+drag pans · Del deletes</span>
          <ClearSettingsButton onDone={onClose} />
        </div>
      </div>
    </div>
  )
}

function Row({ title, children, sub }: { title: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-frog-200/60">{title}</div>
      {children}
      {sub && <div className={`mt-1 ${hint}`}>{sub}</div>}
    </div>
  )
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border-t border-(--hair) pt-2">
      <button onClick={() => setOpen((o) => !o)} className="text-[12px] font-semibold text-frog-200/70 hover:text-white">
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------- Sync

function SyncTab() {
  const settings = useSettings()
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const setRemote = useWorkspace((s) => s.setRemote)
  const [remote, setRemoteDraft] = useState(remoteUrl ?? '')
  const [showToken, setShowToken] = useState(false)
  const [changing, setChanging] = useState(false)
  const repos = useSettings((s) => s.repos)
  useEffect(() => setRemoteDraft(remoteUrl ?? ''), [remoteUrl])

  const saveRemote = async () => {
    await setRemote(remote)
    toast.ok(remote ? 'Remote saved' : 'Remote removed', 'FeelsOkayMan')
  }
  const ready = !!remoteUrl && !!settings.token.trim()

  return (
    <>
      <p className={`mb-4 ${hint}`}>
        Save = commit. With a remote and a token, Save also brings in what others pushed and pushes yours.{' '}
        {ready ? <b className="text-frog-200">Sharing is on.</b> : 'Fill in the two fields below to share boards.'}
      </p>
      <Row title="Repository" sub="Where the boards are shared. Everyone on the team uses the same URL.">
        <div className="mb-2 flex items-center gap-2">
          <button className={`${btn} bg-frog-700/60 hover:bg-frog-600`} onClick={() => setChanging(true)}>
            ⇄ Change repo…
          </button>
          <span className={hint}>{repos.length > 1 ? `${repos.length - 1} other repo${repos.length === 2 ? '' : 's'} remembered` : 'Open another shared repo, or go back to a previous one.'}</span>
        </div>
        {changing && <ChangeRepoDialog onClose={() => setChanging(false)} />}
        <div className="flex gap-2">
          <input
            className={field}
            placeholder="https://github.com/you/my-boards.git"
            value={remote}
            onChange={(e) => setRemoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && remote !== (remoteUrl ?? '') && saveRemote()}
          />
          <button className={btn} onClick={saveRemote} disabled={remote === (remoteUrl ?? '')}>
            Save
          </button>
        </div>
      </Row>
      <Row title="Access token">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            className={field}
            type={showToken ? 'text' : 'password'}
            placeholder="Personal access token"
            value={settings.token}
            onChange={(e) => settings.set({ token: e.target.value })}
          />
          <button className={btn} onClick={() => setShowToken((v) => !v)}>
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
        <TokenHelp remote={remote} className="mt-2" />
      </Row>
      <label className="flex items-start gap-2 text-[13px]">
        <input type="checkbox" checked={settings.autoPull} onChange={(e) => settings.set({ autoPull: e.target.checked })} className="mt-0.5 accent-frog-500" />
        <span>
          Bring in others' saves automatically
          <div className={hint}>Checked every 15 s. Their changes slide in under your unsaved edits when nothing clashes; otherwise you're asked. Off = you get a toast with a Pull button instead.</div>
        </span>
      </label>

      <Fold title="Advanced: non-GitHub hosts, transport, proxy">
        <Row title="Username" sub="Leave empty for GitHub. GitLab wants 'oauth2'.">
          <input className={field} placeholder="Username" value={settings.username} onChange={(e) => settings.set({ username: e.target.value })} />
        </Row>
        <Row title="Transport">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['auto', 'Auto', 'GitHub → REST API, anything else → proxy'],
                ['api', 'GitHub API', 'api.github.com directly, no proxy. Objects are recreated 1:1 (same commit ids).'],
                ['proxy', 'git over HTTP', 'Standard git protocol through a CORS proxy. Works with any host.'],
              ] as const
            ).map(([v, title, tip]) => (
              <button
                key={v}
                title={tip}
                onClick={() => settings.set({ transport: v })}
                className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 ${settings.transport === v ? 'bg-frog-700/50 ring-frog-400' : 'ring-(--hair) hover:bg-(--hover)'}`}
              >
                {title}
              </button>
            ))}
          </div>
          <p className={`mt-1.5 ${hint}`}>
            {settings.transport === 'proxy'
              ? "Browsers can't reach git smart-HTTP endpoints directly (no CORS), so requests go through a proxy. The default is the public isomorphic-git demo proxy — rate limited; self-host proxy/worker.ts for real use."
              : 'GitHub remotes talk to api.github.com directly — no third party in between. Non-GitHub hosts fall back to the proxy.'}
          </p>
          {settings.transport !== 'api' && (
            <input className={`${field} mt-2`} placeholder={DEFAULT_CORS_PROXY} value={settings.corsProxy} onChange={(e) => settings.set({ corsProxy: e.target.value })} />
          )}
        </Row>
      </Fold>
    </>
  )
}

function YouTab() {
  const settings = useSettings()
  const identity = useReview((s) => s.identity)
  const open = () => window.dispatchEvent(new CustomEvent('peeponote:identify'))
  if (identity.kind === 'verified') {
    return (
      <>
        <p className={`mb-4 ${hint}`}>Who you are in this workspace: the author of your saves, and a verified voice in comments and reviews.</p>
        <Row title="Identity" sub="Name and email are part of your identity key, so they're fixed now. Use the dialog to change the picture or log out on this device.">
        <div className="flex items-center gap-3 rounded-lg bg-swamp-800/60 p-2">
          <Avatar person={identity.account} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold">{identity.account.name}</div>
            <div className="truncate text-[11px] text-frog-200/60">{identity.account.email}</div>
          </div>
          <span className="text-[11px] text-frog-300">✓ verified</span>
          <button className={btn} onClick={open}>
            Manage…
          </button>
        </div>
        </Row>
      </>
    )
  }
  return (
    <>
      <p className={`mb-4 ${hint}`}>Who you are in this workspace: the author of your saves, and — with a password — a verified voice in comments and reviews.</p>
      <Row title="Your name on commits" sub="Shown to others as the author of your saves.">
      <div className="grid grid-cols-2 gap-2">
        <input className={field} placeholder="Name" value={settings.authorName} onChange={(e) => settings.set({ authorName: e.target.value })} />
        <input className={field} placeholder="email@example.com" value={settings.authorEmail} onChange={(e) => settings.set({ authorEmail: e.target.value })} />
      </div>
      </Row>
      <Row title="Password" sub={identity.kind === 'mismatch' ? "The password saved in this browser doesn't fit the account committed for your email." : 'Guest right now: you can edit boards, but not comment, review or get notifications.'}>
        <button className={`${btn} bg-frog-700/60 hover:bg-frog-600`} onClick={open}>
          🔑 {identity.kind === 'mismatch' ? 'Fix my password…' : 'Set a password…'}
        </button>
      </Row>
    </>
  )
}

// ----------------------------------------------------------------------------------------- Workspace

function WorkspaceTab() {
  const meta = useWorkspace((s) => s.meta)
  const wsRoot = useWorkspace((s) => s.wsRoot)
  const wsCandidates = useWorkspace((s) => s.wsCandidates)
  const setWsRoot = useWorkspace((s) => s.setWsRoot)
  const updateMeta = useWorkspace((s) => s.updateMeta)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const locked = !meta || !!viewingRef
  return (
    <>
      <p className={`mb-4 ${hint}`}>
        These live in <code>peeponote.json</code> inside the repo — saved and shared with everyone who opens it.
      </p>
      <Row title="Workspace name">
        <input className={field} placeholder="peeponote" value={meta?.name ?? ''} disabled={locked} onChange={(e) => updateMeta({ name: e.target.value })} />
      </Row>
      <label className="mb-4 flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={!!meta?.settings?.snapToGrid}
          disabled={locked}
          onChange={(e) => updateMeta({ settings: { snapToGrid: e.target.checked } })}
          className="accent-frog-500"
        />
        Snap cards to the dot grid (move and resize)
      </label>
      <label className="mb-4 flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={!!meta?.settings?.review?.authorOnlyClose}
          disabled={locked}
          onChange={(e) => updateMeta({ settings: { ...meta?.settings, review: { authorOnlyClose: e.target.checked } } })}
          className="mt-0.5 accent-frog-500"
        />
        <span>
          Only authors may resolve threads and close reviews
          <div className={hint}>Off (default): anyone can resolve a thread or close a review. On: only the comment's author resolves it and only the person who asked closes the review.</div>
        </span>
      </label>
      <Row
        title="Folder in the repo"
        sub={
          <>
            Boards live where <code>peeponote.json</code> is — the repo root or any subfolder of a monorepo (found automatically, up to 4 levels deep).
          </>
        }
      >
        {wsCandidates.length > 1 ? (
          <select value={wsRoot} onChange={(e) => void setWsRoot(e.target.value)} className={field}>
            {wsCandidates.map((c) => (
              <option key={c} value={c}>
                {c ? `/${c}/` : '/ (repo root)'}
              </option>
            ))}
          </select>
        ) : (
          <div className="font-mono text-[13px] text-frog-100">{wsRoot ? `/${wsRoot}/` : '/ (repo root)'}</div>
        )}
      </Row>
    </>
  )
}

// ------------------------------------------------------------------------------------------- Storage

function StorageTab() {
  const fs = useWorkspace((s) => s.fs)
  const busy = useWorkspace((s) => s.busy)
  const meta = useWorkspace((s) => s.meta)
  const switchToFolder = useWorkspace((s) => s.switchToFolder)
  const switchToBrowser = useWorkspace((s) => s.switchToBrowser)
  const cloneInto = useWorkspace((s) => s.cloneInto)
  const flush = useWorkspace((s) => s.flush)
  const [zipping, setZipping] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  return (
    <>
      <p className={`mb-4 ${hint}`}>
        The repo on this device. Currently: <b className="text-frog-100">{fs?.label}</b>. Both options are full git repos; a folder gives you a real <code>.git</code> you can also use
        from a terminal, browser storage lives in IndexedDB.
      </p>
      <Row title="Keep the repo in…">
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!supportsFolderAccess || !!busy} onClick={switchToFolder} title={supportsFolderAccess ? '' : 'Needs a Chromium browser'}>
            📁 A folder on disk
          </button>
          <button className={btn} disabled={fs?.kind === 'browser' || !!busy} onClick={switchToBrowser}>
            🧠 Browser storage
          </button>
        </div>
      </Row>
      {fs?.kind === 'folder' && (
        <Row
          title="Where is the folder?"
          sub="A web app can't open Finder / Explorer directly, so this opens the system folder dialog at your folder — the path is shown there, and you can drag the folder out of it. Cancel the dialog when done."
        >
          <button className={btn} onClick={() => revealFolder(fs).then((ok) => !ok && toast.err('The folder handle is gone — pick the folder again.'))}>
            🔍 Show folder location…
          </button>
        </Row>
      )}
      <Row title="Open a shared repo here" sub="Only into empty storage — wipe the browser repo or pick an empty folder first.">
        <div className="flex gap-2">
          <input className={field} placeholder="https://github.com/you/my-boards.git" value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)} />
          <button
            className={btn}
            disabled={!cloneUrl.trim() || !!busy}
            onClick={async () => {
              await cloneInto(cloneUrl)
              setCloneUrl('')
            }}
          >
            Clone
          </button>
        </div>
      </Row>
      <Row title="Backup" sub={<>Includes <code>.git</code> — unzip anywhere and it's a working clone with full history.</>}>
        <button
          className={btn}
          disabled={!fs || !!busy || zipping}
          onClick={async () => {
            if (!fs) return
            setZipping(true)
            try {
              await flush()
              await exportRepoZip(fs, meta?.name)
              toast.ok('Zipped the whole repo.', 'peepoPog')
            } catch (e) {
              toast.fail('Export failed', e)
            } finally {
              setZipping(false)
            }
          }}
        >
          {zipping ? '⏳ Zipping…' : '🗜 Download repo as .zip'}
        </button>
      </Row>
      {fs?.kind === 'browser' && (
        <Fold title="Danger zone">
          <button
            className={`${btn} text-red-200 hover:bg-red-900/40`}
            disabled={!!busy}
            onClick={async () => {
              const ok = await confirm({
                title: 'Wipe the browser repo?',
                message: 'Everything stored in this browser goes — boards, history, files. Anything not pushed to a remote is gone for good.',
                confirmLabel: 'Wipe it',
                danger: true,
              })
              if (!ok) return
              await wipeBrowserFS()
              clearAssetCache()
              await switchToBrowser()
            }}
          >
            🗑 Wipe browser repo
          </button>
        </Fold>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------- Look

function LookTab() {
  const settings = useSettings()
  return (
    <Row title="Theme" sub="Personal — only this browser.">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['dark', 'Dark'],
            ['peepo', 'Peepo'],
          ] as [ThemeName, string][]
        ).map(([name, title]) => {
          const t = THEMES[name]
          return (
            <button
              key={name}
              onClick={() => settings.set({ theme: name })}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold ring-1 ${
                settings.theme === name ? 'ring-frog-400 bg-frog-700/40' : 'ring-(--hair) hover:bg-(--hover)'
              }`}
            >
              <span className="flex overflow-hidden rounded-md ring-1 ring-black/20">
                <span className="h-5 w-3" style={{ background: t.swamp[900] }} />
                <span className="h-5 w-3" style={{ background: t.swamp[700] }} />
                <span className="h-5 w-3" style={{ background: t.frog[400] }} />
              </span>
              {title}
            </button>
          )
        })}
      </div>
    </Row>
  )
}

// ------------------------------------------------------------------------------------ clear settings

/** Forget every personal setting in this browser (token, name, theme, remembered folders/paths). The repo stays. */
function ClearSettingsButton({ onDone }: { onDone: () => void }) {
  const reset = useSettings((s) => s.reset)
  return (
    <button
      className="rounded-md px-2 py-1 text-[12px] font-semibold text-frog-200/60 hover:bg-red-900/40 hover:text-red-100"
      onClick={async () => {
        const ok = await confirm({
          title: 'Clear all settings?',
          message: 'Token, name, theme and remembered choices in this browser are forgotten. Your boards and the repo are untouched.',
          confirmLabel: 'Clear settings',
          danger: true,
        })
        if (!ok) return
        reset()
        for (const k of Object.keys(localStorage)) if (k.startsWith('peeponote-') && k !== 'peeponote-settings') localStorage.removeItem(k)
        toast.ok('Settings cleared.', 'peepoSit')
        onDone()
      }}
    >
      Clear settings
    </button>
  )
}
