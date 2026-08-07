import type { PresentationState, ServiceItem, Theme, Verse } from './types'

export const defaultTheme: Theme = {
  id: 'theme-classic-gold',
  name: 'Classic Gold',
  fontFamily: 'Georgia, Times New Roman, serif',
  fontSize: 64,
  alignment: 'center',
  overlay: 0.54,
  textColor: '#f4f2ed',
  accentColor: '#d7a640',
  transition: 'fade'
}

export function verseToServiceItem(v: Verse): ServiceItem {
  return {
    id: `verse-${v.translation}-${v.book}-${v.chapter}-${v.verse}`,
    type: 'scripture',
    title: `${v.book} ${v.chapter}:${v.verse}`,
    subtitle: v.translation,
    payload: { text: v.text, reference: `${v.book} ${v.chapter}:${v.verse}` }
  }
}

export function itemToPresentation(item: ServiceItem | undefined, next: ServiceItem | undefined, theme: Theme, sequence = 0): PresentationState {
  if (!item) {
    return {
      sequence, mode: 'idle', title: '', text: '', reference: '', nextTitle: next?.title || '',
      theme, black: false, clearText: false, logo: false, frozen: false, backgroundType: 'solid', video: {playing:true,muted:true,volume:0.8,loop:true}
    }
  }
  const p = item.payload || {}
  return {
    sequence,
    mode: 'preview',
    itemId: item.id,
    title: item.title,
    text: String(p.text || p.lyrics || item.subtitle || item.title),
    reference: String(p.reference || item.subtitle || ''),
    nextTitle: next?.title || '',
    background: typeof p.background === 'string' ? p.background : undefined,
    backgroundType: (p.backgroundType as PresentationState['backgroundType']) || 'solid',
    theme,
    black: false,
    clearText: false,
    logo: false,
    frozen: false,
    notes: typeof p.notes === 'string' ? p.notes : '',
    video: {playing:true,muted:true,volume:0.8,loop:true}
  }
}
