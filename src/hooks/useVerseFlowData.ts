import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../types'

const empty: AppData = { verses: [], translations: [], songs: [], media: [], services: [], themes: [], settings: {}, favorites: [] }

// Sunday-safe rule: local data must NEVER block the operator interface.
// The UI opens immediately and the database fills it in when ready.
export function useVerseFlowData() {
  const [data, setData] = useState<AppData>(empty)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!window.verseflow) {
      setLoading(false)
      return
    }

    // Do not turn the whole application back into a splash screen while
    // reading SQLite. A slow/corrupt database should not stop presentation.
    setLoading(false)

    try {
      const loaded = await window.verseflow.loadData()
      setData(loaded || empty)
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error))
      console.error('VerseFlow local data error:', e)
      setData(current => current || empty)
      // Best-effort only. Never await diagnostics during startup/reload.
      void window.verseflow?.logError('data-load-background', e.message, e.stack || '').catch(() => {})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { data, setData, loading, reload }
}
