import { useEffect, useMemo, useRef, useState } from 'react'
import type { PresentationState } from '../types'
import { defaultTheme } from '../presentation'

const initial: PresentationState = {
  sequence: 0, mode: 'idle', title: '', text: '', reference: '', nextTitle: '',
  theme: defaultTheme, black: false, clearText: false, logo: false, frozen: false, backgroundType: 'solid', video: {playing:true,muted:true,volume:0.8,loop:true}
}

function mediaUrl(path?: string) {
  if (!path) return ''
  if(path.startsWith('http://')||path.startsWith('https://')||path.startsWith('verseflow-media://')||path.startsWith('data:')||path.startsWith('blob:')) return path
  return `verseflow-media://local/${encodeURIComponent(path)}`
}

export default function OutputRenderer({ stage = false }: { stage?: boolean }) {
  const [state, setState] = useState<PresentationState>(initial)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    window.verseflow?.getPresentationState().then(s => s && setState(s))
    return window.verseflow?.onPresentationState(s => {
      if (!s.frozen) setState(s)
    })
  }, [])

  useEffect(() => {
    if (!stage && state.layout!=='countdown') return
    const t=setInterval(()=>setNow(new Date()),500)
    return()=>clearInterval(t)
  }, [stage,state.layout,state.timerEndAt])

  useEffect(() => {
    const v=videoRef.current, c=state.video
    if(!v||!c)return
    v.muted=c.muted; v.volume=Math.max(0,Math.min(1,c.volume)); v.loop=c.loop
    if(c.seekDelta && c.commandId) { try { v.currentTime=Math.max(0,v.currentTime+c.seekDelta) } catch {} }
    if(c.playing) v.play().catch(()=>{}); else v.pause()
  }, [state.video?.playing,state.video?.muted,state.video?.volume,state.video?.loop,state.video?.commandId])

  useEffect(() => {
    const a=audioRef.current,c=state.audio
    if(!a||!c)return
    a.volume=Math.max(0,Math.min(1,c.volume));a.loop=c.loop
    if(c.playing)a.play().catch(()=>{});else a.pause()
  },[state.audio?.path,state.audio?.playing,state.audio?.volume,state.audio?.loop])

  const bg = useMemo(() => mediaUrl(state.background), [state.background])
  const align = state.theme.alignment || 'center'
  const audioNode=state.audio?.path?<audio ref={audioRef} src={mediaUrl(state.audio.path)} autoPlay />:null

  if (stage) {
    return <div className="stage-output" data-no-translate="true">
      <div className="stage-clock">{now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
      <div className="stage-label">CURRENT</div>
      <div className="stage-current">{state.reference || state.title || 'Ready'}</div>
      <div className="stage-text">{state.layout==='countdown'?`${state.timerLabel||'Service starts in'} ${(()=>{const sec=Math.max(0,Math.ceil(((state.timerEndAt||Date.now())-now.getTime())/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`})()}`:(state.clearText?'':state.text)}</div>
      <div className="stage-next"><span>NEXT</span>{state.nextTitle || '—'}</div>
      {state.notes && <div className="stage-notes">{state.notes}</div>}
    </div>
  }

  if (state.black) return <div className="audience-output black-screen" data-no-translate="true">{audioNode}</div>
  if (state.youtubeId) {
    const autoplay = state.youtubeAutoplay ? 1 : 0
    return <div className="audience-output youtube-output" data-no-translate="true">
      <iframe
        className="audience-youtube"
        src={`https://www.youtube-nocookie.com/embed/${state.youtubeId}?autoplay=${autoplay}&rel=0&controls=1&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}&widget_referrer=${encodeURIComponent(window.location.href)}`}
        title="VerseFlow YouTube"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  }

  if (state.logo) return <div className="audience-output logo-screen" data-no-translate="true">{audioNode}<div className="vf-logo-mark">VF</div><div>VERSEFLOW</div></div>

  return <div className="audience-output" data-no-translate="true" style={{
    backgroundImage: state.backgroundType === 'image' && bg ? `linear-gradient(rgba(0,0,0,${state.theme.overlay}),rgba(0,0,0,${state.theme.overlay})), url("${bg}")` : undefined,
    backgroundColor: state.backgroundType === 'solid' ? '#f7f0e4' : '#080808'
  }}>
    {audioNode}
    {state.backgroundType === 'video' && bg && <video ref={videoRef} className="audience-video" src={bg} autoPlay loop muted />}
    <div className={`audience-copy align-${align} layout-${state.layout||'center'}`} style={{fontFamily: state.theme.fontFamily, color: state.theme.textColor}}>
      {state.layout==='countdown' ? <div className="audience-countdown"><span>{state.timerLabel||'Service starts in'}</span><strong>{(()=>{const sec=Math.max(0,Math.ceil(((state.timerEndAt||Date.now())-now.getTime())/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`})()}</strong></div> : <>
        {!state.clearText && <div className="audience-text" style={{fontSize: `${state.theme.fontSize}px`}}>{state.text}</div>}
        {!state.clearText && state.reference && <div className="audience-reference" style={{color: state.theme.accentColor}}>{state.reference}</div>}
      </>}
    </div>
  </div>
}
