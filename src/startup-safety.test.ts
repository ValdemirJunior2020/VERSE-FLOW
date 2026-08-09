import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

describe('Sunday-safe startup', () => {
  it('does not crash when Companion API port is already in use', () => {
    const tools = fs.readFileSync(path.join(root, 'electron', 'production-tools.cjs'), 'utf8')
    expect(tools).toContain("err.code==='EADDRINUSE'")
    expect(tools).toContain('Continuing without Companion API')
    expect(tools).toContain("server.on('error'")
  })

  it('does not remain on the loading screen forever if local data cannot load', () => {
    const hook = fs.readFileSync(path.join(root, 'src', 'hooks', 'useVerseFlowData.ts'), 'utf8')
    expect(hook).toContain('STARTUP_TIMEOUT_MS = 6000')
    expect(hook).toContain('window.setTimeout')
    expect(hook).toContain('setLoading(false)')
    expect(hook).toContain('await loadPromise')
    expect(hook).toContain('void window.verseflow?.logError')
    expect(hook).toContain('finally')
  })
})
