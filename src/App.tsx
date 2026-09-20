import { useEffect, useState } from 'react'
import { Canvas } from './canvas/Canvas'
import { selectBoards, selectDirty, useWorkspace } from './store/workspace'
import { Sidebar } from './ui/Sidebar'
import { TopBar } from './ui/TopBar'
import { HistoryPanel } from './ui/HistoryPanel'
import { SettingsDialog } from './ui/SettingsDialog'
import { Toasts } from './ui/Toasts'
import { Peepo } from './ui/Peepo'
import { BootScreen } from './ui/BootScreen'
import { Onboarding } from './ui/Onboarding'
import { SyncDialog } from './ui/SyncDialog'
import { useSettings } from './store/settings'
import { applyTheme, resolveTheme } from './theme/themes'
import { useIsMobile } from './canvas/touch'

export default function App() {
  const status = useWorkspace((s) => s.status)
  const boot = useWorkspace((s) => s.boot)
  const save = useWorkspace((s) => s.save)
  const currentBoardId = useWorkspace((s) => s.currentBoardId)
  const board = useWorkspace((s) => (s.currentBoardId ? selectBoards(s)[s.currentBoardId] : undefined))
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const busy = useWorkspace((s) => s.busy)
  const busyDetail = useWorkspace((s) => s.busyDetail)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const mobile = useIsMobile()
  // first run: no identity yet and the wizard was never finished/skipped — decided once, at startup
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const s = useSettings.getState()
    return !s.onboarded && !s.authorName
  })

  useEffect(() => {
    boot()
  }, [boot])

  const themeName = useSettings((s) => s.theme)
  useEffect(() => applyTheme(resolveTheme(themeName)), [themeName])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // background pull: every 45s while visible, and right when the tab comes back into view
  const autoPull = useSettings((s) => s.autoPull)
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  useEffect(() => {
    if (!autoPull || !remoteUrl || status !== 'ready') return
    const tick = () => void useWorkspace.getState().autoSync()
    const id = setInterval(tick, 45_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    const first = setTimeout(tick, 4_000)
    return () => {
      clearInterval(id)
      clearTimeout(first)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [autoPull, remoteUrl, status])

  // edits are written to the working tree continuously; make sure the last ones land before we go
  useEffect(() => {
    const onHide = () => void useWorkspace.getState().flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  if (status !== 'ready') return <BootScreen onOpenSettings={() => setShowSettings(true)} />

  return (
    <div className="flex h-full w-full">
      {mobile ? (
        showSidebar && (
          <div className="fixed inset-0 z-40 flex" onClick={() => setShowSidebar(false)}>
            <div className="h-full shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
              <Sidebar onOpenSettings={() => setShowSettings(true)} onNavigate={() => setShowSidebar(false)} onClose={() => setShowSidebar(false)} />
            </div>
            <div className="flex-1 bg-black/50" />
          </div>
        )
      ) : (
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleHistory={() => setShowHistory((v) => !v)}
          historyOpen={showHistory}
          onOpenSettings={() => setShowSettings(true)}
          onToggleSidebar={mobile ? () => setShowSidebar((v) => !v) : undefined}
        />
        <div className="relative flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {board && currentBoardId ? (
              <Canvas key={`${board.id}:${viewingRef ?? 'live'}`} board={board} readOnly={!!viewingRef} />
            ) : (
              <div className="flex h-full items-center justify-center text-frog-200/60">Board not found</div>
            )}
            {viewingRef ? <HistoryBanner /> : <UncommittedBanner />}
            {busy && busy !== 'saving' && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <div className="flex items-center gap-2 rounded-full bg-swamp-600/90 px-3 py-1 text-sm shadow">
                  <Peepo name={busy === 'pushing' || busy === 'syncing' ? 'peepoRun' : busy === 'cloning' ? 'peepoLeave' : 'peepoThink'} size={22} className="peepo-bounce" />
                  {busyDetail ?? `${busy}…`}
                </div>
              </div>
            )}
          </div>
          {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} mobile={mobile} />}
        </div>
      </div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showOnboarding && <Onboarding onFinish={() => setShowOnboarding(false)} />}
      <SyncDialog />
      <Toasts />
    </div>
  )
}

function UncommittedBanner() {
  const dirty = useWorkspace(selectDirty)
  const busy = useWorkspace((s) => s.busy)
  const save = useWorkspace((s) => s.save)
  if (!dirty) return null
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-4 flex justify-center max-md:bottom-20">
      <div className="pointer-events-auto flex items-center justify-center gap-3 rounded-xl border border-amber-400/30 bg-swamp-900/90 px-4 py-2 text-sm text-amber-100 shadow-lg backdrop-blur">
        <Peepo name="peepoShy" size={24} />
        <span>
          <span className="max-md:hidden">Commit to make these changes visible for other people</span>
          <span className="md:hidden">Unsaved changes</span>
        </span>
        <button
          onClick={() => save()}
          disabled={!!busy}
          className="rounded-md bg-frog-500 px-2.5 py-1 font-bold text-white hover:bg-frog-400 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function HistoryBanner() {
  const viewingRef = useWorkspace((s) => s.viewingRef)
  const viewCommit = useWorkspace((s) => s.viewCommit)
  const restoreCommit = useWorkspace((s) => s.restoreCommit)
  return (
    <div className="absolute inset-x-2 bottom-4 flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-400/40 bg-amber-900/80 px-4 py-2 text-sm text-amber-100 shadow-lg backdrop-blur">
        <Peepo name="monkaS" size={24} />
        <span>
          Viewing commit <code className="font-mono">{viewingRef?.slice(0, 7)}</code> — read only
        </span>
        <button onClick={() => viewCommit(null)} className="rounded-md bg-(--hover-strong) px-2 py-1 font-semibold hover:bg-(--hover-strong)">
          Back to now
        </button>
        <button
          onClick={() => {
            if (confirm('Reset the board to this commit? Later commits will be dropped from this branch.')) restoreCommit(viewingRef!)
          }}
          className="rounded-md bg-amber-500 px-2 py-1 font-semibold text-black hover:bg-amber-400"
        >
          Restore this version
        </button>
      </div>
    </div>
  )
}
