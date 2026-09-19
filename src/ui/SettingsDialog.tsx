import { useEffect, useState } from 'react'
import { supportsFolderAccess } from '../fs'
import { wipeBrowserFS } from '../fs/lightning'
import { DEFAULT_CORS_PROXY } from '../git/repo'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { toast } from '../store/toast'
import { clearAssetCache } from '../cards/useAssetUrl'
import { Peepo } from './Peepo'

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
      <div className="max-h-full w-full max-w-xl overflow-auto rounded-2xl border border-white/10 bg-swamp-800 p-5 shadow-2xl scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <Peepo name="peepoShy" size={40} />
          <div className="flex-1">
            <div className="text-xl font-black">Settings</div>
            <div className="text-[12px] text-frog-200/60">Stored in this browser only. Your token never leaves it (except to the git host).</div>
          </div>
          <button onClick={onClose} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>

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

        <section className="space-y-2">
          <div className={label}>Canvas</div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={settings.snapToGrid} onChange={(e) => settings.set({ snapToGrid: e.target.checked })} className="accent-frog-500" />
            Snap cards to grid
          </label>
          <p className="text-[11px] text-frog-200/50">
            Shortcuts: ⌘S save · ⌘A select all · ⌘0 reset zoom · Space/Alt+drag or middle-mouse pans · ⌘/Ctrl+wheel zooms · Del deletes · double-click writes a note
          </p>
        </section>
      </div>
    </div>
  )
}
