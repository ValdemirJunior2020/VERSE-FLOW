const fs = require('fs')
const path = require('path')
const http = require('http')
const net = require('net')
const crypto = require('crypto')
const { spawn, execFile, execFileSync } = require('child_process')
const WebSocket = require('ws')

const COMPANION_PORT = 35677
const MPV_PIPE = '\\\\.\\pipe\\verseflow-mpv'

let mpvProcess = null
let whisperProcess = null
let companionServer = null
let obsSocket = null
let obsIdentified = false
let obsPending = new Map()
let obsSequence = 0

function firstExisting(paths) {
  return paths.find(p => p && fs.existsSync(p)) || null
}

function whereExe(name) {
  try {
    const out = String(execFileSync('where.exe',[name],{encoding:'utf8',windowsHide:true,timeout:2500})).split(/\r?\n/).map(x=>x.trim()).find(Boolean)
    return out && fs.existsSync(out) ? out : null
  } catch { return null }
}

function findRecursive(dir, filename, depth=5) {
  if(!dir || !fs.existsSync(dir) || depth<0) return null
  try{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,entry.name)
      if(entry.isFile() && entry.name.toLowerCase()===filename.toLowerCase()) return p
      if(entry.isDirectory()){
        const found=findRecursive(p,filename,depth-1)
        if(found) return found
      }
    }
  }catch{}
  return null
}

function winGetExe(filename, packageHint='') {
  const local=process.env.LOCALAPPDATA||''
  const root=path.join(local,'Microsoft','WinGet','Packages')
  if(!fs.existsSync(root)) return null
  try{
    const dirs=fs.readdirSync(root,{withFileTypes:true})
      .filter(x=>x.isDirectory() && (!packageHint || x.name.toLowerCase().includes(packageHint.toLowerCase())))
      .map(x=>path.join(root,x.name))
    for(const dir of dirs){
      const found=findRecursive(dir,filename,7)
      if(found)return found
    }
  }catch{}
  return null
}

function commandVersion(exe,args=['--version']){
  if(!exe) return ''
  try{return String(execFileSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:3500})).trim().split(/\r?\n/)[0]||''}
  catch{return ''}
}

function processRunning(image){
  try{
    const out=String(execFileSync('tasklist.exe',['/FI',`IMAGENAME eq ${image}`],{encoding:'utf8',windowsHide:true,timeout:2500}))
    return out.toLowerCase().includes(image.toLowerCase())
  }catch{return false}
}

function toolPaths(app){
  const local=process.env.LOCALAPPDATA||''
  const pf=process.env.ProgramFiles||'C:\\Program Files'
  const tools=path.join(local,'VerseFlowTools')
  const whisperRoot=path.join(tools,'whisper')
  return {
    tools,
    ffmpeg:firstExisting([
      path.join(tools,'ffmpeg','bin','ffmpeg.exe'),
      winGetExe('ffmpeg.exe','Gyan.FFmpeg'),
      whereExe('ffmpeg.exe'),
      whereExe('ffmpeg')
    ]),
    ffprobe:firstExisting([
      path.join(tools,'ffmpeg','bin','ffprobe.exe'),
      winGetExe('ffprobe.exe','Gyan.FFmpeg'),
      whereExe('ffprobe.exe'),
      whereExe('ffprobe')
    ]),
    mpv:firstExisting([
      path.join(tools,'mpv','mpv.exe'),
      path.join(pf,'MPV Player','mpv.exe'),
      path.join(pf,'mpv','mpv.exe'),
      winGetExe('mpv.exe','shinchiro.mpv'),
      whereExe('mpv.exe'),
      whereExe('mpv')
    ]),
    whisperStream:firstExisting([
      findRecursive(whisperRoot,'whisper-stream.exe'),
      whereExe('whisper-stream.exe'),
      whereExe('whisper-stream')
    ]),
    whisperModel:firstExisting([
      path.join(whisperRoot,'ggml-base.bin'),
      path.join(whisperRoot,'models','ggml-base.bin')
    ]),
    obs:firstExisting([
      path.join(pf,'obs-studio','bin','64bit','obs64.exe'),
      whereExe('obs64.exe')
    ]),
    companion:firstExisting([
      path.join(pf,'Companion','companion.exe'),
      path.join(local,'Programs','companion','Companion.exe'),
      path.join(local,'Programs','Companion','Companion.exe'),
      whereExe('companion.exe'),
      whereExe('companion')
    ])
  }
}

