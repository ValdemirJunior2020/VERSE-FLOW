import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, ExternalLink, Plus, Search, Trash2, WifiOff } from 'lucide-react'
import type { InternetSongResult, PresentationState, Song, SongSection } from '../types'
import { extractLyricsFromPageText, formatLyricsIntoFourLineSlides, localSongMatches, lyricSectionTypes, lyricSlides, parseRawSections, songLyricsText } from '../lyrics'

const id=(p='id')=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
const emptySong=():Song=>({id:id('lyrics'),title:'',author:'',source:'',copyright:'',language:'English',notes:'',rights:'unknown',sections:[{id:id('section'),label:'Verse 1',lines:[]}]})
const cloneSong=(source:Song):Song=>({
  ...source,
  sections:source.sections.map(sec=>({...sec,lines:[...sec.lines]}))
})

const friendlyNote=(value:string)=>{
  const raw=String(value||'').trim()
  if(!raw)return ''
  if(/Companion API port|disk_cache|Gpu Cache Creation failed|Could not find files for the given pattern|DEP0180|Access is denied/i.test(raw))return 'A local helper reported a Windows warning. VerseFlow is still running. If internet search is unavailable, open Settings → Internet Agent and check the tool status.'
  if(raw.length>700)return raw.split(/\r?\n/).find(line=>line.trim()&&!/^\[?\d{4,}|INFO:|ERROR:net|ERROR:gpu|\(node:/i.test(line.trim()))?.slice(0,320)||'The operation could not finish. Check Settings → Internet Agent for tool status.'
  return raw
}

export default function LyricsPage({songs,onSave,onAddToService,onLiveState,state,setState}:{songs:Song[];onSave:(s:Song)=>Promise<void>;onAddToService:(s:Song)=>void;onLiveState:(s:PresentationState)=>void;state:PresentationState;setState:(s:PresentationState)=>void}){
  const [tab,setTab]=useState<'search'|'mine'|'edit'>('search')
  const [query,setQuery]=useState('')
  const [internet,setInternet]=useState<InternetSongResult[]>([])
  const [note,setNote]=useState('')
  const [busy,setBusy]=useState(false)
  const [song,setSong]=useState<Song>(emptySong())
  const [selected,setSelected]=useState<Song|undefined>()
  const [raw,setRaw]=useState('')
  const [slideIndex,setSlideIndex]=useState(0)
  const [hideLabels,setHideLabels]=useState(false)

  const slides=useMemo(()=>lyricSlides(selected||song),[selected,song])
  const local=useMemo(()=>localSongMatches(songs,query),[songs,query])
  const edit=(patch:Partial<Song>)=>setSong(s=>({...s,...patch}))
  const updateSec=(i:number,patch:Partial<SongSection>)=>setSong(s=>({...s,sections:s.sections.map((x,n)=>n===i?{...x,...patch}:x)}))
  const move=(i:number,d:number)=>setSong(s=>{const a=[...s.sections],to=i+d;if(to<0||to>=a.length)return s;[a[i],a[to]]=[a[to],a[i]];return{...s,sections:a}})
  const duplicate=(i:number)=>setSong(s=>{const a=[...s.sections];a.splice(i+1,0,{...a[i],id:id('section'),lines:[...a[i].lines]});return{...s,sections:a}})
  const remove=(i:number)=>setSong(s=>({...s,sections:s.sections.length>1?s.sections.filter((_,n)=>n!==i):s.sections}))
  const add=(label:string)=>setSong(s=>({...s,sections:[...s.sections,{id:id('section'),label,lines:[]}]}))

  const startNew=()=>{
    setSong(emptySong())
    setSelected(undefined)
    setRaw('')
    setSlideIndex(0)
    setNote('Add or paste lyrics, then save them locally.')
    setTab('edit')
  }

  const editSong=(value:Song)=>{
    const copy=cloneSong(value)
    setSong(copy)
    setSelected(copy)
    setRaw(copy.sections.map(sec=>`${sec.label}\n${sec.lines.join('\n')}`).join('\n\n'))
    setSlideIndex(0)
    setNote(`Editing: ${copy.title}`)
    setTab('edit')
  }

  const save=async()=>{
    if(!song.title.trim()){setNote('Song Title is required.');return}
    await onSave(song)
    setSelected(song)
    setNote('Lyrics saved locally and ready for presentation.')
  }

  const search=async()=>{
    const clean=query.trim()
    if(!clean){setNote('Type a song title, artist, or a natural-language request first.');return}
    setBusy(true)
    setInternet([])
    setNote('Searching your local Lyrics library first…')
    try{
      if(local.length===1&&local[0].score>=.9){
        setSelected(local[0].song)
        setSlideIndex(0)
        setNote(`Found locally: ${local[0].song.title}`)
        return
      }
      if(local.length>1&&Math.abs(local[0].score-local[1].score)<.02){
        setNote('I found more than one local match. Choose the correct song below.')
        return
      }
      setNote('Not found locally. Ollama is checking the request and searching the internet agent…')
      const r=await window.verseflow?.searchInternetSongs(clean)
      if(!r?.ok){
        setNote(r?.offline?'Internet search unavailable — showing local results only.':r?.error||'Internet search failed.')
        return
      }
      if(!r.results?.length){
        setNote('SONG NOT FOUND\n\nI searched your local Lyrics library and available internet sources.\n\nTry another song title, artist name, or alternate spelling.')
        return
      }
      setInternet(r.results)
      setNote('FOUND POSSIBLE MATCHES — choose the correct song. You can then add, paste, import, edit, and save the lyrics locally.')
    } finally {setBusy(false)}
  }

  const selectInternet=async(r:InternetSongResult)=>{
    if(/dashboard\.exa\.ai|create api key|api-keys|mcp url/i.test(`${r.sourceUrl} ${r.sourceTitle} ${r.title}`)){setNote('That result is an Internet Agent setup page, not a song. VerseFlow ignored it. Search again.');return}
    if(/\/(artists?|users?|profiles?|members?|authors?|tags?|search|browse|charts?|playlists?|albums?)(?:\/|$)/i.test(new URL(r.sourceUrl).pathname)){setNote('That result is an artist/profile or collection page, not the actual song. VerseFlow ignored it. Choose a specific song result instead.');return}
    setBusy(true)
    setNote('Opening the selected result and checking whether it contains usable lyric text…')
    let importedText=''
    const redirectOnly=/youtube\.com|youtu\.be|spotify\.com|apple\.com|music\.amazon|lnk\.to|linkfire|soundcloud\.com/i.test(r.sourceUrl)
    // A selected song page is opened in VerseFlow's read-only extractor. If the
    // page has a real Lyrics section, import only that section into the editor.
    // Streaming/redirect pages are skipped because they do not contain page lyrics.
    if(!redirectOnly){
      try{
        setNote('Reading the selected song page and looking for its Lyrics section…')
        const extracted=await window.verseflow?.extractInternetPage(r.sourceUrl)
        if(extracted?.ok)importedText=extractLyricsFromPageText(String(extracted.markdown||''))
      }catch{}
    }
    const base=emptySong()
    const next={
      ...base,
      title:r.title,
      author:r.artist||'',
      source:r.sourceUrl,
      copyright:r.sourceTitle,
      rights:r.rights,
      notes:`Source: ${r.sourceTitle}\nURL: ${r.sourceUrl}\nRetrieved: ${r.retrievedAt}\nConfidence: ${Math.round(r.confidence*100)}%`,
      sections:importedText?parseRawSections(importedText):base.sections
    }
    setSong(next)
    setSelected(next)
    setRaw(importedText)
    setSlideIndex(0)
    setTab('edit')
    setBusy(false)
    if(importedText)setNote('Lyrics were found on this source and loaded into the editor. Review them, then click Save Lyrics.')
    else if(redirectOnly)setNote('This result is a streaming/redirect page and does not contain lyric text. Go back and choose a lyric-page result, or paste/import lyrics here.')
    else setNote('Song selected, but this source did not provide importable lyric text. Paste/import the lyrics below or choose another result.')
  }

  const importLyrics=async()=>{
    const r=await window.verseflow?.importAuthorizedLyrics()
    if(!r?.ok){if(r?.error!=='Canceled')setNote(r?.error||'Import failed.');return}
    const text=r.text||''
    setRaw(text)
    edit({sections:parseRawSections(text),source:r.path||song.source})
    setNote('Lyrics imported. You can edit them before saving.')
  }

  const fullLyrics=()=>raw.trim()||songLyricsText(song)
  const formatForScreen=()=>{
    const text=fullLyrics()
    if(!text.trim()){setNote('Paste, import, or type lyrics first.');return}
    const sections=formatLyricsIntoFourLineSlides(text,4)
    edit({sections})
    setRaw(text)
    setSelected(undefined)
    setSlideIndex(0)
    setNote(`Formatted into ${sections.length} presentation slide${sections.length===1?'':'s'} with a maximum of 4 lines each. No lyric words were changed.`)
  }
  const copyAll=async()=>{
    const text=fullLyrics()
    if(!text.trim()){setNote('There are no lyrics to copy.');return}
    const r=await window.verseflow?.copyText(text)
    if(r?.ok)setNote('All lyrics copied to the clipboard.')
  }
  const exportAll=async()=>{
    const text=fullLyrics()
    if(!text.trim()){setNote('There are no lyrics to export.');return}
    const r=await window.verseflow?.exportLyricsText(song.title||'lyrics',text)
    setNote(r?.ok?`Lyrics exported to ${r.path}`:r?.error||'Lyrics export canceled.')
  }

  const useSlide=(live:boolean)=>{
    const base=selected||song
    const currentSlides=lyricSlides(base)
    const s=currentSlides[Math.max(0,Math.min(slideIndex,currentSlides.length-1))]
    if(!s)return
    const next={...state,mode:live?'live' as const:'preview' as const,title:base.title,text:s.lines.join('\n'),reference:hideLabels?'':s.label,layout:'center' as const,youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1}
    if(live)onLiveState(next);else setState(next)
  }

  const list=(arr:Song[])=><div className="lyrics-library-grid">{arr.map(x=><button key={x.id} onClick={()=>{setSelected(x);setSlideIndex(0)}} className={selected?.id===x.id?'selected':''}><strong>{x.title}</strong><span>{x.author||'Saved lyrics'}</span><small>{x.sections.length} section{x.sections.length===1?'':'s'}</small></button>)}{!arr.length&&<div className="empty-card">No saved lyrics yet.</div>}</div>

  return <div className="lyrics-page">
    <div className="page-heading"><div><span className="eyebrow">CHRISTIAN · GOSPEL · WORSHIP</span><h2>LYRICS</h2></div><div className="status-pill">Offline-first · Ollama local</div></div>

    <div className="lyrics-tabs">
      <button className={tab==='search'?'active':''} onClick={()=>setTab('search')}>Search Lyrics</button>
      <button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}>My Lyrics</button>
      <button className={tab==='edit'?'active':''} onClick={startNew}>Add / Edit Lyrics</button>
    </div>

    {note&&<div className="lyrics-note">{friendlyNote(note)}</div>}

    {tab==='search'&&<>
      <div className="lyrics-search-help">Type only what you know. Example: <strong>Way Maker</strong>, <strong>Way Maker Sinach</strong>, <strong>Sinach</strong>, or even a misspelled title. You do not need to type “find”. Ollama helps clean up the search before the internet agent runs.</div>
      <div className="lyrics-search-hero"><Search size={24}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void search()} placeholder="Ask AI to find a song or lyrics source…"/><button className="gold" disabled={busy} onClick={search}>{busy?'Searching…':'AI SEARCH'}</button></div>
      {local.length>0&&<section><h3>Local matches</h3><div className="search-results">{local.slice(0,8).map(({song:x,score})=><button key={x.id} onClick={()=>{setSelected(x);setSlideIndex(0)}}><strong>{x.title} — {x.author||'Local'}</strong><span>My Lyrics · {Math.round(score*100)}% match</span></button>)}</div></section>}
      {internet.length>0&&<section><h3>Internet matches</h3><div className="search-results lyrics-internet-results">{internet.map((r,i)=><article key={r.sourceUrl+i}><div><strong>{r.title}{r.artist?` — ${r.artist}`:''}</strong><span>{r.album||r.alternateTitle||r.sourceTitle}</span><small>Confidence {Math.round(r.confidence*100)}% · {new Date(r.retrievedAt).toLocaleString()}</small><small>{r.sourceTitle}</small></div><div className="inline"><button className="gold" onClick={()=>selectInternet(r)}>USE / EDIT</button><button onClick={()=>window.verseflow?.openInternetSource(r.sourceUrl)}><ExternalLink size={14}/> OPEN SOURCE</button></div></article>)}</div></section>}
    </>}

    {tab==='mine'&&<>
      <div className="lyrics-search-help">These are lyrics already saved on this computer. Select one to preview it, send it live, add it to the service, or edit it.</div>
      {list(songs)}
    </>}

    {tab==='edit'&&<div className="lyrics-editor-layout">
      <div className="lyrics-editor-main">
        <div className="lyrics-meta-grid">
          <label>Song Title<input value={song.title} onChange={e=>edit({title:e.target.value})}/></label>
          <label>Artist / Author<input value={song.author||''} onChange={e=>edit({author:e.target.value})}/></label>
          <label>Source<input value={song.copyright||song.source||''} onChange={e=>edit({copyright:e.target.value})}/></label>
          <label>Language<input value={song.language||''} onChange={e=>edit({language:e.target.value})}/></label>
        </div>
        <label>Notes<textarea className="lyrics-notes" value={song.notes||''} onChange={e=>edit({notes:e.target.value})}/></label>

        <div className="lyrics-editor-quick-actions">
          <button onClick={importLyrics}>Import Lyrics File</button>
          {song.source&&<button onClick={()=>window.verseflow?.openInternetSource(song.source)}><ExternalLink size={14}/> Open Song Source</button>}
        </div>

        <div className="section-stack">{song.sections.map((sec,i)=><article className="lyric-section-card" key={sec.id}>
          <div className="section-card-head"><input value={sec.label} onChange={e=>updateSec(i,{label:e.target.value})}/><div className="inline"><button title="Duplicate" onClick={()=>duplicate(i)}><Copy size={14}/></button><button title="Move Up" onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button title="Move Down" onClick={()=>move(i,1)}><ArrowDown size={14}/></button><button title="Delete" onClick={()=>remove(i)}><Trash2 size={14}/></button></div></div>
          <textarea value={sec.lines.join('\n')} onChange={e=>updateSec(i,{lines:e.target.value.replace(/\r/g,'').split('\n')})} placeholder="Type or paste lyrics here…"/>
        </article>)}</div>

        <div className="section-add-row"><button onClick={()=>add(`Verse ${song.sections.filter(x=>/^verse/i.test(x.label)).length+1}`)}><Plus size={14}/> Add Verse</button><button onClick={()=>add('Chorus')}>Add Chorus</button><button onClick={()=>add('Bridge')}>Add Bridge</button><select onChange={e=>{if(e.target.value)add(e.target.value);e.currentTarget.value=''}} defaultValue=""><option value="" disabled>Add Section…</option>{lyricSectionTypes.map(x=><option key={x}>{x}</option>)}</select></div>

        <div className="messy-organizer screen-formatter"><h3>FORMAT INTO 4-LINE SLIDES</h3><p>Paste the complete lyrics here. VerseFlow keeps every word in the same order and simply creates presentation slides with no more than 4 non-empty lines each.</p><textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste the complete lyrics here…"/><div className="lyrics-save-actions"><button className="gold" onClick={formatForScreen}>FORMAT INTO 4-LINE SLIDES</button><button onClick={copyAll}><Copy size={15}/> COPY ALL LYRICS</button><button onClick={exportAll}><Download size={15}/> EXPORT FULL LYRICS</button></div></div>

        <div className="detail-actions lyrics-primary-actions"><button className="gold" onClick={save}>SAVE TO MY LYRICS</button><button onClick={copyAll}><Copy size={15}/> COPY ALL LYRICS</button><button onClick={exportAll}><Download size={15}/> EXPORT FULL LYRICS</button><button onClick={()=>{setSelected(song);setSlideIndex(0);useSlide(false)}}>PREVIEW</button><button onClick={()=>onAddToService(song)}>ADD ENTIRE SONG TO SERVICE</button><button className="gold" onClick={()=>{setSelected(song);setSlideIndex(0);useSlide(true)}}>SEND LIVE</button></div>
      </div>

      <aside className="lyrics-preview-panel"><h3>Presentation Ready</h3><label className="inline-check"><input type="checkbox" checked={hideLabels} onChange={e=>setHideLabels(e.target.checked)}/> Hide section labels on audience screen</label><p>Maximum 4 lyric lines per slide.</p><div className="lyrics-slide-list">{slides.map((sl,i)=><button key={sl.id} className={slideIndex===i?'selected':''} onClick={()=>setSlideIndex(i)}><small>{sl.label}</small><span>{sl.lines.join(' / ')||'(empty)'}</span></button>)}</div><div className="live-controls"><button disabled={slideIndex<=0} onClick={()=>setSlideIndex(i=>Math.max(0,i-1))}>PREVIOUS</button><button onClick={()=>useSlide(false)}>PREVIEW</button><button className="gold" onClick={()=>useSlide(true)}>LIVE</button><button disabled={slideIndex>=slides.length-1} onClick={()=>setSlideIndex(i=>Math.min(slides.length-1,i+1))}>NEXT</button></div></aside>
    </div>}

    {selected&&tab!=='edit'&&<div className="selected-song-presenter"><div><strong>{selected.title}</strong><span>{selected.author}</span></div><div className="lyrics-slide-list">{lyricSlides(selected).map((sl,i)=><button key={sl.id} className={slideIndex===i?'selected':''} onClick={()=>setSlideIndex(i)}><small>{sl.label}</small><span>{sl.lines.join(' / ')}</span></button>)}</div><div className="live-controls"><button onClick={()=>setSlideIndex(i=>Math.max(0,i-1))}>PREVIOUS</button><button onClick={()=>useSlide(false)}>PREVIEW</button><button className="gold" onClick={()=>useSlide(true)}>LIVE</button><button onClick={()=>setSlideIndex(i=>Math.min(lyricSlides(selected).length-1,i+1))}>NEXT</button><button onClick={()=>onAddToService(selected)}>Add Entire Song To Service</button><button className="gold" onClick={()=>editSong(selected)}>EDIT LYRICS</button></div></div>}

    {!window.verseflow&&<div className="lyrics-note"><WifiOff size={15}/> Desktop integrations unavailable. Local saved lyrics still remain usable after reload.</div>}
  </div>
}
