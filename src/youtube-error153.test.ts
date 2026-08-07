import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('YouTube Error 153 protection', () => {
  it('configures a Referer for YouTube requests in Electron', () => {
    const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')
    expect(main).toContain('configureYouTubeRequestIdentity')
    expect(main).toContain("requestHeaders.Referer = 'https://verseflow.app/'")
    expect(main).toContain("requestHeaders.Origin = 'https://verseflow.app'")
  })

  it('uses strict-origin referrer policy for embedded YouTube players', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const output = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OutputRenderer.tsx'), 'utf8')
    expect(app).toContain('referrerPolicy="strict-origin-when-cross-origin"')
    expect(output).toContain('referrerPolicy="strict-origin-when-cross-origin"')
    expect(output).toContain('widget_referrer=https%3A%2F%2Fverseflow.app%2F')
  })
})