function getProductionToolStatus(app){
  const p=toolPaths(app)
  return {
    ffmpegInstalled:Boolean(p.ffmpeg),
    ffmpegVersion:commandVersion(p.ffmpeg,['-version']),
    mpvInstalled:Boolean(p.mpv),
    mpvVersion:commandVersion(p.mpv,['--version']),
    whisperInstalled:Boolean(p.whisperStream),
    whisperModelInstalled:Boolean(p.whisperModel),
    obsInstalled:Boolean(p.obs),
    obsRunning:processRunning('obs64.exe'),
    companionInstalled:Boolean(p.companion),
    companionRunning:processRunning('companion.exe'),
    companionApi:`http://127.0.0.1:${COMPANION_PORT}`
  }
}

function mpvSend(command,retries=10){
  return new Promise((resolve,reject)=>{
    const attempt=(left)=>{
      const socket=net.createConnection(MPV_PIPE)
      let settled=false
      socket.once('connect',()=>{
        settled=true
        socket.write(JSON.stringify({command})+'\n',()=>{
          socket.end()
          resolve({ok:true})
        })
      })
      socket.once('error',err=>{
        socket.destroy()
        if(settled)return
        if(left>0) setTimeout(()=>attempt(left-1),180)
        else reject(err)
      })
    }
    attempt(retries)
  })
}

function launchMpv(app,file,screenIndex=0){
  const exe=toolPaths(app).mpv
  if(!exe) throw new Error('mpv is not installed. Open Production → Install / Update Open Source Tools.')
  if(!file||!fs.existsSync(file)) throw new Error('Select a valid local media file.')
  if(mpvProcess && !mpvProcess.killed){try{mpvProcess.kill()}catch{}}
  const args=['--no-config',`--input-ipc-server=${MPV_PIPE}`,'--force-window=yes','--fs',`--screen=${Number.isFinite(screenIndex)?screenIndex:0}`,'--keep-open=yes',file]
  mpvProcess=spawn(exe,args,{windowsHide:false,detached:false,stdio:'ignore'})
  mpvProcess.on('exit',()=>{mpvProcess=null})
  return {ok:true}
}

function ffprobe(app,file){
  return new Promise((resolve,reject)=>{
    const exe=toolPaths(app).ffprobe
    if(!exe) return reject(new Error('FFmpeg/ffprobe is not installed.'))
    if(!file||!fs.existsSync(file)) return reject(new Error('Select a valid media file.'))
    execFile(exe,['-v','error','-show_entries','format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate','-of','json',file],{windowsHide:true,maxBuffer:4*1024*1024},(err,stdout,stderr)=>{
      if(err)return reject(new Error((stderr||err.message).trim()))
      try{
        const data=JSON.parse(stdout)
        const streams=(data.streams||[]).map(s=>{
          const dims=s.width&&s.height?` ${s.width}x${s.height}`:''
          return `${s.codec_type||'stream'}: ${s.codec_name||'?'}${dims}${s.r_frame_rate?` @ ${s.r_frame_rate}`:''}`
        })
        const f=data.format||{}
        const duration=Number(f.duration||0)
        const size=Number(f.size||0)
        const summary=[...streams,`duration: ${duration.toFixed(2)}s`,`size: ${(size/1024/1024).toFixed(1)} MB`].join('\n')
        resolve(summary)
      }catch{resolve(stdout.trim())}
    })
  })
}

