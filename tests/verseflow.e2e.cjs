const assert = require('node:assert/strict')
const path = require('node:path')
const { _electron: electron } = require('playwright')

async function main() {
  let app
  const rendererErrors = []
  try {
    app = await electron.launch({ args: ['.'], cwd: path.resolve(__dirname, '..') })
    const page = await app.firstWindow()
    page.on('pageerror', error => rendererErrors.push(`pageerror: ${error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') rendererErrors.push(`console: ${message.text()}`)
    })

    await page.waitForLoadState('domcontentloaded')
    await page.locator('.sidebar nav button').nth(5).click()
    await page.getByTestId('background-controls').first().waitFor()

    const presets = page.getByTestId('background-preset')
    assert.equal(await presets.count(), 12, 'Expected 12 built-in backgrounds')

    await page.locator('.live-tabs button').first().click()
    // The live desk ships with sample text; use the visible presentation canvas as the source of truth.
    const canvasText = page.locator('.presentation-canvas .canvas-text').first()
    const before = (await canvasText.innerText()).trim()
    assert.ok(before.length > 0, 'Preview should contain text before choosing a background')

    await presets.first().click()
    const after = (await canvasText.innerText()).trim()
    assert.equal(after, before, 'Choosing a background must preserve the text')
    const canvasStyle = await page.locator('.presentation-canvas').first().getAttribute('style')
    assert.match(canvasStyle || '', /background-image/i, 'Background should be applied to preview')

    await page.locator('.sidebar nav button').nth(8).click()
    await page.locator('.system-check-section button.gold').first().click()
    await page.locator('.system-check-summary').waitFor()
    const summary = (await page.locator('.system-check-summary').innerText()).trim()
    assert.ok(summary.length > 0, 'System Check should return a result')

    if (rendererErrors.length) {
      throw new Error(`Renderer errors detected:\n${rendererErrors.join('\n')}`)
    }

    console.log('[PASS] VerseFlow opened')
    console.log('[PASS] 12 offline backgrounds loaded')
    console.log('[PASS] Background preserved slide text')
    console.log('[PASS] System Check returned a result')
    console.log('VERSEFLOW E2E CHECK PASSED')
  } finally {
    if (app) await app.close()
  }
}

main().catch(error => {
  console.error('VERSEFLOW E2E CHECK FAILED')
  console.error(error)
  process.exitCode = 1
})
