import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../types'

const empty: AppData = { verses: [], translations: [], songs: [], media: [], services: [], themes: [], settings: {}, favorites: [] }

export function useVerseFlowData() {
  const [data, setData] = useState<AppData>(empty)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!window.verseflow) { setLoading(false); return }
    const loaded = await window.verseflow.loadData()
    setData(loaded); setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])
  return { data, setData, loading, reload }
}