function makeCompatible(app,file){
  return new Promise((resolve,reject)=>{
    const exe=toolPaths(app).ffmpeg
    if(!exe) return reject(new Error('FFmpeg is not installed.'))
    if(!file||!fs.existsSync(file)) return reject(new Error('Select a valid local media file.'))
    const dir=path.join(app.getPath('userData'),'media','compatible')
    fs.mkdirSync(dir,{recursive:true})
    const base=path.basename(file,path.extname(file)).replace(/[^\w.-]+/g,'_').slice(0,80)
    const out=path.join(dir,`${base}-verseflow-${Date.now()}.mp4`)
    const args=['-y','-i',file,'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',out]
    const child=spawn(exe,args,{windowsHide:true})
    let err=''
    child.stderr.on('data',d=>{err+=d.toString();if(err.length>16000)err=err.slice(-16000)})
    child.on('error',reject)
    child.on('close',code=>{
      if(code!==0||!fs.existsSync(out))return reject(new Error((err||`FFmpeg exited with code ${code}`).slice(-1600)))
      resolve({id:`media-compatible-${Date.now()}`,name:path.basename(out),path:out,type:'video'})
    })
  })
}

function startWhisper(app,controlWindow,language='auto'){
  const p=toolPaths(app)
  if(!p.whisperStream) throw new Error('whisper.cpp stream tool is not installed.')
  if(!p.whisperModel) throw new Error('Whisper multilingual base model is not installed.')
  if(whisperProcess && !whisperProcess.killed) return {ok:true}
  const lang=language&&language!=='auto'?language:'auto'
  const args=['-m',p.whisperModel,'-t','4','--step','1000','--length','5000','--keep','200','-l',lang]
  whisperProcess=spawn(p.whisperStream,args,{windowsHide:true})
  const emit=(chunk)=>{
    const clean=chunk.toString().replace(/\x1b\[[0-9;]*m/g,'')
    const lines=clean.split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith('[') && !x.includes('whisper_') && !x.includes('processing'))
    for(const line of lines.slice(-3)){
      if(controlWindow() && !controlWindow().isDestroyed()) controlWindow().webContents.send('whisper:caption',line)
    }
  }
  whisperProcess.stdout.on('data',emit)
  whisperProcess.stderr.on('data',emit)
  whisperProcess.on('exit',()=>{whisperProcess=null})
  return {ok:true}
}

function stopWhisper(){
  if(whisperProcess && !whisperProcess.killed){try{whisperProcess.kill()}catch{}}
  whisperProcess=null
  return {ok:true}
}

function obsAuth(password,salt,challenge){
  const secret=crypto.createHash('sha256').update(password+salt).digest('base64')
  return crypto.createHash('sha256').update(secret+challenge).digest('base64')
}

function disconnectObs(){
  try{obsSocket?.close()}catch{}
  obsSocket=null
  obsIdentified=false
  for(const [,p] of obsPending)p.reject(new Error('OBS disconnected.'))
  obsPending.clear()
}

