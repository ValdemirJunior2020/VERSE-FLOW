import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Sunday-safe startup', () => {
  it('does not let local data block the operator interface', () => {
    const hook = fs.readFileSync(path.join(root, 'src', 'hooks', 'useVerseFlowData.ts'), 'utf8')
    expect(hook).toContain('useState(false)')
    expect(hook).toContain('await window.verseflow.loadData()')
    expect(hook).not.toContain('setLoading(true)')
    expect(hook).toContain("logError('data-load-background'")
    expect(hook).toContain('finally')
  })
})
