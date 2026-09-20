import { useWorkspace, type Resolution } from '../store/workspace'
import { Peepo } from './Peepo'

/** Shown when local and remote both have new commits. */
export function SyncDialog() {
  const d = useWorkspace((s) => s.divergence)
  const resolve = useWorkspace((s) => s.resolveDivergence)
  const dismiss = () => useWorkspace.setState({ divergence: null })
  if (!d) return null
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`

  const Option = ({ mode, title, desc, tone = 'normal' }: { mode: Resolution; title: string; desc: string; tone?: 'normal' | 'primary' | 'danger' }) => (
    <button
      onClick={() => resolve(mode)}
      className={`rounded-xl p-3 text-left ring-1 ${
        tone === 'primary' ? 'bg-frog-700/40 ring-frog-400 hover:bg-frog-700/60' : tone === 'danger' ? 'ring-red-500/40 hover:bg-red-900/30' : 'ring-(--hair) hover:bg-(--hover)'
      }`}
    >
      <div className={`text-[14px] font-bold ${tone === 'danger' ? 'text-red-200' : ''}`}>{title}</div>
      <div className="text-[12px] text-frog-200/70">{desc}</div>
    </button>
  )

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={dismiss}>
      <div className="w-full max-w-lg rounded-2xl border border-(--hair) bg-swamp-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <Peepo name="monkaS" size={56} />
          <div>
            <h2 className="text-2xl font-black tracking-tight">Histories diverged</h2>
            <p className="text-[13px] text-frog-200/70">
              You have <b>{n(d.ahead, 'commit')}</b> the remote doesn't, and it has <b>{n(d.behind, 'commit')}</b> you don't. Pick how to reconcile:
            </p>
          </div>
        </div>
        <div className="grid gap-2">
          <Option
            mode="merge-ours"
            tone="primary"
            title="Merge — keep both, mine wins on clashes"
            desc="Cards edited on only one side are combined. When the same card was changed on both sides, your version is kept. Creates a merge commit and pushes."
          />
          <Option mode="merge-theirs" title="Merge — keep both, theirs wins on clashes" desc="Same as above, but the remote version wins when the same card changed on both sides." />
          <Option mode="force-push" tone="danger" title="Overwrite remote with mine" desc={`Force-push. The remote's ${n(d.behind, 'commit')} disappear from the branch.`} />
          <Option mode="take-theirs" tone="danger" title="Discard mine, take remote" desc={`Reset to the remote. Your ${n(d.ahead, 'commit')} disappear from the branch (still reachable via git reflog in a folder clone).`} />
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={dismiss} className="rounded-lg px-4 py-2 text-[14px] font-semibold text-frog-200 hover:bg-(--hover-strong)">
            Decide later
          </button>
        </div>
      </div>
    </div>
  )
}
