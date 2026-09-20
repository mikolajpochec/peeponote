import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** what to show instead; gets the error and a retry */
  fallback?: (error: Error, retry: () => void) => ReactNode
  /** reset when this changes (e.g. the card id) */
  resetKey?: string
}
interface State {
  error: Error | null
}

/**
 * Keeps one broken piece (a card that fails to render, a 3D preview that throws) from taking the whole app
 * down to a white page. The app-level one offers a reload; the per-card one shows a small tile.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('peeponote: render error', error, info.componentStack)
  }
  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const retry = () => this.setState({ error: null })
    if (this.props.fallback) return this.props.fallback(error, retry)
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-swamp-900 p-6 text-center text-frog-50">
        <div className="text-2xl font-black">Something broke</div>
        <div className="max-w-lg text-[13px] text-frog-200/80">Your boards are safe — everything is on disk. Reload to carry on; if it happens again, the details below help fix it.</div>
        <pre className="max-h-48 max-w-full overflow-auto rounded-lg bg-black/40 p-3 text-left text-[11px] text-red-200 select-text">{`${error.name}: ${error.message}\n${error.stack ?? ''}`}</pre>
        <div className="flex gap-2">
          <button onClick={() => location.reload()} className="rounded-md bg-frog-500 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-frog-400">
            Reload
          </button>
          <button onClick={retry} className="rounded-md bg-swamp-700 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-600">
            Try again
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(`${error.name}: ${error.message}\n${error.stack ?? ''}`).catch(() => {})}
            className="rounded-md bg-swamp-700 px-3 py-1.5 text-[13px] font-semibold hover:bg-swamp-600"
          >
            Copy details
          </button>
        </div>
      </div>
    )
  }
}

/** a card that failed to render: a small tile in its place, the rest of the board stays usable */
export function cardFallback(error: Error, retry: () => void) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl bg-red-950/70 p-3 text-center text-red-100 ring-1 ring-red-500/40" data-nodrag>
      <div className="text-[12px] font-bold">This card couldn't be shown</div>
      <div className="line-clamp-3 text-[10px] opacity-80 select-text">{error.message}</div>
      <button onClick={retry} className="mt-1 rounded bg-red-900/60 px-2 py-0.5 text-[11px] font-semibold hover:bg-red-800">
        Try again
      </button>
    </div>
  )
}
