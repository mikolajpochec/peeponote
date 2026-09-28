import { useEffect, useMemo, useRef } from 'react'
import { isAutoCommit } from '../git/repo'
import { useSettings } from '../store/settings'
import { useWorkspace } from '../store/workspace'
import { Peepo } from './Peepo'

function timeAgo(ts: number) {
  const d = Date.now() / 1000 - ts
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return new Date(ts * 1000).toLocaleDateString()
}

export function HistoryPanel({ onClose, mobile }: { onClose: () => void; mobile?: boolean }) {
  const commits = useWorkspace((s) => s.commits)
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const viewCommit = useWorkspace((s) => s.viewCommit)
  const refreshGit = useWorkspace((s) => s.refreshGit)
  const head = useWorkspace((s) => s.head)
  const historyDone = useWorkspace((s) => s.historyDone)
  const historyLoading = useWorkspace((s) => s.historyLoading)
  const loadMore = useWorkspace((s) => s.loadMoreHistory)
  const showAuto = useSettings((s) => s.showAutoCommits)
  const setSettings = useSettings((s) => s.set)
  const sentinel = useRef<HTMLLIElement>(null)

  // what peeponote committed by itself (review activity, merges) is noise here — unless you tick the box.
  // The one you're currently peeking at always stays in the list, so it can't vanish under you.
  const shown = useMemo(() => (showAuto ? commits : commits.filter((c) => c.oid === viewingRef || !isAutoCommit(c.commit.message))), [commits, showAuto, viewingRef])
  const hidden = commits.length - shown.length

  useEffect(() => {
    refreshGit()
  }, [refreshGit])

  // load the next page when the end of the list scrolls into view
  useEffect(() => {
    const el = sentinel.current
    if (!el || historyDone) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [historyDone, loadMore, commits.length, shown.length])

  return (
    <aside className={`flex shrink-0 flex-col border-l border-(--hair) bg-swamp-900 ${mobile ? 'absolute inset-0 z-30 w-full' : 'w-80'}`}>
      <div className="flex items-center gap-2 border-b border-(--hair) px-3 py-2">
        <Peepo name="peepoThink" size={24} />
        <div className="flex-1 text-sm font-extrabold">History</div>
        <span className="text-[11px] text-frog-200/50">
          {shown.length}
          {historyDone ? '' : '+'} commits
        </span>
        <button onClick={onClose} className="text-frog-200/60 hover:text-white">
          ✕
        </button>
      </div>
      <label
        className="flex cursor-pointer items-center gap-2 border-b border-(--hair) px-3 py-1.5 text-[11px] text-frog-200/60 hover:text-frog-100"
        title="Commits peeponote makes on its own: review activity (comments, verdicts, seen) and merges after a pull"
      >
        <input type="checkbox" checked={showAuto} onChange={(e) => setSettings({ showAutoCommits: e.target.checked })} className="accent-frog-500" />
        <span>Automatic commits</span>
        {!showAuto && hidden > 0 && (
          <span className="ml-auto text-frog-200/40">
            {hidden} hidden{historyDone ? '' : '+'}
          </span>
        )}
      </label>
      <ul className="min-h-0 flex-1 overflow-auto scrollbar-thin">
        {shown.map((c) => {
          const isHead = c.oid === head?.oid
          const active = viewingRef ? c.oid === viewingRef : isHead
          return (
            <li key={c.oid}>
              <button
                onClick={() => viewCommit(isHead ? null : c.oid)}
                className={`flex w-full flex-col gap-0.5 border-b border-(--hair) px-3 py-2 text-left hover:bg-swamp-700 ${active ? "bg-frog-700/40" : ""}`}
              >
                <div className="flex items-center gap-2 text-[13px]">
                  <span className={`h-2 w-2 rounded-full ${isHead ? 'bg-frog-300' : 'bg-frog-200/30'}`} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.commit.message.split('\n')[0]}</span>
                </div>
                <div className="flex gap-2 pl-4 text-[11px] text-frog-200/50">
                  <span className="font-mono text-frog-300/80">{c.oid.slice(0, 7)}</span>
                  <span>{c.commit.author.name}</span>
                  <span>·</span>
                  <span>{timeAgo(c.commit.author.timestamp)}</span>
                  {isHead && <span className="ml-auto font-bold text-frog-300">HEAD</span>}
                </div>
              </button>
            </li>
          )
        })}
        {commits.length === 0 && <li className="p-4 text-sm text-frog-200/50">No commits yet. Hit Save.</li>}
        {commits.length > 0 && shown.length === 0 && historyDone && (
          <li className="p-4 text-sm text-frog-200/50">Nothing but automatic commits so far — tick the box above to see them.</li>
        )}
        {commits.length > 0 && (
          <li ref={sentinel} className="p-3 text-center text-[11px] text-frog-200/40">
            {historyDone ? 'That\'s the whole history.' : historyLoading ? 'Loading older commits…' : ''}
          </li>
        )}
      </ul>
      <div className="border-t border-(--hair) p-2 text-[11px] text-frog-200/50">Click a commit to peek at that version. Restore from the banner.</div>
    </aside>
  )
}
