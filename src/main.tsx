import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

window.addEventListener('error', event => {
  window.verseflow?.logError('window-error', event.message || 'Unknown renderer error', event.error?.stack || `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}`)
})
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled promise rejection'))
  window.verseflow?.logError('unhandled-promise', reason.message, reason.stack || '')
})

// Live Desk song sections are presentation controls. Clicking the section name
// should immediately send that section live instead of only changing preview.
// This keeps Verse 1 / Verse 2 / Chorus switching fast during a service.
document.addEventListener('click', event => {
  const target = event.target as HTMLElement | null
  const sectionButton = target?.closest('.instant-song-list .song-section-row > button:first-child') as HTMLButtonElement | null
  if (!sectionButton) return
  const row = sectionButton.closest('.song-section-row')
  const liveButton = row?.querySelector('button.gold.small') as HTMLButtonElement | null
  if (liveButton && !liveButton.disabled) queueMicrotask(() => liveButton.click())
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>
)
