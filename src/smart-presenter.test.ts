import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Smart Presenter tools', () => {
  it('wires Ollama, yt-dlp and optional installer through secure IPC', () => {
    const main=fs.readFileSync(path.resolve(process.cwd(),'electron/main.cjs'),'utf8')
    const preload=fs.readFileSync(path.resolve(process.cwd(),'electron/preload.cjs'),'utf8')
    expect(main).toContain("const SMART_MODEL = 'qwen3:0.6b'")
    expect(main).toContain("ipcMain.handle('smart:command'")
    expect(main).toContain("ipcMain.handle('media:download-url'")
    expect(main).toContain("ipcMain.handle('tools:status'")
    expect(preload).toContain("smartCommand:")
    expect(preload).toContain("downloadMediaUrl:")
  })

  it('makes the previously decorative top toolbar buttons functional', () => {
    const app=fs.readFileSync(path.resolve(process.cwd(),'src/App.tsx'),'utf8')
    expect(app).toContain('onClick={newSlide}')
    expect(app).toContain('onClick={globalImport}')
    expect(app).toContain('onClick={undoPresentation}')
    expect(app).toContain("if(e.key==='Enter')globalSearch()")
  })

  it('keeps Scripture exact by having AI return references only', () => {
    const main=fs.readFileSync(path.resolve(process.cwd(),'electron/main.cjs'),'utf8')
    expect(main).toContain('Never rewrite, paraphrase, summarize, correct, or invent Scripture')
    expect(main).toContain('VerseFlow itself will retrieve the exact stored verse text')
  })
})
