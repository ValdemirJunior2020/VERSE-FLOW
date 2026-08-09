const { app, BrowserWindow, screen, ipcMain, dialog, shell, session, clipboard, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const { pathToFileURL } = require('url')
const { spawn, execFileSync } = require('child_process')
const { VerseFlowDb } = require('./db.cjs')
const { downloadRepoBible } = require('./repo-bibles.cjs')
const { getProductionToolStatus, registerProductionTools, startCompanionApi, shutdownProductionTools } = require('./production-tools.cjs')

const bibleCatalog = require('./bible-catalog.json')
const bibleCatalogByCode = new Map(bibleCatalog.map(x => [String(x.code).toUpperCase(), x]))

protocol.registerSchemesAsPrivileged([{
  scheme:'verseflow-media',
  privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}
}])

app.setAppUserModelId('com.verseflow.desktop')
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required')

let controlWindow
let audienceWindow
let stageWindow
let presentationState = null
let audienceTargetDisplayId = null
let identifyWindows = []
let db
let rendererServer = null
let rendererPort = 0

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function errorLogPath() {
  try { return path.join(app.getPath('userData'),'logs','verseflow-errors.log') }
  catch { return path.join(process.cwd(),'verseflow-errors.log') }
}
function writeErrorLog(source, message, stack='') {
  try {
    const file=errorLogPath()
    fs.mkdirSync(path.dirname(file),{recursive:true})
    const line=`\n[${new Date().toISOString()}] ${String(source||'unknown')}\n${String(message||'Unknown error')}\n${String(stack||'')}\n`
    fs.appendFileSync(file,line,'utf8')
    return file
  } catch { return '' }
}
process.on('uncaughtExceptionMonitor',error=>writeErrorLog('main-uncaught',error?.message,error?.stack))
process.on('unhandledRejection',reason=>{const e=reason instanceof Error?reason:new Error(String(reason));writeErrorLog('main-promise',e.message,e.stack)})

function attachWindowDiagnostics(win,label) {
  win.webContents.on('render-process-gone',(_event,details)=>writeErrorLog(`${label}-render-gone`,details.reason,JSON.stringify(details)))
  win.webContents.on('did-fail-load',(_event,code,description,url)=>writeErrorLog(`${label}-load-failed`,`${code} ${description}`,url))
  win.webContents.on('console-message',(_event,level,message,line,sourceId)=>{if(level>=3)writeErrorLog(`${label}-console`,message,`${sourceId}:${line}`)})
}

async function runSystemCheck() {
  const checks=[]
  const add=(id,label,ok,detail,optional=false)=>checks.push({id,label,ok:Boolean(ok),detail:String(detail||''),optional})
  try {
    const dir=app.getPath('userData')
    fs.mkdirSync(path.join(dir,'diagnostics'),{recursive:true})
    const probe=path.join(dir,'diagnostics','.write-test')
    fs.writeFileSync(probe,'ok');fs.unlinkSync(probe)
    add('storage','Local storage',true,'VerseFlow can save settings, songs and services.')
  } catch(e){ add('storage','Local storage',false,e.message) }
  try { const data=db?.loadAll(); add('database','Local database',Boolean(data),'Database opened normally.') } catch(e){ add('database','Local database',false,e.message) }
  try {
    const displays=screen.getAllDisplays()
    add('display','Display detection',displays.length>0,`${displays.length} display${displays.length===1?'':'s'} detected.`)
    const settings=db?.loadAll()?.settings||{}
    const savedId=Number(settings.audienceDisplayId)
    const saved=displays.find(d=>d.id===savedId)
    add('video-wall','TELÃO',Boolean(saved)&&(!saved.primary||displays.length===1),saved?(saved.primary&&displays.length>1?'The saved TELÃO is the operator monitor. Choose the video wall instead.':`Saved TELÃO connected · ${saved.bounds.width}×${saved.bounds.height}.`):'No saved TELÃO is connected. Open Settings > IDENTIFICAR TELAS.')
  } catch(e){ add('display','Display detection',false,e.message) }
  try {
    const root=isDev?app.getAppPath():path.join(app.getAppPath(),'dist')
    add('renderer','Application files',fs.existsSync(root),'Core presentation files are available.')
  } catch(e){ add('renderer','Application files',false,e.message) }
  try {
    const t=await toolsStatus()
    add('ffmpeg','FFmpeg Media Doctor',Boolean(t.ffmpegInstalled),t.ffmpegInstalled?`Ready${t.ffmpegVersion?` · ${t.ffmpegVersion}`:''}`:'Optional. Install it if a video will not play.',true)
  } catch(e){ add('ffmpeg','FFmpeg Media Doctor',false,'Optional tool status unavailable.',true) }
  const required=checks.filter(x=>!x.optional)
  const ok=required.every(x=>x.ok)
  return {ok,summary:ok?'SYSTEM OK':'CHECK SYSTEM',checks,logPath:errorLogPath()}
}

