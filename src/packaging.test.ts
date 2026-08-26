import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Electron Bible packaging', () => {
  it('keeps the runtime Bible catalog inside electron/', () => {
    const runtimeCatalog = path.resolve(process.cwd(), 'electron/bible-catalog.json')
    expect(fs.existsSync(runtimeCatalog)).toBe(true)

    const catalog = JSON.parse(fs.readFileSync(runtimeCatalog, 'utf8'))
    expect(Array.isArray(catalog)).toBe(true)
    expect(catalog.some((x: any) => x.code === 'KJV')).toBe(true)
  })

  it('packages all src/data assets too', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.build.files).toContain('src/data/**/*')
  })
})
