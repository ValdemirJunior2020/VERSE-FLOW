import type { Song, SongSection } from './types'

export const lyricSectionTypes=['Verse 1','Verse 2','Verse 3','Verse 4','Chorus','Pre-Chorus','Bridge','Tag','Intro','Outro','Refrain','Custom Section'] as const
export function lyricSlides(song:Song,maxLines=4){
  const slides:{id:string;label:string;lines:string[];sectionIndex:number}[]=[]
  song.sections.forEach((section,sectionIndex)=>{
    const lines=section.lines.filter(x=>x.trim())
    if(!lines.length){slides.push({id:`${section.id}-0`,label:section.label,lines:[],sectionIndex});return}
    for(let i=0;i<lines.length;i+=maxLines){
      let end=Math.min(i+maxLines,lines.length)
      // Prefer ending at punctuation if that avoids creating a one-line tail.
      if(end<lines.length && lines.length-end===1 && end-i>2) end--
      slides.push({id:`${section.id}-${i}`,label:section.label,lines:lines.slice(i,end),sectionIndex})
      i=end-maxLines
    }
  })
  return slides
}
export function normalizeSongSearch(value:string){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(find|show|lyrics|song|music|please|put|live)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function distance(a:string,b:string){const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
export function localSongMatches(songs:Song[],query:string){
  const q=normalizeSongSearch(query); if(!q)return []
  const terms=q.split(' ').filter(Boolean)
  return songs.map(song=>{const hay=normalizeSongSearch(`${song.title} ${song.author||''}`);const words=hay.split(' ').filter(Boolean);const hits=terms.filter(t=>words.some(w=>w.includes(t)||t.includes(w)||(Math.max(t.length,w.length)>=5&&distance(t,w)<=2))).length;return{song,score:terms.length?hits/terms.length:0}}).filter(x=>x.score>=.5).sort((a,b)=>b.score-a.score)
}

export function extractLyricsFromPageText(text:string){
  const raw=String(text||'').replace(/\r/g,'')
  if(!raw.trim())return ''
  const lines=raw.split('\n')
  const headingIndex=lines.findIndex(line=>/^\s*#{1,6}\s*lyrics\s*:?\s*$/i.test(line)||/^\s*lyrics\s*:?\s*$/i.test(line))
  if(headingIndex<0)return ''
  const headingMatch=lines[headingIndex].match(/^\s*(#{1,6})\s*/)
  const headingLevel=headingMatch?headingMatch[1].length:2
  const out:string[]=[]
  const stopLabel=/^(heard on air|official video|about|related|more songs?|recently played|listen|connect|events?|comments?|credits?|share|footer)\b/i
  const junk=/cookie|privacy policy|sign in|log in|subscribe|advertisement|navigation|download the app|terms of use|all rights reserved/i
  for(let i=headingIndex+1;i<lines.length;i++){
    const source=lines[i]
    const h=source.match(/^\s*(#{1,6})\s+(.+?)\s*$/)
    if(h&&h[1].length<=headingLevel)break
    let line=source
      .replace(/^\s*#{1,6}\s*/,'')
      .replace(/^\s*[-*>]+\s*/,'')
      .replace(/!\[[^\]]*\]\([^)]*\)/g,'')
      .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
      .replace(/<[^>]+>/g,'')
      .replace(/[*_`]/g,'')
      .trim()
    if(!line){if(out.length&&out[out.length-1]!=='' )out.push('');continue}
    if(stopLabel.test(line))break
    if(/^©\s*/.test(line)&&out.filter(Boolean).length>=4)break
    if(junk.test(line))continue
    if(/^https?:\/\//i.test(line))continue
    if(line.length>220)continue
    out.push(line)
    if(out.filter(Boolean).length>=320)break
  }
  while(out.length&&!out[out.length-1])out.pop()
  const meaningful=out.filter(Boolean)
  return meaningful.length>=4?out.join('\n').trim():''
}


export function formatLyricsIntoFourLineSlides(text:string,maxLines=4):SongSection[]{
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trimEnd()).filter(x=>x.trim())
  if(!lines.length)return[{id:`slide-${Date.now()}-0`,label:'Slide 1',lines:[]}]
  const sections:SongSection[]=[]
  for(let i=0;i<lines.length;i+=maxLines){
    const n=sections.length+1
    sections.push({id:`slide-${Date.now()}-${n}`,label:`Slide ${n}`,lines:lines.slice(i,i+maxLines)})
  }
  return sections
}

export function songLyricsText(song:Song){
  return song.sections.flatMap(section=>section.lines).filter(line=>line.trim()).join('\n')
}

export function parseRawSections(text:string):SongSection[]{
  const lines=text.replace(/\r/g,'').split('\n'); const sections:SongSection[]=[]; let current:SongSection|undefined
  const head=/^(verse\s*\d*|chorus|pre[- ]?chorus|bridge|tag|intro|outro|refrain|custom(?: section)?)\s*:?[\s]*$/i
  for(const raw of lines){const line=raw.trimEnd(); if(head.test(line.trim())){current={id:`section-${Date.now()}-${sections.length}`,label:line.trim().replace(/:$/,''),lines:[]};sections.push(current)} else if(line.trim()){if(!current){current={id:`section-${Date.now()}-0`,label:'Verse 1',lines:[]};sections.push(current)}current.lines.push(line)}}
  return sections.length?sections:[{id:`section-${Date.now()}-0`,label:'Verse 1',lines:[]}]
}
