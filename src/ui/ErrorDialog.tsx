import { formatReport, useErrorDetails } from './errorDetails'
import { toast } from '../store/toast'
import { Peepo } from './Peepo'

/** "Details" of a failed operation: full error, HTTP status, what we were doing, copy button. */
export function ErrorDialog() {
  const open = useErrorDetails((s) => s.open)
  const close = useErrorDetails((s) => s.close)
  if (!open) return null
  const text = formatReport(open)
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl border border-(--hair) bg-swamp-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <Peepo name="PepeHands" size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-black tracking-tight">{open.title}</h2>
            <div className="text-[12px] text-frog-200/60">{new Date(open.at).toLocaleString()}</div>
          </div>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-swamp-950/70 p-3 font-mono text-[12px] leading-snug text-frog-100 scrollbar-thin select-text">{text}</pre>
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text)
                toast.ok('Copied — paste it in an issue or a message.')
              } catch {
                toast.err('Clipboard blocked — select the text and copy it.')
              }
            }}
            className="rounded-md bg-swamp-700 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-600"
          >
            Copy report
          </button>
          <button onClick={close} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
