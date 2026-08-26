import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const main=fs.readFileSync(path.join(root,'electron','main.cjs'),'utf8')
const preload=fs.readFileSync(path.join(root,'electron','preload.cjs'),'utf8')
const app=fs.readFileSync(path.join(root,'src','App.tsx'),'utf8')

describe('Sunday-safe telão detection',()=>{
  it('identifies physical displays with numbered overlays',()=>{
    expect(main).toContain("ipcMain.handle('display:identify'")
    expect(main).toContain('identifyDisplays()')
    expect(preload).toContain('identifyDisplays:')
  })
  it('remembers a chosen audience display and blocks missing output',()=>{
    expect(app).toContain("audienceDisplayId")
    expect(app).toContain('TELÃO NÃO DETECTADO — LIVE bloqueado')
    expect(app).toContain('openOnSelected')
  })
  it('does not silently keep audience output on a removed display',()=>{
    expect(main).toContain("screen.on('display-removed'")
    expect(main).toContain('audienceTargetDisplayId')
  })
})
