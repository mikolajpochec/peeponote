import { useToasts } from '../store/toast'
import { Peepo } from './Peepo'

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`toast-in pointer-events-auto flex max-w-lg items-center gap-2 rounded-xl px-3 py-2 text-sm shadow-xl ring-1 ${
            t.kind === 'err'
              ? 'bg-red-950/95 text-red-100 ring-red-500/40'
              : t.kind === 'ok'
                ? 'bg-frog-800/95 text-frog-50 ring-frog-400/40'
                : 'bg-swamp-600/95 text-frog-100 ring-(--hair)'
          }`}
        >
          <Peepo name={t.peepo} size={26} />
          <span className="text-left">{t.text}</span>
          {t.action && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                t.action!.onClick()
                dismiss(t.id)
              }}
              className="ml-1 rounded-md bg-frog-500 px-2 py-0.5 text-[12px] font-bold text-white hover:bg-frog-400"
            >
              {t.action.label}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
