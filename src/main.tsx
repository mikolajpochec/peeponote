import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { watchForUpdates } from './pwa/updates'
import './index.css'
import App from './App.tsx'

watchForUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
