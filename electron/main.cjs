const { app, BrowserWindow, screen, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const { pathToFileURL } = require('url')
const { VerseFlowDb } = require('./db.cjs')

app.setAppUserModelId('com.verseflow.desktop')

let controlWindow
let audienceWindow
let stageWindow
let presentationState = null
let db

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function rendererUrl(mode) {
  if (isDev) return `${process.env.VITE_DEV_SERVER_URL}${mode ? `?mode=${mode}` : ''}`
  const file = path.join(app.getAppPath(), 'dist', 'index.html')
  return `${pathToFileURL(file).toString()}${mode ? `?mode=${mode}` : ''}`
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
  await win.loadURL(rendererUrl(kind))
  win.setBounds(display.bounds)
  win.setFullScreen(true)
  win.show()
  if (kind==='audience') audienceWindow=win; else stageWindow=win
  win.on('closed',()=>{if(kind==='audience')audienceWindow=null;else stageWindow=null})
  if (presentationState) win.webContents.send('presentation:state',presentationState)
  return {ok:true}
}
function broadcast(state) {
  for (const w of [audienceWindow,stageWindow]) if (w && !w.isDestroyed()) w.webContents.send('presentation:state',state)
}
function entityId(value) {
  if (!value || typeof value!=='object') return null
  return value.id || value.key || null
}
const allowedEntities = new Set(['songs','media','services','themes'])

app.whenReady().then(async()=>{
  const dataFile=path.join(app.getPath('userData'),'data','verseflow.sqlite')
  db=new VerseFlowDb(dataFile); await db.init()
  await createControl()
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createControl()})
})

app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})

ipcMain.handle('display:list',()=>screen.getAllDisplays().map((d,i)=>({
  id:d.id,label:d.label||`Display ${i+1}`,bounds:d.bounds,scaleFactor:d.scaleFactor,primary:d.id===screen.getPrimaryDisplay().id
})))
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
ipcMain.handle('app:info',()=>({version:app.getVersion(),dataPath:app.getPath('userData')}))
