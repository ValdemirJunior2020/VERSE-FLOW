import { describe, expect, it } from 'vitest'

describe('Bible source metadata', () => {
  it('catalog contains working English and Portuguese Bible sources', async () => {
    const catalog = (await import('./data/bible-catalog.json')).default as any[]

    // English automatic installs now use reliable full-Bible JSON.
    expect(catalog.some(x =>
      x.code === 'KJV' &&
      x.status === 'download' &&
      x.source === 'GetBible v2 JSON'
    )).toBe(true)

    // Portuguese public-domain installs remain sourced from damarals/biblias.
    expect(catalog.some(x =>
      x.code === 'ALM1911' &&
      x.status === 'download' &&
      x.source === 'damarals/biblias'
    )).toBe(true)

    expect(catalog.some(x =>
      x.code === 'TB' &&
      x.status === 'download' &&
      x.source === 'damarals/biblias'
    )).toBe(true)

    expect(catalog.some(x =>
      x.code === 'BLIVRE' &&
      x.status === 'download' &&
      x.source === 'damarals/biblias'
    )).toBe(true)
  })
})