function mimeType(file) {
  const ext=path.extname(file).toLowerCase()
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'})[ext]||'application/octet-stream'
}

function registerMediaProtocol() {
  if(protocol.isProtocolHandled('verseflow-media')) return
  protocol.handle('verseflow-media', request => {
    try{
      const u=new URL(request.url)
      const filePath=decodeURIComponent(u.pathname.replace(/^\/+/,''))
      const allowed=new Set(['.png','.jpg','.jpeg','.webp','.gif','.bmp','.svg','.mp4','.m4v','.mov','.webm','.mkv','.avi','.mp3','.wav','.m4a','.aac','.ogg','.flac'])
      if(!path.isAbsolute(filePath)||!fs.existsSync(filePath)||!allowed.has(path.extname(filePath).toLowerCase())) return new Response('Media not found',{status:404})
      return net.fetch(pathToFileURL(filePath).toString(),{headers:request.headers})
    }catch{return new Response('Bad media request',{status:400})}
  })
}


function displayInfoList() {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d,i)=>({
    id:d.id,index:i,label:d.label||`Display ${i+1}`,bounds:d.bounds,scaleFactor:d.scaleFactor,primary:d.id===primaryId
  }))
}

function closeIdentifyWindows() {
  for (const w of identifyWindows) {
    try { if (w && !w.isDestroyed()) w.destroy() } catch {}
  }
  identifyWindows = []
}

