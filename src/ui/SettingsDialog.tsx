import { useEffect, useState } from 'react'
import { supportsFolderAccess } from '../fs'
import { wipeBrowserFS } from '../fs/lightning'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { toast } from '../store/toast'
import { clearAssetCache } from '../cards/useAssetUrl'
import { exportRepoZip } from '../git/exportZip'
import { Peepo } from './Peepo'
import { THEMES, type ThemeName } from '../theme/themes'

const field = 'w-full rounded-md bg-swamp-700 px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const label = 'text-[11px] font-bold uppercase tracking-wider text-frog-200/60'
const btn = 'rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const fs = useWorkspace((s) => s.fs)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const setRemote = useWorkspace((s) => s.setRemote)
  const switchToFolder = useWorkspace((s) => s.switchToFolder)
  const switchToBrowser = useWorkspace((s) => s.switchToBrowser)
  const cloneInto = useWorkspace((s) => s.cloneInto)
  const busy = useWorkspace((s) => s.busy)
  const meta = useWorkspace((s) => s.meta)
  const updateMeta = useWorkspace((s) => s.updateMeta)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const flush = useWorkspace((s) => s.flush)
  const [zipping, setZipping] = useState(false)
  const [remote, setRemoteDraft] = useState(remoteUrl ?? '')
  const [cloneUrl, setCloneUrl] = useState('')
  const [showToken, setShowToken] = useState(false)

  useEffect(() => setRemoteDraft(remoteUrl ?? ''), [remoteUrl])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const saveRemote = async () => {
    await setRemote(remote)
    toast.ok(remote ? 'Remote saved' : 'Remote removed', 'FeelsOkayMan')
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-xl overflow-auto rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <Peepo name="peepoShy" size={40} />
          <div className="flex-1">
            <div className="text-xl font-black">Settings</div>
            <div className="text-[12px] text-frog-200/60">Two kinds of settings: shared ones travel with the repo, personal ones stay in this browser.</div>
          </div>
          <button onClick={onClose} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>

        <GroupHeader title="This workspace" hint="Saved in peeponote.json — committed and shared with everyone who clones the repo." tone="repo" />

        <section className="mb-5 space-y-2">
          <div className={label}>Name</div>
          <input
            className={field}
            placeholder="peeponote"
            value={meta?.name ?? ''}
            disabled={!meta || !!viewingRef}
            onChange={(e) => updateMeta({ name: e.target.value })}
          />
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={!!meta?.settings?.snapToGrid}
              disabled={!meta || !!viewingRef}
              onChange={(e) => updateMeta({ settings: { snapToGrid: e.target.checked } })}
              className="accent-frog-500"
            />
            Snap cards to grid
          </label>
          <p className="text-[11px] text-frog-200/50">
            The remote URL is also repo-level, but lives in <code>.git/config</code> of this clone — it's set below and never committed.
          </p>
        </section>

        <GroupHeader title="You" hint="Stored in this browser's localStorage only. Never written to the repo; your token only ever goes to the git host." tone="user" />

        <section className="mb-5 space-y-2">
          <div className={label}>Storage</div>
          <div className="rounded-lg bg-swamp-700/60 p-3 text-[13px]">
            <div className="mb-2">
              Currently: <b>{fs?.label}</b>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btn} disabled={!supportsFolderAccess || !!busy} onClick={switchToFolder} title={supportsFolderAccess ? '' : 'Needs a Chromium browser'}>
                📁 Use a folder on disk
              </button>
              <button className={btn} disabled={fs?.kind === 'browser' || !!busy} onClick={switchToBrowser}>
                🧠 Use browser storage
              </button>
              {fs?.kind === 'browser' && (
                <button
                  className={`${btn} text-red-200`}
                  disabled={!!busy}
                  onClick={async () => {
                    if (!confirm('Wipe the browser repo? Anything not pushed is gone forever. monkaS')) return
                    await wipeBrowserFS()
                    clearAssetCache()
                    await switchToBrowser()
                  }}
                >
                  🗑 Wipe browser repo
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-frog-200/50">
              A folder gives you a real <code>.git</code> you can use from a terminal. Browser storage lives in IndexedDB. Both are full git repos.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-(--hair) pt-3">
              <button
                className={btn}
                disabled={!fs || !!busy || zipping}
                onClick={async () => {
                  if (!fs) return
                  setZipping(true)
                  try {
                    await flush()
                    await exportRepoZip(fs, meta?.name)
                    toast.ok('Zipped the whole repo. peepoPog', 'peepoPog')
                  } catch (e) {
                    toast.err(`Export failed: ${(e as Error).message}`)
                  } finally {
                    setZipping(false)
                  }
                }}
              >
                {zipping ? '⏳ Zipping…' : '🗜 Download repo as .zip'}
              </button>
              <span className="text-[11px] text-frog-200/50">Includes <code>.git</code> — unzip anywhere and it's a working clone with full history.</span>
            </div>
          </div>
        </section>

        <section className="mb-5 space-y-2">
          <div className={label}>Author</div>
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Name" value={settings.authorName} onChange={(e) => settings.set({ authorName: e.target.value })} />
            <input className={field} placeholder="email@example.com" value={settings.authorEmail} onChange={(e) => settings.set({ authorEmail: e.target.value })} />
          </div>
        </section>

        <section className="mb-5 space-y-2">
          <div className={label}>Remote (git over HTTPS)</div>
          <div className="flex gap-2">
            <input className={field} placeholder="https://github.com/you/my-boards.git" value={remote} onChange={(e) => setRemoteDraft(e.target.value)} />
            <button className={btn} onClick={saveRemote} disabled={remote === (remoteUrl ?? '')}>
              Save
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className={field}
              type={showToken ? 'text' : 'password'}
              placeholder="Personal access token (repo scope / contents: read+write)"
              value={settings.token}
              onChange={(e) => settings.set({ token: e.target.value })}
            />
            <button className={btn} onClick={() => setShowToken((v) => !v)}>
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            className={field}
            placeholder="Username (leave empty for GitHub; use 'oauth2' for GitLab)"
            value={settings.username}
            onChange={(e) => settings.set({ username: e.target.value })}
          />
          <input className={field} placeholder={DEFAULT_CORS_PROXY} value={settings.corsProxy} onChange={(e) => settings.set({ corsProxy: e.target.value })} />
          <p className="text-[11px] text-frog-200/50">
            Browsers can't talk to GitHub's git endpoint directly, so pushes go through a CORS proxy. The default is the public isomorphic-git demo proxy (rate limited, don't
            trust it with secrets you care about). Self-host <code>proxy/worker.ts</code> from the repo for your own.
          </p>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={settings.autoPush} onChange={(e) => settings.set({ autoPush: e.target.checked })} className="accent-frog-500" />
            Auto-yeet after every save
          </label>
        </section>

        <section className="mb-5 space-y-2">
          <div className={label}>Clone an existing peeponote repo</div>
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
          <p className="text-[11px] text-frog-200/50">Only into empty storage: wipe the browser repo or pick an empty folder first.</p>
        </section>

        <section className="mb-5 space-y-2">
          <div className={label}>Theme</div>
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
        </section>

        <p className="text-[11px] text-frog-200/50">
          Shortcuts: ⌘S save · ⌘A select all · ⌘0 reset zoom · Space/Alt+drag or middle-mouse pans · ⌘/Ctrl+wheel zooms · Del deletes · double-click writes a note
        </p>
      </div>
    </div>
  )
}

function GroupHeader({ title, hint, tone }: { title: string; hint: string; tone: 'repo' | 'user' }) {
  return (
    <div className="mb-3 mt-1 flex items-start gap-2 border-t border-(--hair) pt-4 first:mt-0 first:border-0 first:pt-0">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
          tone === 'repo' ? 'bg-frog-700/50 text-frog-100' : 'bg-swamp-600 text-frog-100'
        }`}
      >
        {tone === 'repo' ? 'repo' : 'local'}
      </span>
      <div>
        <div className="text-[14px] font-extrabold">{title}</div>
        <div className="text-[11px] text-frog-200/50">{hint}</div>
      </div>
    </div>
  )
}
