import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('YouTube presentation', () => {
  it('has a real audience-output YouTube mode', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const out = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OutputRenderer.tsx'), 'utf8')
    const types = fs.readFileSync(path.resolve(process.cwd(), 'src/types.ts'), 'utf8')

    expect(app).toContain('PRESENT YOUTUBE')
    expect(app).toContain('youtubeId')
    expect(out).toContain('audience-youtube')
    expect(out).toContain('youtube-nocookie.com/embed/')
    expect(types).toContain('youtubeId?: string')
  })
})
