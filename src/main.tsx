import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { watchForUpdates } from './pwa/updates'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { useWorkspace } from './store/workspace'
import { useReview } from './store/review'
import { useSettings } from './store/settings'

watchForUpdates()
// the stores from the console (debugging a live install, browser tests): `peeponote.workspace.getState()`
Object.assign(window, { peeponote: { workspace: useWorkspace, review: useReview, settings: useSettings } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
