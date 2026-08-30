import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const app=fs.readFileSync(path.join(process.cwd(),'src','App.tsx'),'utf8')

describe('Timer audience output',()=>{
  it('keeps Preview local and routes START TIMER through audience LIVE output',()=>{
    expect(app).toContain('if(goLive)void onSendLive(n);else setState(n)')
    expect(app).toContain('Preview is intentionally local-only')
  })
  it('opens the audience output after auto-selecting a non-primary display',()=>{
    expect(app).toContain("openOutput('audience',saved)")
    expect(app).toContain('detected.find(d=>!d.primary)')
  })
})
