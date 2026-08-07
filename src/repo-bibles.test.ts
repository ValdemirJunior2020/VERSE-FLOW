import { describe, expect, it } from 'vitest'

describe('repository Bible source metadata', () => {
  it('catalog contains repo-backed English and Portuguese public-domain translations', async () => {
    const catalog = (await import('./data/bible-catalog.json')).default as any[]
    expect(catalog.some(x => x.code === 'KJV' && x.source === 'public-domain-bibles/english')).toBe(true)
    expect(catalog.some(x => x.code === 'ALM1911' && x.source === 'damarals/biblias')).toBe(true)
    expect(catalog.some(x => x.code === 'TB' && x.source === 'damarals/biblias')).toBe(true)
    expect(catalog.some(x => x.code === 'BLIVRE' && x.source === 'damarals/biblias')).toBe(true)
  })
})
