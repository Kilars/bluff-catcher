import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App.tsx'
import { migrateLegacyStats } from './hooks/useAppPrefs'

// Before any stats hook reads storage (docs/PLAN-menu.md).
migrateLegacyStats()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
