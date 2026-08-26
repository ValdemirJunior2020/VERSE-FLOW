import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { builtInBackgrounds } from './backgrounds'

describe('Sunday-safe backgrounds and diagnostics', () => {
  it('ships twelve backgrounds completely offline', () => {
    expect(builtInBackgrounds).toHaveLength(12)
    for (const background of builtInBackgrounds) {
      expect(background.src.startsWith('data:image/svg+xml')).toBe(true)
      expect(background.src).not.toMatch(/^https?:/)
    }
  })

  it('keeps background and music separate from fullscreen media actions', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    expect(app).toContain('USE AS BG')
    expect(app).toContain('FULLSCREEN')
    expect(app).toContain('ADD MUSIC')
    expect(app).toContain('PLAY NOW')
    expect(app).toContain('Pick one. Your verse or lyrics stay on screen.')
  })

  it('wires the local System Check and error log through secure IPC', () => {
    const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')
    const preload = fs.readFileSync(path.resolve(process.cwd(), 'electron/preload.cjs'), 'utf8')
    expect(main).toContain("ipcMain.handle('diagnostics:run'")
    expect(main).toContain('verseflow-errors.log')
    expect(preload).toContain('systemCheck:')
    expect(preload).toContain('logError:')
  })
})