async function identifyDisplays() {
  closeIdentifyWindows()
  const displays = displayInfoList()
  for (const d of displays) {
    const win = new BrowserWindow({
      x:d.bounds.x,y:d.bounds.y,width:d.bounds.width,height:d.bounds.height,
      frame:false,transparent:false,backgroundColor:'#050505',alwaysOnTop:true,
      skipTaskbar:true,resizable:false,movable:false,focusable:false,show:false,
      webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
    })
    const number = d.index + 1
    const kind = d.primary ? 'MONITOR DO OPERADOR' : 'POSSÍVEL TELÃO'
    const html = `<!doctype html><html><body style="margin:0;background:#050505;color:#f3c969;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden"><div style="text-align:center"><div style="font-size:min(42vw,42vh);font-weight:900;line-height:.8">${number}</div><div style="margin-top:5vh;font-size:min(4vw,4vh);font-weight:800;color:white;letter-spacing:.08em">${kind}</div><div style="margin-top:2vh;font-size:min(2.2vw,2.2vh);color:#bbb">${d.bounds.width} × ${d.bounds.height}</div></div></body></html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    win.setBounds(d.bounds)
    win.showInactive()
    identifyWindows.push(win)
  }
  setTimeout(closeIdentifyWindows, 7000)
  return {ok:true,displays}
}

function outputStatus(savedDisplayId) {
  const displays = displayInfoList()
  const requested = Number(savedDisplayId)
  const selected = displays.find(d=>d.id===requested) || null
  const open = Boolean(audienceWindow && !audienceWindow.isDestroyed())
  return {
    connected:Boolean(selected),
    open,
    openOnSelected:open && audienceTargetDisplayId===requested,
    selectedDisplayId:Number.isFinite(requested)?requested:null,
    selected,
    displays
  }
}

function startRendererServer() {
  if(isDev || rendererServer) return Promise.resolve()
  const distRoot=path.join(app.getAppPath(),'dist')
  return new Promise((resolve,reject)=>{
    rendererServer=http.createServer((req,res)=>{
      try{
        const u=new URL(req.url||'/', 'http://127.0.0.1')
        let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html'
        if(rel.includes('..')){res.statusCode=400;res.end('Bad request');return}
        let file=path.join(distRoot,rel)
        if(!fs.existsSync(file) || fs.statSync(file).isDirectory()) file=path.join(distRoot,'index.html')
        res.statusCode=200
        res.setHeader('Content-Type',mimeType(file))
        res.setHeader('Cache-Control','no-store')
        res.setHeader('Referrer-Policy','strict-origin-when-cross-origin')
        fs.createReadStream(file).pipe(res)
      }catch(e){res.statusCode=500;res.end('VerseFlow renderer error')}
    })
    rendererServer.once('error',reject)
    rendererServer.listen(0,'127.0.0.1',()=>{rendererPort=rendererServer.address().port;resolve()})
  })
}

function rendererUrl(mode) {
  if (isDev) return `${process.env.VITE_DEV_SERVER_URL}${mode ? `?mode=${mode}` : ''}`
  return `http://127.0.0.1:${rendererPort}/${mode ? `?mode=${mode}` : ''}`
}
function secureOptions(extra={}) {
  return {
    show: false,
    backgroundColor: '#080808',
    webPreferences: {
      preload: path.join(__dirname,'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    },
    ...extra
  }
}
async function createControl() {
  controlWindow = new BrowserWindow(secureOptions({width:1440,height:900,minWidth:960,minHeight:650,title:'VerseFlow'}))
  attachWindowDiagnostics(controlWindow,'control')
  await controlWindow.loadURL(rendererUrl())
  controlWindow.once('ready-to-show',()=>controlWindow.show())
}
async function createOutput(kind, displayId) {
  const display = screen.getAllDisplays().find(d=>d.id===displayId)
  if (!display) return {ok:false,error:'Selected display is no longer connected.'}
  const existing = kind==='audience' ? audienceWindow : stageWindow
  if (existing && !existing.isDestroyed()) existing.destroy()
  const win = new BrowserWindow(secureOptions({
    x:display.bounds.x,y:display.bounds.y,width:display.bounds.width,height:display.bounds.height,
    frame:false,fullscreen:true,skipTaskbar:true,alwaysOnTop:false,title:kind==='audience'?'VerseFlow Audience':'VerseFlow Stage'
  }))
  attachWindowDiagnostics(win,kind)
  await win.loadURL(rendererUrl(kind))
  win.setBounds(display.bounds)
  win.setFullScreen(true)
  win.show()
  if (kind==='audience') { audienceWindow=win; audienceTargetDisplayId=display.id } else stageWindow=win
  win.on('closed',()=>{if(kind==='audience'){audienceWindow=null;audienceTargetDisplayId=null}else stageWindow=null})
  if (presentationState) win.webContents.send('presentation:state',presentationState)
  return {ok:true}
}
function broadcast(state) {
  for (const w of [audienceWindow,stageWindow]) if (w && !w.isDestroyed()) w.webContents.send('presentation:state',state)
}

function downloadJson(url, redirects=0) {
  return new Promise((resolve,reject)=>{
    if(redirects>5) return reject(new Error('Too many redirects.'))
    const u=new URL(url)
    if(u.protocol!=='https:') return reject(new Error('Bible catalog downloads require HTTPS.'))
    const req=https.get(u,{headers:{'User-Agent':'VerseFlow/1.0'}},res=>{
      if(res.statusCode>=300 && res.statusCode<400 && res.headers.location){
        res.resume()
        const next=new URL(res.headers.location,u).toString()
        return resolve(downloadJson(next,redirects+1))
      }
      if(res.statusCode!==200){res.resume();return reject(new Error(`Bible source returned HTTP ${res.statusCode}.`))}
      let body=''
      res.setEncoding('utf8')
      res.on('data',chunk=>{
        body+=chunk
        if(body.length>40*1024*1024){req.destroy(new Error('Bible file is unexpectedly large.'))}
      })
      res.on('end',()=>{
        try{resolve(JSON.parse(body))}catch(e){reject(new Error('Bible source did not return valid JSON.'))}
      })
    })
    req.setTimeout(30000,()=>req.destroy(new Error('Bible download timed out.')))
    req.on('error',reject)
  })
}

function entityId(value) {
  if (!value || typeof value!=='object') return null
  return value.id || value.key || null
}
const allowedEntities = new Set(['songs','media','services','themes'])


const SMART_MODEL = 'qwen3:0.6b'

function firstExisting(paths) {
  return paths.find(p => p && fs.existsSync(p)) || null
}

function ollamaExe() {
  const local = process.env.LOCALAPPDATA || ''
  return firstExisting([
    path.join(local,'Programs','Ollama','ollama.exe'),
    path.join(local,'Ollama','ollama.exe')
  ]) || 'ollama'
}

function ytDlpExe() {
  const local = process.env.LOCALAPPDATA || ''
  return firstExisting([
    path.join(local,'VerseFlowTools','yt-dlp.exe'),
    path.join(app.getAppPath(),'.runtime','tools','yt-dlp.exe')
  ]) || 'yt-dlp'
}

function denoExe() {
  const local=process.env.LOCALAPPDATA||''
  const user=process.env.USERPROFILE||''
  const candidates=[
    path.join(local,'Microsoft','WinGet','Links','deno.exe'),
    path.join(user,'.deno','bin','deno.exe'),
    path.join(local,'VerseFlowTools','deno.exe')
  ]
  const direct=firstExisting(candidates)
  if(direct)return direct
  try{
    const out=String(execFileSync('where.exe',['deno.exe'],{encoding:'utf8',windowsHide:true,timeout:2500})).split(/\r?\n/).map(x=>x.trim()).find(Boolean)
    return out&&fs.existsSync(out)?out:null
  }catch{return null}
}

function commandVersion(exe, args=['--version']) {
  try { return String(execFileSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:3500})).trim() }
  catch { return '' }
}

function jsonRequest(url, payload, timeout=15000) {
  return new Promise((resolve,reject)=>{
    const u=new URL(url)
    const body=Buffer.from(JSON.stringify(payload))
    const client=u.protocol==='https:'?https:http
    const req=client.request({hostname:u.hostname,port:u.port||undefined,path:u.pathname+u.search,method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length}},res=>{
      let data='';res.setEncoding('utf8')
      res.on('data',c=>data+=c)
      res.on('end',()=>{try{resolve({status:res.statusCode||0,json:JSON.parse(data||'{}')})}catch{reject(new Error('Local AI returned invalid JSON.'))}})
    })
    req.setTimeout(timeout,()=>req.destroy(new Error('Local AI timed out.')))
    req.on('error',reject);req.write(body);req.end()
  })
}

