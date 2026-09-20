import { useEffect, useState } from 'react'
import { checkAccess, type AccessResult } from '../git/access'
import { useSettings, type RepoEntry } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { wipeBrowserFS } from '../fs/lightning'
import { confirm } from './confirm'
import { Peepo } from './Peepo'
import { TokenHelp } from './TokenHelp'

const field = 'w-full rounded-md bg-swamp-700 px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-frog-400 placeholder:text-frog-200/30'
const btn = 'rounded-md bg-swamp-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-500 disabled:opacity-40'

/**
 * Switch to another shared repo. You type the address and the token that goes with it; we check the
 * pair against the host right here, and only a working pair can be opened. Repos you've used before
 * are listed below (each keeps its own clone and token), one click to go back.
 */
export function ChangeRepoDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const current = useWorkspace((s) => s.remoteUrl)
  const fs = useWorkspace((s) => s.fs)
  const busy = useWorkspace((s) => s.busy)
  const busyDetail = useWorkspace((s) => s.busyDetail)
  const switchRepo = useWorkspace((s) => s.switchRepo)
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<AccessResult | null>(null)
  const [checkedPair, setCheckedPair] = useState('')

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const pair = `${url.trim()}\n${token.trim()}`
  const verified = result?.ok && checkedPair === pair
  const canCheck = url.trim().length > 8 && !checking && !busy

  const check = async () => {
    setChecking(true)
    setResult(null)
    const r = await checkAccess(url, token, settings.transport, settings.corsProxy, settings.username)
    setResult(r)
    setCheckedPair(pair)
    setChecking(false)
  }
  const open = async (u: string, t: string) => {
    const ok = await switchRepo(u, t)
    if (ok) onClose()
  }
  const forget = async (e: RepoEntry) => {
    const ok = await confirm({
      title: `Forget ${short(e.url)}?`,
      message: 'Its local copy in this browser is deleted too. The repo on the server is untouched — you can add it again any time.',
      confirmLabel: 'Forget',
      danger: true,
    })
    if (!ok) return
    settings.forgetRepo(e.url)
    if (e.url !== current) await wipeBrowserFS(e.slot).catch(() => {})
  }

  const others = settings.repos.filter((r) => r.url !== current)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <Peepo name="peepoRun" size={40} />
          <div className="flex-1">
            <div className="text-lg font-black">Change repo</div>
            <div className="text-[12px] text-frog-200/60">
              {current ? (
                <>
                  Now on <b className="text-frog-100">{short(current)}</b>. It stays saved here; you can come back below.
                </>
              ) : (
                'Open a shared repo.'
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-2 rounded-xl bg-swamp-700/60 p-3">
          <input
            className={field}
            placeholder="https://github.com/team/boards.git"
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canCheck && check()}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className={field}
              type={show ? 'text' : 'password'}
              placeholder="Access token for this repo"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canCheck && check()}
            />
            <button className={btn} onClick={() => setShow((v) => !v)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <TokenHelp remote={url} />
          <div className="flex items-center gap-2 pt-1">
            <button className={btn} disabled={!canCheck} onClick={check}>
              {checking ? 'Checking…' : 'Check access'}
            </button>
            <button
              className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!verified || !!busy}
              title={verified ? '' : 'Check access first'}
              onClick={() => open(url, token)}
            >
              {busy === 'cloning' ? busyDetail || 'Opening…' : 'Open this repo'}
            </button>
            {result && checkedPair === pair && (
              <span className={`text-[12px] ${result.ok ? 'text-frog-200' : 'text-red-200'}`}>
                {result.ok ? `✓ ${result.name}${result.canPush ? ' — you can save here' : ''}${result.empty ? ' (empty repo, will be set up)' : ''}` : `✗ ${result.error}`}
              </span>
            )}
            {result && checkedPair !== pair && <span className="text-[12px] text-frog-200/50">changed — check again</span>}
          </div>
          {result?.ok && result.note && checkedPair === pair && <div className="text-[11px] text-amber-200/80">{result.note}</div>}
          {fs?.kind === 'folder' && (
            <div className="text-[11px] text-frog-200/50">The new repo is kept in browser storage. Your current folder on disk is left as it is.</div>
          )}
        </div>

        {others.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-frog-200/60">Previous repos</div>
            <div className="max-h-48 space-y-1 overflow-auto scrollbar-thin">
              {others.map((e) => (
                <div key={e.url} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-(--hover)">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{short(e.url)}</div>
                    <div className="text-[11px] text-frog-200/50">
                      last used {new Date(e.lastUsed).toLocaleDateString()} · {e.token ? 'token saved' : 'no token'}
                    </div>
                  </div>
                  <button className={btn} disabled={!!busy} onClick={() => open(e.url, e.token)}>
                    Open
                  </button>
                  <button className="rounded-md px-2 py-1 text-[12px] text-frog-200/50 hover:bg-red-900/40 hover:text-red-100" title="Forget" onClick={() => forget(e)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const short = (u: string) => u.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '')
