export interface BackgroundPreset {
  id: string
  name: string
  category: 'Light' | 'Nature' | 'Worship' | 'Calm'
  src: string
}

function svgData(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function scene(name: string, colors: string[], body: string) {
  const [a,b,c,d] = colors
  return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="${name}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="0.48" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${d}" stop-opacity=".92"/><stop offset="1" stop-color="${d}" stop-opacity="0"/></radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="32"/></filter>
    </defs>
    <rect width="1600" height="900" fill="url(#bg)"/>
    ${body}
  </svg>`)
}

export const builtInBackgrounds: BackgroundPreset[] = [
  {id:'bg-golden-dawn',name:'Golden Dawn',category:'Light',src:scene('Golden Dawn',['#25180f','#7b4424','#d69b54','#ffd99a'],`<circle cx="1230" cy="205" r="330" fill="url(#glow)"/><path d="M0 700 Q300 570 560 680 T1100 650 T1600 670 V900 H0Z" fill="#160f0b" opacity=".82"/>`)},
  {id:'bg-blue-heaven',name:'Blue Heaven',category:'Calm',src:scene('Blue Heaven',['#071b31','#0e4268','#6e9fb8','#d9f2ff'],`<circle cx="1180" cy="190" r="370" fill="url(#glow)" opacity=".62"/><path d="M0 690 Q250 610 510 690 T980 675 T1600 700 V900 H0Z" fill="#061421" opacity=".72"/>`)},
  {id:'bg-purple-worship',name:'Purple Worship',category:'Worship',src:scene('Purple Worship',['#160b25','#472364','#a04c82','#f5b8dc'],`<ellipse cx="820" cy="180" rx="520" ry="300" fill="url(#glow)" opacity=".35"/><path d="M720 900 L775 330 L825 330 L880 900Z" fill="#fff" opacity=".07"/><path d="M0 760 Q350 650 700 760 T1400 740 T1600 760 V900 H0Z" fill="#100819" opacity=".75"/>`)},
  {id:'bg-cross-light',name:'Cross Light',category:'Worship',src:scene('Cross Light',['#090909','#332614','#7d5a24','#ffe9a8'],`<circle cx="800" cy="360" r="410" fill="url(#glow)" opacity=".38"/><rect x="775" y="210" width="50" height="480" rx="8" fill="#f7df9a" opacity=".65"/><rect x="620" y="350" width="360" height="50" rx="8" fill="#f7df9a" opacity=".65"/><path d="M0 790 Q400 700 800 790 T1600 790 V900 H0Z" fill="#050505" opacity=".92"/>`)},
  {id:'bg-mountain-morning',name:'Mountain Morning',category:'Nature',src:scene('Mountain Morning',['#1d3540','#58707a','#d3b48b','#fff0c5'],`<circle cx="1250" cy="210" r="300" fill="url(#glow)" opacity=".55"/><path d="M0 760 L330 410 L560 670 L800 300 L1090 650 L1310 430 L1600 730 V900 H0Z" fill="#13242b" opacity=".82"/><path d="M0 820 L390 570 L620 760 L930 500 L1210 760 L1600 590 V900 H0Z" fill="#0b171c" opacity=".88"/>`)},
  {id:'bg-ocean-peace',name:'Ocean Peace',category:'Nature',src:scene('Ocean Peace',['#051d2a','#0d5366','#5fa6a8','#e8f5dc'],`<circle cx="1180" cy="180" r="320" fill="url(#glow)" opacity=".5"/><path d="M0 590 Q210 555 420 600 T840 600 T1260 585 T1600 610 V900 H0Z" fill="#0b4352" opacity=".9"/><path d="M0 680 Q240 640 480 690 T960 690 T1440 675 T1600 690" fill="none" stroke="#b8e0d7" stroke-opacity=".2" stroke-width="10"/>`)},
  {id:'bg-forest-light',name:'Forest Light',category:'Nature',src:scene('Forest Light',['#061812','#183d2e','#59754f','#f4ddb0'],`<circle cx="830" cy="160" r="360" fill="url(#glow)" opacity=".32"/><path d="M120 900 L280 250 L360 900M390 900 L480 110 L570 900M1080 900 L1180 130 L1270 900M1320 900 L1460 280 L1540 900" stroke="#06110d" stroke-width="100" opacity=".72"/><path d="M0 760 Q380 680 760 760 T1520 755 L1600 900 H0Z" fill="#07130f" opacity=".82"/>`)},
  {id:'bg-night-stars',name:'Night Stars',category:'Calm',src:scene('Night Stars',['#030611','#0b1633','#1a3153','#8eb7e8'],`<circle cx="1270" cy="170" r="190" fill="url(#glow)" opacity=".38"/><g fill="#fff" opacity=".6">${Array.from({length:26},(_,i)=>`<circle cx="${80+(i*173)%1480}" cy="${70+(i*97)%480}" r="${1+(i%3)}"/>`).join('')}</g><path d="M0 800 Q350 680 700 790 T1400 770 T1600 800 V900 H0Z" fill="#010309" opacity=".9"/>`)},
  {id:'bg-rose-clouds',name:'Rose Clouds',category:'Light',src:scene('Rose Clouds',['#3c1d2d','#88485d','#d78f8e','#ffe1be'],`<circle cx="1200" cy="170" r="330" fill="url(#glow)" opacity=".55"/><g fill="#f6d2cf" opacity=".12" filter="url(#blur)"><ellipse cx="380" cy="320" rx="250" ry="95"/><ellipse cx="760" cy="230" rx="300" ry="110"/><ellipse cx="1220" cy="390" rx="280" ry="100"/></g><path d="M0 790 Q420 710 800 785 T1600 790 V900 H0Z" fill="#2b1420" opacity=".78"/>`)},
  {id:'bg-emerald-calm',name:'Emerald Calm',category:'Calm',src:scene('Emerald Calm',['#071713','#0b3c34','#24766b','#c8f0c8'],`<circle cx="1090" cy="210" r="380" fill="url(#glow)" opacity=".28"/><path d="M0 720 Q260 600 520 720 T1040 700 T1600 720 V900 H0Z" fill="#05110e" opacity=".75"/><path d="M0 590 Q290 525 580 590 T1160 575 T1600 590" fill="none" stroke="#bce5cc" stroke-opacity=".11" stroke-width="8"/>`)},
  {id:'bg-warm-embers',name:'Warm Embers',category:'Worship',src:scene('Warm Embers',['#120805','#4d1d0d','#ad5420','#ffcb75'],`<circle cx="800" cy="260" r="420" fill="url(#glow)" opacity=".3"/><g fill="#ffd28a" opacity=".28">${Array.from({length:18},(_,i)=>`<circle cx="${130+(i*149)%1350}" cy="${500+(i*83)%290}" r="${2+(i%5)}"/>`).join('')}</g><path d="M0 800 Q400 720 800 800 T1600 800 V900 H0Z" fill="#0a0403" opacity=".92"/>`)},
  {id:'bg-soft-sand',name:'Soft Sand',category:'Light',src:scene('Soft Sand',['#493b2e','#8d765d','#c8ad87','#fff0c9'],`<circle cx="1180" cy="190" r="360" fill="url(#glow)" opacity=".45"/><path d="M0 660 Q280 560 560 665 T1120 650 T1600 675 V900 H0Z" fill="#423326" opacity=".72"/><path d="M0 750 Q320 680 640 750 T1280 745 T1600 760" fill="none" stroke="#f5dfba" stroke-opacity=".1" stroke-width="16"/>`)}
]
