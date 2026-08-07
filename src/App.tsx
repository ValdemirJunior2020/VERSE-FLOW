import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CirclePlus, Clock3, Images, Import, Monitor, Search, Undo2, WifiOff, Zap } from 'lucide-react'
import Nav from './components/Nav'
import CanvasPreview from './components/CanvasPreview'
import OutputRenderer from './components/OutputRenderer'
import { defaultTheme, itemToPresentation, verseToServiceItem } from './presentation'
import { useVerseFlowData } from './hooks/useVerseFlowData'
import type { BibleCatalogItem, BibleTranslation, DisplayInfo, MediaItem, ModuleKey, PresentationState, ServiceItem, Song, Theme, Verse } from './types'

const params = new URLSearchParams(location.search)
const mode = params.get('mode')
if (mode === 'audience' || mode === 'stage') {
  // rendered below from App
}

function uid(prefix='id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}` }

function ScriptureBrowser({verses,translations,onPreview,onAdd,onImport,onInstalled}:{verses:Verse[];translations:BibleTranslation[];onPreview:(v:Verse)=>void;onAdd:(v:Verse)=>void;onImport:()=>void;onInstalled:()=>void}) {
  const [q,setQ]=useState('John 3')
  const [translation,setTranslation]=useState(translations[0]?.code||'WEB')
  const [catalog,setCatalog]=useState<BibleCatalogItem[]>([])
  const [busy,setBusy]=useState('')
  const [catalogOpen,setCatalogOpen]=useState(false)
  useEffect(()=>{window.verseflow?.getBibleCatalog().then(setCatalog)},[])
  useEffect(()=>{if(translations.length&&!translations.some(t=>t.code===translation))setTranslation(translations[0].code)},[translations])
  const filtered=useMemo(()=> {
    const x=q.trim().toLowerCase()
    return verses.filter(v=>v.translation===translation && (!x||`${v.book} ${v.chapter}:${v.verse} ${v.text}`.toLowerCase().includes(x)))
  },[q,verses,translation])
  const installed=new Set(translations.map(t=>t.code))
  const install=async(item:BibleCatalogItem)=>{
    if(item.status==='import'){onImport();return}
    setBusy(item.code)
    const r=await window.verseflow?.installBibleFromCatalog(item.code)
    setBusy('')
    if(r?.ok){await onInstalled();setTranslation(item.code)}
    else alert(r?.error||'Bible install failed')
  }
  return <div className="browser-panel">
    <div className="panel-title">Bible</div>
    <label className="search-field"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="John 3:16 or words"/></label>
    <div className="tiny-row"><select value={translation} onChange={e=>setTranslation(e.target.value)}>{translations.map(t=><option value={t.code} key={t.code}>{t.code} · {t.name}</option>)}</select><button className="ghost" onClick={()=>setCatalogOpen(v=>!v)}>Bibles</button></div>
    {catalogOpen&&<div className="bible-catalog">
      <div className="catalog-head"><strong>Bible Library</strong><button onClick={onImport}>Import JSON</button></div>
      {catalog.map(item=><div className="catalog-row" key={item.code}>
        <div><strong>{item.code}</strong><span>{item.name}</span><small>{item.language} · {item.license}</small></div>
        {installed.has(item.code)?<span className="installed-badge">Installed</span>:<button disabled={busy===item.code} onClick={()=>install(item)}>{busy===item.code?'Installing…':item.status==='download'?'Install':'Import'}</button>}
      </div>)}
    </div>}
    <div className="verse-list">{filtered.map(v=><article key={v.id} onClick={()=>onPreview(v)}>
      <div><strong>{v.book} {v.chapter}:{v.verse}</strong><span>{v.translation}</span></div>
      <p>{v.text}</p>
      <button onClick={e=>{e.stopPropagation();onAdd(v)}}>+ Service</button>
    </article>)}</div>
  </div>
}
function Inspector({state,setState,themes}:{state:PresentationState;setState:(s:PresentationState)=>void;themes:Theme[]}) {
  const patchTheme=(patch:Partial<Theme>)=>setState({...state,theme:{...state.theme,...patch}})
  return <div className="inspector">
    <div className="panel-title">Properties</div>
    <label>Theme<select value={state.theme.id} onChange={e=>{const t=themes.find(x=>x.id===e.target.value); if(t) setState({...state,theme:t})}}>{themes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Font Family<select value={state.theme.fontFamily} onChange={e=>patchTheme({fontFamily:e.target.value})}><option>Georgia, Times New Roman, serif</option><option>Arial, Helvetica, sans-serif</option><option>Verdana, sans-serif</option></select></label>
    <label>Font Size<div className="range-row"><input type="range" min="30" max="110" value={state.theme.fontSize} onChange={e=>patchTheme({fontSize:+e.target.value})}/><span>{state.theme.fontSize}</span></div></label>
    <label>Alignment<div className="seg"><button className={state.theme.alignment==='left'?'active':''} onClick={()=>patchTheme({alignment:'left'})}>Left</button><button className={state.theme.alignment==='center'?'active':''} onClick={()=>patchTheme({alignment:'center'})}>Center</button><button className={state.theme.alignment==='right'?'active':''} onClick={()=>patchTheme({alignment:'right'})}>Right</button></div></label>
    <label>Overlay Darkness<div className="range-row"><input type="range" min="0" max="90" value={Math.round(state.theme.overlay*100)} onChange={e=>patchTheme({overlay:+e.target.value/100})}/><span>{Math.round(state.theme.overlay*100)}%</span></div></label>
    <label>Transition<select value={state.theme.transition} onChange={e=>patchTheme({transition:e.target.value as Theme['transition']})}><option value="fade">Fade</option><option value="cut">Cut</option><option value="slide">Slide</option></select></label>
    <div className="safe-note">16:9 safe-area protection is always active on the live output.</div>
  </div>
}

function Dashboard({go,data}:{go:(m:ModuleKey)=>void;data:any}) {
  return <div className="page dashboard">
    <div className="hero-card"><div><span className="eyebrow">SUNDAY READY</span><h1>Your service. One clean flow.</h1><p>Build the service offline, preview every slide, then send only approved content to the audience screen.</p><div className="hero-actions"><button className="gold" onClick={()=>go('present')}>Open Live Desk</button><button onClick={()=>go('playlists')}>Build Service (optional)</button></div></div><div className="hero-orb">VF</div></div>
    <div className="stats"><div><span>Bible verses</span><strong>{data.verses.length}</strong></div><div><span>Songs</span><strong>{data.songs.length}</strong></div><div><span>Media</span><strong>{data.media.length}</strong></div><div><span>Saved services</span><strong>{data.services.length}</strong></div></div>
    <div className="feature-grid"><div><Zap/><h3>Live Scripture Flow</h3><p>Search, preview, send live, then move verse-by-verse with keyboard control.</p></div><div><Monitor/><h3>Cinematic Scripture Studio</h3><p>Optional motion and AI media tools stay separate from the reliable live engine.</p></div><div><ListMusicIcon/><h3>Sunday Service Builder</h3><p>Scripture, songs, announcements, images and videos in one ordered service.</p></div></div>
  </div>
}
function ListMusicIcon(){return <span className="feature-icon">☷</span>}

function BiblePage({verses,translations,onPreview,onAdd,onLive,onImport,onInstalled,state,setState,themes,items}:{verses:Verse[];translations:BibleTranslation[];onPreview:(v:Verse)=>void;onAdd:(v:Verse)=>void;onLive:(v:Verse)=>void;onImport:()=>void;onInstalled:()=>void;state:PresentationState;setState:(s:PresentationState)=>void;themes:Theme[];items:ServiceItem[]}) {
  const [selected,setSelected]=useState<Verse|undefined>(verses[0])
  const preview=(v:Verse)=>{setSelected(v);onPreview(v)}
  return <div className="editor-layout">
    <ScriptureBrowser verses={verses} translations={translations} onPreview={preview} onAdd={onAdd} onImport={onImport} onInstalled={onInstalled}/>
    <section className="editor-center">
      <div className="editor-heading"><div><span className="eyebrow">SLIDE EDITOR</span><strong>{selected?`${selected.book} ${selected.chapter}:${selected.verse}`:'Scripture preview'}</strong></div><div className="detail-actions">{selected&&<><button className="gold" onClick={()=>onLive(selected)}>LIVE NOW</button><button onClick={()=>onAdd(selected)}>Add to Service (optional)</button></>}</div></div>
      <CanvasPreview state={state} live={state.mode==='live'}/>
      <div className="slide-strip"><div className="strip-label">SERVICE</div>{items.length===0?<span className="strip-empty">Add scripture, songs or media to build the service.</span>:items.slice(0,8).map((it,i)=><div className="slide-thumb" key={it.id}><span>{i+1}</span><strong>{it.title}</strong></div>)}</div>
    </section>
    <Inspector state={state} setState={setState} themes={themes}/>
  </div>
}
function SongsPage({songs,onSave,onAdd}:{songs:Song[];onSave:(s:Song)=>void;onAdd:(s:Song)=>void}) {
  const [selected,setSelected]=useState<Song|undefined>(songs[0])
  const [title,setTitle]=useState(songs[0]?.title||'')
  const [author,setAuthor]=useState(songs[0]?.author||'')
  const [ccli,setCcli]=useState(songs[0]?.ccli||'')
  const [songKey,setSongKey]=useState(songs[0]?.key||'')
  const [body,setBody]=useState(songs[0]?.sections.map(x=>[x.label,...x.lines].join('\n')).join('\n\n')||'Verse 1\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\nChorus\nMy chains are gone\nI’ve been set free')
  const choose=(s:Song)=>{setSelected(s);setTitle(s.title);setAuthor(s.author||'');setCcli(s.ccli||'');setSongKey(s.key||'');setBody(s.sections.map(x=>[x.label,...x.lines].join('\n')).join('\n\n'))}
  const save=()=>{const sections=body.split(/\n\s*\n/).map((block,i)=>{const lines=block.split('\n');return{id:uid('sec'),label:lines.shift()||`Section ${i+1}`,lines}}); const s={id:selected?.id||uid('song'),title:title||'Untitled Song',author,ccli,key:songKey,sections};onSave(s);setSelected(s)}
  return <div className="library-page"><div className="library-list"><div className="panel-title">Songs</div>{songs.map(s=><button className={selected?.id===s.id?'selected':''} key={s.id} onClick={()=>choose(s)}><strong>{s.title}</strong><span>{s.author||'Local song'}</span></button>)}<button className="ghost" onClick={()=>{setSelected(undefined);setTitle('');setAuthor('');setCcli('');setSongKey('');setBody('Verse 1\n')}}>+ New Song</button></div><div className="song-editor"><span className="eyebrow">LOCAL SONG LIBRARY</span><input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Song title"/><textarea value={body} onChange={e=>setBody(e.target.value)}/><div className="detail-actions"><button onClick={save}>Save Song</button>{selected&&<button className="gold" onClick={()=>onAdd({...selected,title,author,ccli,key:songKey})}>Add to Service</button>}</div></div><div className="mini-help"><h3>Song metadata</h3><label>Author<input value={author} onChange={e=>setAuthor(e.target.value)}/></label><label>CCLI #<input value={ccli} onChange={e=>setCcli(e.target.value)}/></label><label>Key<input value={songKey} onChange={e=>setSongKey(e.target.value)}/></label><p>CCLI fields are metadata only. VerseFlow does not grant or claim music licensing rights.</p></div></div>
}
function MediaPage({media,onImport,onAdd}:{media:MediaItem[];onImport:()=>void;onAdd:(m:MediaItem)=>void}) {
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">LOCAL MEDIA</span><h1>Media Library</h1></div><button className="gold" onClick={onImport}><Import size={16}/> Import Media</button></div><div className="media-grid">{media.length===0?<div className="empty-card"><Images size={32}/><h3>No local media yet</h3><p>Import images, videos or audio. Files stay on this PC.</p><button onClick={onImport}>Choose files</button></div>:media.map(m=><div className="media-card" key={m.id}><div className={`media-thumb ${m.type}`}>{m.type==='image'?<img src={`file:///${m.path.replace(/\\/g,'/')}`}/>:m.type.toUpperCase()}</div><strong>{m.name}</strong><span>{m.type}</span><button onClick={()=>onAdd(m)}>Add to Service</button></div>)}</div></div>
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
  const [aud,setAud]=useState<number>(Number(settings.audienceDisplayId) || (displays[1]?.id ?? displays[0]?.id ?? 0))
  const [stage,setStage]=useState<number>(Number(settings.stageDisplayId) || (displays[2]?.id ?? displays[0]?.id ?? 0))
  const [omni,setOmni]=useState(String(settings.aiEndpoint||'http://127.0.0.1:20128/v1'))
  const [translation,setTranslation]=useState(String(settings.defaultTranslation||translations[0]?.code||'WEB'))
  const [resolution,setResolution]=useState(String(settings.resolution||'1920x1080'))
  const [fps,setFps]=useState(String(settings.fps||'60'))
  const [mediaFolders,setMediaFolders]=useState(String(settings.mediaFolders||''))
  const [health,setHealth]=useState('')
  const [dataPath,setDataPath]=useState('')
  useEffect(()=>{window.verseflow?.appInfo().then(x=>setDataPath(x.dataPath))},[])
  useEffect(()=>{if(displays.length){if(!displays.some(d=>d.id===aud))setAud(displays[1]?.id??displays[0].id);if(!displays.some(d=>d.id===stage))setStage(displays[2]?.id??displays[0].id)}},[displays])
  const saveBasics=()=>{onSaveSetting('defaultTranslation',translation);onSaveSetting('resolution',resolution);onSaveSetting('fps',fps);onSaveSetting('mediaFolders',mediaFolders);onSaveSetting('aiEndpoint',omni)}
  return <div className="page settings-page"><div className="page-heading"><div><span className="eyebrow">SYSTEM</span><h1>Settings</h1></div><div className="inline"><button onClick={refresh}>Refresh displays</button><button className="gold" onClick={saveBasics}>Save Settings</button></div></div><section><h3>Presentation defaults</h3><div className="settings-grid"><label>Default translation<select value={translation} onChange={e=>setTranslation(e.target.value)}>{translations.map(t=><option value={t.code} key={t.code}>{t.code} · {t.name}</option>)}</select></label><label>Output resolution<select value={resolution} onChange={e=>setResolution(e.target.value)}><option>1920x1080</option><option>1280x720</option><option>3840x2160</option></select></label><label>FPS preference<select value={fps} onChange={e=>setFps(e.target.value)}><option>30</option><option>60</option></select></label><label>Media folders<input value={mediaFolders} onChange={e=>setMediaFolders(e.target.value)} placeholder="D:\Church Media; C:\Media"/></label></div></section><section><h3>Outputs</h3><div className="settings-grid"><label>Audience display<select value={aud} onChange={e=>{const id=+e.target.value;setAud(id);onSaveSetting('audienceDisplayId',id)}}>{displays.map(d=><option key={d.id} value={d.id}>{d.label} · {d.bounds.width}×{d.bounds.height}{d.primary?' · Primary':''}</option>)}</select><div className="inline"><button className="gold" onClick={()=>openOut('audience',aud)}>Open Audience</button><button onClick={()=>closeOut('audience')}>Close</button></div></label><label>Stage display<select value={stage} onChange={e=>{const id=+e.target.value;setStage(id);onSaveSetting('stageDisplayId',id)}}>{displays.map(d=><option key={d.id} value={d.id}>{d.label} · {d.bounds.width}×{d.bounds.height}</option>)}</select><div className="inline"><button onClick={()=>openOut('stage',stage)}>Open Stage</button><button onClick={()=>closeOut('stage')}>Close</button></div></label></div></section><section><h3>Data & backup</h3><p>Database location: <code>{dataPath||'Loading…'}</code></p><div className="inline"><button onClick={onBackup}>Export Backup</button><button onClick={onRestore}>Restore Backup</button></div></section><section><h3>Hotkeys</h3><p><kbd>Space</kbd> / <kbd>→</kbd> next · <kbd>←</kbd> previous · <kbd>B</kbd> black · <kbd>C</kbd> clear text · <kbd>Esc</kbd> emergency black. Custom remapping is reserved for the next settings pass.</p></section><section><h3>Optional local AI gateway</h3><p>AI is never required for live presentation. VerseFlow only talks to a local OpenAI-compatible endpoint when you enable it.</p><label>OmniRoute / compatible URL<input value={omni} onChange={e=>setOmni(e.target.value)}/></label><div className="inline"><button onClick={async()=>{setHealth('Checking…');const r=await window.verseflow?.integrationHealth(omni);setHealth(r?.ok?'Connected':r?.error||'Not available')}}>Test connection</button><span className="health">{health}</span></div></section></div>
}

function FreeLivePage({
  state,setState,onSendLive,verses,media,onPickMedia
}:{
  state:PresentationState;
  setState:(s:PresentationState)=>void;
  onSendLive:(s?:PresentationState)=>void;
  verses:Verse[];
  media:MediaItem[];
  onPickMedia:()=>void;
}) {
  const [tab,setTab]=useState<'text'|'bible'|'media'>('text')
  const [custom,setCustom]=useState('Welcome to worship')
  const [reference,setReference]=useState('')
  const [q,setQ]=useState('John 3:16')

  const found=useMemo(()=>{
    const x=q.trim().toLowerCase()
    if(!x)return verses.slice(0,30)
    return verses.filter(v=>`${v.book} ${v.chapter}:${v.verse} ${v.text}`.toLowerCase().includes(x)).slice(0,80)
  },[q,verses])

  const previewText=()=>{
    setState({...state,mode:'preview',text:custom,reference,title:reference||'Custom Text',backgroundType:state.backgroundType||'solid',black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }
  const liveText=()=>{
    const n={...state,mode:'live' as const,text:custom,reference,title:reference||'Custom Text',black:false,logo:false,clearText:false,sequence:state.sequence+1}
    setState(n); onSendLive(n)
  }
  const versePreview=(v:Verse)=>{
    setState({...state,mode:'preview',title:`${v.book} ${v.chapter}:${v.verse}`,text:v.text,reference:`${v.book} ${v.chapter}:${v.verse}`,black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }
  const verseLive=(v:Verse)=>{
    const n={...state,mode:'live' as const,title:`${v.book} ${v.chapter}:${v.verse}`,text:v.text,reference:`${v.book} ${v.chapter}:${v.verse}`,black:false,logo:false,clearText:false,sequence:state.sequence+1}
    setState(n); onSendLive(n)
  }
  const mediaPreview=(m:MediaItem)=>{
    setState({...state,mode:'preview',title:m.name,text:'',reference:'',background:m.path,backgroundType:m.type==='video'?'video':'image',black:false,logo:false,clearText:false,sequence:state.sequence+1})
  }
  const mediaLive=(m:MediaItem)=>{
    const n={...state,mode:'live' as const,title:m.name,text:'',reference:'',background:m.path,backgroundType:m.type==='video'?'video':'image',black:false,logo:false,clearText:false,sequence:state.sequence+1}
    setState(n); onSendLive(n)
  }

  return <div className="free-live-page">
    <aside className="free-live-browser">
      <div className="panel-title">LIVE DESK</div>
      <div className="live-tabs">
        <button className={tab==='text'?'active':''} onClick={()=>setTab('text')}>Text</button>
        <button className={tab==='bible'?'active':''} onClick={()=>setTab('bible')}>Bible</button>
        <button className={tab==='media'?'active':''} onClick={()=>setTab('media')}>Media</button>
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
          {found.map(v=><article key={`${v.translation}-${v.id}`}>
            <div onClick={()=>versePreview(v)}>
              <strong>{v.book} {v.chapter}:{v.verse}</strong>
              <span>{v.translation}</span>
              <p>{v.text}</p>
            </div>
            <button className="gold small" onClick={()=>verseLive(v)}>LIVE</button>
          </article>)}
        </div>
      </>}

      {tab==='media'&&<>
        <button className="import-wide" onClick={onPickMedia}>+ Import Image / Video</button>
        <div className="instant-media-list">
          {media.map(m=><article key={m.id}>
            <div onClick={()=>mediaPreview(m)}>
              <strong>{m.name}</strong><span>{m.type}</span>
            </div>
            <button className="gold small" onClick={()=>mediaLive(m)}>LIVE</button>
          </article>)}
        </div>
      </>}
    </aside>

    <section className="free-live-center">
      <div className="free-live-heading">
        <div><span className="eyebrow">FREE LIVE MODE</span><h2>Display anything, anytime.</h2></div>
        <span className={state.mode==='live'?'live-badge':'ready-badge'}>{state.mode==='live'?'LIVE':'PREVIEW'}</span>
      </div>
      <CanvasPreview state={state} live={state.mode==='live'}/>
      <div className="live-safety-bar">
        <button className={state.black?'active-red':''} onClick={()=>{const n={...state,mode:'live' as const,black:!state.black,logo:false,sequence:state.sequence+1};setState(n);onSendLive(n)}}>BLACK</button>
        <button className={state.clearText?'active':''} onClick={()=>{const n={...state,mode:'live' as const,clearText:!state.clearText,sequence:state.sequence+1};setState(n);onSendLive(n)}}>CLEAR TEXT</button>
        <button className={state.logo?'active':''} onClick={()=>{const n={...state,mode:'live' as const,logo:!state.logo,black:false,sequence:state.sequence+1};setState(n);onSendLive(n)}}>LOGO</button>
        <button onClick={()=>{const n={...state,mode:'live' as const,text:'',reference:'',black:false,logo:false,clearText:false,background:undefined,backgroundType:'solid' as const,sequence:state.sequence+1};setState(n);onSendLive(n)}}>EMPTY SCREEN</button>
      </div>
    </section>

    <Inspector state={state} setState={setState} themes={[state.theme]}/>
  </div>
}

function PresentPage({state,setState,sendSafety,items,index,setIndex,sendLive,displays,openOut}:{state:PresentationState;setState:(s:PresentationState)=>void;sendSafety:(patch:Partial<PresentationState>)=>void;items:ServiceItem[];index:number;setIndex:(i:number)=>void;sendLive:()=>void;displays:DisplayInfo[];openOut:(k:'audience'|'stage',id:number)=>void}) {
  const prev=()=>setIndex(Math.max(0,index-1)), next=()=>setIndex(Math.min(items.length-1,index+1))
  return <div className="present-page"><div className="present-main"><CanvasPreview state={state} live={state.mode==='live'}/><div className="transport"><button onClick={prev}><ChevronLeft/> Previous</button><button className="gold go-live" onClick={sendLive}>GO LIVE</button><button onClick={next}>Next <ChevronRight/></button></div>{state.backgroundType==='video'&&<div className="video-controls"><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:true,volume:.8,loop:true}),playing:!(state.video?.playing??true),seekDelta:0,commandId:Date.now()}})}>{state.video?.playing===false?'Play':'Pause'}</button><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:true,volume:.8,loop:true}),seekDelta:-10,commandId:Date.now()}})}>−10s</button><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:true,volume:.8,loop:true}),seekDelta:10,commandId:Date.now()}})}>+10s</button><button onClick={()=>setState({...state,video:{...(state.video||{playing:true,muted:true,volume:.8,loop:true}),muted:!(state.video?.muted??true),seekDelta:0,commandId:Date.now()}})}>{state.video?.muted===false?'Mute':'Unmute'}</button><label>Volume <input type="range" min="0" max="100" value={Math.round((state.video?.volume??.8)*100)} onChange={e=>setState({...state,video:{...(state.video||{playing:true,muted:true,volume:.8,loop:true}),volume:+e.target.value/100,seekDelta:0,commandId:Date.now()}})}/></label></div>}<div className="safety-controls"><button className={state.black?'active-red':''} onClick={()=>sendSafety({black:!state.black,logo:false})}>Black Screen <kbd>B</kbd></button><button className={state.clearText?'active':''} onClick={()=>sendSafety({clearText:!state.clearText})}>Clear Text <kbd>C</kbd></button><button className={state.logo?'active':''} onClick={()=>sendSafety({logo:!state.logo,black:false})}>Logo</button><button className={state.frozen?'active':''} onClick={()=>sendSafety({frozen:!state.frozen})}>Freeze</button></div></div><aside className="present-queue"><div className="panel-title">Current / Next</div>{items.slice(Math.max(0,index-1),index+5).map((it,j)=>{const actual=Math.max(0,index-1)+j;return <button className={actual===index?'current':''} onClick={()=>setIndex(actual)} key={it.id}><span>{actual===index?'CURRENT':actual===index+1?'NEXT':actual+1}</span><strong>{it.title}</strong></button>})}<div className="output-box"><h3>Outputs</h3><p>{displays.length} display{displays.length===1?'':'s'} detected</p>{displays[1]&&<button onClick={()=>openOut('audience',displays[1].id)}>Open on {displays[1].label}</button>}</div></aside></div>
}