function simpleSmartPlan(command) {
  const c=String(command||'').trim()
  const l=c.toLowerCase()
  if(!c) return {action:'NO_ACTION',message:'Type a presentation request.'}
  if(/\b(black|blackout|tela preta|pantalla negra|negro)\b/.test(l)) return {action:'BLACK',message:'Black audience screen.'}
  if(/\b(clear text|hide text|limpar texto|limpiar texto|ocultar texto)\b/.test(l)) return {action:'CLEAR_TEXT',message:'Clear text from the audience output.'}
  if(/\b(show logo|logo|mostrar logo)\b/.test(l)) return {action:'LOGO',message:'Show the VerseFlow logo.'}
  if(/\b(stop audio|parar audio|parar áudio|detener audio)\b/.test(l)) return {action:'STOP_AUDIO',message:'Stop local background audio.'}
  const timer=c.match(/(?:timer|countdown|cronometro|cronômetro|temporizador|cuenta regresiva).*?(\d{1,3})\s*(?:min|minutes?|minutos?)?/i)
  if(timer) return {action:'START_TIMER',minutes:Math.max(1,Math.min(180,Number(timer[1]))),label:'Service starts in',message:`Prepare a ${timer[1]} minute countdown.`}
  const lower=c.match(/(?:lower third|terco inferior|terço inferior|tercio inferior|legenda inferior)\s*[:\-]?\s*(.+?)(?:\s*[|/]\s*(.+))?$/i)
  if(lower) return {action:'SHOW_LOWER_THIRD',text:lower[1].trim(),label:(lower[2]||'').trim(),message:'Prepare a lower third.'}
  const ref=c.match(/([1-3]?\s*[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3})\s+(?:(?:chapter|cap[ií]tulo)\s+)?(\d{1,3})\s*(?::|(?:verse|vers[ií]culo)\s+)(\d{1,3})/i)
  if(ref) return {action:'SHOW_VERSE',reference:`${ref[1].trim()} ${ref[2]}:${ref[3]}`,message:`Find ${ref[1].trim()} ${ref[2]}:${ref[3]} in the installed Bible.`}
  const colors={pink:'#d84f91',rosa:'#d84f91',red:'#c94242',vermelho:'#c94242',rojo:'#c94242',gold:'#c89a32',dourado:'#c89a32',dorado:'#c89a32',white:'#ffffff',branco:'#ffffff',blanco:'#ffffff',black:'#111111',preto:'#111111',negro:'#111111',blue:'#3478c9',azul:'#3478c9',green:'#3f8558',verde:'#3f8558',purple:'#7b4db3',roxo:'#7b4db3',morado:'#7b4db3'}
  for(const [name,color] of Object.entries(colors)) {
    const textWords=['text','font','texto','fonte','fuente']
    const refWords=['reference','accent','referencia','referência','destaque','acento']
    if(textWords.some(w=>l.includes(`${name} ${w}`)||l.includes(`${w} ${name}`))) return {action:'SET_TEXT_COLOR',color,message:`Set text color to ${name}.`}
    if(refWords.some(w=>l.includes(`${name} ${w}`)||l.includes(`${w} ${name}`))) return {action:'SET_ACCENT_COLOR',color,message:`Set reference color to ${name}.`}
  }
  const textMatch=c.match(/(?:show|display|put|write|mostrar|exibir|poner|escribir)\s+(?:the\s+)?(?:text\s+)?[\"']?(.+?)[\"']?$/i)
  if(textMatch && textMatch[1].length>1) return {action:'SHOW_TEXT',text:textMatch[1],message:'Create a custom text slide.'}
  if(/\b(song|music|hymn|música|musica|canção|cancao|hino|canción|cancion|himno)\b/i.test(c)) return {action:'FIND_SONG',query:c.replace(/\b(song|music|hymn|música|musica|canção|cancao|hino|canción|cancion|himno)\b/ig,'').trim(),message:'Find a song in the local library.'}
  if(/\b(image|video|vídeo|media|mídia|midia|picture|imagem|foto|imagen|medio)\b/i.test(c)) return {action:'FIND_MEDIA',query:c.replace(/\b(image|video|vídeo|media|mídia|midia|picture|imagem|foto|imagen|medio)\b/ig,'').trim(),message:'Find media in the local library.'}
  return {action:'NO_ACTION',message:'I could not safely map that request to a presentation action.'}
}

function parseSmartJson(content) {
  const cleaned=String(content||'').replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/```(?:json)?/gi,'').replace(/```/g,'').trim()
  const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}')
  if(start<0||end<start) throw new Error('Smart Presenter did not return an action plan.')
  return JSON.parse(cleaned.slice(start,end+1))
}

