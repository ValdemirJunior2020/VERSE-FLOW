const { execFile, execFileSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const https = require('https')

function where(name){
  try {
    const out=String(execFileSync(process.platform==='win32'?'where.exe':'which',[name],{encoding:'utf8',windowsHide:true,timeout:2500,stdio:['ignore','pipe','ignore']}))
      .split(/\r?\n/).map(x=>x.trim()).find(Boolean)
    return out||null
  } catch { return null }
}

function run(exe,args,timeout=20000){
  return new Promise((resolve,reject)=>execFile(exe,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:3*1024*1024},(err,stdout,stderr)=>{
    if(err)reject(new Error(String(stderr||err.message).slice(-1800)))
    else resolve(String(stdout||''))
  }))
}

function version(exe,args=['--version']){
  try{return String(execFileSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:3500,stdio:['ignore','pipe','ignore']})).trim().split(/\r?\n/)[0]}
  catch{return ''}
}

function toolsRoot(){
  const base=process.env.LOCALAPPDATA || path.join(os.homedir(),'.verseflow')
  return path.join(base,'VerseFlow','InternetAgent')
}
function venvExe(envName,exeName){
  const p=process.platform==='win32'
    ? path.join(toolsRoot(),envName,'Scripts',exeName.endsWith('.exe')?exeName:`${exeName}.exe`)
    : path.join(toolsRoot(),envName,'bin',exeName.replace(/\.exe$/,''))
  return fs.existsSync(p)?p:null
}
function venvPython(envName){
  const p=process.platform==='win32'
    ? path.join(toolsRoot(),envName,'Scripts','python.exe')
    : path.join(toolsRoot(),envName,'bin','python')
  return fs.existsSync(p)?p:null
}
function pythonHas(py,moduleName){
  if(!py)return false
  try{execFileSync(py,['-c',`import ${moduleName}`],{windowsHide:true,timeout:3500,stdio:'ignore'});return true}catch{return false}
}

function resolveLocalMcporter(){
  const pkgFile=path.join(toolsRoot(),'node','node_modules','mcporter','package.json')
  try{
    if(!fs.existsSync(pkgFile))return null
    const pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'))
    const rel=typeof pkg.bin==='string'?pkg.bin:(pkg.bin?.mcporter||Object.values(pkg.bin||{})[0])
    if(!rel)return null
    const cli=path.resolve(path.dirname(pkgFile),String(rel))
    if(!fs.existsSync(cli))return null
    const nodeExe=where(process.platform==='win32'?'node.exe':'node')||where('node')
    if(!nodeExe)return null
    return{exe:nodeExe,prefix:[cli],display:cli}
  }catch{return null}
}

// Compatibility fallback for an older/global installation. VerseFlow's installer
// now installs mcporter privately under LOCALAPPDATA instead of changing npm/Python globally.
function resolveNodeCli(binName,packageName=binName){
  if(binName==='mcporter'){
    const local=resolveLocalMcporter()
    if(local)return local
  }
  const directExe=where(`${binName}.exe`)
  if(directExe)return{exe:directExe,prefix:[],display:directExe}
  const found=[where(`${binName}.cmd`),where(binName)].filter(Boolean)
  for(const shim of found){
    const dir=path.dirname(shim)
    const packageFiles=[
      path.join(dir,'node_modules',packageName,'package.json'),
      path.join(dir,'..','node_modules',packageName,'package.json'),
      path.join(dir,'..','lib','node_modules',packageName,'package.json')
    ]
    for(const pkgFile of packageFiles){
      try{
        if(!fs.existsSync(pkgFile))continue
        const pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'))
        const rel=typeof pkg.bin==='string'?pkg.bin:(pkg.bin?.[binName]||pkg.bin?.[packageName]||Object.values(pkg.bin||{})[0])
        if(!rel)continue
        const cli=path.resolve(path.dirname(pkgFile),String(rel))
        if(fs.existsSync(cli)){
          const nodeExe=where(process.platform==='win32'?'node.exe':'node')||where('node')
          if(nodeExe)return{exe:nodeExe,prefix:[cli],display:shim}
        }
      }catch{}
    }
    if(process.platform!=='win32'&&fs.existsSync(shim))return{exe:shim,prefix:[],display:shim}
  }
  return null
}

async function runTool(spec,args,timeout=20000){
  if(!spec)throw new Error('Required command is not installed.')
  return run(spec.exe,[...(spec.prefix||[]),...args],timeout)
}
function toolVersion(spec){return spec?version(spec.exe,[...(spec.prefix||[]),'--version']):''}
function safeQuery(q){return String(q||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240)}
function validHttpUrl(raw){try{const u=new URL(String(raw));return['http:','https:'].includes(u.protocol)?u.toString():null}catch{return null}}


