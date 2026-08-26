import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('bundled full Bibles', () => {
  it('bundles Genesis-through-Revelation translations offline', () => {
    const catalog = JSON.parse(fs.readFileSync(path.resolve(process.cwd(),'src/data/bible-catalog.json'),'utf8'))
    const bundled = catalog.filter((x:any)=>x.bundledFile)

    expect(bundled.length).toBe(18)

    for (const item of bundled) {
      const file = path.resolve(process.cwd(),'bibles/bundled',item.bundledFile)
      expect(fs.existsSync(file)).toBe(true)

      const bible = JSON.parse(fs.readFileSync(file,'utf8'))
      expect(bible.translation).toBe(item.code)
      expect(bible.verses.length).toBeGreaterThan(30000)
      expect(bible.verses[0].chapter).toBe(1)
      expect(bible.verses[0].verse).toBe(1)
      expect(bible.verses[0].book.length).toBeGreaterThan(0)

      const last = bible.verses[bible.verses.length - 1]
      expect(last.chapter).toBe(22)
      expect(last.verse).toBe(21)
    }
  })

  it('packages the bundled Bible directory in Windows builds', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(),'package.json'),'utf8'))
    expect(pkg.build.files).toContain('bibles/bundled/**/*')
  })
})
