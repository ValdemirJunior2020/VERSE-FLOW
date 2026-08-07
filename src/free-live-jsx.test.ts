import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('FreeLivePage JSX wiring', () => {
  it('passes songs and media props in one valid component tag', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    expect(app).toContain('onPickMedia={importMedia} songs={data.songs} onSaveSong={saveSong}/>')
    expect(app).not.toContain('onPickMedia={importMedia}/ songs={data.songs}')
  })
})
