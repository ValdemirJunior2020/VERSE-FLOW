import { describe, expect, it } from 'vitest'
import { extractLyricsFromPageText, formatLyricsIntoFourLineSlides, localSongMatches, lyricSlides, parseRawSections } from './lyrics'
import type { Song } from './types'

const song:Song={id:'1',title:'Amazing Grace',author:'Hillsong Worship',sections:[{id:'v1',label:'Verse 1',lines:['one','two','three','four','five']},{id:'c',label:'Chorus',lines:['a','b']}]}

describe('Lyrics',()=>{
  it('handles incomplete/spelling-imperfect local searches without silently choosing unrelated songs',()=>{
    const hits=localSongMatches([song],'hilsong amazing grace')
    expect(hits[0]?.song.title).toBe('Amazing Grace')
    expect(localSongMatches([song],'way maker sinach')).toHaveLength(0)
  })
  it('splits presentation slides at a maximum of four lyric lines',()=>{
    const slides=lyricSlides(song)
    expect(Math.max(...slides.map(x=>x.lines.length))).toBeLessThanOrEqual(4)
    expect(slides.map(x=>x.label)).toContain('Chorus')
  })

  it('extracts only the Lyrics section from a song webpage',()=>{
    const page='# Way Maker\n\n## Official Video\nvideo stuff\n\n## Lyrics\nLine one\nLine two\n\nLine three\nLine four\n\n## Heard on Air\nunrelated page content'
    expect(extractLyricsFromPageText(page)).toBe('Line one\nLine two\n\nLine three\nLine four')
  })
  it('formats pasted lyrics into exact-order slides with no more than four lines',()=>{
    const sections=formatLyricsIntoFourLineSlides('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine')
    expect(sections.map(x=>x.lines)).toEqual([['one','two','three','four'],['five','six','seven','eight'],['nine']])
    expect(sections.map(x=>x.label)).toEqual(['Slide 1','Slide 2','Slide 3'])
  })
  it('creates section blocks from pasted lyrics',()=>{
    const sections=parseRawSections('Verse 1\nLine A\nLine B\n\nChorus\nLine C')
    expect(sections).toHaveLength(2)
    expect(sections[1].label).toMatch(/chorus/i)
  })
  it('keeps duplicate, delete and ordering controls in the Lyrics editor',async()=>{
    const fs=await import('node:fs');const app=fs.readFileSync('src/components/LyricsPage.tsx','utf8')
    expect(app).toContain('const duplicate=')
    expect(app).toContain('const remove=')
    expect(app).toContain('const move=')
    expect(app).toContain('Add Entire Song To Service')
  })
})
