import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CirclePlus, Clock3, Images, Import, Monitor, Search, Undo2, WifiOff, Youtube, Zap, TimerReset, Type, SlidersHorizontal, Music2, ImagePlus, CheckCircle2, AlertTriangle } from 'lucide-react'
import Nav from './components/Nav'
import CanvasPreview from './components/CanvasPreview'
import OutputRenderer from './components/OutputRenderer'
import LanguageSwitcher from './components/LanguageSwitcher'
import ProductionPage from './components/ProductionPage'
import LyricsPage from './components/LyricsPage'
import { installDomTranslation, type Language } from './i18n'
import { cleanStrongMarkers, defaultTheme, itemToPresentation, verseToServiceItem } from './presentation'
import { useVerseFlowData } from './hooks/useVerseFlowData'
import { builtInBackgrounds } from './backgrounds'
import { localSongMatches, lyricSlides } from './lyrics'
import type { BibleCatalogItem, BibleTranslation, DisplayInfo, DisplayStatus, MediaItem, ModuleKey, PresentationState, ServiceItem, SmartPlan, Song, Theme, ToolStatus, Verse, SystemCheckResult, InternetToolsStatus } from './types'

const params = new URLSearchParams(location.search)
const mode = params.get('mode')
if (mode === 'audience' || mode === 'stage') {
  // rendered below from App
}

