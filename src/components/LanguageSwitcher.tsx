import type { Language } from '../i18n'
import brazilFlag from '../assets/brazil-flag.png'
import usFlag from '../assets/us-flag.svg'
import spainFlag from '../assets/spain-flag.svg'

export default function LanguageSwitcher({language,onChange}:{language:Language;onChange:(language:Language)=>void}){
  return <div className="language-switcher" aria-label="Language">
    <button className={language==='en'?'active':''} title="English" onClick={()=>onChange('en')}><img src={usFlag}/><span>EN</span></button>
    <button className={language==='pt'?'active':''} title="Português do Brasil" onClick={()=>onChange('pt')}><img src={brazilFlag}/><span>PT</span></button>
    <button className={language==='es'?'active':''} title="Español" onClick={()=>onChange('es')}><img src={spainFlag}/><span>ES</span></button>
  </div>
}
