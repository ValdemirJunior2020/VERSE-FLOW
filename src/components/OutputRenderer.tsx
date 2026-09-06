import { useEffect, useMemo, useRef, useState } from 'react'
import type { PresentationState, Theme } from '../types'
import { defaultTheme } from '../presentation'

const initial: PresentationState = {
  sequence: 0, mode: 'idle', title: '', text: '', reference: '', nextTitle: '',
  theme: defaultTheme, black: false, clearText: false, logo: false, frozen: false, backgroundType: 'solid', video: {playing:true,muted:false,volume:0.85,loop:true}
}

type PositionedTheme = Theme & { positionX?: number; positionY?: number }

function mediaUrl(path?: string) {
  if (!path) return ''
  if(path.startsWith('http://')||path.startsWith('https://')||path.startsWith('verseflow-media://')||path.startsWith('data:')||path.startsWith('blob:')) return path
  return `verseflow-media://local/${encodeURIComponent(path)}`
}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}

export default function OutputRenderer({ stage = false }: { stage?: boolean }) {
  const [state, setState] = useState<PresentationState>(initial)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
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

  const positionedTheme=state.theme as PositionedTheme
  const positionX=positionedTheme.positionX ?? 50
  const positionY=positionedTheme.positionY ?? 50

  const moveText=(clientX:number,clientY:number)=>{
    const rect=outputRef.current?.getBoundingClientRect()
    if(!rect)return
    const nextTheme={...state.theme,positionX:clamp(((clientX-rect.left)/rect.width)*100,2,98),positionY:clamp(((clientY-rect.top)/rect.height)*100,3,97)} as PositionedTheme
    const next={...state,theme:nextTheme,sequence:state.sequence+1}
    setState(next)
    window.verseflow?.sendPresentationState(next)
  }

  const onPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(state.clearText||state.layout==='countdown')return
    dragRef.current=true
    e.currentTarget.setPointerCapture(e.pointerId)
    moveText(e.clientX,e.clientY)
  }
  const onPointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(dragRef.current)moveText(e.clientX,e.clientY)}
  const onPointerUp=(e:React.PointerEvent<HTMLDivElement>)=>{dragRef.current=false;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}

  const bg = useMemo(() => mediaUrl(state.background), [state.background])
  const align = state.theme.alignment || 'center'
  const audioNode=state.audio?.path?<audio ref={audioRef} src={mediaUrl(state.audio.path)} autoPlay />:null
  const solidOutput=state.backgroundType==='solid' || !state.backgroundType
  const outputTextColor=solidOutput?'#000000':state.theme.textColor
  const outputReferenceColor=solidOutput?'#000000':state.theme.accentColor

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

  return <div ref={outputRef} className="audience-output" data-no-translate="true" style={{
    backgroundImage: state.backgroundType === 'image' && bg ? `linear-gradient(rgba(0,0,0,${state.theme.overlay}),rgba(0,0,0,${state.theme.overlay})), url("${bg}")` : undefined,
    backgroundColor: state.backgroundType === 'solid' ? '#f7f0e4' : '#080808',
    position:'relative'
  }}>
    {audioNode}
    {state.backgroundType === 'video' && bg && <video ref={videoRef} className="audience-video" src={bg} autoPlay loop muted />}
    <div
      className={`audience-copy align-${align} layout-${state.layout||'center'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={()=>{dragRef.current=false}}
      title="Drag to reposition Bible verses or lyrics"
      style={{fontFamily: state.theme.fontFamily, color: outputTextColor,position:'absolute',left:`${positionX}%`,top:`${positionY}%`,transform:'translate(-50%,-50%)',width:'92%',cursor:state.layout==='countdown'?'default':'grab',touchAction:'none',userSelect:'none'}}>
      {state.layout==='countdown' ? <div className="audience-countdown"><span>{state.timerLabel||'Service starts in'}</span><strong>{(()=>{const sec=Math.max(0,Math.ceil(((state.timerEndAt||Date.now())-now.getTime())/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`})()}</strong></div> : <>
        {!state.clearText && <div className="audience-text" style={{fontSize: `${state.theme.fontSize}px`}}>{state.text}</div>}
        {!state.clearText && state.reference && <div className="audience-reference" style={{color: outputReferenceColor}}>{state.reference}</div>}
      </>}
    </div>
  </div>
}
