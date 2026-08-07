const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

const defaultThemes = [
  {id:'theme-classic-gold',name:'Classic Gold',fontFamily:'Georgia, Times New Roman, serif',fontSize:64,alignment:'center',overlay:.54,textColor:'#f4f2ed',accentColor:'#d7a640',transition:'fade'},
  {id:'theme-minimal',name:'Minimal Charcoal',fontFamily:'Arial, Helvetica, sans-serif',fontSize:60,alignment:'left',overlay:.66,textColor:'#f4f2ed',accentColor:'#f0c86a',transition:'cut'},
  {id:'theme-stage',name:'Warm Sermon',fontFamily:'Georgia, Times New Roman, serif',fontSize:70,alignment:'center',overlay:.44,textColor:'#fffaf0',accentColor:'#f0c86a',transition:'fade'}
]
const sampleVerses = [
  ['WEB','Genesis',1,1,'In the beginning, God created the heavens and the earth.'],
  ['WEB','Psalm',23,1,'Yahweh is my shepherd: I shall lack nothing.'],
  ['WEB','Psalm',23,4,'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me.'],
  ['WEB','John',1,1,'In the beginning was the Word, and the Word was with God, and the Word was God.'],
  ['WEB','John',3,16,'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.'],
  ['WEB','Romans',8,28,'We know that all things work together for good for those who love God, to those who are called according to his purpose.'],
  ['WEB','Philippians',4,13,'I can do all things through Christ, who strengthens me.']
]

class VerseFlowDb {
  constructor(file) { this.file=file; this.db=null; this.SQL=null }
  async init() {
    const wasmDir = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'))
    this.SQL = await initSqlJs({ locateFile: f => path.join(wasmDir, f) })
    this.db = fs.existsSync(this.file) ? new this.SQL.Database(fs.readFileSync(this.file)) : new this.SQL.Database()
    this.migrate()
    this.persist()
  }
  migrate() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS translations (code TEXT PRIMARY KEY, name TEXT NOT NULL, license TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS verses (id INTEGER PRIMARY KEY AUTOINCREMENT, translation TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS objects (entity TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(entity,id));
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS favorites (verse_id INTEGER PRIMARY KEY);
    `)
    this.db.run('INSERT OR IGNORE INTO translations(code,name,license) VALUES (?,?,?)',['WEB','World English Bible','Public Domain — bundled development sample'])
    const c = this.one('SELECT COUNT(*) AS n FROM verses')
    if (!c || c.n === 0) {
      const stmt = this.db.prepare('INSERT INTO verses(translation,book,chapter,verse,text) VALUES (?,?,?,?,?)')
      for (const v of sampleVerses) stmt.run(v)
      stmt.free()
    }
    for (const t of defaultThemes) this.putObject('themes', t.id, t, false)
    if (!this.listObjects('songs').length) {
      const song={id:'song-amazing-grace',title:'Amazing Grace',author:'John Newton',sections:[
        {id:'v1',label:'Verse 1',lines:['Amazing grace, how sweet the sound','That saved a wretch like me']},
        {id:'v2',label:'Verse 2',lines:['I once was lost, but now am found','Was blind, but now I see']}
      ]}
      this.putObject('songs',song.id,song,false)
    }
  }
  rows(sql, params=[]) {
    const stmt=this.db.prepare(sql); stmt.bind(params); const out=[]
    while(stmt.step()) out.push(stmt.getAsObject())
    stmt.free(); return out
  }
  one(sql,params=[]){return this.rows(sql,params)[0]}
  listObjects(entity){return this.rows('SELECT json FROM objects WHERE entity=? ORDER BY updated_at DESC',[entity]).map(r=>JSON.parse(r.json))}
  putObject(entity,id,value,persist=true){
    this.db.run('INSERT OR REPLACE INTO objects(entity,id,json,updated_at) VALUES (?,?,?,?)',[entity,String(id),JSON.stringify(value),new Date().toISOString()])
    if(persist)this.persist()
  }
  removeObject(entity,id){this.db.run('DELETE FROM objects WHERE entity=? AND id=?',[entity,String(id)]);this.persist()}
  loadAll(){
    const settings={}
    for(const r of this.rows('SELECT key,json FROM settings')) settings[r.key]=JSON.parse(r.json)
    return {
      verses:this.rows('SELECT * FROM verses ORDER BY book, chapter, verse'),
      translations:this.rows('SELECT code,name,license FROM translations ORDER BY name'),
      songs:this.listObjects('songs'), media:this.listObjects('media'), services:this.listObjects('services'),
      themes:this.listObjects('themes'), settings, favorites:this.rows('SELECT verse_id FROM favorites').map(r=>r.verse_id)
    }
  }

  importTranslation(payload){
    if(!payload||typeof payload!=='object') throw new Error('Bible JSON must be an object.')
    const code=String(payload.translation||'').trim().toUpperCase()
    const name=String(payload.name||code).trim()
    const license=String(payload.license||'').trim()
    const verses=Array.isArray(payload.verses)?payload.verses:[]
    if(!code||code.length>24) throw new Error('Missing or invalid translation code.')
    if(!license) throw new Error('A license/public-domain note is required.')
    if(!verses.length) throw new Error('No verses were found in this JSON file.')
    const seen=new Set(), clean=[]
    for(const v of verses){
      const book=String(v.book||'').trim(), chapter=Number(v.chapter), verse=Number(v.verse), text=String(v.text||'').trim()
      if(!book||!Number.isInteger(chapter)||chapter<1||!Number.isInteger(verse)||verse<1||!text) throw new Error('Every verse needs book, positive chapter/verse numbers, and text.')
      const key=`${book.toLowerCase()}|${chapter}|${verse}`; if(seen.has(key)) throw new Error(`Duplicate verse: ${book} ${chapter}:${verse}`); seen.add(key); clean.push([code,book,chapter,verse,text])
    }
    this.db.run('BEGIN')
    try{
      this.db.run('DELETE FROM verses WHERE translation=?',[code])
      this.db.run('INSERT OR REPLACE INTO translations(code,name,license) VALUES (?,?,?)',[code,name,license])
      const stmt=this.db.prepare('INSERT INTO verses(translation,book,chapter,verse,text) VALUES (?,?,?,?,?)')
      for(const row of clean) stmt.run(row)
      stmt.free(); this.db.run('COMMIT'); this.persist(); return {translation:code,imported:clean.length}
    }catch(e){this.db.run('ROLLBACK');throw e}
  }
  setSetting(key,value){this.db.run('INSERT OR REPLACE INTO settings(key,json) VALUES (?,?)',[String(key),JSON.stringify(value)]);this.persist()}
  persist(){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file,Buffer.from(this.db.export()))}
  replaceFrom(file){const bytes=fs.readFileSync(file); if(this.db)this.db.close(); this.db=new this.SQL.Database(bytes);this.migrate();this.persist()}
}
module.exports={VerseFlowDb}
