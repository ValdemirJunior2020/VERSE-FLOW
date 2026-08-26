import { BookOpen, Gauge, Images, ListMusic, MonitorPlay, Palette, Settings, SquarePlay, Music2, SlidersHorizontal } from 'lucide-react'
import type { ModuleKey } from '../types'

const items: {key:ModuleKey; label:string; icon:any}[] = [
  {key:'dashboard',label:'Dashboard',icon:Gauge},
  {key:'bible',label:'Bible',icon:BookOpen},
  {key:'songs',label:'Songs',icon:Music2},
  {key:'media',label:'Media',icon:Images},
  {key:'playlists',label:'Playlists',icon:ListMusic},
  {key:'present',label:'Live Desk',icon:MonitorPlay},
  {key:'themes',label:'Themes',icon:Palette},
  {key:'production',label:'Production',icon:SlidersHorizontal},
  {key:'settings',label:'Settings',icon:Settings},
]

export default function Nav({active,onChange}:{active:ModuleKey,onChange:(m:ModuleKey)=>void}) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">V</div><div><strong>VerseFlow</strong><span>Church Presentation</span></div></div>
    <nav>{items.map(({key,label,icon:Icon})=><button key={key} className={active===key?'active':''} onClick={()=>onChange(key)}><Icon size={18}/><span>{label}</span></button>)}</nav>
    <div className="sidebar-footer"><SquarePlay size={16}/><span>Offline Ready</span></div>
  </aside>
}
