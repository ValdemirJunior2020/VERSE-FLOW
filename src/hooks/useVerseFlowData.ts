import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../types'

const empty: AppData = { verses: [], translations: [], songs: [], media: [], services: [], themes: [], settings: {}, favorites: [] }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Startup data load timed out after ${ms}ms`)), ms))
  ])
}

export function useVerseFlowData() {
  const [data, setData] = useState<AppData>(empty)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!window.verseflow) { setLoading(false); return }
    setLoading(true)
    try {
      const loaded = await withTimeout(window.verseflow.loadData(), 10000)
      setData(loaded || empty)
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error))
      console.error('VerseFlow startup data error:', e)
      try { await window.verseflow.logError('startup-data', e.message, e.stack || '') } catch {}
      // Do not trap a Sunday operator on an endless splash screen. The app can
      // still open with empty local data and System Check can show the problem.
      setData(empty)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, setData, loading, reload }
}
