import { useWorkspace } from '../store/workspace'
import { useReview } from '../store/review'
import { Peepo } from './Peepo'

const primary = 'rounded-lg bg-frog-500 px-4 py-2 font-bold text-white hover:bg-frog-400'
const quiet = 'rounded-lg bg-swamp-600 px-4 py-2 font-bold hover:bg-swamp-500'

/**
 * GitHub says this account cannot reach the repo behind this workspace: a private repo and no key, a key that
 * doesn't cover it, or someone who was removed from the collaborators. The boards stay shut until that changes.
 */
export function LockedScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const remoteUrl = useWorkspace((s) => s.remoteUrl)
  const refreshAccess = useWorkspace((s) => s.refreshAccess)
  const identity = useReview((s) => s.identity)
  const signedIn = identity.kind === 'github'
  const repo = (remoteUrl ?? '').replace(/^https?:\/\//, '').replace(/^github\.com\//, '').replace(/\.git$/, '')

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Peepo name="monkaS" size={96} />
      <h1 className="text-3xl font-black tracking-tight">Locked</h1>
      <p className="max-w-md text-frog-200/80">
        {signedIn ? (
          <>
            GitHub doesn't let <b>@{identity.account.login}</b> open <b>{repo}</b>. Ask whoever owns it to add you as a collaborator, then try again.
          </>
        ) : (
          <>
            <b>{repo || 'This workspace'}</b> is kept in a private repository. Sign in with the GitHub account that has access to it.
          </>
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {!signedIn && (
          <button className={primary} onClick={() => window.dispatchEvent(new CustomEvent('peeponote:identify'))}>
            Sign in with GitHub
          </button>
        )}
        <button className={quiet} onClick={() => void refreshAccess(true)}>
          Try again
        </button>
        <button className={quiet} onClick={onOpenSettings}>
          Open another repo
        </button>
      </div>
      {signedIn && (
        <button className="text-[12px] text-frog-200/50 hover:text-frog-200" onClick={() => window.dispatchEvent(new CustomEvent('peeponote:identify'))}>
          Signed in as @{identity.account.login} — use a different account
        </button>
      )}
    </div>
  )
}
