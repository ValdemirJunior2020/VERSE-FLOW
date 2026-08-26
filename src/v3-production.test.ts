import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read=(p:string)=>fs.readFileSync(path.resolve(process.cwd(),p),'utf8')

describe('VerseFlow V3 multilingual production center',()=>{
  it('defaults to English and provides Brazilian Portuguese and Spanish switches',()=>{
    const app=read('src/App.tsx')
    const sw=read('src/components/LanguageSwitcher.tsx')
    expect(app).toContain("useState<Language>('en')")
    expect(app).toContain("saveSetting('uiLanguage',language)")
    expect(sw).toContain("brazil-flag.png")
    expect(sw).toContain("onChange('pt')")
    expect(sw).toContain("onChange('es')")
  })

  it('wires the production tools to Electron IPC',()=>{
    const preload=read('electron/preload.cjs')
    const tools=read('electron/production-tools.cjs')
    for(const key of ['mpv:launch','ffmpeg:compatible','whisper:start','obs:open','obs:connect','hyperframes:render','companion:open']){
      expect(preload+tools).toContain(key)
    }
    expect(tools).toContain('127.0.0.1')
    expect(tools).toContain('data-composition-id="verseflow-welcome"')
  })

  it('keeps live operator safety features and smart actions',()=>{
    const app=read('src/App.tsx')
    const main=read('electron/main.cjs')
    expect(app).toContain('STOP AUDIO')
    expect(app).toContain("setActive('production')")
    expect(main).toContain("START_TIMER")
    expect(main).toContain("SHOW_LOWER_THIRD")
    expect(main).toContain("STOP_AUDIO")
    expect(app).toContain("p.action==='START_TIMER'")
    expect(app).toContain("p.action==='SHOW_LOWER_THIRD'")
    expect(app).toContain("p.action==='STOP_AUDIO'")
  })

  it('installs yt-dlp with the recommended Deno runtime and keeps full offline Bibles',()=>{
    const installer=read('INSTALL_OPTIONAL_OPEN_SOURCE_TOOLS.bat')
    const pkg=JSON.parse(read('package.json'))
    expect(installer).toContain('Deno')
    expect(installer).toContain('yt-dlp')
    expect(installer).toContain('whisper')
    expect(installer).toContain('OBS')
    expect(pkg.build.files).toContain('bibles/bundled/**/*')
  })
  it('keeps local media working securely while the UI uses localhost HTTP for YouTube',()=>{
    const main=read('electron/main.cjs')
    const preview=read('src/components/CanvasPreview.tsx')
    const output=read('src/components/OutputRenderer.tsx')
    expect(main).toContain("scheme:'verseflow-media'")
    expect(main).toContain("stream:true")
    expect(preview).toContain('verseflow-media://local/')
    expect(output).toContain('verseflow-media://local/')
  })

})
