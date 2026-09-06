import { useEffect, useRef, useState } from 'react'
import type { PresentationState, Theme, Verse } from '../types'
import { cleanStrongMarkers } from '../presentation'

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

type PositionedTheme = Theme & { positionX?: number; positionY?: number }

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}

export default function CanvasPreview({ state, live }: { state: PresentationState; live: boolean }) {
  const [,setTick]=useState(0)
  const [localState,setLocalState]=useState<PresentationState|null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const shown=localState||state
  const positionedTheme=shown.theme as PositionedTheme
  const positionX=positionedTheme.positionX ?? 50
  const positionY=positionedTheme.positionY ?? 50

  useEffect(()=>{setLocalState(null)},[state.sequence])
  useEffect(()=>{if(shown.layout!=='countdown')return;const t=setInterval(()=>setTick(x=>x+1),500);return()=>clearInterval(t)},[shown.layout,shown.timerEndAt])
  useEffect(() => {
    const v=videoRef.current, c=shown.video
    if(!v||!c)return
    v.muted=Boolean(c.muted)
    v.volume=Math.max(0,Math.min(1,c.volume ?? 0.85))
    v.loop=Boolean(c.loop)
    if(c.seekDelta && c.commandId) { try { v.currentTime=Math.max(0,v.currentTime+c.seekDelta) } catch {} }
    if(c.playing===false) v.pause(); else v.play().catch(()=>{})
  }, [shown.video?.playing,shown.video?.muted,shown.video?.volume,shown.video?.loop,shown.video?.commandId])

  const sendPosition=(x:number,y:number)=>{
    const nextTheme={...shown.theme,positionX:clamp(x,2,98),positionY:clamp(y,3,97)} as PositionedTheme
    // Keep the same theme object data available to the parent so the position
    // survives when the operator advances to another Bible verse or lyric slide.
    Object.assign(state.theme,nextTheme)
    const next={...shown,theme:nextTheme,sequence:shown.sequence+1}
    setLocalState(next)
    if(live||shown.mode==='live')window.verseflow?.sendPresentationState(next)
  }

  const pointerPosition=(clientX:number,clientY:number)=>{
    const rect=canvasRef.current?.getBoundingClientRect()
    if(!rect)return
    sendPosition(((clientX-rect.left)/rect.width)*100,((clientY-rect.top)/rect.height)*100)
  }

  const onPointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(shown.black||shown.logo||shown.clearText||shown.layout==='countdown')return
    dragRef.current=true
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerPosition(e.clientX,e.clientY)
  }
  const onPointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{if(dragRef.current)pointerPosition(e.clientX,e.clientY)}
  const onPointerUp=(e:React.PointerEvent<HTMLDivElement>)=>{dragRef.current=false;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}

  const translationFromItem=()=>{
    const id=shown.itemId||''
    if(!id.startsWith('verse-'))return undefined
    return id.slice(6).split('-')[0]||undefined
  }
  const isBible=Boolean(shown.itemId?.startsWith('verse-')||/^.+\s+\d+:\d+$/.test(shown.reference||''))

  const showVerseLive=(verse:Verse)=>{
    const text=verse.translation.includes('STRONGS')?cleanStrongMarkers(verse.text):verse.text
    const ref=`${verse.book} ${verse.chapter}:${verse.verse}`
    const next:PresentationState={...shown,itemId:`verse-${verse.translation}-${verse.book}-${verse.chapter}-${verse.verse}`,mode:'live',title:ref,text,reference:ref,black:false,logo:false,clearText:false,sequence:shown.sequence+1}
    Object.assign(state,{itemId:next.itemId,title:next.title,text:next.text,reference:next.reference,mode:'live'})
    setLocalState(next)
    window.verseflow?.sendPresentationState(next)
  }

  const moveBible=async(kind:'prevVerse'|'nextVerse'|'prevChapter'|'nextChapter')=>{
    if(!window.verseflow||!shown.reference)return
    const translation=translationFromItem()
    const current=await window.verseflow.getBibleReference(shown.reference,translation)
    if(!current)return
    const chapters=await window.verseflow.getBibleChapters(current.translation,current.book)
    const currentChapterIndex=chapters.indexOf(current.chapter)
    const chapterVerses=await window.verseflow.getBibleChapter(current.translation,current.book,current.chapter)
    const verseIndex=chapterVerses.findIndex(v=>v.verse===current.verse)
    let target:Verse|undefined

    if(kind==='prevVerse'){
      target=chapterVerses[Math.max(0,verseIndex-1)]
      if(verseIndex<=0&&currentChapterIndex>0){
        const prior=await window.verseflow.getBibleChapter(current.translation,current.book,chapters[currentChapterIndex-1])
        target=prior[prior.length-1]
      }
    }
    if(kind==='nextVerse'){
      target=chapterVerses[Math.min(chapterVerses.length-1,verseIndex+1)]
      if(verseIndex>=chapterVerses.length-1&&currentChapterIndex>=0&&currentChapterIndex<chapters.length-1){
        const next=await window.verseflow.getBibleChapter(current.translation,current.book,chapters[currentChapterIndex+1])
        target=next[0]
      }
    }
    if(kind==='prevChapter'&&currentChapterIndex>0){
      const prior=await window.verseflow.getBibleChapter(current.translation,current.book,chapters[currentChapterIndex-1])
      target=prior.find(v=>v.verse===current.verse)||prior[Math.min(prior.length-1,Math.max(0,verseIndex))]||prior[0]
    }
    if(kind==='nextChapter'&&currentChapterIndex>=0&&currentChapterIndex<chapters.length-1){
      const next=await window.verseflow.getBibleChapter(current.translation,current.book,chapters[currentChapterIndex+1])
      target=next.find(v=>v.verse===current.verse)||next[Math.min(next.length-1,Math.max(0,verseIndex))]||next[0]
    }
    if(target)showVerseLive(target)
  }

  const isImg = shown.backgroundType === 'image' && shown.background
  return <div className="canvas-wrap">
    <div className="canvas-status"><span className={live ? 'live-dot' : 'preview-dot'} /> {live ? 'LIVE' : 'PREVIEW'}</div>
    {isBible&&<div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'0 0 8px'}}>
      <button onClick={()=>void moveBible('prevChapter')}>◀ CHAPTER</button>
      <button onClick={()=>void moveBible('prevVerse')}>◀ VERSE</button>
      <button className="gold" onClick={()=>void moveBible('nextVerse')}>VERSE ▶</button>
      <button onClick={()=>void moveBible('nextChapter')}>CHAPTER ▶</button>
      <span style={{alignSelf:'center',fontSize:11,opacity:.7}}>Changes go straight to the live TVs.</span>
    </div>}
    <div ref={canvasRef} className="presentation-canvas" data-no-translate="true" style={{
      backgroundImage: isImg ? `linear-gradient(rgba(0,0,0,${shown.theme.overlay}),rgba(0,0,0,${shown.theme.overlay})),url("${fileUrl(shown.background)}")` : undefined,
      position:'relative'
    }}>
      {shown.backgroundType === 'video' && shown.background && <video ref={videoRef} src={fileUrl(shown.background)} autoPlay loop muted={Boolean(shown.video?.muted ?? false)} />}
      {shown.audio?.path && <div className="preview-audio-badge">♫ {shown.audio.playing?'AUDIO PLAYING':'AUDIO READY'} · {shown.title||'Local audio'}</div>}
      <div
        className={`canvas-copy align-${shown.theme.alignment} layout-${shown.layout||'center'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={()=>{dragRef.current=false}}
        title="Drag the verse or lyrics anywhere on the TV wall"
        style={{fontFamily:shown.theme.fontFamily,color:shown.theme.textColor,textShadow:shown.background?'0 3px 14px rgba(0,0,0,.72)':'none',position:'absolute',left:`${positionX}%`,top:`${positionY}%`,transform:'translate(-50%,-50%)',cursor:'grab',touchAction:'none',userSelect:'none',width:'92%'}}>
        {shown.black ? <div className="screen-mode-label">BLACK SCREEN</div> : shown.logo ? <div className="vf-logo-mark large">VF</div> : shown.layout==='countdown' ? <div className="countdown-copy"><span>{shown.timerLabel||'Service starts in'}</span><strong>{formatRemaining(shown.timerEndAt)}</strong></div> : <>
          {!shown.clearText && <div className="canvas-text" style={{fontSize:`${Math.max(22,shown.theme.fontSize*.43)}px`}}>{shown.text || 'Select a scripture, song, image, or announcement.'}</div>}
          {!shown.clearText && <div className="canvas-ref" style={{color:shown.theme.accentColor}}>{shown.reference}</div>}
        </>}
      </div>
    </div>
    {!shown.black&&!shown.logo&&!shown.clearText&&shown.layout!=='countdown'&&<div style={{fontSize:11,opacity:.72,marginTop:7}}>Click and drag the text in this preview to place it anywhere across your TV wall.</div>}
  </div>
}
