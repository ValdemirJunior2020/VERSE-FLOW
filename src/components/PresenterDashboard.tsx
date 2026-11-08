import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen, ChevronRight, Circle, FolderOpen,
  Images, ListMusic, Maximize2, Monitor, Music2, Play, Plus,
  Search, Settings2, Square, Video, Volume2, Zap
} from 'lucide-react'
import { builtInBackgrounds } from '../backgrounds'
import { cleanStrongMarkers, itemToPresentation } from '../presentation'
import type { AppData, MediaItem, ModuleKey, PresentationState, ServiceItem, Song, Verse } from '../types'
import '../presenter-dashboard.css'

type Props = {
  data: AppData
  items: ServiceItem[]
  index: number
  state: PresentationState
  liveState: PresentationState | null
  outputConnected: boolean
  outputOpen: boolean
  onGo: (module: ModuleKey) => void
  onPreviewVerse: (verse: Verse) => void
  onLiveVerse: (verse: Verse) => void
  onAddVerse: (verse: Verse) => void
  onPreviewSong: (song: Song, section: number) => void
  onLiveSong: (song: Song, section: number) => void
  onSelectItem: (index: number) => void
  onLiveItem: (index: number) => void
  onLoadService: (items: ServiceItem[]) => void
  onPreviewMedia: (item: MediaItem) => void
  onLiveMedia: (item: MediaItem) => void
  onSetBackground: (path: string, type: 'image' | 'video') => void
  onImportMedia: () => void
  onGoLive: () => void
  onBlack: () => void
  onClear: () => void
  onLogo: () => void
}

function mediaUrl(path?: string) {
  if (!path) return ''
  if (/^(https?:|data:|blob:|verseflow-media:)/i.test(path)) return path
  return 'verseflow-media://local/' + encodeURIComponent(path)
}

function verseLabel(verse: Verse) {
  return verse.book + ' ' + verse.chapter + ':' + verse.verse
}

function readableVerse(verse: Verse) {
  return verse.translation.includes('STRONGS') ? cleanStrongMarkers(verse.text) : verse.text
}

function Slide({ value, placeholder = 'Select an item to preview', playVideo = false }: { value: PresentationState | null, placeholder?: string, playVideo?: boolean }) {
  const isSolid = !value?.backgroundType || value.backgroundType === 'solid'
  const hasImage = value?.backgroundType === 'image' && Boolean(value.background)
  const hasVideo = value?.backgroundType === 'video' && Boolean(value.background)
  const background = hasImage ? mediaUrl(value?.background) : ''
  const textColor = isSolid ? '#171717' : value?.theme.textColor === '#000000' ? '#ffffff' : (value?.theme.textColor || '#ffffff')
  const refColor = isSolid ? '#795826' : (value?.theme.accentColor || '#eac777')
  const size = Math.max(12, Math.min(29, (value?.theme.fontSize || 60) * 0.33))
  return <div className={'pd-slide ' + (isSolid ? 'pd-slide-solid' : 'pd-slide-dark')} style={{
    backgroundImage: background ? 'linear-gradient(rgba(0,0,0,' + (value?.theme.overlay || 0) + '),rgba(0,0,0,' + (value?.theme.overlay || 0) + ')),url("' + background + '")' : undefined
  }}>
    {hasVideo && (playVideo ? <video className="pd-slide-video" src={mediaUrl(value?.background)} muted autoPlay loop playsInline /> : <div className="pd-slide-video-poster"><Video size={25}/></div>)}
    {value?.black ? <span className="pd-slide-empty">BLACK SCREEN</span> :
      value?.logo ? <div className="pd-slide-logo">VERSEFLOW</div> :
      value?.youtubeId ? <div className="pd-slide-empty"><Video size={24}/> YouTube ready on audience output</div> :
      value?.layout === 'countdown' ? <div className="pd-slide-countdown">{value.timerLabel || 'Countdown'}<strong>{Math.max(0, Math.ceil(((value.timerEndAt || Date.now()) - Date.now()) / 1000))}s</strong></div> :
      value?.clearText ? <span className="pd-slide-empty">TEXT HIDDEN</span> :
      (value?.text || value?.reference) ? <div className="pd-slide-copy" style={{ fontFamily:value?.theme.fontFamily, color:textColor, textAlign:value?.theme.alignment || 'center' }}>
        <div className="pd-slide-verse" style={{ fontSize:size }}>{value.text}</div>
        {value.reference && <div className="pd-slide-ref" style={{color:refColor}}>{value.reference}</div>}
      </div> : <div className="pd-slide-empty">{placeholder}</div>}
  </div>
}

