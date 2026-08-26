const https = require('https')

const BOOKS = {
  GEN:'Genesis', EXO:'Exodus', LEV:'Leviticus', NUM:'Numbers', DEU:'Deuteronomy',
  JOS:'Joshua', JDG:'Judges', RUT:'Ruth', '1SA':'1 Samuel', '2SA':'2 Samuel',
  '1KI':'1 Kings', '2KI':'2 Kings', '1CH':'1 Chronicles', '2CH':'2 Chronicles',
  EZR:'Ezra', NEH:'Nehemiah', EST:'Esther', JOB:'Job', PSA:'Psalms', PRO:'Proverbs',
  ECC:'Ecclesiastes', SNG:'Song of Solomon', ISA:'Isaiah', JER:'Jeremiah',
  LAM:'Lamentations', EZK:'Ezekiel', DAN:'Daniel', HOS:'Hosea', JOL:'Joel',
  AMO:'Amos', OBA:'Obadiah', JON:'Jonah', MIC:'Micah', NAM:'Nahum', HAB:'Habakkuk',
  ZEP:'Zephaniah', HAG:'Haggai', ZEC:'Zechariah', MAL:'Malachi', MAT:'Matthew',
  MRK:'Mark', LUK:'Luke', JHN:'John', ACT:'Acts', ROM:'Romans', '1CO':'1 Corinthians',
  '2CO':'2 Corinthians', GAL:'Galatians', EPH:'Ephesians', PHP:'Philippians',
  COL:'Colossians', '1TH':'1 Thessalonians', '2TH':'2 Thessalonians',
  '1TI':'1 Timothy', '2TI':'2 Timothy', TIT:'Titus', PHM:'Philemon', HEB:'Hebrews',
  JAS:'James', '1PE':'1 Peter', '2PE':'2 Peter', '1JN':'1 John', '2JN':'2 John',
  '3JN':'3 John', JUD:'Jude', REV:'Revelation'
}

function getText(url, redirects=0) {
  return new Promise((resolve,reject)=>{
    if(redirects>5) return reject(new Error('Too many redirects'))
    const req=https.get(url,{headers:{'User-Agent':'VerseFlow/1.0','Accept':'application/vnd.github+json'}},res=>{
      if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){
        res.resume(); return resolve(getText(new URL(res.headers.location,url).toString(),redirects+1))
      }
      if(res.statusCode!==200){res.resume();return reject(new Error(`HTTP ${res.statusCode}`))}
      let body=''; res.setEncoding('utf8')
      res.on('data',c=>body+=c)
      res.on('end',()=>resolve(body))
    })
    req.setTimeout(30000,()=>req.destroy(new Error('Download timed out')))
    req.on('error',reject)
  })
}

async function getJson(url){ return JSON.parse(await getText(url)) }

function clean(s){ return String(s||'').replace(/\uFEFF/g,'').replace(/\s+/g,' ').trim() }

function parseEnglishBible(text, format) {
  const out=[]
  const lines=text.replace(/\r/g,'').split('\n')
  let book='', chapter=0

  const explicit = [
    /^(.+?)\s+(\d+):(\d+)\s+(.+)$/,
    /^(.+?)\|(\d+)\|(\d+)\|(.+)$/,
    /^(.+?)\t(\d+)\t(\d+)\t(.+)$/
  ]

  for(const raw of lines){
    const line=raw.trim()
    if(!line) continue

    let matched=false
    for(const rx of explicit){
      const m=line.match(rx)
      if(m){
        const b=clean(m[1]), c=Number(m[2]), v=Number(m[3]), t=clean(m[4])
        if(b&&c&&v&&t){out.push({book:b,chapter:c,verse:v,text:t}); book=b; chapter=c; matched=true; break}
      }
    }
    if(matched) continue

    // f3 normally starts each chapter with a book/chapter header.
    let m=line.match(/^(.+?)\s+(\d+)\s*$/)
    if(m && !/^\d/.test(m[1])){
      book=clean(m[1]); chapter=Number(m[2]); continue
    }

    // f2 starts each book/chapter section with headers, then "verse text" rows.
    if(!/^\d+\b/.test(line) && line.length<80 && !/[.!?;:]$/.test(line)){
      if(format==='f2' || format==='f3'){
        const maybeChapter=line.match(/^(.+?)\s+Chapter\s+(\d+)$/i)
        if(maybeChapter){book=clean(maybeChapter[1]);chapter=Number(maybeChapter[2]);continue}
        if(!book){book=clean(line);continue}
      }
    }

    m=line.match(/^(\d+)[\s\t|.:-]+(.+)$/)
    if(m && book && chapter){
      const verse=Number(m[1]), t=clean(m[2])
      if(verse&&t) out.push({book,chapter,verse,text:t})
    }
  }

  if(out.length<100){
    throw new Error(`Could not parse this repository Bible format (${format}); only ${out.length} verses were detected.`)
  }
  return out
}

function flattenDamaralsBook(payload, bookCode){
  const book=clean(payload?.name) || BOOKS[bookCode] || bookCode
  const out=[]
  const chapters = Array.isArray(payload) ? payload : (payload.chapters || payload.data || [])
  for(const ch of chapters){
    const chapter=Number(ch.number ?? ch.chapter ?? ch.nr)
    const verses=Array.isArray(ch.verses)?ch.verses:[]
    for(const v of verses){
      const verse=Number(v.number ?? v.verse ?? v.nr)
      const text=clean(v.text ?? v.content)
      if(chapter&&verse&&text) out.push({book,chapter,verse,text})
    }
  }
  return out
}

async function downloadEnglish(entry){
  const url=`https://raw.githubusercontent.com/public-domain-bibles/english/master/${encodeURIComponent(entry.repoFile)}`
  const text=await getText(url)
  return parseEnglishBible(text,entry.format)
}

async function downloadDamarals(entry){
  const code=entry.repoTranslation
  const api=`https://api.github.com/repos/damarals/biblias/contents/data/canonical/${encodeURIComponent(code)}?ref=main`
  const listing=await getJson(api)
  if(!Array.isArray(listing)) throw new Error('Unexpected GitHub directory response.')
  const books=listing.filter(x=>x.type==='file'&&x.name.endsWith('.json')&&x.name!=='meta.json')
  const all=[]
  for(const file of books){
    const bookCode=file.name.replace(/\.json$/i,'').toUpperCase()
    const raw=file.download_url || `https://raw.githubusercontent.com/damarals/biblias/main/data/canonical/${code}/${file.name}`
    const payload=await getJson(raw)
    all.push(...flattenDamaralsBook(payload,bookCode))
  }
  if(all.length<100) throw new Error(`Only ${all.length} verses were found in ${code}.`)
  return all
}

async function downloadRepoBible(entry){
  if(entry.sourceType==='englishText') return downloadEnglish(entry)
  if(entry.sourceType==='damaralsCanonical') return downloadDamarals(entry)
  throw new Error('Unsupported repository Bible source.')
}

module.exports={downloadRepoBible,parseEnglishBible,flattenDamaralsBook}
