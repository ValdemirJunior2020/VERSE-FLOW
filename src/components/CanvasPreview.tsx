import type { PresentationState } from '../types'

function fileUrl(path?: string) {
  if (!path) return ''
  return `file:///${path.replace(/\\/g, '/')}`
}

export default function CanvasPreview({ state, live }: { state: PresentationState; live: boolean }) {
  const isImg = state.backgroundType === 'image' && state.background
  return <div className="canvas-wrap">
    <div className="canvas-status"><span className={live ? 'live-dot' : 'preview-dot'} /> {live ? 'LIVE' : 'PREVIEW'}</div>
    <div className="presentation-canvas" style={{
      backgroundImage: isImg ? `linear-gradient(rgba(0,0,0,${state.theme.overlay}),rgba(0,0,0,${state.theme.overlay})),url("${fileUrl(state.background)}")` : undefined
    }}>
      {state.backgroundType === 'video' && state.background && <video src={fileUrl(state.background)} autoPlay loop muted />}
      <div className={`canvas-copy align-${state.theme.alignment}`} style={{fontFamily:state.theme.fontFamily,color:state.theme.textColor}}>
        {state.black ? <div className="screen-mode-label">BLACK SCREEN</div> : state.logo ? <div className="vf-logo-mark large">VF</div> : <>
          {!state.clearText && <div className="canvas-text" style={{fontSize:`${Math.max(22,state.theme.fontSize*.43)}px`}}>{state.text || 'Select a scripture, song, image, or announcement.'}</div>}
          {!state.clearText && <div className="canvas-ref" style={{color:state.theme.accentColor}}>{state.reference}</div>}
        </>}
      </div>
    </div>
  </div>
}