function htmlDecode(value){
  return String(value||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')
}
function stripTags(value){return htmlDecode(String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim())}
function isToolSetupResult(item){
  try{
    const u=new URL(String(item?.url||''))
    const hay=`${u.hostname} ${u.pathname} ${item?.title||''} ${item?.snippet||''}`.toLowerCase()
    if(u.hostname==='dashboard.exa.ai')return true
    if(/create api key|api-keys|mcp url|update exa mcp|developer dashboard|authentication required|configure exa/.test(hay))return true
    return false
  }catch{return true}
}

// Search engines often return an artist/profile page before the actual song.
// Those pages can identify the artist but cannot be treated as a selected song.
function isGenericNonSongResult(item){
  try{
    const u=new URL(String(item?.url||''))
    const host=u.hostname.toLowerCase().replace(/^www\./,'')
    const pathName=u.pathname.toLowerCase().replace(/\/+$/,'')||'/'
    const hay=`${host} ${pathName} ${item?.title||''} ${item?.snippet||''}`.toLowerCase()
    if(/\/(artists?|users?|profiles?|members?|authors?|tags?|search|browse|charts?|playlists?|albums?)(?:\/|$)/.test(pathName))return true
    if(/genius\.com/.test(host)&&/\/artists?\//.test(pathName))return true
    if(/youtube\.com/.test(host)&&/\/(channel|@|user|c)\//.test(pathName))return true
    if(/spotify\.com/.test(host)&&/\/(artist|album|playlist|user)\//.test(pathName))return true
    if(/artist profile|artist page|discography|all songs by|browse artists/.test(hay))return true
    return false
  }catch{return true}
}

function songPageScore(item,query=''){
  if(!item||isToolSetupResult(item)||isGenericNonSongResult(item))return -100
  let u
  try{u=new URL(String(item.url||item.sourceUrl||''))}catch{return -100}
  const rawQuery=String(query||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ')
  const stop=new Set(['find','show','play','song','songs','lyrics','lyric','christian','gospel','worship','by','the','a','an','please','music'])
  const tokens=[...new Set(rawQuery.split(/\s+/).filter(x=>x.length>=3&&!stop.has(x)))]
  const hay=`${item.title||''} ${item.sourceTitle||''} ${item.snippet||''} ${u.pathname}`.toLowerCase()
  const matched=tokens.filter(t=>hay.includes(t)).length
  let score=tokens.length?matched/tokens.length*6:0
  if(/lyrics?|songtext|words|hymn/.test(`${u.pathname} ${item.title||''}`.toLowerCase()))score+=5
  if(/genius\.com|azlyrics\.com|musixmatch\.com|songlyrics\.com|hymnary\.org|worshiptogether\.com/.test(u.hostname.toLowerCase()))score+=2
  if(/youtube\.com|youtu\.be|spotify\.com|apple\.com|music\.amazon|lnk\.to|linkfire|soundcloud\.com/.test(u.hostname.toLowerCase()))score-=3
  return score
}
function getText(url,timeout=14000){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{'User-Agent':'Mozilla/5.0 VerseFlow/1.4.8','Accept':'text/html,application/xhtml+xml'},timeout},res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){req.destroy();return resolve(getText(new URL(res.headers.location,url).toString(),timeout))}
      let d='';res.setEncoding('utf8');res.on('data',c=>{d+=c;if(d.length>2000000)req.destroy()});res.on('end',()=>resolve(d))
    });req.on('timeout',()=>req.destroy(new Error('Search fallback timed out.')));req.on('error',reject)
  })
}
async function duckDuckGoSearch(query,limit=7){
  const url='https://html.duckduckgo.com/html/?q='+encodeURIComponent(query)
  const html=String(await getText(url))
  const out=[]
  const re=/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>|$)/gi
  let m
  while((m=re.exec(html))&&out.length<Math.max(1,Math.min(10,limit))){
    let href=htmlDecode(m[1])
    try{
      const du=new URL(href.startsWith('//')?'https:'+href:href,'https://duckduckgo.com')
      const target=du.searchParams.get('uddg'); if(target)href=decodeURIComponent(target)
    }catch{}
    const item={title:stripTags(m[2]),url:href,snippet:stripTags(m[3]||'')}
    if(validHttpUrl(item.url)&&!isToolSetupResult(item)&&!isGenericNonSongResult(item))out.push(item)
  }
  return out
}

