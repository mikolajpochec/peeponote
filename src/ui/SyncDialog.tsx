import { useState } from 'react'
import { useWorkspace, type Resolution } from '../store/workspace'
import { Peepo } from './Peepo'

/**
 * Both you and someone else saved changes since you last synced. Written for people who never
 * used git: one recommended button, one alternative, the destructive ones folded away.
 */
export function SyncDialog() {
  const d = useWorkspace((s) => s.divergence)
  const resolve = useWorkspace((s) => s.resolveDivergence)
  const save = useWorkspace((s) => s.save)
  const busy = useWorkspace((s) => s.busy)
  const [advanced, setAdvanced] = useState(false)
  const dismiss = () => useWorkspace.setState({ divergence: null })
  if (!d) return null
  const who = d.who && d.who !== 'someone' ? d.who : 'Someone else'
  const n = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`

  const Option = ({ mode, title, desc, tone = 'normal' }: { mode: Resolution; title: string; desc: string; tone?: 'normal' | 'primary' | 'danger' }) => (
    <button
      disabled={!!busy}
      onClick={() => resolve(mode)}
      className={`rounded-xl p-3 text-left ring-1 disabled:opacity-50 ${
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
          <Peepo name="peepoThink" size={56} />
          <div>
            <h2 className="text-xl font-black tracking-tight">{who} changed the board too</h2>
            <p className="mt-1 text-[13px] text-frog-200/70">
              Since your last sync, <b>{who}</b> saved {n(d.behind, 'change')} and you saved {n(d.ahead, 'change')}. Both sets need to be put together before anything can be
              shared.
            </p>
          </div>
        </div>

        {d.dirty ? (
          <div className="rounded-xl bg-amber-900/30 p-3 text-[13px] text-amber-100 ring-1 ring-amber-400/30">
            <div className="font-bold">First, save what you're working on</div>
            <div className="mt-0.5 text-amber-100/80">You have edits that aren't saved yet. Save them, and the combining step will start by itself.</div>
            <button
              disabled={!!busy}
              onClick={async () => {
                dismiss()
                await save()
              }}
              className="mt-2 rounded-lg bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400 disabled:opacity-50"
            >
              Save and combine
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Option
              mode="merge-ours"
              tone="primary"
              title="Combine both — keep my version where we edited the same card"
              desc="Everything either of you added or changed is kept. Only when the very same card was edited by both, yours stays. Recommended."
            />
            <Option mode="merge-theirs" title={`Combine both — keep ${who}'s version where we edited the same card`} desc="Same as above, but their edit wins on the cards you both touched." />
            <button onClick={() => setAdvanced((a) => !a)} className="mt-1 self-start text-[12px] text-frog-200/60 hover:text-frog-100">
              {advanced ? '▾' : '▸'} Other options (they throw work away)
            </button>
            {advanced && (
              <>
                <Option mode="force-push" tone="danger" title={`Throw away ${who}'s ${n(d.behind, 'change')}, keep only mine`} desc="Their saves since the last sync are removed from the shared board." />
                <Option mode="take-theirs" tone="danger" title={`Throw away my ${n(d.ahead, 'change')}, take ${who}'s`} desc="Your saves since the last sync are removed from this board (they stay in History for a while)." />
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-[12px] text-frog-200/50">
          <span>Nothing is lost while this is open — you can keep working.</span>
          <button onClick={dismiss} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-frog-200 hover:bg-(--hover-strong)">
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
