import { useWorkspace } from '../store/workspace'
import { Peepo } from './Peepo'

export function BootScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const status = useWorkspace((s) => s.status)
  const error = useWorkspace((s) => s.error)
  const grantFolder = useWorkspace((s) => s.grantFolder)
  const switchToBrowser = useWorkspace((s) => s.switchToBrowser)
  const pendingHandle = useWorkspace((s) => s.pendingHandle)
  const switchToFolder = useWorkspace((s) => s.switchToFolder)
  const fs = useWorkspace((s) => s.fs)
  const missing = /not.*found|NotFound|could not be found/i.test(error ?? '')

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Peepo name={status === 'error' ? 'PepeHands' : status === 'needs-permission' ? 'peepoShy' : 'peepoThink'} size={120} className={status === 'booting' ? 'peepo-bounce' : ''} />
      <h1 className="text-3xl font-black tracking-tight">peeponote</h1>
      {status === 'booting' && <p className="text-frog-200/70">mounting your swamp…</p>}
      {status === 'needs-permission' && (
        <>
          <p className="max-w-md text-frog-200/80">
            Last time you used the folder <b>{pendingHandle?.name}</b>. Browsers make us ask again before touching it.
          </p>
          <div className="flex gap-2">
            <button onClick={grantFolder} className="rounded-lg bg-frog-500 px-4 py-2 font-bold hover:bg-frog-400">
              Re-open folder
            </button>
            <button onClick={switchToBrowser} className="rounded-lg bg-swamp-600 px-4 py-2 font-bold hover:bg-swamp-500">
              Use browser storage instead
            </button>
          </div>
        </>
      )}
      {status === 'error' && (
        <>
          {missing && fs?.kind === 'folder' ? (
            <p className="max-w-lg text-frog-200/80">
              The folder <b>{fs.label.replace(/^Folder:\s*/, '')}</b> can't be read any more — it was probably moved, renamed or deleted. Pick where it is now, or start over in the
              browser.
            </p>
          ) : (
            <p className="max-w-lg text-red-300">{error}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={switchToFolder} className="rounded-lg bg-frog-500 px-4 py-2 font-bold text-white hover:bg-frog-400">
              📁 Pick a folder…
            </button>
            <button onClick={switchToBrowser} className="rounded-lg bg-swamp-600 px-4 py-2 font-bold hover:bg-swamp-500">
              Use browser storage
            </button>
            <button onClick={onOpenSettings} className="rounded-lg bg-swamp-600 px-4 py-2 font-bold hover:bg-swamp-500">
              Settings
            </button>
          </div>
        </>
      )}
    </div>
  )
}