function uid(prefix='id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}` }

function localMediaUrl(filePath?:string){
  if(!filePath)return ''
  if(filePath.startsWith('http://')||filePath.startsWith('https://')||filePath.startsWith('verseflow-media://')||filePath.startsWith('data:')||filePath.startsWith('blob:'))return filePath
  return `verseflow-media://local/${encodeURIComponent(filePath)}`
}

function ScriptureBrowser({verses,translations,onPreview,onAdd,onLive,onImport,onInstalled}:{verses:Verse[];translations:BibleTranslation[];onPreview:(v:Verse)=>void;onAdd:(v:Verse)=>void;onLive:(v:Verse)=>void;onImport:()=>void;onInstalled:()=>void}) {
  const [q,setQ]=useState('')
  const [translation,setTranslation]=useState(translations[0]?.code||'WEB')
  const [book,setBook]=useState('')
  const [chapter,setChapter]=useState(1)
  const [books,setBooks]=useState<string[]>([])
  const [chapters,setChapters]=useState<number[]>([])
  const [visibleVerses,setVisibleVerses]=useState<Verse[]>([])
  const [catalog,setCatalog]=useState<BibleCatalogItem[]>([])
  const [busy,setBusy]=useState('')
  const [catalogOpen,setCatalogOpen]=useState(false)
  const [versesLoading,setVersesLoading]=useState(false)

  useEffect(()=>{window.verseflow?.getBibleCatalog().then(setCatalog)},[])
  useEffect(()=>{if(translations.length&&!translations.some(t=>t.code===translation))setTranslation(translations[0].code)},[translations,translation])

  useEffect(()=>{
    let cancelled=false
    const loadBooks=async()=>{
      setVersesLoading(true)
      try{
        const loaded=window.verseflow?.getBibleBooks ? await window.verseflow.getBibleBooks(translation) : Array.from(new Set(verses.filter(v=>v.translation===translation).map(v=>v.book)))
        if(cancelled)return
        setBooks(loaded||[])
        setBook(current=>(loaded||[]).includes(current)?current:(loaded?.[0]||''))
        setChapter(1)
      }catch(error){console.error('Bible book list failed:',error)}
      finally{if(!cancelled)setVersesLoading(false)}
    }
    if(translation)void loadBooks()
    return()=>{cancelled=true}
  },[translation,verses])

  useEffect(()=>{
    let cancelled=false
    const loadChapters=async()=>{
      if(!book){setChapters([]);return}
      try{
        const loaded=window.verseflow?.getBibleChapters ? await window.verseflow.getBibleChapters(translation,book) : Array.from(new Set(verses.filter(v=>v.translation===translation&&v.book===book).map(v=>v.chapter))).sort((a,b)=>a-b)
        if(cancelled)return
        setChapters(loaded||[])
        setChapter(current=>(loaded||[]).includes(current)?current:(loaded?.[0]||1))
      }catch(error){console.error('Bible chapter list failed:',error)}
    }
    void loadChapters()
    return()=>{cancelled=true}
  },[translation,book,verses])

  useEffect(()=>{
    let cancelled=false
    const timer=setTimeout(async()=>{
      setVersesLoading(true)
      try{
        const query=q.trim()
        let loaded:Verse[]=[]
        if(query){
          loaded=window.verseflow?.searchBible ? await window.verseflow.searchBible(query,translation,250) : verses.filter(v=>v.translation===translation&&`${v.book} ${v.chapter}:${v.verse} ${v.text}`.toLowerCase().includes(query.toLowerCase())).slice(0,250)
        }else if(book){
          loaded=window.verseflow?.getBibleChapter ? await window.verseflow.getBibleChapter(translation,book,chapter) : verses.filter(v=>v.translation===translation&&v.book===book&&v.chapter===chapter)
        }
        if(!cancelled)setVisibleVerses(loaded||[])
      }catch(error){
        console.error('Bible lazy load failed:',error)
        if(!cancelled)setVisibleVerses([])
      }finally{if(!cancelled)setVersesLoading(false)}
    },q.trim()?180:0)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[translation,book,chapter,q,verses])

  const installed=new Set(translations.map(t=>t.code))
  const install=async(item:BibleCatalogItem)=>{
    if(item.status==='import'){onImport();return}
    setBusy(item.code)
    const r=await window.verseflow?.installBibleFromCatalog(item.code)
    setBusy('')
    if(r?.ok){await onInstalled();setTranslation(item.code);setQ('')}
    else alert(r?.error||'Bible install failed')
  }
  const readable=(v:Verse)=>v.translation.includes('STRONGS')?cleanStrongMarkers(v.text):v.text
  return <div className="browser-panel">
    <div className="panel-title">Bible</div>
    <label className="search-field"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search reference or words"/></label>
    <div className="tiny-row"><select value={translation} onChange={e=>{setTranslation(e.target.value);setQ('')}}>{translations.map(t=><option value={t.code} key={t.code}>{t.code} · {t.name}</option>)}</select><button className="ghost" onClick={()=>setCatalogOpen(v=>!v)}>Bibles</button></div>
    <div className="bible-nav-row"><select value={book} disabled={!books.length} onChange={e=>{setBook(e.target.value);setChapter(1);setQ('')}}>{books.map(b=><option key={b}>{b}</option>)}</select><select value={chapter} disabled={!chapters.length} onChange={e=>{setChapter(+e.target.value);setQ('')}}>{chapters.map(c=><option key={c} value={c}>Chapter {c}</option>)}</select></div>
    {catalogOpen&&<div className="bible-catalog">
      <div className="catalog-head"><strong>Bible Library</strong><button onClick={onImport}>Import JSON</button></div>
      {catalog.map(item=><div className="catalog-row" key={item.code}>
        <div><strong>{item.code}</strong><span>{item.name}</span><small>{item.language} · {item.license}</small></div>
        {installed.has(item.code)?<span className="installed-badge">Installed</span>:<button disabled={busy===item.code} onClick={()=>install(item)}>{busy===item.code?'Installing…':item.status==='download'?'Install':'Import'}</button>}
      </div>)}
    </div>}
    <div className="verse-list">{versesLoading?<div className="empty-card"><strong>Loading Bible…</strong><p>Loading only the selected {q.trim()?'search':'chapter'}.</p></div>:visibleVerses.map(v=><article key={`${v.translation}-${v.id}`} onClick={()=>onPreview(v)}>
      <div><strong>{v.book} {v.chapter}:{v.verse}</strong><span>{v.translation}</span></div>
      <p data-no-translate="true">{readable(v)}</p>
      <div className="verse-actions"><button onClick={e=>{e.stopPropagation();onPreview(v)}}>Preview</button><button className="gold small" onClick={e=>{e.stopPropagation();onLive(v)}}>LIVE</button><button onClick={e=>{e.stopPropagation();onAdd(v)}}>+ Service</button></div>
    </article>)}</div>
  </div>
}
function atmospherePayload(state:PresentationState) {
  return {
    ...(state.background ? {background:state.background,backgroundType:state.backgroundType||'image'} : {}),
    ...(state.audio?.path ? {audioPath:state.audio.path,audioVolume:state.audio.volume,audioLoop:state.audio.loop} : {})
  }
}

function BackgroundControls({state,setState,media,onPickMedia}:{state:PresentationState;setState:(s:PresentationState)=>void;media:MediaItem[];onPickMedia?:()=>void}) {
  const importedBackgrounds=media.filter(m=>m.type==='image'||m.type==='video')
  const audio=media.filter(m=>m.type==='audio')
  const applyBackground=(path:string,type:'image'|'video')=>{
    const darkDefault=['#2f3133','#111111','#000000'].includes(String(state.theme.textColor).toLowerCase())
    setState({...state,background:path,backgroundType:type,youtubeId:undefined,black:false,logo:false,theme:{...state.theme,overlay:Math.max(.46,state.theme.overlay||0),textColor:darkDefault?'#fffaf0':state.theme.textColor},sequence:state.sequence+1})
  }
  const applyMusic=(m:MediaItem)=>setState({...state,audio:{path:m.path,playing:true,volume:state.audio?.volume??.72,loop:state.audio?.loop??true},sequence:state.sequence+1})
  return <div className="background-controls" data-testid="background-controls">
    <div className="background-head"><div><strong>Backgrounds</strong><small>Pick one. Your verse or lyrics stay on screen.</small></div>{onPickMedia&&<button className="tiny-button" onClick={onPickMedia}><ImagePlus size={13}/> Import</button>}</div>
    <div className="background-grid">
      {builtInBackgrounds.map(bg=><button key={bg.id} data-testid="background-preset" className={state.background===bg.src?'selected':''} title={bg.name} onClick={()=>applyBackground(bg.src,'image')}><i style={{backgroundImage:`url("${bg.src}")`}}/><span>{bg.name}</span></button>)}
    </div>
    {importedBackgrounds.length>0&&<><div className="control-subtitle">Imported backgrounds</div><div className="imported-background-list">{importedBackgrounds.slice(0,12).map(m=><button key={m.id} className={state.background===m.path?'selected':''} onClick={()=>applyBackground(m.path,m.type==='video'?'video':'image')}>{m.type==='image'?<img src={localMediaUrl(m.path)}/>:<span className="video-bg-mark">VIDEO</span>}<small>{m.name}</small></button>)}</div></>}
    <button className="clear-background" disabled={!state.background} onClick={()=>setState({...state,background:undefined,backgroundType:'solid',theme:{...state.theme,textColor:String(state.theme.textColor).toLowerCase()==='#fffaf0'?'#2f3133':state.theme.textColor},sequence:state.sequence+1})}>Clear background</button>
    <div className="music-picker"><div className="control-subtitle"><Music2 size={13}/> Background music</div>{audio.length?<select value={state.audio?.path||''} onChange={e=>{const m=audio.find(x=>x.path===e.target.value);if(m)applyMusic(m)}}><option value="">Choose music…</option>{audio.map(m=><option key={m.id} value={m.path}>{m.name}</option>)}</select>:<p>No music imported yet.</p>}
      <div className="music-actions">{onPickMedia&&<button onClick={onPickMedia}>Import music</button>}<button disabled={!state.audio?.path} onClick={()=>setState({...state,audio:undefined,sequence:state.sequence+1})}>Remove music</button></div>
      {state.audio?.path&&<label className="loop-check"><input type="checkbox" checked={state.audio.loop} onChange={e=>setState({...state,audio:{...state.audio!,loop:e.target.checked},sequence:state.sequence+1})}/> Loop music</label>}
    </div>
  </div>
}

function Inspector({state,setState,themes,media=[],onPickMedia}:{state:PresentationState;setState:(s:PresentationState)=>void;themes:Theme[];media?:MediaItem[];onPickMedia?:()=>void}) {
  const patchTheme=(patch:Partial<Theme>)=>setState({...state,theme:{...state.theme,...patch}})
  return <div className="inspector">
    <div className="panel-title">Properties</div>
    <BackgroundControls state={state} setState={setState} media={media} onPickMedia={onPickMedia}/>
    <div className="inspector-divider"/>
    <label>Theme<select value={state.theme.id} onChange={e=>{const t=themes.find(x=>x.id===e.target.value); if(t) setState({...state,theme:t})}}>{themes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Font Family<select value={state.theme.fontFamily} onChange={e=>patchTheme({fontFamily:e.target.value})}><option>Georgia, Times New Roman, serif</option><option>Arial, Helvetica, sans-serif</option><option>Verdana, sans-serif</option></select></label>
    <label>Font Size<div className="range-row"><input type="range" min="30" max="110" value={state.theme.fontSize} onChange={e=>patchTheme({fontSize:+e.target.value})}/><span>{state.theme.fontSize}</span></div></label>
    <label>Text Color<input type="color" value={state.theme.textColor} onChange={e=>patchTheme({textColor:e.target.value})}/></label>
    <label>Accent / Reference Color<input type="color" value={state.theme.accentColor} onChange={e=>patchTheme({accentColor:e.target.value})}/></label>
    <label>Alignment<div className="seg"><button className={state.theme.alignment==='left'?'active':''} onClick={()=>patchTheme({alignment:'left'})}>Left</button><button className={state.theme.alignment==='center'?'active':''} onClick={()=>patchTheme({alignment:'center'})}>Center</button><button className={state.theme.alignment==='right'?'active':''} onClick={()=>patchTheme({alignment:'right'})}>Right</button></div></label>
    <label>Overlay Darkness<div className="range-row"><input type="range" min="0" max="90" value={Math.round(state.theme.overlay*100)} onChange={e=>patchTheme({overlay:+e.target.value/100})}/><span>{Math.round(state.theme.overlay*100)}%</span></div></label>
    <label>Transition<select value={state.theme.transition} onChange={e=>patchTheme({transition:e.target.value as Theme['transition']})}><option value="fade">Fade</option><option value="cut">Cut</option><option value="slide">Slide</option></select></label>
    <div className="safe-note">16:9 safe-area protection is always active on the live output.</div>
  </div>
}

function Dashboard({go,data}:{go:(m:ModuleKey)=>void;data:any}) {
  return <div className="page dashboard">
    <div className="hero-card"><div><span className="eyebrow">SUNDAY READY</span><h1>Your service. One clean flow.</h1><p>Build the service offline, preview every slide, then send only approved content to the audience screen.</p><div className="hero-actions"><button className="gold" onClick={()=>go('present')}>Open Live Desk</button><button onClick={()=>go('playlists')}>Build Service (optional)</button></div></div><div className="hero-orb">VF</div></div>
    <div className="stats"><div><span>Bible verses</span><strong>{data.verseCount}</strong></div><div><span>Songs</span><strong>{data.songs.length}</strong></div><div><span>Media</span><strong>{data.media.length}</strong></div><div><span>Saved services</span><strong>{data.services.length}</strong></div></div>
    <div className="feature-grid"><div><Zap/><h3>Live Scripture Flow</h3><p>Search, preview, send live, then move verse-by-verse with keyboard control.</p></div><div><Monitor/><h3>Cinematic Scripture Studio</h3><p>Optional motion and AI media tools stay separate from the reliable live engine.</p></div><div><ListMusicIcon/><h3>Sunday Service Builder</h3><p>Scripture, songs, announcements, images and videos in one ordered service.</p></div></div>
  </div>
}
function ListMusicIcon(){return <span className="feature-icon">☷</span>}

function BiblePage({verses,translations,onPreview,onAdd,onLive,onImport,onInstalled,state,setState,themes,items,media,onPickMedia}:{verses:Verse[];translations:BibleTranslation[];onPreview:(v:Verse)=>void;onAdd:(v:Verse)=>void;onLive:(v:Verse)=>void;onImport:()=>void;onInstalled:()=>void;state:PresentationState;setState:(s:PresentationState)=>void;themes:Theme[];items:ServiceItem[];media:MediaItem[];onPickMedia:()=>void}) {
  const [selected,setSelected]=useState<Verse|undefined>(verses[0])
  const preview=(v:Verse)=>{setSelected(v);onPreview(v)}
  return <div className="editor-layout">
    <ScriptureBrowser verses={verses} translations={translations} onPreview={preview} onAdd={onAdd} onLive={onLive} onImport={onImport} onInstalled={onInstalled}/>
    <section className="editor-center">
      <div className="editor-heading"><div><span className="eyebrow">SLIDE EDITOR</span><strong>{selected?`${selected.book} ${selected.chapter}:${selected.verse}`:'Scripture preview'}</strong></div><div className="detail-actions">{selected&&<><button className="gold" onClick={()=>onLive(selected)}>LIVE NOW</button><button onClick={()=>onAdd(selected)}>Add to Service (optional)</button></>}</div></div>
      <CanvasPreview state={state} live={state.mode==='live'}/>
      <div className="slide-strip"><div className="strip-label">SERVICE</div>{items.length===0?<span className="strip-empty">Add scripture, songs or media to build the service.</span>:items.slice(0,8).map((it,i)=><div className="slide-thumb" key={it.id}><span>{i+1}</span><strong>{it.title}</strong></div>)}</div>
    </section>
    <Inspector state={state} setState={setState} themes={themes} media={media} onPickMedia={onPickMedia}/>
  </div>
}
function SongsPage({songs,onSave,onAdd,onPreview,onLive,state,setState,media,onPickMedia}:{songs:Song[];onSave:(s:Song)=>void;onAdd:(s:Song)=>void;onPreview:(s:Song)=>void;onLive:(s:Song)=>void;state:PresentationState;setState:(s:PresentationState)=>void;media:MediaItem[];onPickMedia:()=>void}) {
  const [selected,setSelected]=useState<Song|undefined>(songs[0])
  const [title,setTitle]=useState(songs[0]?.title||'')
  const [author,setAuthor]=useState(songs[0]?.author||'')
  const [ccli,setCcli]=useState(songs[0]?.ccli||'')
  const [songKey,setSongKey]=useState(songs[0]?.key||'')
  const [body,setBody]=useState(songs[0]?.sections.map(x=>[x.label,...x.lines].join('\n')).join('\n\n')||'Verse 1\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\nChorus\nMy chains are gone\nI’ve been set free')
  const choose=(s:Song)=>{setSelected(s);setTitle(s.title);setAuthor(s.author||'');setCcli(s.ccli||'');setSongKey(s.key||'');setBody(s.sections.map(x=>[x.label,...x.lines].join('\n')).join('\n\n'))}
  const draftSong=()=>{const sections=body.split(/\n\s*\n/).map((block,i)=>{const lines=block.split('\n');return{id:uid('sec'),label:lines.shift()||`Section ${i+1}`,lines}});return{id:selected?.id||uid('song'),title:title||'Untitled Song',author,ccli,key:songKey,sections}}
  const save=()=>{const s=draftSong();onSave(s);setSelected(s)}
  return <div className="library-page"><div className="library-list"><div className="panel-title">Songs</div>{songs.map(s=><button className={selected?.id===s.id?'selected':''} key={s.id} onClick={()=>choose(s)}><strong>{s.title}</strong><span>{s.author||'Local song'}</span></button>)}<button className="ghost" onClick={()=>{setSelected(undefined);setTitle('');setAuthor('');setCcli('');setSongKey('');setBody('Verse 1\n')}}>+ New Song</button></div><div className="song-editor"><span className="eyebrow">LOCAL SONG LIBRARY</span><input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Song title"/><textarea value={body} onChange={e=>setBody(e.target.value)}/><div className="detail-actions"><button onClick={save}>Save Song</button>{selected&&<><button onClick={()=>onPreview(draftSong())}>Preview</button><button className="gold" onClick={()=>onLive(draftSong())}>LIVE</button><button onClick={()=>onAdd(draftSong())}>+ Service</button></>}</div></div><div className="mini-help song-side-panel"><h3>Song metadata</h3><label>Author<input value={author} onChange={e=>setAuthor(e.target.value)}/></label><label>CCLI #<input value={ccli} onChange={e=>setCcli(e.target.value)}/></label><label>Key<input value={songKey} onChange={e=>setSongKey(e.target.value)}/></label><p>CCLI fields are metadata only. VerseFlow does not grant or claim music licensing rights.</p><div className="inspector-divider"/><BackgroundControls state={state} setState={setState} media={media} onPickMedia={onPickMedia}/></div></div>
}
function MediaPage({media,onImport,onAdd,onPreview,onLive,onBackground,onMusic}:{media:MediaItem[];onImport:()=>void;onAdd:(m:MediaItem)=>void;onPreview:(m:MediaItem)=>void;onLive:(m:MediaItem)=>void;onBackground:(m:MediaItem)=>void;onMusic:(m:MediaItem)=>void}) {
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">LOCAL MEDIA</span><h1>Media Library</h1></div><button className="gold" onClick={onImport}><Import size={16}/> Import Media</button></div><div className="media-grid">{media.length===0?<div className="empty-card"><Images size={32}/><h3>No local media yet</h3><p>Import images, videos or audio. Files stay on this PC.</p><button onClick={onImport}>Choose files</button></div>:media.map(m=><div className="media-card" key={m.id}><div className={`media-thumb ${m.type}`}>{m.type==='image'?<img src={localMediaUrl(m.path)}/>:m.type.toUpperCase()}</div><strong>{m.name}</strong><span>{m.type}</span><div className="media-card-actions media-actions-stacked">{m.type==='audio'?<><button onClick={()=>onMusic(m)}><Music2 size={13}/> ADD MUSIC</button><button className="gold small" onClick={()=>onLive(m)}>PLAY NOW</button></>:<><button onClick={()=>onBackground(m)}><ImagePlus size={13}/> USE AS BG</button><button className="gold small" onClick={()=>onLive(m)}>FULLSCREEN</button></>}<button onClick={()=>onPreview(m)}>Preview</button><button onClick={()=>onAdd(m)}>+ Service</button></div></div>)}</div></div>
}


function PlaylistPage({items,setItems,onSelect,onLive,onSave}:{items:ServiceItem[];setItems:(x:ServiceItem[])=>void;onSelect:(i:number)=>void;onLive:(i:number)=>void;onSave:(name:string,items:ServiceItem[])=>void}) {
  const [name,setName]=useState('Sunday Service')
  const [undo,setUndo]=useState<ServiceItem[]|null>(null)
  const commit=(next:ServiceItem[])=>{setUndo([...items]);setItems(next)}
  const move=(i:number,d:number)=>{const j=i+d;if(j<0||j>=items.length)return;const x=[...items];[x[i],x[j]]=[x[j],x[i]];commit(x)}
  const duplicate=(i:number)=>{const copy={...items[i],id:uid('copy'),title:`${items[i].title} Copy`};const x=[...items];x.splice(i+1,0,copy);commit(x)}
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">SERVICE BUILDER</span><input className="title-input" value={name} onChange={e=>setName(e.target.value)}/></div><div className="inline"><span className="status-pill">{items.length} items</span><button disabled={!undo} onClick={()=>{if(undo){const current=[...items];setItems(undo);setUndo(current)}}}>Undo</button><button className="gold" onClick={()=>onSave(name,items)}>Save Service</button></div></div><div className="service-builder">{items.length===0?<div className="empty-card"><h3>Your service is empty</h3><p>Add scripture from Bible, songs from Songs, or files from Media.</p></div>:items.map((it,i)=><div className="service-row" key={it.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',String(i))} onDragOver={e=>e.preventDefault()} onDrop={e=>{const from=+e.dataTransfer.getData('text/plain');if(from===i)return;const x=[...items];const [m]=x.splice(from,1);x.splice(i,0,m);commit(x)}}><span className="drag">⋮⋮</span><span className={`kind ${it.type}`}>{it.type.slice(0,3).toUpperCase()}</span><div onClick={()=>onSelect(i)}><strong>{it.title}</strong><span>{it.subtitle}</span></div><button onClick={()=>move(i,-1)}>↑</button><button onClick={()=>move(i,1)}>↓</button><button className="gold small" onClick={()=>onLive(i)}>Live</button><button title="Duplicate" onClick={()=>duplicate(i)}>⧉</button><button className="danger" onClick={()=>commit(items.filter((_,x)=>x!==i))}>×</button></div>)}</div></div>
}
function ThemesPage({themes,onApply,onSave}:{themes:Theme[];onApply:(t:Theme)=>void;onSave:(t:Theme)=>void}) {
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">REUSABLE STYLES</span><h1>Themes</h1></div><button className="gold" onClick={()=>onSave({...defaultTheme,id:uid('theme'),name:'New Gold Theme'})}>+ New Theme</button></div><div className="theme-grid">{themes.map(t=><button className="theme-card" key={t.id} onClick={()=>onApply(t)}><div className="theme-demo" style={{fontFamily:t.fontFamily}}><span style={{color:t.accentColor}}>JOHN 3:16</span><strong style={{color:t.textColor}}>FOR GOD SO LOVED<br/>THE WORLD</strong></div><div><strong>{t.name}</strong><span>{t.transition} · {t.alignment}</span></div></button>)}</div></div>
}

function SettingsPage({displays,settings,translations,refresh,openOut,closeOut,onBackup,onRestore,onSaveSetting}:{displays:DisplayInfo[];settings:Record<string,unknown>;translations:BibleTranslation[];refresh:()=>void;openOut:(k:'audience'|'stage',id:number)=>void;closeOut:(k:'audience'|'stage')=>void;onBackup:()=>void;onRestore:()=>void;onSaveSetting:(k:string,v:unknown)=>void}) {
  const [aud,setAud]=useState<number>(Number(settings.audienceDisplayId) || (displays.find(d=>!d.primary)?.id ?? displays[0]?.id ?? 0))
  const [stage,setStage]=useState<number>(Number(settings.stageDisplayId) || (displays[2]?.id ?? displays[0]?.id ?? 0))
  const [omni,setOmni]=useState(String(settings.aiEndpoint||'http://127.0.0.1:20128/v1'))
  const [translation,setTranslation]=useState(String(settings.defaultTranslation||translations[0]?.code||'WEB'))
  const [resolution,setResolution]=useState(String(settings.resolution||'1920x1080'))
  const [fps,setFps]=useState(String(settings.fps||'60'))
  const [mediaFolders,setMediaFolders]=useState(String(settings.mediaFolders||''))
  const [health,setHealth]=useState('')
  const [tools,setTools]=useState<ToolStatus|null>(null)
  const [diagnostics,setDiagnostics]=useState<SystemCheckResult|null>(null)
  const [internetTools,setInternetTools]=useState<InternetToolsStatus|null>(null)
  const refreshTools=async()=>{setTools(await window.verseflow?.toolStatus()||null);setInternetTools(await window.verseflow?.internetToolsStatus()||null)}
  const runDiagnostics=async()=>setDiagnostics(await window.verseflow?.systemCheck()||null)
  const [dataPath,setDataPath]=useState('')
  const [identifyBusy,setIdentifyBusy]=useState(false)
  const [displayStatus,setDisplayStatus]=useState<DisplayStatus|null>(null)
  useEffect(()=>{window.verseflow?.appInfo().then(x=>setDataPath(x.dataPath));refreshTools();runDiagnostics()},[])
  useEffect(()=>{window.verseflow?.getDisplayStatus(aud).then(setDisplayStatus)},[aud,displays])
  useEffect(()=>{if(displays.length){if(!displays.some(d=>d.id===aud))setAud(displays.find(d=>!d.primary)?.id??displays[0].id);if(!displays.some(d=>d.id===stage))setStage(displays.find(d=>d.id!==aud&&!d.primary)?.id??displays[0].id)}},[displays])
  const identify=async()=>{setIdentifyBusy(true);const r=await window.verseflow?.identifyDisplays();setIdentifyBusy(false);if(r?.ok)refresh()}
  const saveBasics=()=>{onSaveSetting('defaultTranslation',translation);onSaveSetting('resolution',resolution);onSaveSetting('fps',fps);onSaveSetting('mediaFolders',mediaFolders);onSaveSetting('aiEndpoint',omni)}
  return <div className="page settings-page"><div className="page-heading"><div><span className="eyebrow">SYSTEM</span><h1>Settings</h1></div><div className="inline"><button onClick={refresh}>Refresh displays</button><button className="gold" onClick={saveBasics}>Save Settings</button></div></div><section><h3>Presentation defaults</h3><div className="settings-grid"><label>Default translation<select value={translation} onChange={e=>setTranslation(e.target.value)}>{translations.map(t=><option value={t.code} key={t.code}>{t.code} · {t.name}</option>)}</select></label><label>Output resolution<select value={resolution} onChange={e=>setResolution(e.target.value)}><option>1920x1080</option><option>1280x720</option><option>3840x2160</option></select></label><label>FPS preference<select value={fps} onChange={e=>setFps(e.target.value)}><option>30</option><option>60</option></select></label><label>Media folders<input value={mediaFolders} onChange={e=>setMediaFolders(e.target.value)} placeholder="D:\Church Media; C:\Media"/></label></div></section><section className="display-setup-section"><div className="section-row"><div><h3>Telão</h3><p>Escolha uma vez qual tela é o telão. O VerseFlow lembra dela e não troca para o monitor do operador sozinho.</p></div><button className="gold" onClick={identify} disabled={identifyBusy}>{identifyBusy?'IDENTIFICANDO…':'IDENTIFICAR TELAS'}</button></div><div className={`wall-status ${displayStatus?.connected?'connected':'disconnected'}`}>{displayStatus?.connected?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>}<div><strong>{displayStatus?.connected?'TELÃO CONECTADO':'TELÃO NÃO DETECTADO'}</strong><span>{displayStatus?.connected?`Tela ${displayStatus.selected!.index+1} · ${displayStatus.selected!.bounds.width}×${displayStatus.selected!.bounds.height}`:'Conecte o telão e clique em Identificar Telas.'}</span></div></div><div className="settings-grid"><label>TELÃO (Audience)<select value={aud} onChange={e=>{const id=+e.target.value;setAud(id);onSaveSetting('audienceDisplayId',id)}}>{displays.map(d=><option key={d.id} value={d.id}>Tela {d.index+1} · {d.label} · {d.bounds.width}×{d.bounds.height}{d.primary?' · MONITOR DO OPERADOR':''}</option>)}</select><div className="inline"><button className="gold" onClick={()=>openOut('audience',aud)}>TESTAR TELÃO</button><button onClick={()=>closeOut('audience')}>Fechar teste</button></div></label><label>Stage display<select value={stage} onChange={e=>{const id=+e.target.value;setStage(id);onSaveSetting('stageDisplayId',id)}}>{displays.map(d=><option key={d.id} value={d.id}>Tela {d.index+1} · {d.label} · {d.bounds.width}×{d.bounds.height}</option>)}</select><div className="inline"><button onClick={()=>openOut('stage',stage)}>Open Stage</button><button onClick={()=>closeOut('stage')}>Close</button></div></label></div></section><section><h3>Data & backup</h3><p>Database location: <code>{dataPath||'Loading…'}</code></p><div className="inline"><button onClick={onBackup}>Export Backup</button><button onClick={onRestore}>Restore Backup</button></div></section><section className="system-check-section"><div className="section-row"><div><h3>System Check</h3><p>One-click check for the things that can stop a Sunday presentation.</p></div><button className="gold" onClick={runDiagnostics}>Run System Check</button></div>{diagnostics&&<><div className={`system-check-summary ${diagnostics.ok?'ok':'warn'}`}>{diagnostics.ok?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>}<strong>{diagnostics.summary}</strong></div><div className="system-check-list">{diagnostics.checks.map(c=><div key={c.id} className={c.ok?'ok':c.optional?'optional':'fail'}>{c.ok?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>}<div><strong>{c.label}</strong><span>{c.detail}</span></div></div>)}</div><small>Error report: {diagnostics.logPath}</small></>}</section><section><h3>Hotkeys</h3><p><kbd>Space</kbd> / <kbd>→</kbd> next · <kbd>←</kbd> previous · <kbd>B</kbd> black · <kbd>C</kbd> clear text · <kbd>Esc</kbd> emergency black. Custom remapping is reserved for the next settings pass.</p></section><section><div className="section-row"><div><h3>Internet Agent</h3><p>Local Ollama stays the brain. Agent-Reach provides web search, Crawl4AI extracts clean page data, and Browser Use is an optional fallback only.</p></div><button onClick={refreshTools}>Refresh Status</button></div><div className="tool-status-grid internet-tool-grid">{[['Ollama',tools?.ollamaRunning?'Ready':tools?.ollamaInstalled?'Stopped':'Not installed'],['Agent-Reach',internetTools?.agentReach.running?'Ready':internetTools?.agentReach.installed?'Stopped':'Not installed'],['Crawl4AI',internetTools?.crawl4ai.installed?'Ready':'Not installed'],['Browser Use',internetTools?.browserUse.installed?'Ready':'Not installed']].map(([name,status])=><div key={String(name)}><strong>{name}</strong><span>{status}</span></div>)}</div><div className="inline"><button className="gold" onClick={async()=>{const r=await window.verseflow?.installInternetAgentTools();setHealth(r?.ok?'Internet Agent installer opened':r?.error||'Could not open installer')}}>INSTALL INTERNET AGENT TOOLS</button><span className="health">{health}</span></div><small>Allowed web tools: search_web · fetch_page · extract_page · open_browser_if_needed. Web content is treated as untrusted data and cannot run commands or access VerseFlow files.</small></section><section><h3>Smart Presenter Tools</h3><p>Optional and local. VerseFlow uses Ollama + qwen3:0.6b for natural-language presentation planning and yt-dlp for permitted web-media imports. Scripture text is always retrieved exactly from your installed Bible database; AI never rewrites it.</p><div className="tool-status-grid"><div><strong>Ollama</strong><span>{tools?.ollamaRunning?'Running':tools?.ollamaInstalled?'Installed / not running':'Not installed'}</span><small>{tools?.modelInstalled?`${tools.model} ready`:`${tools?.model||'qwen3:0.6b'} not downloaded`}</small></div><div><strong>yt-dlp</strong><span>{tools?.ytDlpInstalled?'Ready':'Not installed'}</span><small>{tools?.ytDlpVersion||'Optional web-media importer'}</small></div></div><div className="inline"><button onClick={refreshTools}>Refresh Status</button><button className="gold" onClick={async()=>{const r=await window.verseflow?.openOptionalToolsInstaller();setHealth(r?.ok?'Installer opened':r?.error||'Could not open installer')}}>Install / Update Tools</button><span className="health">{health}</span></div><details><summary>Advanced compatible AI endpoint</summary><label>OmniRoute / compatible URL<input value={omni} onChange={e=>setOmni(e.target.value)}/></label><button onClick={async()=>{setHealth('Checking…');const r=await window.verseflow?.integrationHealth(omni);setHealth(r?.ok?'Connected':r?.error||'Not available')}}>Test endpoint</button></details></section></div>
}

function FreeLivePage({
  state,setState,onSendLive,verses,translations,media,onPickMedia,onMediaAdded,songs,onSaveSong,requestedTab
}:{
  state:PresentationState;
  setState:(s:PresentationState)=>void;
  onSendLive:(s?:PresentationState)=>void;
  verses:Verse[];
  translations:BibleTranslation[];
  media:MediaItem[];
  onPickMedia:()=>void;
  onMediaAdded:()=>Promise<void>;
  songs:Song[];
  onSaveSong:(s:Song)=>Promise<void>;
  requestedTab?:string;
}) {
  const [tab,setTab]=useState<'text'|'bible'|'songs'|'media'|'youtube'|'smart'|'lower'|'timer'>('text')
  useEffect(()=>{if(requestedTab&&['text','bible','songs','media','youtube','smart','lower','timer'].includes(requestedTab))setTab(requestedTab as typeof tab)},[requestedTab])
  const [custom,setCustom]=useState('Welcome to worship')
  const [reference,setReference]=useState('')
  const [lowerName,setLowerName]=useState('')
  const [lowerRole,setLowerRole]=useState('')
  const [timerMinutes,setTimerMinutes]=useState(5)
  const [timerLabel,setTimerLabel]=useState('Service starts in')
  const [q,setQ]=useState('John 3:16')
  const [songQuery,setSongQuery]=useState('')
  const [youtubeUrl,setYoutubeUrl]=useState('')
  const [youtubeId,setYoutubeId]=useState('')
  const [newSongTitle,setNewSongTitle]=useState('')
  const [newSongBody,setNewSongBody]=useState('Verse 1\n\nChorus\n')
  const [webUrl,setWebUrl]=useState('')
  const [webBusy,setWebBusy]=useState(false)
  const [youtubeDownloadBusy,setYoutubeDownloadBusy]=useState(false)
  const [youtubeDownloadNote,setYoutubeDownloadNote]=useState('')
  const [smartInput,setSmartInput]=useState('Show John 3:16')
  const [smartBusy,setSmartBusy]=useState(false)
  const [smartEngine,setSmartEngine]=useState('')
  const [smartPlan,setSmartPlan]=useState<SmartPlan|null>(null)
  const [smartNote,setSmartNote]=useState('')
  const [smartVerse,setSmartVerse]=useState<Verse|null>(null)
  const [smartSuggestions,setSmartSuggestions]=useState<string[]>([])

  const [found,setFound]=useState<Verse[]>([])
  const [bibleSearchBusy,setBibleSearchBusy]=useState(false)
  useEffect(()=>{
    if(tab!=='bible')return
    let cancelled=false
    const timer=setTimeout(async()=>{
      setBibleSearchBusy(true)
      try{
        const loaded=window.verseflow?.searchBible ? await window.verseflow.searchBible(q.trim(),undefined,80) : verses.filter(v=>!q.trim()||`${v.book} ${v.chapter}:${v.verse} ${v.text}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0,80)
        if(!cancelled)setFound(loaded||[])
      }catch(error){console.error('Live Desk Bible search failed:',error);if(!cancelled)setFound([])}
      finally{if(!cancelled)setBibleSearchBusy(false)}
    },q.trim()?180:0)
    return()=>{cancelled=true;clearTimeout(timer)}
  },[q,tab,verses])

  const songResults=useMemo(()=>{
    const x=songQuery.trim().toLowerCase()
    return songs.filter(s=>!x||`${s.title} ${s.author||''}`.toLowerCase().includes(x))
  },[songQuery,songs])

  const live=(n:PresentationState)=>{setState(n);onSendLive(n)}

  const withVideoDefaults=(base:PresentationState, extra:Partial<NonNullable<PresentationState['video']>>={})=>({
    ...base,
    video:{...(base.video||{playing:true,muted:false,volume:0.85,loop:true}),playing:true,muted:false,volume:0.85,loop:true,...extra,commandId:Date.now(),seekDelta:extra.seekDelta||0}
  })

  const updateVideoControl=(patch:Partial<NonNullable<PresentationState['video']>>)=>{
    setState({
      ...state,
      video:{...(state.video||{playing:true,muted:false,volume:0.85,loop:true}),...patch,commandId:Date.now(),seekDelta:patch.seekDelta||0}
    })
  }

  const previewText=()=>{
    setState({...state,mode:'preview',text:custom,reference,title:reference||'Custom Text',layout:'center',backgroundType:state.backgroundType||'solid',black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }

  const liveText=()=>{
    live({...state,mode:'live',text:custom,reference,title:reference||'Custom Text',layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }

  const versePreview=(v:Verse)=>{
    setState({...state,mode:'preview',title:`${v.book} ${v.chapter}:${v.verse}`,text:v.translation.includes('STRONGS')?cleanStrongMarkers(v.text):v.text,reference:`${v.book} ${v.chapter}:${v.verse}`,layout:'center',black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }

  const verseLive=(v:Verse)=>{
    live({...state,mode:'live',title:`${v.book} ${v.chapter}:${v.verse}`,text:v.translation.includes('STRONGS')?cleanStrongMarkers(v.text):v.text,reference:`${v.book} ${v.chapter}:${v.verse}`,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }

  const mediaPreview=(m:MediaItem)=>{
    if(m.type==='audio'){setState({...state,mode:'preview',title:m.name,audio:{path:m.path,playing:false,volume:.85,loop:false},sequence:state.sequence+1});return}
    setState(withVideoDefaults({...state,mode:'preview',title:m.name,text:'',reference:'',layout:'center',background:m.path,backgroundType:m.type==='video'?'video':'image',black:false,logo:false,clearText:false,sequence:state.sequence+1}, m.type==='video'?{muted:false,playing:true,volume:0.85,loop:false}:{muted:false,playing:true,volume:0.85,loop:true}))
  }

  const mediaLive=(m:MediaItem)=>{
    if(m.type==='audio'){live({...state,mode:'live',title:m.name,audio:{path:m.path,playing:true,volume:.85,loop:false},sequence:state.sequence+1});return}
    live(withVideoDefaults({...state,mode:'live',title:m.name,text:'',reference:'',layout:'center',youtubeId:undefined,audio:m.type==='video'?undefined:state.audio,background:m.path,backgroundType:m.type==='video'?'video':'image',black:false,logo:false,clearText:false,sequence:state.sequence+1}, m.type==='video'?{muted:false,playing:true,volume:0.85,loop:false}:{muted:false,playing:true,volume:0.85,loop:true}))
  }

  const mediaAsBackground=(m:MediaItem)=>{
    if(m.type==='audio')return
    const darkDefault=['#2f3133','#111111','#000000'].includes(String(state.theme.textColor).toLowerCase())
    setState(withVideoDefaults({...state,background:m.path,backgroundType:m.type==='video'?'video':'image',youtubeId:undefined,black:false,logo:false,theme:{...state.theme,overlay:Math.max(.46,state.theme.overlay||0),textColor:darkDefault?'#fffaf0':state.theme.textColor},sequence:state.sequence+1}, m.type==='video'?{muted:false,playing:true,volume:0.85,loop:false}:{muted:false,playing:true,volume:0.85,loop:true}))
  }
  const mediaAsMusic=(m:MediaItem)=>{
    if(m.type!=='audio')return
    setState({...state,audio:{path:m.path,playing:true,volume:state.audio?.volume??.72,loop:true},sequence:state.sequence+1})
  }

  const songSectionPreview=(song:Song,section:Song['sections'][number])=>{
    setState({...state,mode:'preview',title:song.title,text:section.lines.join('\n'),reference:section.label,layout:'center',black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }

  const songSectionLive=(song:Song,section:Song['sections'][number])=>{
    live({...state,mode:'live',title:song.title,text:section.lines.join('\n'),reference:section.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }

  const saveQuickSong=async()=>{
    const sections=newSongBody.split(/\n\s*\n/).map((block,i)=>{
      const lines=block.split('\n').map(x=>x.trim()).filter(Boolean)
      return {id:`quick-${Date.now()}-${i}`,label:lines.shift()||`Section ${i+1}`,lines}
    }).filter(x=>x.lines.length)

    if(!newSongTitle.trim()||!sections.length)return

    await onSaveSong({
      id:`song-${Date.now()}`,
      title:newSongTitle.trim(),
      sections
    })

    setNewSongTitle('')
    setNewSongBody('Verse 1\n\nChorus\n')
  }

  const presentYoutube=()=>{
    if(!youtubeId)return
    live({
      ...state,
      mode:'live',
      title:'YouTube',
      text:'',
      reference:'',
      youtubeId,
      youtubeAutoplay:true,
      audio:undefined,
      background:undefined,
      backgroundType:'solid',
      black:false,
      logo:false,
      clearText:false,
      sequence:state.sequence+1
    })
  }

  const showLowerThird=(goLive:boolean)=>{
    const n={...state,mode:goLive?'live' as const:'preview' as const,title:lowerName||'Lower Third',text:lowerName,reference:lowerRole,layout:'lower-third' as const,youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1}
    if(goLive)live(n);else setState(n)
  }

  const startTimer=(goLive:boolean)=>{
    const end=Date.now()+Math.max(1,timerMinutes)*60*1000
    const n={...state,mode:goLive?'live' as const:'preview' as const,title:'Timer',text:'',reference:'',layout:'countdown' as const,timerEndAt:end,timerLabel,youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1}
    // Preview is intentionally local-only. START TIMER sends the countdown
    // through the normal LIVE path, which opens/validates the audience output.
    if(goLive)void onSendLive(n);else setState(n)
  }

  const parseYoutube=(value:string)=>{
    try{
      const u=new URL(value)
      let id=''
      if(u.hostname.includes('youtu.be')){
        id=u.pathname.replace('/','')
      }else if(u.searchParams.get('v')){
        id=u.searchParams.get('v')||''
      }else{
        const parts=u.pathname.split('/').filter(Boolean)
        const i=parts.findIndex(x=>x==='embed'||x==='shorts')
        if(i>=0) id=parts[i+1]||''
      }
      setYoutubeId(id)
    }catch{
      setYoutubeId(value.trim())
    }
  }

  const downloadWebMedia=async()=>{
    if(!webUrl.trim())return
    setWebBusy(true);setSmartNote('Downloading permitted media…')
    const r=await window.verseflow?.downloadMediaUrl(webUrl.trim())
    setWebBusy(false)
    if(r?.ok&&r.item){await window.verseflow?.upsert('media',r.item);setSmartNote(`${r.item.name} saved to the local media library.`);setWebUrl('')}
    else setSmartNote(r?.error||'Web-media download failed.')
  }

  const downloadYoutube=async()=>{
    if(!youtubeUrl.trim())return
    setYoutubeDownloadBusy(true)
    setYoutubeDownloadNote('Downloading with yt-dlp + Deno + FFmpeg… Please keep VerseFlow open.')
    try{
      const r=await window.verseflow?.downloadMediaUrl(youtubeUrl.trim())
      if(r?.ok&&r.item){
        const saved=await window.verseflow?.upsert('media',r.item)
        if(saved?.ok===false)throw new Error(saved.error||'The file downloaded but could not be added to Media.')
        await onMediaAdded()
        setYoutubeDownloadNote(`DONE · ${r.item.name} is now in the Media library.`)
      }else setYoutubeDownloadNote(r?.error||'YouTube download failed.')
    }catch(error){
      setYoutubeDownloadNote(error instanceof Error?error.message:'YouTube download failed.')
    }finally{
      setYoutubeDownloadBusy(false)
    }
  }

  const planSmart=async()=>{
    setSmartBusy(true);setSmartNote('Planning safely…');setSmartVerse(null);setSmartSuggestions([])
    const context={translations:translations.map(t=>t.code),songs:songs.slice(0,80).map(s=>s.title),media:media.slice(0,80).map(m=>m.name),current:{title:state.title,reference:state.reference}}
    const r=await window.verseflow?.smartCommand(smartInput,context)
    if(r?.ok&&r.plan){
      setSmartPlan(r.plan);setSmartEngine(r.engine||'local')
      if(r.plan.action==='SHOW_VERSE'&&r.plan.reference){
        const suggestions=await window.verseflow?.suggestBibleReferences(r.plan.reference,r.plan.translation,3)||[]
        if(suggestions.length>1){
          setSmartSuggestions(suggestions)
          setSmartNote(`That reference is ambiguous. Did you mean ${suggestions.join(' or ')}? Choose one below.`)
        }else{
          const verse=await resolveVerse(r.plan.reference,r.plan.translation)
          if(verse){
            const canonical=`${verse.book} ${verse.chapter}:${verse.verse}`
            const exactText=verse.translation.includes('STRONGS')?cleanStrongMarkers(verse.text):verse.text
            setSmartPlan({...r.plan,reference:canonical,message:`${canonical} · ${verse.translation}`})
            setSmartVerse(verse)
            setSmartNote(r.error?`Corrected safely. ${r.error}`:`Ready · ${canonical}`)
            setState({...state,mode:'preview',title:canonical,text:exactText,reference:canonical,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1})
          }else{
            setSmartSuggestions(suggestions)
            setSmartNote(suggestions.length?`I couldn't find ${r.plan.reference}. Did you mean ${suggestions.join(' or ')}?`:`I couldn't find ${r.plan.reference}. Please check the book, chapter, and verse.`)
          }
        }
      }else setSmartNote(r.error?`Fallback used: ${r.error}`:(r.plan.message||'Plan ready.'))
    } else {setSmartPlan(null);setSmartNote(r?.error||'Smart Presenter is not available.')}
    setSmartBusy(false)
  }

  const resolveVerse=async(reference:string,translation?:string)=>{
    if(window.verseflow?.getBibleReference)return (await window.verseflow.getBibleReference(reference,translation))||undefined
    const m=reference.trim().match(/^(.+?)\s+(\d+):(\d+)$/)
    if(!m)return undefined
    const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
    const book=norm(m[1]),chapter=+m[2],verse=+m[3]
    const candidates=verses.filter(v=>v.chapter===chapter&&v.verse===verse&&(norm(v.book)===book||norm(v.book).includes(book)||book.includes(norm(v.book))))
    return (translation?candidates.find(v=>v.translation.toLowerCase()===translation.toLowerCase()):undefined)||candidates[0]
  }

  const applySmart=async(goLive:boolean)=>{
    const p=smartPlan;if(!p)return
    const finish=(n:PresentationState)=>goLive?live({...n,mode:'live',sequence:n.sequence+1}):setState({...n,mode:'preview',sequence:n.sequence+1})
    if(p.action==='SHOW_VERSE'&&p.reference){const v=smartVerse||await resolveVerse(p.reference,p.translation);if(!v){const suggestions=await window.verseflow?.suggestBibleReferences(p.reference,p.translation,3)||[];setSmartSuggestions(suggestions);setSmartNote(suggestions.length?`Verse not found: ${p.reference}. Did you mean ${suggestions.join(' or ')}?`:`Verse not found: ${p.reference}. Please check the book, chapter, and verse.`);return}const text=v.translation.includes('STRONGS')?cleanStrongMarkers(v.text):v.text;finish({...state,title:`${v.book} ${v.chapter}:${v.verse}`,text,reference:`${v.book} ${v.chapter}:${v.verse}`,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false});return}
    if(p.action==='SHOW_TEXT'&&p.text){finish({...state,title:'Smart Text',text:p.text,reference:'',youtubeId:undefined,black:false,logo:false,clearText:false});return}
    if(p.action==='FIND_SONG'){const matches=localSongMatches(songs,String(p.query||''));if(matches.length>1&&matches[0].score===matches[1].score){setSmartNote(`Multiple songs match: ${matches.slice(0,4).map(x=>x.song.title).join(', ')}. Please choose the correct song in LYRICS.`);return}const song=matches[0]?.song;const sec=song?.sections[0];if(!song||!sec){setSmartNote('Song not found locally. Open LYRICS to search the internet. VerseFlow will not silently guess or invent a modern song.');return}finish({...state,title:song.title,text:sec.lines.join('\n'),reference:sec.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false});return}
    if(p.action==='SHOW_SONG_SECTION'){const current=songs.find(x=>x.title===state.title)||songs.find(x=>state.title.toLowerCase().includes(x.title.toLowerCase()));if(!current){setSmartNote('No current song is selected. Say “Show lyrics [song title]” first.');return}const wanted=String(p.query||'').toLowerCase().replace(/[- ]/g,'');const sec=current.sections.find(x=>x.label.toLowerCase().replace(/[- ]/g,'')===wanted)||current.sections.find(x=>x.label.toLowerCase().replace(/[- ]/g,'').includes(wanted));if(!sec){setSmartNote(`${p.query||'That section'} was not found in ${current.title}.`);return}finish({...state,title:current.title,text:sec.lines.slice(0,4).join('\n'),reference:sec.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false});return}
    if(p.action==='NEXT_LYRICS'||p.action==='PREVIOUS_LYRICS'){const current=songs.find(x=>x.title===state.title)||songs.find(x=>state.title.toLowerCase().includes(x.title.toLowerCase()));if(!current){setSmartNote('No current lyrics song is selected.');return}const slides=lyricSlides(current);let at=slides.findIndex(x=>x.label===state.reference&&x.lines.join('\n')===state.text);if(at<0)at=0;at=Math.max(0,Math.min(slides.length-1,at+(p.action==='NEXT_LYRICS'?1:-1)));const sl=slides[at];finish({...state,title:current.title,text:sl.lines.join('\n'),reference:sl.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false});return}
    if(p.action==='FIND_MEDIA'){const m=media.find(x=>x.name.toLowerCase().includes(String(p.query||'').toLowerCase()));if(!m){setSmartNote('Media not found in the local library.');return}finish(withVideoDefaults({...state,title:m.name,text:'',reference:'',layout:'center',background:m.path,backgroundType:m.type==='video'?'video':'image',youtubeId:undefined,black:false,logo:false,clearText:false}, m.type==='video'?{muted:false,playing:true,volume:0.85,loop:false}:{muted:false,playing:true,volume:0.85,loop:true}));return}
    if(p.action==='SET_TEXT_COLOR'&&p.color){setState({...state,theme:{...state.theme,textColor:p.color}});return}
    if(p.action==='SET_ACCENT_COLOR'&&p.color){setState({...state,theme:{...state.theme,accentColor:p.color}});return}
    if(p.action==='START_TIMER'){
      const minutes=Math.max(1,Math.min(180,Number(p.minutes||5)))
      const n={...state,title:'Timer',text:'',reference:'',layout:'countdown' as const,timerEndAt:Date.now()+minutes*60*1000,timerLabel:p.label||'Service starts in',youtubeId:undefined,black:false,logo:false,clearText:false}
      finish(n);return
    }
    if(p.action==='SHOW_LOWER_THIRD'&&p.text){
      finish({...state,title:p.text,text:p.text,reference:p.label||'',layout:'lower-third' as const,youtubeId:undefined,black:false,logo:false,clearText:false});return
    }
    if(p.action==='STOP_AUDIO'){
      const n={...state,audio:undefined}
      if(goLive) live({...n,mode:'live',sequence:state.sequence+1}); else setState({...n,mode:'preview',sequence:state.sequence+1})
      return
    }
    if(p.action==='BLACK'){live({...state,mode:'live',black:true,logo:false,sequence:state.sequence+1});return}
    if(p.action==='CLEAR_TEXT'){live({...state,mode:'live',clearText:true,sequence:state.sequence+1});return}
    if(p.action==='LOGO'){live({...state,mode:'live',logo:true,black:false,sequence:state.sequence+1});return}
    setSmartNote(p.message||'No safe action to apply.')
  }

  return <div className="free-live-page">
    <aside className="free-live-browser">
      <div className="panel-title">LIVE DESK</div>

      <div className="live-tabs six">
        <button className={tab==='text'?'active':''} onClick={()=>setTab('text')}>Text</button>
        <button className={tab==='bible'?'active':''} onClick={()=>setTab('bible')}>Bible</button>
        <button className={tab==='songs'?'active':''} onClick={()=>setTab('songs')}>Songs</button>
        <button className={tab==='media'?'active':''} onClick={()=>setTab('media')}>Media</button>
        <button className={`youtube-tab ${tab==='youtube'?'active':''}`} onClick={()=>setTab('youtube')}><Youtube size={13}/> YouTube</button>
        <button className={tab==='smart'?'active smart-tab':''} onClick={()=>setTab('smart')}><Zap size={13}/> Smart</button>
        <button className={tab==='lower'?'active':''} onClick={()=>setTab('lower')}><Type size={13}/> Lower Third</button>
        <button className={tab==='timer'?'active':''} onClick={()=>setTab('timer')}><TimerReset size={13}/> Timer</button>
      </div>

      {tab==='text'&&<div className="quick-live-form">
        <label>Anything you want to display
          <textarea value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Type an announcement, prayer, title, message…"/>
        </label>
        <label>Small reference / subtitle
          <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional"/>
        </label>
        <div className="quick-actions">
          <button onClick={previewText}>Preview</button>
          <button className="gold" onClick={liveText}>LIVE NOW</button>
        </div>
      </div>}

      {tab==='bible'&&<>
        <label className="search-field"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="John 3:16"/></label>
        <div className="instant-verse-list">
          {bibleSearchBusy&&<div className="empty-card">Loading Bible…</div>}
          {!bibleSearchBusy&&found.map(v=><article key={`${v.translation}-${v.id}`}>
            <div onClick={()=>versePreview(v)}>
              <strong>{v.book} {v.chapter}:{v.verse}</strong>
              <span>{v.translation}</span>
              <p>{v.translation.includes('STRONGS')?cleanStrongMarkers(v.text):v.text}</p>
            </div>
            <button className="gold small" onClick={()=>verseLive(v)}>LIVE</button>
          </article>)}
        </div>
      </>}

      {tab==='songs'&&<>
        <label className="search-field"><Search size={16}/><input value={songQuery} onChange={e=>setSongQuery(e.target.value)} placeholder="Search songs"/></label>
        <div className="quick-song-create">
          <input value={newSongTitle} onChange={e=>setNewSongTitle(e.target.value)} placeholder="New song title"/>
          <textarea value={newSongBody} onChange={e=>setNewSongBody(e.target.value)} placeholder="Verse 1&#10;Lyrics...&#10;&#10;Chorus&#10;Lyrics..."/>
          <button onClick={saveQuickSong}>Save Song</button>
        </div>
        <div className="instant-song-list">
          {songResults.map(song=><article key={song.id}>
            <strong>{song.title}</strong>
            {song.sections.map(section=><div className="song-section-row" key={section.id}>
              <button onClick={()=>songSectionPreview(song,section)}>{section.label}</button>
              <button className="gold small" onClick={()=>songSectionLive(song,section)}>LIVE</button>
            </div>)}
          </article>)}
        </div>
      </>}

      {tab==='media'&&<>
        <button className="import-wide gold" onClick={onPickMedia}>+ Import Image / Video / Audio</button>
        <div className="web-media-import"><input value={webUrl} onChange={e=>setWebUrl(e.target.value)} placeholder="Permitted web-media URL"/><button disabled={webBusy||!webUrl.trim()} onClick={downloadWebMedia}>{webBusy?'Saving…':'Save Web Media'}</button></div>
        <small className="rights-note">Use yt-dlp only for media you own or are permitted to download. VerseFlow does not bypass DRM or grant content rights.</small>
        <div className="instant-media-list">
          {media.map(m=><article key={m.id}>
            <div onClick={()=>mediaPreview(m)}>
              <strong>{m.name}</strong><span>{m.type}</span>
            </div>
            <div className="instant-media-actions">{m.type==='audio'?<><button onClick={()=>mediaAsMusic(m)}>+ MUSIC</button><button className="gold small" onClick={()=>mediaLive(m)}>PLAY</button></>:<><button onClick={()=>mediaAsBackground(m)}>USE BG</button><button className="gold small" onClick={()=>mediaLive(m)}>FULL</button></>}</div>
          </article>)}
        </div>
      </>}

      {tab==='youtube'&&<div className="youtube-panel">
        <div className="youtube-brand"><Youtube size={30}/><div><strong>YouTube</strong><span>Play a video inside VerseFlow</span></div></div>
        <label>YouTube URL
          <input value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} placeholder="Paste YouTube link here"/>
        </label>
        <div className="youtube-actions">
          <button onClick={()=>parseYoutube(youtubeUrl)}>LOAD / PREVIEW</button>
          <button className="gold" disabled={youtubeDownloadBusy||!youtubeUrl.trim()} onClick={downloadYoutube}>{youtubeDownloadBusy?'DOWNLOADING…':'DOWNLOAD TO MEDIA'}</button>
          <button className="youtube-present" disabled={!youtubeId} onClick={presentYoutube}><Youtube size={17}/> PRESENT YOUTUBE</button>
        </div>
        <p>Preview/present uses YouTube's embedded player. Download uses local yt-dlp + Deno + FFmpeg and saves the finished file into VerseFlow Media. Only download media you have permission to save.</p>
        {youtubeDownloadNote&&<div className={`youtube-download-status ${youtubeDownloadNote.startsWith('DONE')?'done':''}`}>{youtubeDownloadNote}</div>}
        {youtubeId&&<div className="youtube-embed-small">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&rel=0&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.href)}`}
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>}
      </div>}

      {tab==='lower'&&<div className="quick-live-form">
        <label>Name / headline<input value={lowerName} onChange={e=>setLowerName(e.target.value)} placeholder="Pastor / speaker / announcement"/></label>
        <label>Subtitle / role<input value={lowerRole} onChange={e=>setLowerRole(e.target.value)} placeholder="Pastor · Worship Leader · Guest"/></label>
        <div className="lower-third-demo"><strong>{lowerName||'Name / headline'}</strong><span>{lowerRole||'Subtitle / role'}</span></div>
        <div className="quick-actions"><button onClick={()=>showLowerThird(false)}>Preview</button><button className="gold" onClick={()=>showLowerThird(true)}>LIVE NOW</button></div>
      </div>}

      {tab==='timer'&&<div className="quick-live-form">
        <label>Timer label<input value={timerLabel} onChange={e=>setTimerLabel(e.target.value)} placeholder="Service starts in"/></label>
        <label>Minutes<input type="number" min={1} max={180} value={timerMinutes} onChange={e=>setTimerMinutes(Math.max(1,+e.target.value||1))}/></label>
        <div className="timer-demo"><TimerReset size={30}/><strong>{timerMinutes}:00</strong><span>{timerLabel}</span></div>
        <div className="quick-actions"><button onClick={()=>startTimer(false)}>Preview</button><button className="gold" onClick={()=>startTimer(true)}>START TIMER</button></div>
      </div>}

      {tab==='smart'&&<div className="smart-presenter-panel">
        <div className="smart-brand"><Zap size={24}/><div><strong>Smart Presenter</strong><span>Local AI + safe presentation actions</span></div></div>
        <label>Tell VerseFlow what you want to show
          <textarea value={smartInput} onChange={e=>setSmartInput(e.target.value)} placeholder="Examples: Show John 3:16 · Make text pink · Show our welcome video · Black screen"/>
        </label>
        <button className="gold" disabled={smartBusy||!smartInput.trim()} onClick={planSmart}>{smartBusy?'Thinking locally…':'PLAN ACTION'}</button>
        {smartPlan&&<div className="smart-plan-card"><span>{smartEngine}</span><strong>{smartPlan.action}</strong><p>{smartPlan.message||smartNote}</p>{smartPlan.reference&&<code>{smartPlan.reference}</code>}{smartVerse&&<div className="smart-verse-result"><strong>{smartVerse.book} {smartVerse.chapter}:{smartVerse.verse} · {smartVerse.translation}</strong><p>{smartVerse.translation.includes('STRONGS')?cleanStrongMarkers(smartVerse.text):smartVerse.text}</p></div>}{smartSuggestions.length>0&&<div className="smart-suggestions"><span>Did you mean:</span>{smartSuggestions.map(ref=><button key={ref} onClick={()=>{setSmartInput(`Show ${ref}`);setSmartPlan(null);setSmartVerse(null);setSmartSuggestions([]);setSmartNote(`Try ${ref}, then press PLAN ACTION.`)}}>{ref}</button>)}</div>}{smartPlan.query&&<code>{smartPlan.query}</code>}{smartPlan.color&&<div className="smart-color"><i style={{background:smartPlan.color}}/>{smartPlan.color}</div>}<div className="smart-plan-actions"><button onClick={()=>applySmart(false)}>PREVIEW ACTION</button><button className="gold" onClick={()=>applySmart(true)} disabled={smartPlan.action==='SHOW_VERSE'&&!smartVerse}>SEND LIVE</button></div></div>}
        <p className="smart-note">{smartNote||'AI plans the action; VerseFlow retrieves Scripture exactly from the local Bible database.'}</p>
      </div>}
    </aside>

    <section className="free-live-center">
      <div className="free-live-heading">
        <div><span className="eyebrow">FREE LIVE MODE</span><h2>Display anything, anytime.</h2></div>
        <span className={state.mode==='live'?'live-badge':'ready-badge'}>{state.mode==='live'?'LIVE':'PREVIEW'}</span>
      </div>

      {state.backgroundType==='video'&&state.background&&<div className="video-controls live-video-controls visible-video-controls video-controls-top">
        <strong>DOWNLOADED VIDEO CONTROLS</strong>
        <button className="gold" onClick={()=>updateVideoControl({playing:!(state.video?.playing??true)})}>{state.video?.playing===false?'▶ Play':'⏸ Pause'}</button>
        <button onClick={()=>updateVideoControl({seekDelta:-10})}>−10s</button>
        <button onClick={()=>updateVideoControl({seekDelta:10})}>+10s</button>
        <button onClick={()=>updateVideoControl({muted:!(state.video?.muted??false)})}>{state.video?.muted?'🔊 Unmute':'🔇 Mute'}</button>
        <label>Volume <input type="range" min="0" max="100" value={Math.round((state.video?.volume??0.85)*100)} onChange={e=>updateVideoControl({volume:+e.target.value/100,muted:false})}/><b>{Math.round((state.video?.volume??0.85)*100)}%</b></label>
      </div>}

      {tab==='youtube'&&youtubeId
        ? <div className="youtube-main-preview">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&rel=0&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.href)}`}
              title="YouTube preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        : <CanvasPreview state={state} live={state.mode==='live'}/>
      }

      <div className="live-safety-bar">
        <button className={state.black?'active-red':''} onClick={()=>live({...state,mode:'live',black:!state.black,logo:false,sequence:state.sequence+1})}>BLACK</button>
        <button className={state.clearText?'active':''} onClick={()=>live({...state,mode:'live',clearText:!state.clearText,sequence:state.sequence+1})}>CLEAR TEXT</button>
        <button className={state.logo?'active':''} onClick={()=>live({...state,mode:'live',logo:!state.logo,black:false,sequence:state.sequence+1})}>LOGO</button>
        <button onClick={()=>live({...state,mode:'live',text:'',reference:'',youtubeId:undefined,black:false,logo:false,clearText:false,background:undefined,backgroundType:'solid',sequence:state.sequence+1})}>EMPTY SCREEN</button>
      </div>

    </section>

    <Inspector state={state} setState={setState} themes={[state.theme]} media={media} onPickMedia={onPickMedia}/>
  </div>
}

function PresentPage({state,setState,sendSafety,items,index,setIndex,sendLive,displays,openOut}:{state:PresentationState;setState:(s:PresentationState)=>void;sendSafety:(patch:Partial<PresentationState>)=>void;items:ServiceItem[];index:number;setIndex:(i:number)=>void;sendLive:()=>void;displays:DisplayInfo[];openOut:(k:'audience'|'stage',id:number)=>void}) {
  const prev=()=>setIndex(Math.max(0,index-1)), next=()=>setIndex(Math.min(items.length-1,index+1))
  return <div className="present-page"><div className="present-main"><CanvasPreview state={state} live={state.mode==='live'}/><div className="transport"><button onClick={prev}><ChevronLeft/> Previous</button><button className="gold go-live" onClick={sendLive}>GO LIVE</button><button onClick={next}>Next <ChevronRight/></button></div>{state.backgroundType==='video'&&<div className="video-controls"><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:false,volume:.85,loop:true}),playing:!(state.video?.playing??true),seekDelta:0,commandId:Date.now()}})}>{state.video?.playing===false?'Play':'Pause'}</button><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:false,volume:.85,loop:true}),seekDelta:-10,commandId:Date.now()}})}>−10s</button><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:false,volume:.85,loop:true}),seekDelta:10,commandId:Date.now()}})}>+10s</button><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:false,volume:.85,loop:true}),muted:!(state.video?.muted??false),seekDelta:0,commandId:Date.now()}})}>{state.video?.muted===false?'Mute':'Unmute'}</button><label>Volume <input type="range" min="0" max="100" value={Math.round((state.video?.volume??.85)*100)} onChange={e=>setState({...state,video:{...(state.video||{playing:true,muted:false,volume:.85,loop:true}),volume:+e.target.value/100,seekDelta:0,commandId:Date.now()}})}/></label></div>}<div className="safety-controls"><button className={state.black?'active-red':''} onClick={()=>sendSafety({black:!state.black,logo:false})}>Black Screen <kbd>B</kbd></button><button className={state.clearText?'active':''} onClick={()=>sendSafety({clearText:!state.clearText})}>Clear Text <kbd>C</kbd></button><button className={state.logo?'active':''} onClick={()=>sendSafety({logo:!state.logo,black:false})}>Logo</button><button className={state.frozen?'active':''} onClick={()=>sendSafety({frozen:!state.frozen})}>Freeze</button></div></div><aside className="present-queue"><div className="panel-title">Current / Next</div>{items.slice(Math.max(0,index-1),index+5).map((it,j)=>{const actual=Math.max(0,index-1)+j;return <button className={actual===index?'current':''} onClick={()=>setIndex(actual)} key={it.id}><span>{actual===index?'CURRENT':actual===index+1?'NEXT':actual+1}</span><strong>{it.title}</strong></button>})}<div className="output-box"><h3>Outputs</h3><p>{displays.length} display{displays.length===1?'':'s'} detected</p>{displays[1]&&<button onClick={()=>openOut('audience',displays[1].id)}>Open on {displays[1].label}</button>}</div></aside></div>
}

export default function App() {
  if (mode === 'audience') return <OutputRenderer />
  if (mode === 'stage') return <OutputRenderer stage />

  const {data,loading,reload}=useVerseFlowData()
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [language,setLanguage]=useState<Language>('en')
  const [liveTab,setLiveTab]=useState('text')
  const [items,setItems]=useState<ServiceItem[]>([])
  const [index,setIndex]=useState(0)
  const [displays,setDisplays]=useState<DisplayInfo[]>([])
  const [toast,setToast]=useState('')
  const [taskProgress,setTaskProgress]=useState<{id:string;label:string;percent:number;stage?:string;done?:boolean;error?:boolean}|null>(null)
  const [globalQ,setGlobalQ]=useState('')
  const [systemHealth,setSystemHealth]=useState<'checking'|'ok'|'warning'>('checking')
  const [audienceStatus,setAudienceStatus]=useState<DisplayStatus|null>(null)
  const audienceIdRef=useRef<number|null>(null)
  const historyRef=useRef<PresentationState[]>([])
  const lastStateRef=useRef<PresentationState|null>(null)
  const undoingRef=useRef(false)
  const languageReadyRef=useRef(false)
  const [state,setState]=useState<PresentationState>(()=>itemToPresentation(undefined,undefined,defaultTheme))
  const lastLive=useRef<PresentationState|null>(null)
  const quickBackRef=useRef<{active:ModuleKey;liveTab:string}|null>(null)

  useEffect(()=>{
    if(loading||languageReadyRef.current)return
    const saved=String(data.settings?.uiLanguage||'en')
    setLanguage((['en','pt','es'].includes(saved)?saved:'en') as Language)
    languageReadyRef.current=true
  },[loading,data.settings])
  useEffect(()=>{
    const cleanup=installDomTranslation(language)
    if(languageReadyRef.current) window.verseflow?.saveSetting('uiLanguage',language)
    return cleanup
  },[language])

  const themes=data.themes.length?data.themes:[defaultTheme]
  useEffect(()=>{const prev=lastStateRef.current;if(prev&&!undoingRef.current&&JSON.stringify(prev)!==JSON.stringify(state)){historyRef.current=[...historyRef.current.slice(-24),prev]}lastStateRef.current=state;undoingRef.current=false},[state])
  useEffect(()=>{
    const draft=data.settings.draftService
    if(!loading && items.length===0 && Array.isArray(draft) && draft.length) setItems(draft as ServiceItem[])
  },[loading])
  useEffect(()=>{if(!loading) window.verseflow?.saveSetting('draftService',items)},[items,loading])
  const previewItem=(idx:number,nextItems=items)=>{
    const safe=Math.max(0,Math.min(idx,nextItems.length-1))
    setIndex(safe)
    setState(s=>itemToPresentation(nextItems[safe],nextItems[safe+1],s.theme,s.sequence+1))
  }
  const addItem=(item:ServiceItem)=>{
    setItems(x=>{const n=[...x,item];if(x.length===0) setTimeout(()=>previewItem(0,n),0);return n})
    setToast(`${item.title} added to service`)
  }
  const ensureTelão=async()=>{
    let saved=Number(data.settings?.audienceDisplayId)
    let status=(Number.isFinite(saved)&&saved)?await window.verseflow?.getDisplayStatus(saved):null

    // Sunday-safe auto setup: if the saved audience display is missing (or was
    // never chosen), use the first connected NON-primary display. This lets
    // START TIMER / LIVE work immediately when a projector or second monitor
    // is plugged in, while never hijacking the operator's primary monitor.
    const detected=status?.displays?.length?status.displays:(await window.verseflow?.getDisplays()||[])
    const autoAudience=detected.find(d=>!d.primary)
    if((!status?.connected||!Number.isFinite(saved)||!saved||status.selected?.primary)&&autoAudience){
      saved=autoAudience.id
      audienceIdRef.current=saved
      await window.verseflow?.saveSetting('audienceDisplayId',saved)
      status=await window.verseflow?.getDisplayStatus(saved)
      setToast(`Audience screen detected: ${autoAudience.label}`)
    }

    setAudienceStatus(status||null)
    if(!status?.connected){
      setToast('Timer ready — no audience screen connected. Connect a second display/projector, then press START TIMER again.')
      return false
    }
    if(status.selected?.primary){
      setToast('Audience output cannot use the operator monitor. Connect or select a second display.')
      setActive('settings')
      return false
    }
    if(!status.openOnSelected){
      const opened=await window.verseflow?.openOutput('audience',saved)
      if(!opened?.ok){setToast(opened?.error||'Could not open the audience screen');return false}
    }
    setAudienceStatus(await window.verseflow?.getDisplayStatus(saved)||status)
    return true
  }
  const sendLiveState=async(live:PresentationState,message='Audience updated')=>{
    if(!(await ensureTelão()))return false
    setState(live);lastLive.current=live;window.verseflow?.sendPresentationState(live);setToast(message);return true
  }
  const sendLive=async()=>{
    const live={...state,mode:'live' as const,sequence:state.sequence+1}
    await sendLiveState(live,'TELÃO atualizado')
  }
  const setStateAndSync=(s:PresentationState)=>{
    setState(s)
    if(s.mode==='live') { lastLive.current=s; window.verseflow?.sendPresentationState(s) }
  }
  const sendSafety=(patch:Partial<PresentationState>)=>{
    const base=lastLive.current || {...state,mode:'live' as const}
    const live={...base,...patch,mode:'live' as const,sequence:Math.max(base.sequence,state.sequence)+1}
    lastLive.current=live
    window.verseflow?.sendPresentationState(live)
    setState(s=>({...s,...patch}))
  }
  const liveAt=(i:number)=>{
    const p=itemToPresentation(items[i],items[i+1],state.theme,state.sequence+1)
    const live={...p,mode:'live' as const}
    setIndex(i); void sendLiveState(live,'TELÃO atualizado')
  }
  const refreshDisplays=async()=>{
    const next=await window.verseflow?.getDisplays()||[]
    setDisplays(next)
    const saved=audienceIdRef.current
    if(saved) setAudienceStatus(await window.verseflow?.getDisplayStatus(saved)||null)
  }
  useEffect(()=>{refreshDisplays();window.verseflow?.systemCheck().then(r=>setSystemHealth(r.ok?'ok':'warning')).catch(()=>setSystemHealth('warning'));return window.verseflow?.onDisplaysChanged(()=>refreshDisplays())},[])
  useEffect(()=>{
    if(loading)return
    const saved=Number(data.settings?.audienceDisplayId)
    audienceIdRef.current=Number.isFinite(saved)&&saved?saved:null
    if(!Number.isFinite(saved)||!saved)return
    window.verseflow?.getDisplayStatus(saved).then(status=>{
      // Only inspect the saved output during startup. Opening a fullscreen
      // Audience window automatically can cover the operator UI when the
      // saved display is the primary/only monitor. The output is opened on
      // demand by ensureTelão() when the operator actually sends LIVE.
      setAudienceStatus(status)
    })
  },[loading,data.settings?.audienceDisplayId,displays.length])
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2200);return()=>clearTimeout(t)},[toast])
  useEffect(()=>{
    if(!window.verseflow?.onTaskProgress)return
    let finishTimer:number|undefined
    return window.verseflow.onTaskProgress(progress=>{
      if(finishTimer)window.clearTimeout(finishTimer)
      setTaskProgress(progress)
      if(progress.done)finishTimer=window.setTimeout(()=>setTaskProgress(null),progress.error?4200:1800)
    })
  },[])
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(active!=='present') return
      const target=e.target as HTMLElement|null
      if(target?.closest('input, textarea, select, [contenteditable=\"true\"]')) return
      if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();previewItem(Math.min(items.length-1,index+1))}
      if(e.key==='ArrowLeft'){e.preventDefault();previewItem(Math.max(0,index-1))}
      if(e.key.toLowerCase()==='b') sendSafety({black:!state.black,logo:false})
      if(e.key.toLowerCase()==='c') sendSafety({clearText:!state.clearText})
      if(e.key==='Escape') sendSafety({black:true,logo:false})
    }
    addEventListener('keydown',fn);return()=>removeEventListener('keydown',fn)
  },[active,index,items,state])

  useEffect(()=>{ if(items[index]) setState(s=>itemToPresentation(items[index],items[index+1],s.theme,s.sequence+1)) },[index])

  const previewVerse=(v:Verse)=>{const i=verseToServiceItem(v);setState(s=>{const p=itemToPresentation(i,undefined,s.theme,s.sequence+1);return{...p,background:s.background,backgroundType:s.backgroundType,audio:s.audio}})}
  const liveVerse=(v:Verse)=>{const i=verseToServiceItem(v);const p=itemToPresentation(i,undefined,state.theme,state.sequence+1);const live={...p,background:state.background,backgroundType:state.backgroundType,audio:state.audio,mode:'live' as const};void sendLiveState(live,'Versículo no TELÃO').then(ok=>{if(ok)setActive('present')})}
  const saveSong=async(s:Song)=>{await window.verseflow?.upsert('songs',s);await reload();setToast('Song saved')}
  const addSong=(s:Song)=>addItem({id:uid('songitem'),type:'song',title:s.title,payload:{text:s.sections.flatMap(x=>x.lines).join('\n'),...atmospherePayload(state)}})
  const addEntireLyricsSong=(s:Song)=>{const slides=lyricSlides(s);setItems(current=>[...current,...slides.map((sl,i)=>({id:uid('lyricsitem'),type:'song' as const,title:`${s.title} · ${sl.label}${slides.length>1?` · ${i+1}/${slides.length}`:''}`,subtitle:s.author||'Lyrics',payload:{text:sl.lines.join('\n'),reference:sl.label,...atmospherePayload(state)}}))]);setToast(`${s.title} added to service as ${slides.length} lyric slide${slides.length===1?'':'s'}`)}
  const previewSong=(song:Song)=>{const sec=song.sections[0];if(!sec)return;setState(x=>({...x,mode:'preview',title:song.title,text:sec.lines.join('\n'),reference:sec.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:x.sequence+1}))}
  const liveSong=(song:Song)=>{const sec=song.sections[0];if(!sec)return;const live:PresentationState={...state,mode:'live',title:song.title,text:sec.lines.join('\n'),reference:sec.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1};void sendLiveState(live,'Letra no TELÃO').then(ok=>{if(ok)setActive('present')})}
  const importMedia=async()=>{const picked=await window.verseflow?.pickMedia()||[];for(const m of picked) await window.verseflow?.upsert('media',m);await reload()}
  const addMedia=(m:MediaItem)=>addItem({id:uid('mediaitem'),type:m.type==='audio'?'audio':m.type==='video'?'video':'image',title:m.name,payload:m.type==='audio'?{text:'',audioPath:m.path}:{text:'',background:m.path,backgroundType:m.type==='video'?'video':'image'}})
  const previewMedia=(m:MediaItem)=>{if(m.type==='audio'){setState(x=>({...x,mode:'preview',title:m.name,audio:{path:m.path,playing:false,volume:.85,loop:false},sequence:x.sequence+1}));setActive('present');setToast('Audio ready in Preview');return}setState(x=>({...x,mode:'preview',title:m.name,text:'',reference:'',layout:'center',background:m.path,backgroundType:m.type==='video'?'video':'image',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:x.sequence+1}));setActive('present');setToast(m.type==='video'?'Video opened in Preview':'Image opened in Preview')}
  const applyMediaBackground=(m:MediaItem)=>{if(m.type==='audio')return;setState(x=>{const darkDefault=['#2f3133','#111111','#000000'].includes(String(x.theme.textColor).toLowerCase());return{...x,background:m.path,backgroundType:m.type==='video'?'video':'image',youtubeId:undefined,black:false,logo:false,theme:{...x.theme,overlay:Math.max(.46,x.theme.overlay||0),textColor:darkDefault?'#fffaf0':x.theme.textColor},sequence:x.sequence+1}});setToast(`${m.name} set as background`)}
  const applyMediaMusic=(m:MediaItem)=>{if(m.type!=='audio')return;setState(x=>({...x,audio:{path:m.path,playing:true,volume:x.audio?.volume??.72,loop:true},sequence:x.sequence+1}));setToast(`${m.name} added as background music`)}
  const liveMedia=(m:MediaItem)=>{if(m.type==='audio'){const live={...state,mode:'live' as const,title:m.name,audio:{path:m.path,playing:true,volume:.85,loop:false},sequence:state.sequence+1};void sendLiveState(live,'Áudio no TELÃO');return}const live:PresentationState={...state,mode:'live',title:m.name,text:'',reference:'',background:m.path,backgroundType:m.type==='video'?'video':'image',youtubeId:undefined,audio:m.type==='video'?undefined:state.audio,black:false,logo:false,clearText:false,sequence:state.sequence+1};void sendLiveState(live,'Mídia no TELÃO').then(ok=>{if(ok)setActive('present')})}
  const openOut=async(k:'audience'|'stage',id:number)=>{const r=await window.verseflow?.openOutput(k,id);if(k==='audience')setAudienceStatus(await window.verseflow?.getDisplayStatus(id)||null);setToast(r?.ok?(k==='audience'?'TELÃO aberto':`${k} display opened`):r?.error||'Could not open display')}
  const saveTheme=async(t:Theme)=>{await window.verseflow?.upsert('themes',t);await reload()}
  const applyTheme=(t:Theme)=>setState(s=>({...s,theme:t}))

  const showCaption=(text:string,goLive:boolean)=>{
    const next={...state,mode:goLive?'live' as const:'preview' as const,title:'Live Caption',text,reference:'',layout:'lower-third' as const,youtubeId:undefined,black:false,logo:false,clearText:false,sequence:state.sequence+1}
    setState(next)
    if(goLive){lastLive.current=next;window.verseflow?.sendPresentationState(next);setToast('Caption sent live')}
  }

  const autoScriptureFromCaption=async(text:string)=>{
    const r=await window.verseflow?.smartCommand(text,{source:'whisper-caption'})
    if(!r?.ok||r.plan?.action!=='SHOW_VERSE'||!r.plan.reference)return
    const ref=r.plan.reference
    const match=window.verseflow?.getBibleReference ? await window.verseflow.getBibleReference(ref) : undefined
    if(match){previewVerse(match);setActive('present');setLiveTab('bible');setToast(`Auto Scripture Follow: ${match.book} ${match.chapter}:${match.verse} ready in Preview`)}
  }

  const newSlide=()=>{setActive('present');setState(s=>({...s,mode:'preview',title:'New Slide',text:'',reference:'',layout:'center',background:undefined,backgroundType:'solid',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:s.sequence+1}));setToast('New blank slide ready')}
  const undoPresentation=()=>{const prev=historyRef.current.pop();if(!prev){setToast('Nothing to undo');return}undoingRef.current=true;setState({...prev,mode:'preview',sequence:state.sequence+1});setToast('Presentation change undone')}
  const globalSearch=async()=>{const q=globalQ.trim();if(!q)return;const bible=window.verseflow?.searchBible?await window.verseflow.searchBible(q,undefined,1):[];const verse=bible?.[0];if(verse){previewVerse(verse);setActive('present');setToast(`Previewing ${verse.book} ${verse.chapter}:${verse.verse}`);return}const lower=q.toLowerCase();const song=data.songs.find(x=>x.title.toLowerCase().includes(lower));if(song?.sections[0]){const sec=song.sections[0];setState(s=>({...s,mode:'preview',title:song.title,text:sec.lines.join('\n'),reference:sec.label,layout:'center',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:s.sequence+1}));setActive('present');setToast(`Previewing ${song.title}`);return}const m=data.media.find(x=>x.name.toLowerCase().includes(lower));if(m){setState(s=>({...s,mode:'preview',title:m.name,text:'',reference:'',layout:'center',background:m.path,backgroundType:m.type==='video'?'video':'image',youtubeId:undefined,black:false,logo:false,clearText:false,sequence:s.sequence+1}));setActive('present');setToast(`Previewing ${m.name}`);return}setToast('No Bible verse, song, or media matched that search')}
  const globalImport=async()=>{if(active==='bible'){const r=await window.verseflow?.importBible();if(r?.ok){await reload();setToast(`${r.translation}: ${r.imported} verses imported`)}else if(r?.error!=='Canceled')setToast(r?.error||'Import failed');return}await importMedia();setToast('Media import finished')}

  const quickNavigate=(target:ModuleKey,tab?:string)=>{
    quickBackRef.current={active,liveTab}
    if(tab)setLiveTab(tab)
    setActive(target)
  }
  const quickBack=()=>{
    const prev=quickBackRef.current
    if(!prev){setToast('No previous sidebar screen yet');return}
    setLiveTab(prev.liveTab)
    setActive(prev.active)
    quickBackRef.current=null
    setToast('Back to previous screen')
  }
  const quickPrevious=()=>{
    if(!items.length){setToast('No service items yet');return}
    if(index<=0){setToast('Already at the first service item');return}
    previewItem(index-1)
  }
  const quickNext=()=>{
    if(!items.length){setToast('No service items yet');return}
    if(index>=items.length-1){setToast('Already at the last service item');return}
    previewItem(index+1)
  }
  const quickStopAudio=()=>{
    if(!state.audio?.path){setToast('No audio is playing');return}
    sendSafety({audio:undefined})
    setToast('Audio stopped')
  }
  const quickCamera=async()=>{
    quickBackRef.current={active,liveTab}
    setActive('production')
    const r=await window.verseflow?.obsOpen()
    setToast(r?.ok?'Camera/OBS controls opened':'Camera controls are in Production. Open OBS when you are ready.')
  }

  useEffect(()=>window.verseflow?.onCompanionAction(action=>{
    if(action==='black')sendSafety({black:!state.black,logo:false})
    if(action==='clear')sendSafety({clearText:!state.clearText})
    if(action==='logo')sendSafety({logo:!state.logo,black:false})
    if(action==='empty')sendSafety({text:'',reference:'',youtubeId:undefined,black:false,logo:false,clearText:false,background:undefined,backgroundType:'solid'})
    if(action==='live')sendLive()
    if(action==='next'&&items.length)previewItem(Math.min(items.length-1,index+1))
    if(action==='previous'&&items.length)previewItem(Math.max(0,index-1))
  }),[state,index,items])

  if (loading) return <div className="boot-screen"><div className="brand-mark big">V</div><span>Loading VerseFlow…</span></div>

  return <div className="app-shell">
    <Nav active={active} onChange={setActive} controls={<div className="sidebar-quick-controls" aria-label="Live controls">
      <button className={`side-control side-color-1 ${state.black?'quick-active':''}`} onClick={()=>sendSafety({black:!state.black,logo:false})}>BLACK</button>
      <button className={`side-control side-color-2 ${state.logo?'quick-active':''}`} onClick={()=>sendSafety({logo:!state.logo,black:false})}>LOGO</button>
      <button className={`side-control side-color-3 ${state.clearText?'quick-active':''}`} onClick={()=>sendSafety({clearText:!state.clearText})}>CLEAR TEXT</button>
      <button className="side-control side-color-4" onClick={()=>quickNavigate('bible')}>Bible</button>
      <button className="side-control side-color-5" onClick={()=>quickNavigate('songs')}>Songs</button>
      <button className="side-control side-color-6" onClick={()=>quickNavigate('lyrics')}>LYRICS</button>
      <button className="side-control side-color-7" onClick={()=>quickNavigate('media')}>Media</button>
      <button className="side-control side-color-8" onClick={()=>quickNavigate('present','youtube')}><Youtube size={13}/> YouTube</button>
      <button className="side-control side-color-9" onClick={()=>quickNavigate('present','timer')}><TimerReset size={13}/> Timer</button>
      <button className="side-control side-color-10" onClick={()=>quickNavigate('present','lower')}><Type size={13}/> Lower Third</button>
      <button className="side-control side-color-11" onClick={()=>quickNavigate('production')}><SlidersHorizontal size={13}/> Production</button>
      <button className="side-control side-color-12" onClick={()=>void quickCamera()}><Monitor size={13}/> Camera</button>
      <button className="side-control side-color-13" onClick={quickStopAudio}>STOP AUDIO</button>
      <button className="side-control side-color-14" onClick={quickPrevious}>Previous</button>
      <button className="side-control side-color-15" onClick={quickBack}>BACK</button>
      <button className="side-control side-live" onClick={sendLive}>LIVE</button>
      <button className="side-control side-color-16" onClick={quickNext}>Next</button>
    </div>}/>
    <main className="main-shell">
      <header className="topbar"><div className="global-search"><Search size={16}/><input value={globalQ} onChange={e=>setGlobalQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void globalSearch()}} placeholder="Search Bible, songs, media…"/></div><button onClick={newSlide}><CirclePlus size={16}/> New Slide</button><button onClick={globalImport}><Import size={16}/> Import</button><button title="Undo presentation change" onClick={undoPresentation}><Undo2 size={16}/></button><div className="top-spacer"/><LanguageSwitcher language={language} onChange={setLanguage}/><span className="offline"><WifiOff size={14}/> Offline-first</span><button className={`wall-health-badge ${audienceStatus?.connected?'connected':'disconnected'}`} onClick={()=>setActive('settings')} title="Configurar telão">{audienceStatus?.connected?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>} {audienceStatus?.connected?'TELÃO CONECTADO':'SEM TELÃO'}</button><button className={`system-health-badge ${systemHealth}`} onClick={()=>setActive('settings')} title="Open System Check">{systemHealth==='ok'?<CheckCircle2 size={13}/>:systemHealth==='warning'?<AlertTriangle size={13}/>:null}{systemHealth==='ok'?'SYSTEM OK':systemHealth==='warning'?'CHECK SYSTEM':'CHECKING'}</button><button className="present-top" onClick={()=>setActive('present')}><Monitor size={16}/> Present</button><span className={state.mode==='live'?'live-badge':'ready-badge'}>{state.mode==='live'?'LIVE':'READY'}</span><span className="clock"><Clock3 size={14}/>{new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></header>
      <div className="workspace">
        {active==='dashboard'&&<Dashboard go={setActive} data={data}/>}
        {active==='bible'&&<BiblePage verses={data.verses} translations={data.translations} onPreview={previewVerse} onAdd={v=>{const item=verseToServiceItem(v);addItem({...item,payload:{...item.payload,...atmospherePayload(state)}})}} onLive={liveVerse} onImport={async()=>{const r=await window.verseflow?.importBible();if(r?.ok){await reload();setToast(`${r.translation}: ${r.imported} verses imported`)}else if(r?.error!=='Canceled')setToast(r?.error||'Import failed')}} onInstalled={async()=>{await reload();setToast('Bible installed and ready offline')}} state={state} setState={setState} themes={themes} items={items} media={data.media} onPickMedia={importMedia}/>}
        {active==='lyrics'&&<LyricsPage songs={data.songs} onSave={saveSong} onAddToService={addEntireLyricsSong} onLiveState={next=>{void sendLiveState(next,'Lyrics on TELÃO')}} state={state} setState={setStateAndSync}/>}
        {active==='songs'&&<SongsPage songs={data.songs} onSave={saveSong} onAdd={addSong} onPreview={previewSong} onLive={liveSong} state={state} setState={setState} media={data.media} onPickMedia={importMedia}/>}
        {active==='media'&&<MediaPage media={data.media} onImport={importMedia} onAdd={addMedia} onPreview={previewMedia} onLive={liveMedia} onBackground={applyMediaBackground} onMusic={applyMediaMusic}/>}
        {active==='playlists'&&<PlaylistPage items={items} setItems={setItems} onSelect={previewItem} onLive={liveAt} onSave={async(name,list)=>{const service={id:uid('service'),title:name,date:new Date().toISOString(),items:list};await window.verseflow?.upsert('services',service);await reload();setToast('Service saved')}}/>}
        {active==='present'&&<FreeLivePage state={state} setState={setStateAndSync} onSendLive={(s)=>{const live=s||{...state,mode:'live' as const,sequence:state.sequence+1};void sendLiveState(live,'TELÃO atualizado')}} verses={data.verses} translations={data.translations} media={data.media} onPickMedia={importMedia} songs={data.songs} onSaveSong={saveSong} requestedTab={liveTab} onMediaAdded={reload}/>}
        {active==='themes'&&<ThemesPage themes={themes} onApply={applyTheme} onSave={saveTheme}/>}
        {active==='production'&&<ProductionPage media={data.media} displays={displays} onCompatibleAdded={async(item)=>{await window.verseflow?.upsert('media',item);await reload()}} onCaption={showCaption} onAutoScripture={autoScriptureFromCaption}/>}
        {active==='settings'&&<SettingsPage displays={displays} settings={data.settings} translations={data.translations} refresh={refreshDisplays} openOut={openOut} closeOut={k=>window.verseflow?.closeOutput(k)} onSaveSetting={async(k,v)=>{await window.verseflow?.saveSetting(k,v);await reload();setToast('Setting saved')}} onBackup={async()=>{const r=await window.verseflow?.exportBackup();setToast(r?.ok?'Backup exported':r?.error||'Backup failed')}} onRestore={async()=>{const r=await window.verseflow?.importBackup();if(r?.ok)await reload();setToast(r?.ok?'Backup restored':r?.error||'Restore failed')}}/>}
      </div>
      {active!=='present'&&['bible'].indexOf(active)<0&&<div className="bottom-status"><span><span className="green-dot"/> Core presentation engine ready</span><span>{audienceStatus?.connected?'Telão conectado':'Telão não detectado'} · {displays.length} tela{displays.length===1?'':'s'}</span></div>}
    </main>
    {active==='dashboard' ? null : active==='bible' ? null : active==='present' ? null : null}
    {taskProgress&&<div className={`global-task-progress ${taskProgress.error?'error':taskProgress.done?'done':''}`} role="status" aria-live="polite"><div className="global-task-progress-head"><strong>{taskProgress.label}</strong><b>{Math.round(taskProgress.percent)}%</b></div><div className="global-task-progress-track"><span style={{width:`${Math.max(0,Math.min(100,taskProgress.percent))}%`}}/></div><small>{taskProgress.stage||'Working…'}</small></div>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