export default function App() {
  if (mode === 'audience') return <OutputRenderer />
  if (mode === 'stage') return <OutputRenderer stage />

  const {data,loading,reload}=useVerseFlowData()
  const [active,setActive]=useState<ModuleKey>('dashboard')
  const [items,setItems]=useState<ServiceItem[]>([])
  const [index,setIndex]=useState(0)
  const [displays,setDisplays]=useState<DisplayInfo[]>([])
  const [toast,setToast]=useState('')
  const [state,setState]=useState<PresentationState>(()=>itemToPresentation(undefined,undefined,defaultTheme))
  const lastLive=useRef<PresentationState|null>(null)

  const themes=data.themes.length?data.themes:[defaultTheme]
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
  const sendLive=()=>{
    const live={...state,mode:'live' as const,sequence:state.sequence+1}
    setState(live); lastLive.current=live; window.verseflow?.sendPresentationState(live); setToast('Audience updated')
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
    setIndex(i); setState(live); lastLive.current=live; window.verseflow?.sendPresentationState(live); setToast('Audience updated')
  }
  const refreshDisplays=async()=>setDisplays(await window.verseflow?.getDisplays()||[])
  useEffect(()=>{refreshDisplays()},[])
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2200);return()=>clearTimeout(t)},[toast])
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(active!=='present') return
      if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();previewItem(Math.min(items.length-1,index+1))}
      if(e.key==='ArrowLeft'){e.preventDefault();previewItem(Math.max(0,index-1))}
      if(e.key.toLowerCase()==='b') sendSafety({black:!state.black,logo:false})
      if(e.key.toLowerCase()==='c') sendSafety({clearText:!state.clearText})
      if(e.key==='Escape') sendSafety({black:true,logo:false})
    }
    addEventListener('keydown',fn);return()=>removeEventListener('keydown',fn)
  },[active,index,items,state])

  useEffect(()=>{ if(items[index]) setState(s=>itemToPresentation(items[index],items[index+1],s.theme,s.sequence+1)) },[index])

  const previewVerse=(v:Verse)=>{const i=verseToServiceItem(v);setState(s=>itemToPresentation(i,undefined,s.theme,s.sequence+1))}
  const liveVerse=(v:Verse)=>{const i=verseToServiceItem(v);const p=itemToPresentation(i,undefined,state.theme,state.sequence+1);const live={...p,mode:'live' as const};setState(live);window.verseflow?.sendPresentationState(live);setActive('present')}
  const saveSong=async(s:Song)=>{await window.verseflow?.upsert('songs',s);await reload();setToast('Song saved')}
  const addSong=(s:Song)=>addItem({id:uid('songitem'),type:'song',title:s.title,payload:{text:s.sections.flatMap(x=>x.lines).join('\n')}})
  const importMedia=async()=>{const picked=await window.verseflow?.pickMedia()||[];for(const m of picked) await window.verseflow?.upsert('media',m);await reload()}
  const addMedia=(m:MediaItem)=>addItem({id:uid('mediaitem'),type:m.type==='video'?'video':'image',title:m.name,payload:{text:'',background:m.path,backgroundType:m.type==='video'?'video':'image'}})
  const openOut=async(k:'audience'|'stage',id:number)=>{const r=await window.verseflow?.openOutput(k,id);setToast(r?.ok?`${k} display opened`:r?.error||'Could not open display')}
  const saveTheme=async(t:Theme)=>{await window.verseflow?.upsert('themes',t);await reload()}
  const applyTheme=(t:Theme)=>setState(s=>({...s,theme:t}))

  if (loading) return <div className="boot-screen"><div className="brand-mark big">V</div><span>Loading VerseFlow…</span></div>

  return <div className="app-shell">
    <Nav active={active} onChange={setActive}/>
    <main className="main-shell">
      <header className="topbar"><div className="global-search"><Search size={16}/><input placeholder="Search Bible, songs, media…"/></div><button><CirclePlus size={16}/> New Slide</button><button><Import size={16}/> Import</button><button><Undo2 size={16}/></button><div className="top-spacer"/><span className="offline"><WifiOff size={14}/> Offline-first</span><button className="present-top" onClick={()=>setActive('present')}><Monitor size={16}/> Present</button><span className={state.mode==='live'?'live-badge':'ready-badge'}>{state.mode==='live'?'LIVE':'READY'}</span><span className="clock"><Clock3 size={14}/>{new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></header>
      <div className="workspace">
        {active==='dashboard'&&<Dashboard go={setActive} data={data}/>}
        {active==='bible'&&<BiblePage verses={data.verses} translations={data.translations} onPreview={previewVerse} onAdd={v=>addItem(verseToServiceItem(v))} onLive={liveVerse} onImport={async()=>{const r=await window.verseflow?.importBible();if(r?.ok){await reload();setToast(`${r.translation}: ${r.imported} verses imported`)}else if(r?.error!=='Canceled')setToast(r?.error||'Import failed')}} onInstalled={async()=>{await reload();setToast('Bible installed and ready offline')}} state={state} setState={setState} themes={themes} items={items}/>}
        {active==='songs'&&<SongsPage songs={data.songs} onSave={saveSong} onAdd={addSong}/>}
        {active==='media'&&<MediaPage media={data.media} onImport={importMedia} onAdd={addMedia}/>}
        {active==='playlists'&&<PlaylistPage items={items} setItems={setItems} onSelect={previewItem} onLive={liveAt} onSave={async(name,list)=>{const service={id:uid('service'),title:name,date:new Date().toISOString(),items:list};await window.verseflow?.upsert('services',service);await reload();setToast('Service saved')}}/>}
        {active==='present'&&<FreeLivePage state={state} setState={setStateAndSync} onSendLive={(s)=>{const live=s||{...state,mode:'live' as const,sequence:state.sequence+1};setState(live);lastLive.current=live;window.verseflow?.sendPresentationState(live);setToast('Audience updated')}} verses={data.verses} media={data.media} onPickMedia={importMedia}/>}
        {active==='themes'&&<ThemesPage themes={themes} onApply={applyTheme} onSave={saveTheme}/>}
        {active==='settings'&&<SettingsPage displays={displays} settings={data.settings} translations={data.translations} refresh={refreshDisplays} openOut={openOut} closeOut={k=>window.verseflow?.closeOutput(k)} onSaveSetting={async(k,v)=>{await window.verseflow?.saveSetting(k,v);await reload();setToast('Setting saved')}} onBackup={async()=>{const r=await window.verseflow?.exportBackup();setToast(r?.ok?'Backup exported':r?.error||'Backup failed')}} onRestore={async()=>{const r=await window.verseflow?.importBackup();if(r?.ok)await reload();setToast(r?.ok?'Backup restored':r?.error||'Restore failed')}}/>}
      </div>
      {active!=='present'&&['bible'].indexOf(active)<0&&<div className="bottom-status"><span><span className="green-dot"/> Core presentation engine ready</span><span>{displays.length} display{displays.length===1?'':'s'} detected</span></div>}
    </main>
    {active==='dashboard' ? null : active==='bible' ? null : active==='present' ? null : null}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
