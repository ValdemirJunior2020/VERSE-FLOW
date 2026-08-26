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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>
)