async function smartPlan(command, context={}) {
  const fallback=simpleSmartPlan(command)
  try{
    const tags=await new Promise(resolve=>{
      const req=http.get('http://127.0.0.1:11434/api/tags',{timeout:1200},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch{resolve(null)}})})
      req.on('timeout',()=>{req.destroy();resolve(null)});req.on('error',()=>resolve(null))
    })
    const names=(tags&&Array.isArray(tags.models)?tags.models:[]).map(x=>String(x.name||x.model||''))
    if(!names.some(n=>n===SMART_MODEL||n.startsWith(SMART_MODEL+':'))) return {ok:true,engine:'rule-based',plan:fallback}

    const system=`You are VerseFlow Smart Presenter, a local church presentation planning assistant. Return ONE JSON object only. Never rewrite, paraphrase, summarize, correct, or invent Scripture. For Bible requests, choose SHOW_VERSE and return only the reference and optional installed translation; VerseFlow itself will retrieve the exact stored verse text. Never output private chain-of-thought. Valid actions: SHOW_VERSE, SHOW_TEXT, BLACK, CLEAR_TEXT, LOGO, SET_TEXT_COLOR, SET_ACCENT_COLOR, FIND_SONG, FIND_MEDIA, START_TIMER, SHOW_LOWER_THIRD, STOP_AUDIO, NO_ACTION. Fields allowed: action, reference, translation, text, query, color, message, minutes, label. Prefer safe previewable actions. Context: ${JSON.stringify(context).slice(0,12000)}`
    const r=await jsonRequest('http://127.0.0.1:11434/api/chat',{
      model:SMART_MODEL,stream:false,format:'json',think:false,
      messages:[{role:'system',content:system},{role:'user',content:String(command||'')}],
      options:{temperature:0.1,num_predict:220}
    },18000)
    if(r.status<200||r.status>=300) throw new Error(`Ollama returned HTTP ${r.status}`)
    const plan=parseSmartJson(r.json?.message?.content||'')
    const allowed=new Set(['SHOW_VERSE','SHOW_TEXT','BLACK','CLEAR_TEXT','LOGO','SET_TEXT_COLOR','SET_ACCENT_COLOR','FIND_SONG','FIND_MEDIA','START_TIMER','SHOW_LOWER_THIRD','STOP_AUDIO','NO_ACTION'])
    if(!allowed.has(plan.action)) throw new Error('Unsupported Smart Presenter action.')
    return {ok:true,engine:SMART_MODEL,plan}
  }catch(e){
    return {ok:true,engine:'rule-based',plan:fallback,error:String(e.message||e)}
  }
}