export default function PresenterDashboard(props: Props) {
  const { data, items, index, state } = props
  const [libraryTab, setLibraryTab] = useState<'bible' | 'songs' | 'service'>('bible')
  const [mediaTab, setMediaTab] = useState<'backgrounds' | 'media'>('backgrounds')
  const [reference, setReference] = useState('John 3:16')
  const [songQuery, setSongQuery] = useState('')
  const [translation, setTranslation] = useState(() => {
    const saved = String(data.settings.defaultTranslation || '')
    return data.translations.some(t => t.code === saved) ? saved :
      (data.translations.find(t => t.code === 'KJV')?.code || data.translations[0]?.code || 'KJV')
  })
  const [results, setResults] = useState<Verse[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null)
  const [selectedSong, setSelectedSong] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)

  useEffect(() => {
    if (!data.translations.some(t => t.code === translation) && data.translations.length) {
      setTranslation(data.translations[0].code)
    }
  }, [data.translations, translation])

  useEffect(() => {
    if (libraryTab !== 'bible') return
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        const query = reference.trim()
        let verses: Verse[] = []
        const range = query.match(/^(.+?)\s+(\d+):(\d+)-(\d+)$/)
        const exact = query.match(/^(.+?)\s+(\d+):(\d+)$/)
        if (range) {
          const first = await window.verseflow?.getBibleReference(range[1] + ' ' + range[2] + ':' + range[3], translation)
          if (first) {
            const chapter = await window.verseflow?.getBibleChapter(first.translation, first.book, first.chapter) || []
            const start = Number(range[3]), end = Number(range[4])
            if (end >= start && end - start < 80) verses = chapter.filter(v => v.verse >= start && v.verse <= end)
          }
        } else if (exact) {
          const first = await window.verseflow?.getBibleReference(query, translation)
          if (first) {
            const chapter = await window.verseflow?.getBibleChapter(first.translation, first.book, first.chapter) || []
            const at = chapter.findIndex(v => v.verse === first.verse)
            verses = at >= 0 ? chapter.slice(at, at + 8) : [first]
          }
        } else {
          verses = await window.verseflow?.searchBible(query, translation, 48) || []
        }
        if (!cancelled) setResults(verses)
      } catch (error) {
        if (!cancelled) {
          setResults([])
          setSearchError(error instanceof Error ? error.message : 'Bible lookup failed')
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 180)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [reference, translation, libraryTab])

  const songs = useMemo(() => data.songs.filter(s => (s.title + ' ' + (s.author || '')).toLowerCase().includes(songQuery.toLowerCase())).slice(0, 30), [data.songs, songQuery])
  const previewVerse = (v: Verse) => { setSelectedVerse(v.translation + '/' + verseLabel(v)); props.onPreviewVerse(v) }
  const previewSong = (song: Song, section: number) => { setSelectedSong(song.id + '/' + section); props.onPreviewSong(song, section) }
  const currentSlide = props.liveState || (state.mode === 'live' ? state : null)

  return <div className="pd-shell">
    <div className="pd-head">
      <div className="pd-product"><span className="pd-logo">V</span><div><strong>VERSEFLOW</strong><small>PRODUCTION DESK</small></div></div>
      <span className="pd-head-divider"/>
      <div className="pd-head-links">
        <button onClick={() => props.onGo('bible')}><BookOpen size={16}/> Bible</button>
        <button onClick={() => props.onGo('lyrics')}><Music2 size={16}/> Lyrics</button>
        <button onClick={() => props.onGo('media')}><Images size={16}/> Media</button>
        <button onClick={() => props.onGo('production')}><Settings2 size={16}/> Production</button>
      </div>
      <span className="pd-head-grow"/>
      <span className={'pd-display-status ' + (props.outputConnected ? 'is-online' : '')}><Circle size={9} fill="currentColor"/> {props.outputConnected ? 'AUDIENCE CONNECTED' : 'NO AUDIENCE DISPLAY'}</span>
      <button className="pd-primary" onClick={props.onGoLive}><Play size={14} fill="currentColor"/> GO LIVE</button>
    </div>

    <div className="pd-workspace">
      <aside className="pd-queue pd-pane">
        <div className="pd-pane-title"><span><FolderOpen size={15}/> PLAYLISTS</span><button title="Open service builder" onClick={() => props.onGo('playlists')}><Plus size={16}/></button></div>
        <div className="pd-playlists">
          <button className={'pd-playlist-row ' + (!selectedService ? 'selected' : '')} onClick={() => setSelectedService(null)}><ListMusic size={15}/><span>Current Service</span><b>{items.length}</b></button>
          {data.services.map(service => <button key={service.id} className={'pd-playlist-row ' + (selectedService === service.id ? 'selected' : '')} onClick={() => setSelectedService(service.id)}><FolderOpen size={15}/><span>{service.title}</span><b>{service.items.length}</b></button>)}
        </div>
        {selectedService && <div className="pd-load-service">
          <span>Saved playlist selected</span>
          <button onClick={() => { const service = data.services.find(s => s.id === selectedService); if (service) { props.onLoadService(service.items); setSelectedService(null) } }}>LOAD SERVICE</button>
        </div>}
        <div className="pd-pane-title pd-service-title"><span><ListMusic size={15}/> CURRENT SERVICE</span><small>{items.length} ITEMS</small></div>
        <div className="pd-service-list">
          {items.length === 0 ? <div className="pd-help">No items in this service yet. Add Bible verses or songs to create a playlist.</div> :
            items.map((item, at) => <div className={'pd-service-item ' + (at === index ? 'selected' : '')} key={item.id}>
              <button className="pd-service-select" onClick={() => props.onSelectItem(at)}><span className="pd-service-number">{at + 1}</span><span><strong>{item.title}</strong><small>{item.subtitle || item.type}</small></span></button>
              <button title={'Send ' + item.title + ' live'} onClick={() => props.onLiveItem(at)}><Play size={13}/></button>
            </div>)}
        </div>
        <div className="pd-queue-foot"><span>{data.verseCount.toLocaleString()} verses</span><span>{data.songs.length} songs</span></div>
      </aside>

      <section className="pd-editor pd-pane">
        <div className="pd-editor-tabs">
          <button className={libraryTab === 'bible' ? 'active' : ''} onClick={() => setLibraryTab('bible')}><BookOpen size={15}/> BIBLE</button>
          <button className={libraryTab === 'songs' ? 'active' : ''} onClick={() => setLibraryTab('songs')}><Music2 size={15}/> SONGS</button>
          <button className={libraryTab === 'service' ? 'active' : ''} onClick={() => setLibraryTab('service')}><ListMusic size={15}/> SERVICE</button>
          <span className="pd-editor-spacer"/>
          <button title="Open detailed editor" onClick={() => props.onGo(libraryTab === 'bible' ? 'bible' : libraryTab === 'songs' ? 'songs' : 'playlists')}><Maximize2 size={14}/></button>
        </div>
        {libraryTab === 'bible' && <div className="pd-filterbar">
          <label className="pd-ref-field"><Search size={14}/><input aria-label="Bible reference or keyword" value={reference} onChange={e => setReference(e.target.value)} placeholder="Search reference, e.g. Mark 1:25-26"/></label>
          <select aria-label="Bible translation" value={translation} onChange={e => setTranslation(e.target.value)}>{data.translations.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}</select>
        </div>}
        {libraryTab === 'songs' && <div className="pd-filterbar"><label className="pd-ref-field"><Search size={14}/><input aria-label="Search songs" value={songQuery} onChange={e => setSongQuery(e.target.value)} placeholder="Search your songs"/></label><button onClick={() => props.onGo('songs')}>MANAGE SONGS</button></div>}
        {libraryTab === 'service' && <div className="pd-filterbar pd-service-filter"><strong>Service slides</strong><button onClick={() => props.onGo('playlists')}>EDIT PLAYLIST <ChevronRight size={13}/></button></div>}
        <div className="pd-editor-body">
          <div className="pd-preview-header"><span><span className="pd-preview-dot"/> PREVIEW</span><strong>{state.reference || state.title || 'No slide selected'}</strong><button className="pd-live-button" onClick={props.onGoLive}><Play size={13} fill="currentColor"/> SEND LIVE</button></div>
          <div className="pd-preview-large"><Slide value={state} playVideo/></div>
          <div className="pd-slide-list-heading"><span>{libraryTab === 'bible' ? 'BIBLE SLIDES' : libraryTab === 'songs' ? 'SONG SECTIONS' : 'SERVICE SLIDES'}</span><small>{libraryTab === 'bible' ? results.length : libraryTab === 'songs' ? songs.length : items.length} ITEMS</small></div>
          <div className="pd-thumbnail-grid">
            {libraryTab === 'bible' && (searching ? <div className="pd-help">Loading Bible verses…</div> : searchError ? <div className="pd-help">{searchError}</div> : results.length === 0 ? <div className="pd-help">No verses found. Check the reference and translation.</div> :
              results.map(v => {
                const label = verseLabel(v)
                const selected = selectedVerse === v.translation + '/' + label || state.reference === label
                const mini = { ...state, title:label, text:readableVerse(v), reference:label, black:false,logo:false,clearText:false,youtubeId:undefined,layout:'center' as const }
                return <div className={'pd-thumbnail ' + (selected ? 'selected' : '')} key={v.translation + '-' + v.id}>
                  <button className="pd-thumb-surface" onClick={() => previewVerse(v)} title={'Preview ' + label}><Slide value={mini}/></button>
                  <div className="pd-thumb-footer"><span>{label}</span><button title="Add to service" onClick={() => props.onAddVerse(v)}><Plus size={13}/></button><button title={'Show ' + label + ' live'} onClick={() => props.onLiveVerse(v)}><Play size={13}/></button></div>
                </div>
              }))}
            {libraryTab === 'songs' && (songs.length === 0 ? <div className="pd-help">No songs found in your local library.</div> : songs.flatMap(song => song.sections.map((section, at) => {
              const active = selectedSong === song.id + '/' + at
              const mini = { ...state, title:song.title, text:section.lines.join('\n'), reference:section.label, black:false,logo:false,clearText:false,youtubeId:undefined,layout:'center' as const }
              return <div className={'pd-thumbnail ' + (active ? 'selected' : '')} key={song.id + '-' + section.id}>
                <button className="pd-thumb-surface" onClick={() => previewSong(song, at)} title={'Preview ' + song.title + ' ' + section.label}><Slide value={mini}/></button>
                <div className="pd-thumb-footer"><span>{song.title} · {section.label}</span><button title="Show lyrics live" onClick={() => props.onLiveSong(song, at)}><Play size={13}/></button></div>
              </div>
            })))}
            {libraryTab === 'service' && (items.length === 0 ? <div className="pd-help">Add Bible verses, songs, or media to start your service.</div> : items.map((item, at) => <div key={item.id} className={'pd-thumbnail ' + (index === at ? 'selected' : '')}>
              <button className="pd-thumb-surface" onClick={() => props.onSelectItem(at)}><Slide value={itemToPresentation(item, items[at + 1], state.theme, state.sequence)}/></button>
              <div className="pd-thumb-footer"><span>{at + 1}. {item.title}</span><button title="Send item live" onClick={() => props.onLiveItem(at)}><Play size={13}/></button></div>
            </div>))}
          </div>
        </div>
      </section>

      <aside className="pd-output pd-pane">
        <div className="pd-pane-title"><span><Monitor size={15}/> AUDIENCE</span><span className={'pd-live-indicator ' + (props.outputOpen ? 'connected' : '')}><Circle size={8} fill="currentColor"/>{props.outputOpen ? 'ON AIR' : 'OFFLINE'}</span></div>
        <div className="pd-output-video"><Slide value={currentSlide} playVideo placeholder={props.outputConnected ? 'Audience ready · send a slide LIVE' : 'Connect a display in Settings'}/></div>
        <div className="pd-output-caption"><strong>{currentSlide?.reference || currentSlide?.title || 'No live content'}</strong><small>{props.outputOpen ? 'Audience window is open' : 'Audience window is closed'}</small></div>
        <div className="pd-pane-title"><span><Zap size={15}/> LIVE CONTROLS</span></div>
        <div className="pd-quick-actions">
          <button className="pd-quick-go" onClick={props.onGoLive}><Play size={16} fill="currentColor"/> GO LIVE</button>
          <button className={state.black ? 'pressed' : ''} onClick={props.onBlack}><Square size={14} fill="currentColor"/> BLACK</button>
          <button className={state.clearText ? 'pressed' : ''} onClick={props.onClear}>Aa CLEAR</button>
          <button className={state.logo ? 'pressed' : ''} onClick={props.onLogo}>V LOGO</button>
        </div>
        <div className="pd-output-info"><span><Circle size={8} fill="currentColor"/> {props.outputConnected ? 'Display detected' : 'No display selected'}</span><button onClick={() => props.onGo('settings')}>SCREEN SETUP <ChevronRight size={13}/></button></div>
      </aside>
    </div>

    <section className="pd-media pd-pane">
      <div className="pd-media-head"><span className="pd-media-heading"><Images size={16}/> MEDIA LIBRARY</span><div className="pd-media-switch"><button className={mediaTab === 'backgrounds' ? 'active' : ''} onClick={() => setMediaTab('backgrounds')}>Backgrounds</button><button className={mediaTab === 'media' ? 'active' : ''} onClick={() => setMediaTab('media')}>Imported Media</button></div><span className="pd-media-fill"/><button onClick={props.onImportMedia}><Plus size={14}/> IMPORT</button><button onClick={() => props.onGo('media')}><Maximize2 size={14}/> LIBRARY</button></div>
      <div className="pd-media-tiles">
        {mediaTab === 'backgrounds' ? builtInBackgrounds.map(preset => <button className={'pd-media-tile ' + (state.background === preset.src ? 'selected' : '')} key={preset.id} onClick={() => props.onSetBackground(preset.src, 'image')} title={'Use ' + preset.name + ' as background'}><span className="pd-media-picture" style={{backgroundImage:'url("' + preset.src + '")'}}/><span className="pd-media-name">{preset.name}</span><small>{preset.category}</small></button>) :
          data.media.length === 0 ? <div className="pd-help">No local media imported. Use IMPORT to add photos, videos, or audio.</div> :
          data.media.map(media => <div className={'pd-media-tile ' + (selectedMedia === media.id ? 'selected' : '')} key={media.id}><button className="pd-media-select" onClick={() => { setSelectedMedia(media.id); props.onPreviewMedia(media) }} title={'Preview ' + media.name}><span className={'pd-media-picture pd-media-' + media.type}>{media.type === 'image' ? <img loading="lazy" alt="" src={mediaUrl(media.path)}/> : media.type === 'video' ? <Video size={26}/> : <Volume2 size={26}/>}</span><span className="pd-media-name">{media.name}</span></button><div className="pd-media-hover"><button onClick={() => media.type === 'audio' ? props.onLiveMedia(media) : props.onSetBackground(media.path, media.type)}>{media.type === 'audio' ? 'PLAY' : 'BG'}</button><button onClick={() => props.onLiveMedia(media)}>LIVE</button></div></div>)}
      </div>
    </section>
    <div className="pd-footer"><span><Circle size={7} fill="currentColor"/> OFFLINE BIBLE READY</span><span>Preview slides safely · LIVE sends content · BLACK, CLEAR and LOGO act immediately.</span><span>{data.media.length} media · {data.services.length} saved services</span></div>
  </div>
}