function connectObs(host='127.0.0.1',port=4455,password=''){
  disconnectObs()
  return new Promise((resolve,reject)=>{
    let finished=false
    const socket=new WebSocket(`ws://${host}:${port}`,'obswebsocket.json')
    obsSocket=socket
    const timer=setTimeout(()=>{if(!finished){finished=true;disconnectObs();reject(new Error('OBS connection timed out. Check Tools → WebSocket Server Settings.'))}},5500)
    socket.on('message',raw=>{
      let msg
      try{msg=JSON.parse(raw.toString())}catch{return}
      if(msg.op===0){
        const auth=msg.d?.authentication
        const identify={rpcVersion:1,eventSubscriptions:0}
        if(auth){
          if(!password){clearTimeout(timer);finished=true;disconnectObs();return reject(new Error('OBS WebSocket requires the password from Tools → WebSocket Server Settings.'))}
          identify.authentication=obsAuth(password,auth.salt,auth.challenge)
        }
        socket.send(JSON.stringify({op:1,d:identify}))
      }else if(msg.op===2){
        obsIdentified=true
        if(!finished){finished=true;clearTimeout(timer);resolve({ok:true})}
      }else if(msg.op===7){
        const id=msg.d?.requestId
        const pending=obsPending.get(id)
        if(!pending)return
        obsPending.delete(id)
        if(msg.d?.requestStatus?.result)pending.resolve(msg.d?.responseData||{})
        else pending.reject(new Error(msg.d?.requestStatus?.comment||`OBS request failed (${msg.d?.requestStatus?.code||'unknown'})`))
      }
    })
    socket.on('error',err=>{if(!finished){finished=true;clearTimeout(timer);reject(new Error(`Could not connect to OBS: ${err.message}`))}})
    socket.on('close',()=>{obsIdentified=false;obsSocket=null})
  })
}

function obsRequest(requestType,requestData={}){
  return new Promise((resolve,reject)=>{
    if(!obsSocket||!obsIdentified||obsSocket.readyState!==WebSocket.OPEN)return reject(new Error('Connect to OBS first.'))
    const requestId=`vf-${Date.now()}-${++obsSequence}`
    obsPending.set(requestId,{resolve,reject})
    obsSocket.send(JSON.stringify({op:6,d:{requestType,requestId,requestData}}))
    setTimeout(()=>{const p=obsPending.get(requestId);if(p){obsPending.delete(requestId);p.reject(new Error(`${requestType} timed out.`))}},5000)
  })
}

async function obsSceneList(){
  const data=await obsRequest('GetSceneList')
  const scenes=(data.scenes||[]).map(s=>String(s.sceneName||'')).filter(Boolean)
  return {scenes,currentScene:data.currentProgramSceneName||''}
}

function startCompanionApi(getControlWindow,getPresentationState,broadcast){
  if(companionServer)return
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url||'/',`http://127.0.0.1:${COMPANION_PORT}`)
    const action=u.pathname.replace(/^\/+/,'').toLowerCase()
    res.setHeader('Access-Control-Allow-Origin','*')
    res.setHeader('Content-Type','application/json; charset=utf-8')
    const control=getControlWindow()
    if(action==='status'||action===''){
      res.end(JSON.stringify({ok:true,service:'VerseFlow Companion API',state:getPresentationState()||null,endpoints:['black','clear','logo','empty','live','next','previous']}))
      return
    }
    const allowed=new Set(['black','clear','logo','empty','live','next','previous'])
    if(!allowed.has(action)){res.statusCode=404;res.end(JSON.stringify({ok:false,error:'Unknown VerseFlow action'}));return}
    if(control&&!control.isDestroyed())control.webContents.send('companion:action',action)
    if(['black','clear','logo','empty'].includes(action)){
      const current=getPresentationState()||{}
      let patch={}
      if(action==='black')patch={black:!current.black,logo:false}
      if(action==='clear')patch={clearText:!current.clearText}
      if(action==='logo')patch={logo:!current.logo,black:false}
      if(action==='empty')patch={text:'',reference:'',youtubeId:undefined,black:false,logo:false,clearText:false,background:undefined,backgroundType:'solid'}
      const next={...current,...patch,mode:'live',sequence:Number(current.sequence||0)+1}
      broadcast(next)
    }
    res.end(JSON.stringify({ok:true,action}))
  })
  // The Companion API is optional. A stale VerseFlow process or another local
  // service may already own this port. Never let that prevent VerseFlow from
  // starting or leave the operator stuck on the loading screen.
  server.on('error',err=>{
    if(err && err.code==='EADDRINUSE'){
      console.warn(`[VerseFlow] Companion API port ${COMPANION_PORT} is already in use. Continuing without Companion API.`)
    }else{
      console.error('[VerseFlow] Companion API error:',err)
    }
    if(companionServer===server) companionServer=null
    try{server.close()}catch{}
  })
  server.listen(COMPANION_PORT,'127.0.0.1',()=>{
    console.log(`[VerseFlow] Companion API ready on 127.0.0.1:${COMPANION_PORT}`)
  })
  companionServer=server
}