async function toolsStatus() {
  const oe=ollamaExe(),ye=ytDlpExe(),de=denoExe()
  const installed=oe!=='ollama'||Boolean(commandVersion(oe,['--version']))
  const ollamaVersion=installed?commandVersion(oe,['--version']):''
  let running=false,modelInstalled=false
  try{
    const tags=await new Promise(resolve=>{
      const req=http.get('http://127.0.0.1:11434/api/tags',{timeout:1300},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch{resolve(null)}})})
      req.on('timeout',()=>{req.destroy();resolve(null)});req.on('error',()=>resolve(null))
    })
    running=Boolean(tags)
    const names=(tags&&Array.isArray(tags.models)?tags.models:[]).map(x=>String(x.name||x.model||''))
    modelInstalled=names.some(n=>n===SMART_MODEL||n.startsWith(SMART_MODEL+':'))
  }catch{}
  const ytVersion=commandVersion(ye,['--version'])
  return {ollamaInstalled:installed,ollamaRunning:running,ollamaVersion,modelInstalled,model:SMART_MODEL,ytDlpInstalled:Boolean(ytVersion),ytDlpVersion:ytVersion,denoInstalled:Boolean(de&&commandVersion(de,['--version'])),denoVersion:de?commandVersion(de,['--version']):'',...getProductionToolStatus(app)}
}

function runYtDlp(url) {
  return new Promise((resolve,reject)=>{
    const u=new URL(url)
    if(!['http:','https:'].includes(u.protocol)) return reject(new Error('Only http:// or https:// media URLs are supported.'))
    const exe=ytDlpExe()
    if(!commandVersion(exe,['--version'])) return reject(new Error('yt-dlp is not installed. Open Settings → Smart Presenter Tools to install it.'))
    const dir=path.join(app.getPath('userData'),'media','web')
    fs.mkdirSync(dir,{recursive:true})
    const template=path.join(dir,'%(title).120B-%(id)s.%(ext)s')
    const deno=denoExe()
    const jsArgs=deno?['--js-runtimes',`deno:${deno}`]:[]
    const args=['--no-playlist','--restrict-filenames','--windows-filenames','--no-warnings',...jsArgs,'-f','best[ext=mp4]/best','-o',template,'--print','after_move:filepath',url]
    const child=spawn(exe,args,{windowsHide:true})
    let stdout='',stderr=''
    child.stdout.on('data',d=>stdout+=d.toString())
    child.stderr.on('data',d=>stderr+=d.toString())
    child.on('error',reject)
    child.on('close',code=>{
      if(code!==0) return reject(new Error((stderr||`yt-dlp exited with code ${code}`).trim().slice(-1200)))
      const lines=stdout.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
      const file=[...lines].reverse().find(x=>fs.existsSync(x))
      if(!file) return reject(new Error('yt-dlp finished but VerseFlow could not locate the downloaded media file.'))
      const ext=path.extname(file).toLowerCase()
      const type=['.jpg','.jpeg','.png','.webp','.gif'].includes(ext)?'image':['.mp3','.wav','.m4a','.aac','.ogg'].includes(ext)?'audio':'video'
      resolve({id:`media-web-${Date.now()}`,name:path.basename(file),path:file,type})
    })
  })
}



registerProductionTools({
  app,
  ipcMain,
  shell,
  clipboard,
  getControlWindow:()=>controlWindow
})

function configureYouTubeRequestIdentity() {
  const ses = session.defaultSession

  ses.webRequest.onBeforeSendHeaders(
    {
      urls: [
        'https://www.youtube.com/*',
        'https://www.youtube-nocookie.com/*',
        'https://*.googlevideo.com/*',
        'https://*.ytimg.com/*',
        'https://*.google.com/*'
      ]
    },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders }

      // YouTube requires desktop/webview embedders to identify the embedding
      // context with an HTTP Referer. Electron file:// pages otherwise send none.
      requestHeaders.Referer = `http://127.0.0.1:${rendererPort}/`
      requestHeaders.Origin = `http://127.0.0.1:${rendererPort}`

      callback({ requestHeaders })
    }
  )
}

