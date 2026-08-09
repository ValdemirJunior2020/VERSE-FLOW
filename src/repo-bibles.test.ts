import { describe, expect, it } from 'vitest'

describe('Bible source metadata', () => {
  it('catalog contains working bundled English and Portuguese Bible sources', async () => {
    const catalog = (await import('./data/bible-catalog.json')).default as any[]

    // KJV is now bundled offline inside VerseFlow instead of downloaded from GetBible.
    expect(catalog.some(x =>
      x.code === 'KJV' &&
      x.status === 'download' &&
      x.source === 'Bible SuperSearch export · bundled offline' &&
      x.bundledFile
    )).toBe(true)

    // Portuguese bundled editions from the user-supplied full Bible pack.
    expect(catalog.some(x =>
      x.code === 'BLIVRE' &&
      x.status === 'download' &&
      x.source === 'Bible SuperSearch export · bundled offline' &&
      x.bundledFile
    )).toBe(true)

    expect(catalog.some(x =>
      x.code === 'ALMEIDA-RA' &&
      x.status === 'download' &&
      x.source === 'Bible SuperSearch export · bundled offline' &&
      x.bundledFile
    )).toBe(true)

    expect(catalog.some(x =>
      x.code === 'ALMEIDA-RC' &&
      x.status === 'download' &&
      x.source === 'Bible SuperSearch export · bundled offline' &&
      x.bundledFile
    )).toBe(true)
  })
})