function registerProductionTools({app,ipcMain,shell,clipboard,getControlWindow}){
  ipcMain.handle('mpv:launch',async(_e,{path:file,screenIndex})=>{try{return launchMpv(app,file,screenIndex)}catch(e){return{ok:false,error:e.message}}})
  ipcMain.handle('mpv:command',async(_e,command)=>{
    try{
      const map={pause:['cycle','pause'],stop:['quit'],seekBack:['seek',-10,'relative'],seekForward:['seek',10,'relative'],volume50:['set_property','volume',50],volume100:['set_property','volume',100]}
      if(!map[command])throw new Error('Unknown mpv command.')
      return await mpvSend(map[command])
    }catch(e){return{ok:false,error:e.message}}
  })
  ipcMain.handle('ffmpeg:probe',async(_e,file)=>{try{return{ok:true,summary:await ffprobe(app,file)}}catch(e){return{ok:false,error:e.message}}})
  ipcMain.handle('ffmpeg:compatible',async(_e,file)=>{try{return{ok:true,item:await makeCompatible(app,file)}}catch(e){return{ok:false,error:e.message}}})
  ipcMain.handle('whisper:start',async(_e,language)=>{try{return startWhisper(app,getControlWindow,language)}catch(e){return{ok:false,error:e.message}}})
  ipcMain.handle('whisper:stop',()=>stopWhisper())
  ipcMain.handle('obs:open',async()=>{
    try{
      const exe=toolPaths(app).obs
      if(exe){spawn(exe,[],{detached:true,stdio:'ignore'}).unref();return{ok:true}}
      await shell.openExternal('https://obsproject.com/download')
      return{ok:true}
    }catch(e){return{ok:false,error:e.message}}
  })
  ipcMain.handle('obs:connect',async(_e,{host,port,password})=>{
    try{await connectObs(host||'127.0.0.1',Number(port)||4455,String(password||''));const list=await obsSceneList();return{ok:true,...list}}catch(e){return{ok:false,error:e.message}}
  })
  ipcMain.handle('obs:scenes',async()=>{try{return{ok:true,...await obsSceneList()}}catch(e){return{ok:false,error:e.message}}})
  ipcMain.handle('obs:set-scene',async(_e,scene)=>{try{await obsRequest('SetCurrentProgramScene',{sceneName:String(scene||'')});return{ok:true}}catch(e){return{ok:false,error:e.message}}})
  ipcMain.handle('obs:control',async(_e,action)=>{
    const map={startRecord:'StartRecord',stopRecord:'StopRecord',startStream:'StartStream',stopStream:'StopStream'}
    try{if(!map[action])throw new Error('Unknown OBS action.');await obsRequest(map[action]);return{ok:true}}catch(e){return{ok:false,error:e.message}}
  })
  ipcMain.handle('companion:open',async()=>{
    try{
      const exe=toolPaths(app).companion
      if(exe){spawn(exe,[],{detached:true,stdio:'ignore'}).unref();return{ok:true}}
      await shell.openExternal('https://user.bitfocus.io/download')
      return{ok:true}
    }catch(e){return{ok:false,error:e.message}}
  })
  ipcMain.handle('clipboard:copy',(_e,text)=>{clipboard.writeText(String(text||''));return{ok:true}})
}

function shutdownProductionTools(){
  try{mpvProcess?.kill()}catch{}
  try{whisperProcess?.kill()}catch{}
  try{companionServer?.close()}catch{}
  disconnectObs()
}

module.exports={getProductionToolStatus,getProductionToolPaths:toolPaths,registerProductionTools,startCompanionApi,shutdownProductionTools,COMPANION_PORT}
