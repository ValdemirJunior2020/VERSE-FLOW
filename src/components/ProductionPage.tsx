import { useEffect, useMemo, useState } from 'react'
import { Activity, Captions, Clapperboard, Copy, Cpu, Film, MonitorUp, Radio, RefreshCw, Video, WandSparkles } from 'lucide-react'
import type { DisplayInfo, MediaItem, ToolStatus } from '../types'

export default function ProductionPage({
  media,displays,onCompatibleAdded,onCaption,onAutoScripture
}:{
  media:MediaItem[]
  displays:DisplayInfo[]
  onCompatibleAdded:(item:MediaItem)=>Promise<void>
  onCaption:(text:string,live:boolean)=>void
  onAutoScripture:(text:string)=>void
}) {
  const [tools,setTools]=useState<ToolStatus|null>(null)
  const [selectedPath,setSelectedPath]=useState('')
  const [screenIndex,setScreenIndex]=useState(0)
  const [probe,setProbe]=useState('')
  const [caption,setCaption]=useState('')
  const [captionLang,setCaptionLang]=useState('auto')
  const [captioning,setCaptioning]=useState(false)
  const [autoFollow,setAutoFollow]=useState(false)
  const [obsHost,setObsHost]=useState('127.0.0.1')
  const [obsPort,setObsPort]=useState(4455)
  const [obsPassword,setObsPassword]=useState('')
  const [obsConnected,setObsConnected]=useState(false)
  const [scenes,setScenes]=useState<string[]>([])
  const [scene,setScene]=useState('')
  const [message,setMessage]=useState('')

  const localMedia=useMemo(()=>media.filter(m=>m.path),[media])
  const refresh=async()=>setTools(await window.verseflow?.toolStatus()||null)

  useEffect(()=>{refresh()},[])
  useEffect(()=>window.verseflow?.onWhisperCaption(text=>{
    setCaption(text)
    if(autoFollow) onAutoScripture(text)
  }),[autoFollow,onAutoScripture])

  const pickDefault=()=>selectedPath||localMedia.find(m=>m.type==='video')?.path||localMedia[0]?.path||''
  const result=async(p:Promise<{ok:boolean;error?:string}>|undefined,okText:string)=>{
    const r=await p
    setMessage(r?.ok?okText:r?.error||'Action failed')
    return r
  }

  const connectObs=async()=>{
    const r=await window.verseflow?.obsConnect(obsHost,obsPort,obsPassword)
    if(r?.ok){
      setObsConnected(true);setScenes(r.scenes||[]);setScene(r.currentScene||r.scenes?.[0]||'');setMessage('OBS connected')
    }else{setObsConnected(false);setMessage(r?.error||'OBS connection failed')}
  }

  return <div className="page production-page">
    <div className="page-heading">
      <div><span className="eyebrow">OPEN SOURCE CONTROL CENTER</span><h1>Production Control</h1></div>
      <div className="inline">
        <button onClick={refresh}><RefreshCw size={15}/> Refresh Status</button>
        <button className="gold" onClick={()=>window.verseflow?.openOptionalToolsInstaller()}>Install / Update Open Source Tools</button>
      </div>
    </div>

    <div className="production-status-strip">
      {[
        ['mpv',tools?.mpvInstalled],['FFmpeg',tools?.ffmpegInstalled],['Whisper',tools?.whisperInstalled&&tools?.whisperModelInstalled],
        ['OBS',tools?.obsInstalled],['Ollama',tools?.ollamaInstalled],['yt-dlp',tools?.ytDlpInstalled],
        ['HyperFrames',tools?.hyperframesInstalled],['Companion',tools?.companionInstalled],['Deno',tools?.denoInstalled]
      ].map(([name,ok])=><div key={String(name)} className={ok?'ok':'off'}><i/>{name}<span>{ok?'Ready':'Optional'}</span></div>)}
    </div>

    <div className="production-grid">
      <section className="production-card">
        <div className="prod-title"><Film/><div><h3>Professional Media Player</h3><p>mpv JSON IPC for difficult local videos and audio.</p></div></div>
        <label>Media<select value={selectedPath} onChange={e=>setSelectedPath(e.target.value)}><option value="">Choose local media…</option>{localMedia.map(m=><option key={m.id} value={m.path}>{m.name}</option>)}</select></label>
        <label>Display<select value={screenIndex} onChange={e=>setScreenIndex(+e.target.value)}>{displays.map(d=><option key={d.id} value={d.index}>{d.label}</option>)}</select></label>
        <div className="prod-actions">
          <button className="gold" onClick={()=>result(window.verseflow?.mpvLaunch(pickDefault(),screenIndex),'mpv opened fullscreen')}>Launch Fullscreen</button>
          <button onClick={()=>result(window.verseflow?.mpvCommand('pause'),'mpv pause/resume sent')}>Pause / Resume</button>
          <button onClick={()=>result(window.verseflow?.mpvCommand('seekBack'),'-10 seconds')}>-10s</button>
          <button onClick={()=>result(window.verseflow?.mpvCommand('seekForward'),'+10 seconds')}>+10s</button>
          <button onClick={()=>result(window.verseflow?.mpvCommand('stop'),'mpv stopped')}>Stop</button>
        </div>
      </section>

      <section className="production-card">
        <div className="prod-title"><Clapperboard/><div><h3>FFmpeg Media Doctor</h3><p>Inspect or convert media to church-friendly H.264/AAC MP4.</p></div></div>
        <div className="prod-actions">
          <button onClick={async()=>{const r=await window.verseflow?.ffmpegProbe(pickDefault());setProbe(r?.ok?r.summary||'OK':r?.error||'Probe failed')}}>Probe Media</button>
          <button className="gold" onClick={async()=>{const r=await window.verseflow?.ffmpegCompatible(pickDefault());if(r?.ok&&r.item){await onCompatibleAdded(r.item);setMessage('Compatible copy added to Media')}else setMessage(r?.error||'Conversion failed')}}>Make Compatible Copy</button>
        </div>
        {probe&&<pre className="probe-result">{probe}</pre>}
      </section>

      <section className="production-card">
        <div className="prod-title"><Captions/><div><h3>Live Captions</h3><p>whisper.cpp listens locally to the default microphone.</p></div></div>
        <label>Language<select value={captionLang} onChange={e=>setCaptionLang(e.target.value)}><option value="auto">Auto</option><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option></select></label>
        <label className="toggle-line"><input type="checkbox" checked={autoFollow} onChange={e=>setAutoFollow(e.target.checked)}/> Auto Scripture Follow</label>
        <div className="prod-actions">
          <button className="gold" disabled={captioning} onClick={async()=>{const r=await window.verseflow?.whisperStart(captionLang);setCaptioning(Boolean(r?.ok));setMessage(r?.ok?'Captions started':r?.error||'Could not start captions')}}>Start Captions</button>
          <button disabled={!captioning} onClick={async()=>{await window.verseflow?.whisperStop();setCaptioning(false);setMessage('Captions stopped')}}>Stop Captions</button>
        </div>
        <div className="caption-box">{caption||'Live microphone transcription will appear here.'}</div>
        <div className="prod-actions">
          <button disabled={!caption} onClick={()=>onCaption(caption,false)}>Preview Caption</button>
          <button className="gold" disabled={!caption} onClick={()=>onCaption(caption,true)}>Live Caption</button>
        </div>
      </section>

      <section className="production-card">
        <div className="prod-title"><Radio/><div><h3>OBS Studio Control</h3><p>Uses the WebSocket server built into modern OBS Studio.</p></div></div>
        <div className="obs-connect-row"><input value={obsHost} onChange={e=>setObsHost(e.target.value)} placeholder="127.0.0.1"/><input type="number" value={obsPort} onChange={e=>setObsPort(+e.target.value)}/><input type="password" value={obsPassword} onChange={e=>setObsPassword(e.target.value)} placeholder="OBS WebSocket password"/></div>
        <div className="prod-actions"><button onClick={()=>result(window.verseflow?.obsOpen(),'OBS opened')}>Open OBS</button><button className="gold" onClick={connectObs}>Connect OBS</button></div>
        <label>Scene<select value={scene} onChange={e=>setScene(e.target.value)}>{scenes.map(s=><option key={s}>{s}</option>)}</select></label>
        <div className="prod-actions">
          <button disabled={!obsConnected||!scene} onClick={()=>result(window.verseflow?.obsSetScene(scene),'OBS scene changed')}>Set Scene</button>
          <button disabled={!obsConnected} onClick={()=>result(window.verseflow?.obsControl('startRecord'),'OBS recording started')}>Start Recording</button>
          <button disabled={!obsConnected} onClick={()=>result(window.verseflow?.obsControl('stopRecord'),'OBS recording stopped')}>Stop Recording</button>
          <button disabled={!obsConnected} onClick={()=>result(window.verseflow?.obsControl('startStream'),'OBS stream started')}>Start Stream</button>
          <button disabled={!obsConnected} onClick={()=>result(window.verseflow?.obsControl('stopStream'),'OBS stream stopped')}>Stop Stream</button>
        </div>
      </section>

      <section className="production-card">
        <div className="prod-title"><WandSparkles/><div><h3>Motion Studio</h3><p>HyperFrames + FFmpeg for cinematic countdowns, intros and announcement videos.</p></div></div>
        <div className="prod-actions">
          <button className="gold" onClick={async()=>{const r=await window.verseflow?.hyperframesStudio();setMessage(r?.ok?'Motion Studio opened':r?.error||'Could not open Motion Studio')}}>Open Motion Studio</button>
          <button onClick={async()=>{const r=await window.verseflow?.hyperframesRender();if(r?.ok&&r.path){const name=r.path.split(/[\\/]/).pop()||'VerseFlow Motion.mp4';await onCompatibleAdded({id:`motion-${Date.now()}`,name,path:r.path,type:'video'});setMessage(`Rendered and added to Media: ${name}`)}else setMessage(r?.error||'Render failed')}}>Render Motion</button>
        </div>
      </section>

      <section className="production-card">
        <div className="prod-title"><MonitorUp/><div><h3>Companion / Stream Deck</h3><p>VerseFlow exposes local HTTP actions for Bitfocus Companion buttons.</p></div></div>
        <code>{tools?.companionApi||'http://127.0.0.1:35677'}</code>
        <div className="companion-links">
          {['black','clear','logo','empty','live','next','previous'].map(a=><button key={a} onClick={()=>window.verseflow?.copyText(`${tools?.companionApi||'http://127.0.0.1:35677'}/${a}`)}><Copy size={13}/> {a}</button>)}
        </div>
        <div className="prod-actions">
          <button className="gold" onClick={()=>window.verseflow?.companionOpen()}>Open Companion</button>
          <button onClick={()=>window.verseflow?.copyText(tools?.companionApi||'http://127.0.0.1:35677')}>Copy API URL</button>
        </div>
      </section>

      <section className="production-card">
        <div className="prod-title"><Cpu/><div><h3>Smart Presenter AI</h3><p>Ollama qwen3:0.6b remains optional and local. Scripture is never rewritten.</p></div></div>
        <div className="tool-detail-list">
          <span><i className={tools?.ollamaRunning?'good':''}/> Ollama {tools?.ollamaRunning?'running':'offline'}</span>
          <span><i className={tools?.modelInstalled?'good':''}/> {tools?.model||'qwen3:0.6b'}</span>
          <span><i className={tools?.ytDlpInstalled?'good':''}/> yt-dlp {tools?.ytDlpInstalled?'ready':'optional'}</span>
          <span><i className={tools?.denoInstalled?'good':''}/> Deno {tools?.denoInstalled?'ready for yt-dlp':'optional'}</span>
        </div>
      </section>

      <section className="production-card">
        <div className="prod-title"><Activity/><div><h3>Production Message</h3><p>Latest action or integration response.</p></div></div>
        <div className="production-message">{message||'VerseFlow production systems are standing by.'}</div>
      </section>
    </div>
  </div>
}
