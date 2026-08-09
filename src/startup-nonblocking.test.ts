import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Sunday-safe non-blocking startup', () => {
  const source = fs.readFileSync(path.join(process.cwd(),'src','hooks','useVerseFlowData.ts'),'utf8')
  it('releases the splash screen before slow database work can trap the operator', () => {
    expect(source).toContain('STARTUP_TIMEOUT_MS = 6000')
    expect(source).toContain('setLoading(false)')
    expect(source).toContain('void window.verseflow?.logError')
    expect(source).not.toContain('await window.verseflow.logError')
  })
})
