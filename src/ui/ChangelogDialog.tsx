import { useEffect, useState } from 'react'
import { useSettings } from '../store/settings'
import { APP_VERSION, CHANGELOG, releasesSince, type Release } from '../version'
import { Peepo } from './Peepo'

/**
 * What's new. Opens by itself once after an update (Settings → About turns that off) and any time from the
 * version in the sidebar. The releases you haven't seen come first, the rest are one click away.
 */
export function ChangelogDialog({ onClose, afterUpdate }: { onClose: () => void; afterUpdate?: boolean }) {
  const seen = useSettings((s) => s.lastSeenVersion)
  const set = useSettings((s) => s.set)
  const showOnUpdate = useSettings((s) => s.showChangelogOnUpdate)
  const [fresh] = useState(() => (afterUpdate ? releasesSince(seen) : [CHANGELOG[0]]))
  const older = CHANGELOG.filter((r) => !fresh.includes(r))
  const [showOlder, setShowOlder] = useState(false)

  const close = () => {
    set({ lastSeenVersion: APP_VERSION })
    onClose()
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-(--hair) bg-swamp-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-4">
          <Peepo name="peepoClap" size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-xl font-black tracking-tight">{afterUpdate ? 'peeponote just updated' : "What's new"}</div>
            <div className="text-[11px] text-frog-200/50">You're on {APP_VERSION}</div>
          </div>
          <button onClick={close} className="text-frog-200/60 hover:text-white">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 scrollbar-thin">
          {fresh.map((r) => (
            <ReleaseNotes key={r.version} release={r} />
          ))}
          {older.length > 0 && (
            <div className="mt-2 border-t border-(--hair) pt-2">
              <button onClick={() => setShowOlder((o) => !o)} className="text-[12px] font-semibold text-frog-200/70 hover:text-white">
                {showOlder ? '▾' : '▸'} Older versions ({older.length})
              </button>
              {showOlder && <div className="mt-3">{older.map((r) => <ReleaseNotes key={r.version} release={r} muted />)}</div>}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-(--hair) px-5 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-frog-200/60 hover:text-frog-100">
            <input type="checkbox" checked={showOnUpdate} onChange={(e) => set({ showChangelogOnUpdate: e.target.checked })} className="accent-frog-500" />
            Show this after an update
          </label>
          <button onClick={close} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function ReleaseNotes({ release, muted }: { release: Release; muted?: boolean }) {
  return (
    <div className={`mb-4 last:mb-0 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-baseline gap-2">
        <span className="rounded-md bg-frog-700/50 px-1.5 py-0.5 font-mono text-[12px] font-bold text-frog-100">{release.version}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{release.title}</span>
        <span className="text-[11px] text-frog-200/40">{release.date}</span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {release.notes.map((n, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-frog-100/90">
            <span className="text-frog-300">•</span>
            <span className="min-w-0">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** open it from anywhere (the sidebar version, Settings → About) */
export const openChangelog = () => window.dispatchEvent(new CustomEvent('peeponote:changelog'))