app.whenReady().then(async()=>{
  registerMediaProtocol()
  await startRendererServer()
  configureYouTubeRequestIdentity()
  const dataFile=path.join(app.getPath('userData'),'data','verseflow.sqlite')
  db=new VerseFlowDb(dataFile); await db.init()
  startCompanionApi(()=>controlWindow,()=>presentationState,(state)=>{presentationState=state;broadcast(state)})
  await createControl()
  screen.on('display-removed',()=>{
    const ids=new Set(screen.getAllDisplays().map(d=>d.id))
    if(audienceTargetDisplayId!=null && !ids.has(audienceTargetDisplayId)){
      try{if(audienceWindow&&!audienceWindow.isDestroyed())audienceWindow.destroy()}catch{}
      audienceWindow=null; audienceTargetDisplayId=null
      controlWindow?.webContents?.send('display:changed')
    }
  })
  screen.on('display-added',()=>controlWindow?.webContents?.send('display:changed'))
  screen.on('display-metrics-changed',()=>controlWindow?.webContents?.send('display:changed'))
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createControl()})
})

app.on('before-quit',()=>{shutdownProductionTools();try{rendererServer?.close()}catch{}})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})

ipcMain.handle('display:list',()=>displayInfoList())
ipcMain.handle('display:identify',()=>identifyDisplays())
ipcMain.handle('display:status',(_e,savedDisplayId)=>outputStatus(savedDisplayId))
ipcMain.handle('display:open',(_e,{kind,displayId})=> {
  if(!['audience','stage'].includes(kind)||!Number.isFinite(displayId)) return {ok:false,error:'Invalid output request.'}
  return createOutput(kind,displayId)
})
ipcMain.handle('display:close',(_e,kind)=>{const w=kind==='audience'?audienceWindow:stageWindow;if(w&&!w.isDestroyed())w.close()})
ipcMain.on('presentation:set',(_e,state)=>{
  if (!state || typeof state!=='object' || typeof state.text!=='string') return
  presentationState=JSON.parse(JSON.stringify(state))
  broadcast(presentationState)
})
ipcMain.handle('presentation:get',()=>presentationState)
ipcMain.handle('data:load',()=>db.loadAll())
ipcMain.handle('data:upsert',(_e,{entity,value})=>{
  try{
    if(!allowedEntities.has(entity)) throw new Error('Entity not allowed')
    const id=entityId(value); if(!id) throw new Error('Missing id')
    db.putObject(entity,id,value); return {ok:true}
  }catch(e){return {ok:false,error:e.message}}
})
ipcMain.handle('settings:set',(_e,{key,value})=>{try{if(typeof key!=='string'||key.length>80)throw new Error('Invalid setting key');db.setSetting(key,value);return{ok:true}}catch(e){return{ok:false,error:e.message}}})
ipcMain.handle('data:remove',(_e,{entity,id})=>{
  try{if(!allowedEntities.has(entity))throw new Error('Entity not allowed');db.removeObject(entity,id);return{ok:true}}catch(e){return{ok:false,error:e.message}}
})

