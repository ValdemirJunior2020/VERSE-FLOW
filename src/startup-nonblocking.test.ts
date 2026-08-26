import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Sunday-safe non-blocking startup', () => {
  const source = fs.readFileSync(path.join(process.cwd(),'src','hooks','useVerseFlowData.ts'),'utf8')
  it('opens the operator UI immediately while local data loads in the background', () => {
    expect(source).toContain('useState(false)')
    expect(source).toContain('await window.verseflow.loadData()')
    expect(source).not.toContain('setLoading(true)')
    expect(source).toContain('void window.verseflow?.logError')
    expect(source).not.toContain('await window.verseflow.logError')
  })
})
