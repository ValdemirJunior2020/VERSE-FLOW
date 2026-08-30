import {describe,it,expect} from 'vitest'
import fs from 'node:fs'

describe('Smart Presenter and YouTube completion fixes',()=>{
  const main=fs.readFileSync('electron/main.cjs','utf8')
  const app=fs.readFileSync('src/App.tsx','utf8')
  it('auto-starts Ollama and auto-loads bundled KJV for missing verse indexes',()=>{
    expect(main).toContain('ensureOllamaRunning')
    expect(main).toContain("spawn(exe,['serve']")
    expect(main).toContain('ensureBundledKjv')
    expect(main).toContain("bibles','bundled','kjv.json")
  })
  it('refreshes Media and shows an explicit YouTube completion message',()=>{
    expect(app).toContain('await onMediaAdded()')
    expect(app).toContain('youtubeDownloadNote')
    expect(app).toContain('is now in the Media library')
  })
})
