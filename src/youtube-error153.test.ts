import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('YouTube desktop embed identity', () => {
  it('serves the packaged renderer from a real localhost HTTP origin', () => {
    const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')
    expect(main).toContain('function startRendererServer()')
    expect(main).toContain('rendererServer.listen(0')
    expect(main).toContain('http://127.0.0.1:${rendererPort}')
    const readyIndex = main.indexOf('app.whenReady()')
    const readyBlock = main.slice(readyIndex, readyIndex + 650)
    expect(readyBlock.indexOf('await startRendererServer()')).toBeGreaterThan(-1)
    expect(readyBlock.indexOf('configureYouTubeRequestIdentity()')).toBeGreaterThan(readyBlock.indexOf('await startRendererServer()'))
  })

  it('uses the localhost renderer as Referer/Origin and iframe identity', () => {
    const main = fs.readFileSync(path.resolve(process.cwd(), 'electron/main.cjs'), 'utf8')
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    const output = fs.readFileSync(path.resolve(process.cwd(), 'src/components/OutputRenderer.tsx'), 'utf8')
    expect(main).toContain('requestHeaders.Referer = `http://127.0.0.1:${rendererPort}/`')
    expect(main).toContain('requestHeaders.Origin = `http://127.0.0.1:${rendererPort}`')
    expect(app).toContain('origin=${encodeURIComponent(window.location.origin)}')
    expect(output).toContain('origin=${encodeURIComponent(window.location.origin)}')
    expect(app).toContain('referrerPolicy="strict-origin-when-cross-origin"')
  })
})
