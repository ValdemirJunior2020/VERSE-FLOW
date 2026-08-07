import { describe, expect, it } from 'vitest'
import { defaultTheme, itemToPresentation, verseToServiceItem } from './presentation'

describe('critical presentation state', () => {
  it('never makes a selected item live automatically', () => {
    const item = verseToServiceItem({ id: 1, translation: 'WEB', book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.' })
    expect(itemToPresentation(item, undefined, defaultTheme).mode).toBe('preview')
  })

  it('keeps scripture text unchanged', () => {
    const text = 'Exact imported scripture text — do not rewrite.'
    const item = verseToServiceItem({ id: 1, translation: 'TEST', book: 'Book', chapter: 1, verse: 1, text })
    expect(itemToPresentation(item, undefined, defaultTheme).text).toBe(text)
  })
})
