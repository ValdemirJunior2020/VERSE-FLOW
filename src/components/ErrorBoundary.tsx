import React from 'react'

interface State { error?: Error }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    window.verseflow?.logError('react-render', error.message, `${error.stack || ''}\n${info.componentStack || ''}`)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <div className="friendly-error-screen">
      <div className="friendly-error-card">
        <div className="brand-mark big">V</div>
        <h1>VerseFlow found a problem / encontrou um problema.</h1>
        <p>Nothing was deleted / Nada foi apagado. Try again or reopen VerseFlow. The technical error was saved locally so it can be fixed later.</p>
        <code>{this.state.error.message}</code>
        <div className="friendly-error-actions">
          <button className="gold" onClick={()=>location.reload()}>Try Again / Tentar novamente</button>
        </div>
      </div>
    </div>
  }
}