ipcMain.handle('bible:catalog',()=>bibleCatalog.map(x=>({...x})))
ipcMain.handle('bible:install-catalog',async(_e,code)=>{
  try{
    const item=bibleCatalogByCode.get(String(code||'').toUpperCase())
    if(!item) throw new Error('Bible catalog entry not found.')
    if(item.status!=='download') throw new Error(`${item.code} requires a local Bible file. Use Import.`)

    let payload
    if(item.bundledFile){
      const bundledPath=path.join(app.getAppPath(),'bibles','bundled',path.basename(item.bundledFile))
      if(!fs.existsSync(bundledPath)) throw new Error(`Bundled Bible file is missing: ${item.bundledFile}`)
      payload=JSON.parse(fs.readFileSync(bundledPath,'utf8'))
    }else if(item.url){
      payload=await downloadJson(item.url)
    }else if(item.sourceType){
      const verses=await downloadRepoBible(item)
      payload={translation:item.code,name:item.name,license:`${item.license} · Source: ${item.source}`,verses}
    }else{
      throw new Error('No verified automatic download is configured for this translation yet. Use Import JSON.')
    }

    const result=db.importTranslation(payload,{code:item.code,name:item.name,license:`${item.license} · Source: ${item.source}`})
    return{ok:true,...result}
  }catch(e){return{ok:false,error:e.message}}
})
ipcMain.handle('bible:import',async()=>{
  try{
    const r=await dialog.showOpenDialog(controlWindow,{title:'Import Bible Translation JSON',properties:['openFile'],filters:[{name:'Bible JSON',extensions:['json']}]})
    if(r.canceled||!r.filePaths[0])return{ok:false,error:'Canceled'}
    const payload=JSON.parse(fs.readFileSync(r.filePaths[0],'utf8'))
    const result=db.importTranslation(payload)
    return{ok:true,...result}
  }catch(e){return{ok:false,error:e.message}}
})
ipcMain.handle('media:pick',async()=>{
  const r=await dialog.showOpenDialog(controlWindow,{title:'Import local media',properties:['openFile','multiSelections'],filters:[
    {name:'Media',extensions:['jpg','jpeg','png','webp','gif','mp4','webm','mov','m4v','mp3','wav','m4a']},
    {name:'All files',extensions:['*']}
  ]})
  if(r.canceled)return[]
  return r.filePaths.map(p=>{
    const ext=path.extname(p).toLowerCase()
    const type=['.jpg','.jpeg','.png','.webp','.gif'].includes(ext)?'image':['.mp4','.webm','.mov','.m4v'].includes(ext)?'video':'audio'
    return{id:`media-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:path.basename(p),path:p,type}
  })
})
ipcMain.handle('backup:export',async()=>{
  try{
    const r=await dialog.showSaveDialog(controlWindow,{title:'Export VerseFlow Backup',defaultPath:`VerseFlow-Backup-${new Date().toISOString().slice(0,10)}.sqlite`,filters:[{name:'VerseFlow SQLite Backup',extensions:['sqlite']}]})
    if(r.canceled||!r.filePath)return{ok:false,error:'Canceled'}
    fs.copyFileSync(path.join(app.getPath('userData'),'data','verseflow.sqlite'),r.filePath)
    return{ok:true,path:r.filePath}
  }catch(e){return{ok:false,error:e.message}}
})
ipcMain.handle('backup:import',async()=>{
  try{
    const r=await dialog.showOpenDialog(controlWindow,{title:'Restore VerseFlow Backup',properties:['openFile'],filters:[{name:'VerseFlow SQLite Backup',extensions:['sqlite','db']}]})
    if(r.canceled||!r.filePaths[0])return{ok:false,error:'Canceled'}
    db.replaceFrom(r.filePaths[0]);return{ok:true}
  }catch(e){return{ok:false,error:e.message}}
})
ipcMain.handle('integration:health',async(_e,url)=>{
  try{
    const u=new URL(url); if(!['http:','https:'].includes(u.protocol))throw new Error('Use http:// or https://')
    const target=new URL('/models',u.href.endsWith('/')?u.href:u.href+'/')
    const client=target.protocol==='https:'?https:http
    return await new Promise(resolve=>{
      const req=client.get(target,{timeout:1800},res=>{res.resume();resolve({ok:res.statusCode>=200&&res.statusCode<500,status:res.statusCode})})
      req.on('timeout',()=>{req.destroy();resolve({ok:false,error:'Timed out'})})
      req.on('error',e=>resolve({ok:false,error:e.message}))
    })
  }catch(e){return{ok:false,error:e.message}}
})

ipcMain.handle('tools:status',()=>toolsStatus())
ipcMain.handle('tools:open-installer',async()=>{
  try{
    const devPath=path.join(app.getAppPath(),'INSTALL_OPTIONAL_OPEN_SOURCE_TOOLS.bat')
    const packagedPath=path.join(process.resourcesPath,'tools','INSTALL_OPTIONAL_OPEN_SOURCE_TOOLS.bat')
    const target=fs.existsSync(packagedPath)?packagedPath:devPath
    if(!fs.existsSync(target)) throw new Error('Optional tools installer was not found.')
    const err=await shell.openPath(target)
    return err?{ok:false,error:err}:{ok:true}
  }catch(e){return{ok:false,error:e.message}}
})
ipcMain.handle('smart:command',async(_e,{command,context})=>{
  try{return await smartPlan(String(command||''),context||{})}catch(e){return{ok:false,error:e.message}}
})
ipcMain.handle('media:download-url',async(_e,url)=>{
  try{const item=await runYtDlp(String(url||''));return{ok:true,item}}catch(e){return{ok:false,error:e.message}}
})

ipcMain.handle('app:info',()=>({version:app.getVersion(),dataPath:app.getPath('userData')}))
ipcMain.handle('diagnostics:run',()=>runSystemCheck())
ipcMain.handle('diagnostics:log-error',(_e,{source,message,stack})=>{const file=writeErrorLog(String(source||'renderer'),String(message||'Unknown renderer error'),String(stack||''));return{ok:Boolean(file),path:file}})