function parseSearch(raw){
  const text=String(raw||'').trim();let data
  try{data=JSON.parse(text)}catch{}
  const candidates=[]
  const walk=(x)=>{
    if(!x)return
    if(Array.isArray(x)){x.forEach(walk);return}
    if(typeof x==='object'){
      const title=x.title||x.name
      const url=x.url||x.link
      if(title&&url)candidates.push({title:String(title),url:String(url),snippet:String(x.text||x.snippet||x.description||x.content||'').slice(0,500)})
      Object.values(x).forEach(walk)
    }
  }
  walk(data)
  if(!candidates.length){
    const urlRe=/(https?:\/\/[^\s)\]"']+)/g
    for(const line of text.split(/\r?\n/).filter(Boolean)){
      const m=line.match(urlRe)
      if(m)candidates.push({title:line.replace(urlRe,'').replace(/^[-*#\s]+/,'').trim().slice(0,180)||m[0],url:m[0],snippet:line.slice(0,500)})
    }
  }
  const seen=new Set()
  return candidates.filter(x=>{const u=validHttpUrl(x.url);if(!u||seen.has(u))return false;x.url=u;if(isToolSetupResult(x)||isGenericNonSongResult(x))return false;seen.add(u);return true}).slice(0,10)
}

async function statuses(){
  const agent=venvExe('agent-reach','agent-reach') || where('agent-reach') || where('agent-reach.exe')
  const mcporter=resolveNodeCli('mcporter','mcporter')
  const crawlPy=venvPython('crawl4ai')
  const browserPy=venvPython('browser-use')
  const crawlInstalled=pythonHas(crawlPy,'crawl4ai')
  const browserInstalled=pythonHas(browserPy,'browser_use')
  let agentRunning=false
  if(agent){try{const out=await run(agent,['doctor'],10000);agentRunning=/search|web|ready|✅|ok/i.test(out)}catch{}}
  return{
    agentReach:{installed:Boolean(agent),running:agentRunning,version:agent?version(agent):''},
    crawl4ai:{installed:crawlInstalled,running:false,version:crawlInstalled?'isolated':''},
    browserUse:{installed:browserInstalled,running:false,version:browserInstalled?'isolated':''},
    searchBackend:{installed:Boolean(mcporter),running:Boolean(mcporter),version:toolVersion(mcporter)}
  }
}

async function searchWeb(query,limit=7){
  const q=safeQuery(query)
  if(!q)throw new Error('Search query is empty.')
  const mcporter=resolveNodeCli('mcporter','mcporter')
  if(!mcporter)throw new Error('Agent-Reach web search bridge (mcporter) is not installed correctly. Run INSTALL_VERSEFLOW.bat, then restart VerseFlow.')
  const expression=`exa.web_search_exa(query: ${JSON.stringify(q)}, numResults: ${Math.max(1,Math.min(10,Number(limit)||7))})`
  let primary=[]
  try{primary=parseSearch(await runTool(mcporter,['call',expression],25000))}catch{}
  if(primary.length>=2)return primary
  try{
    const fallback=await duckDuckGoSearch(q,limit)
    const seen=new Set(primary.map(x=>x.url))
    for(const item of fallback)if(!seen.has(item.url)){primary.push(item);seen.add(item.url)}
  }catch{}
  if(!primary.length)throw new Error('Internet search returned no usable results. Exa may need configuration and the public search fallback was unavailable.')
  return primary.slice(0,Math.max(1,Math.min(10,Number(limit)||7)))
}

async function extractPage(url){
  const safe=validHttpUrl(url)
  if(!safe)throw new Error('Only public http/https pages can be extracted.')

  // The website URL is passed as data, never executed as a command.
  // Crawl4AI runs in its own VerseFlow venv so its dependencies cannot alter Browser Use or global Python.
  const py=venvPython('crawl4ai')
  if(py&&pythonHas(py,'crawl4ai')){
    const script='import asyncio,sys,json\nfrom crawl4ai import AsyncWebCrawler\nasync def m():\n async with AsyncWebCrawler() as c:\n  r=await c.arun(url=sys.argv[1])\n  md=getattr(r,"markdown","")\n  if hasattr(md,"raw_markdown") and md.raw_markdown: md=md.raw_markdown\n  elif hasattr(md,"fit_markdown") and md.fit_markdown: md=md.fit_markdown\n  meta=getattr(r,"metadata",{}) or {}\n  print(json.dumps({"url":sys.argv[1],"title":str(meta.get("title","")),"markdown":str(md)[:120000]}))\nasyncio.run(m())'
    try{return JSON.parse(await run(py,['-c',script,safe],45000))}catch{}
  }

  // Jina Reader is a read-only HTTP fallback when local Crawl4AI is unavailable.
  // The URL remains validated http/https data and is never passed to a shell.
  const target='https://r.jina.ai/'+safe
  return new Promise((resolve,reject)=>{
    const req=https.get(target,{headers:{'User-Agent':'VerseFlow/1.4.8'},timeout:15000},res=>{
      let d=''
      res.setEncoding('utf8')
      res.on('data',c=>{if(d.length<160000)d+=c})
      res.on('end',()=>resolve({url:safe,markdown:d.slice(0,120000)}))
    })
    req.on('timeout',()=>req.destroy(new Error('Page extraction timed out.')))
    req.on('error',reject)
  })
}

function openBrowser(url){
  const safe=validHttpUrl(url)
  if(!safe)throw new Error('Only http/https URLs are allowed.')
  const cmd=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open'
  const args=process.platform==='win32'?['/d','/c','start','',safe]:[safe]
  const child=spawn(cmd,args,{detached:true,stdio:'ignore',windowsHide:true})
  child.unref()
  return true
}

function installerPath(app){
  const dev=path.join(app.getAppPath(),'INSTALL_VERSEFLOW.bat')
  const packaged=path.join(process.resourcesPath||'','tools','INSTALL_VERSEFLOW.bat')
  return fs.existsSync(dev)?dev:packaged
}

module.exports={statuses,searchWeb,extractPage,openBrowser,installerPath,safeQuery,parseSearch,resolveNodeCli,validHttpUrl,toolsRoot,isToolSetupResult,isGenericNonSongResult,songPageScore,duckDuckGoSearch}
