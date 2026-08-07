import { useEffect, useMemo, useRef, useState } from 'react'
import type { PresentationState } from '../types'
import { defaultTheme } from '../presentation'

const initial: PresentationState = {
  sequence: 0, mode: 'idle', title: '', text: '', reference: '', nextTitle: '',
  theme: defaultTheme, black: false, clearText: false, logo: false, frozen: false, backgroundType: 'solid', video: {playing:true,muted:true,volume:0.8,loop:true}
}

function mediaUrl(path?: string) {
  if (!path) return ''
  return path.startsWith('file://') ? path : `file:///${path.replace(/\\/g, '/')}`
}

export default function OutputRenderer({ stage = false }: { stage?: boolean }) {
  const [state, setState] = useState<PresentationState>(initial)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    window.verseflow?.getPresentationState().then(s => s && setState(s))
    return window.verseflow?.onPresentationState(s => {
      if (!s.frozen) setState(s)
    })
  }, [])

  useEffect(() => {
    if (!stage) return
    const t=setInterval(()=>setNow(new Date()),1000)
    return()=>clearInterval(t)
  }, [stage])

  useEffect(() => {
    const v=videoRef.current, c=state.video
    if(!v||!c)return
    v.muted=c.muted; v.volume=Math.max(0,Math.min(1,c.volume)); v.loop=c.loop
    if(c.seekDelta && c.commandId) { try { v.currentTime=Math.max(0,v.currentTime+c.seekDelta) } catch {} }
    if(c.playing) v.play().catch(()=>{}); else v.pause()
  }, [state.video?.playing,state.video?.muted,state.video?.volume,state.video?.loop,state.video?.commandId])

  const bg = useMemo(() => mediaUrl(state.background), [state.background])
  const align = state.theme.alignment || 'center'

  if (stage) {
    return <div className="stage-output">
      <div className="stage-clock">{now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
      <div className="stage-label">CURRENT</div>
      <div className="stage-current">{state.reference || state.title || 'Ready'}</div>
      <div className="stage-text">{state.clearText ? '' : state.text}</div>
      <div className="stage-next"><span>NEXT</span>{state.nextTitle || '—'}</div>
      {state.notes && <div className="stage-notes">{state.notes}</div>}
    </div>
  }

  if (state.black) return <div className="audience-output black-screen" />
  if (state.youtubeId) {
    const autoplay = state.youtubeAutoplay ? 1 : 0
    return <div className="audience-output youtube-output">
      <iframe
        className="audience-youtube"
        src={`https://www.youtube-nocookie.com/embed/${state.youtubeId}?autoplay=${autoplay}&rel=0&controls=1&modestbranding=1`}
        title="VerseFlow YouTube"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  }

  if (state.logo) return <div className="audience-output logo-screen"><div className="vf-logo-mark">VF</div><div>VERSEFLOW</div></div>

  return <div className="audience-output" style={{
    backgroundImage: state.backgroundType === 'image' && bg ? `linear-gradient(rgba(0,0,0,${state.theme.overlay}),rgba(0,0,0,${state.theme.overlay})), url("${bg}")` : undefined,
    backgroundColor: '#080808'
  }}>
    {state.backgroundType === 'video' && bg && <video ref={videoRef} className="audience-video" src={bg} autoPlay loop muted />}
    <div className={`audience-copy align-${align}`} style={{fontFamily: state.theme.fontFamily, color: state.theme.textColor}}>
      {!state.clearText && <div className="audience-text" style={{fontSize: `${state.theme.fontSize}px`}}>{state.text}</div>}
      {!state.clearText && state.reference && <div className="audience-reference" style={{color: state.theme.accentColor}}>{state.reference}</div>}
    </div>
  </div>
}
