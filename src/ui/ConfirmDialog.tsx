import { useEffect } from 'react'
import { useConfirm } from './confirm'
import { Peepo } from './Peepo'

export function ConfirmDialog() {
  const current = useConfirm((s) => s.current)
  const answer = useConfirm((s) => s.answer)
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false)
      if (e.key === 'Enter') answer(true)
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [current, answer])
  if (!current) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => answer(false)}>
      <div className="w-full max-w-sm rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Peepo name={current.peepo ?? 'monkaS'} size={44} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-black tracking-tight">{current.title}</h2>
            {current.message && <p className="mt-1 text-[13px] text-frog-200/70">{current.message}</p>}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button autoFocus onClick={() => answer(false)} className="rounded-md bg-swamp-700 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-600">
            Cancel
          </button>
          <button
            onClick={() => answer(true)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-bold text-white ${current.danger ? 'bg-red-700 hover:bg-red-600' : 'bg-frog-500 hover:bg-frog-400'}`}
          >
            {current.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
