import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../types'

const empty: AppData = { verses: [], translations: [], songs: [], media: [], services: [], themes: [], settings: {}, favorites: [] }

const STARTUP_TIMEOUT_MS = 6000

export function useVerseFlowData() {
  const [data, setData] = useState<AppData>(empty)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!window.verseflow) {
      setLoading(false)
      return
    }

    setLoading(true)
    let timedOut = false

    // Start the real load once. If this older PC needs longer to read a large
    // offline Bible database, the UI is released after six seconds instead of
    // trapping the operator on the splash screen. The same request is allowed
    // to finish in the background and fills the UI when it is ready.
    const loadPromise = window.verseflow.loadData()

    const timer = window.setTimeout(() => {
      timedOut = true
      setLoading(false)
      setData(current => current || empty)
      console.warn('VerseFlow startup data is taking longer than expected; opening the interface while data continues loading.')
      // Never await diagnostics here: the Electron main process may itself be
      // busy reading the database, which was the V1.4.3 endless-loading bug.
      void window.verseflow?.logError(
        'startup-data-slow',
        `Startup data load exceeded ${STARTUP_TIMEOUT_MS}ms; UI released while loading continues.`,
        ''
      ).catch(() => {})
    }, STARTUP_TIMEOUT_MS)

    try {
      const loaded = await loadPromise
      window.clearTimeout(timer)
      setData(loaded || empty)
      setLoading(false)
    } catch (error) {
      window.clearTimeout(timer)
      const e = error instanceof Error ? error : new Error(String(error))
      console.error('VerseFlow startup data error:', e)
      // Release the operator UI first. Logging is best-effort and must never
      // be able to keep the splash screen visible.
      setData(empty)
      setLoading(false)
      void window.verseflow?.logError('startup-data', e.message, e.stack || '').catch(() => {})
    } finally {
      if (!timedOut) setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { data, setData, loading, reload }
}
