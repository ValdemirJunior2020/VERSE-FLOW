import { useEffect, useState } from 'react'
import type { PresentationState } from '../types'

function fileUrl(path?: string) {
  if (!path) return ''
  if(path.startsWith('http://')||path.startsWith('https://')||path.startsWith('verseflow-media://')||path.startsWith('data:')||path.startsWith('blob:')) return path
  return `verseflow-media://local/${encodeURIComponent(path)}`
}

function formatRemaining(end?:number){
  if(!end)return '00:00'
  const sec=Math.max(0,Math.ceil((end-Date.now())/1000))
  const m=Math.floor(sec/60),s=sec%60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function CanvasPreview({ state, live }: { state: PresentationState; live: boolean }) {
  const [,setTick]=useState(0)
  useEffect(()=>{if(state.layout!=='countdown')return;const t=setInterval(()=>setTick(x=>x+1),500);return()=>clearInterval(t)},[state.layout,state.timerEndAt])
  const isImg = state.backgroundType === 'image' && state.background
  return <div className="canvas-wrap">
    <div className="canvas-status"><span className={live ? 'live-dot' : 'preview-dot'} /> {live ? 'LIVE' : 'PREVIEW'}</div>
    <div className="presentation-canvas" data-no-translate="true" style={{
      backgroundImage: isImg ? `linear-gradient(rgba(0,0,0,${state.theme.overlay}),rgba(0,0,0,${state.theme.overlay})),url("${fileUrl(state.background)}")` : undefined
    }}>
      {state.backgroundType === 'video' && state.background && <video src={fileUrl(state.background)} autoPlay loop muted />}
      {state.audio?.path && <div className="preview-audio-badge">♫ {state.audio.playing?'AUDIO PLAYING':'AUDIO READY'} · {state.title||'Local audio'}</div>}
      <div className={`canvas-copy align-${state.theme.alignment} layout-${state.layout||'center'}`} style={{fontFamily:state.theme.fontFamily,color:state.theme.textColor,textShadow:state.background?'0 3px 14px rgba(0,0,0,.72)':'none'}}>
        {state.black ? <div className="screen-mode-label">BLACK SCREEN</div> : state.logo ? <div className="vf-logo-mark large">VF</div> : state.layout==='countdown' ? <div className="countdown-copy"><span>{state.timerLabel||'Service starts in'}</span><strong>{formatRemaining(state.timerEndAt)}</strong></div> : <>
          {!state.clearText && <div className="canvas-text" style={{fontSize:`${Math.max(22,state.theme.fontSize*.43)}px`}}>{state.text || 'Select a scripture, song, image, or announcement.'}</div>}
          {!state.clearText && <div className="canvas-ref" style={{color:state.theme.accentColor}}>{state.reference}</div>}
        </>}
      </div>
    </div>
  </div>
}
