export type ModuleKey = 'dashboard' | 'bible' | 'songs' | 'media' | 'playlists' | 'present' | 'themes' | 'settings'
export type OutputKind = 'audience' | 'stage'

export interface DisplayInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  primary: boolean
}

export interface Verse {
  id: number
  translation: string
  book: string
  chapter: number
  verse: number
  text: string
}

export interface SongSection {
  id: string
  label: string
  lines: string[]
}

export interface Song {
  id: string
  title: string
  author?: string
  ccli?: string
  key?: string
  sections: SongSection[]
}

export interface MediaItem {
  id: string
  name: string
  path: string
  type: 'image' | 'video' | 'audio'
  favorite?: boolean
}

export interface ServiceItem {
  id: string
  type: 'scripture' | 'song' | 'image' | 'video' | 'announcement'
  title: string
  subtitle?: string
  payload: Record<string, unknown>
}

export interface Theme {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  alignment: 'left' | 'center' | 'right'
  overlay: number
  textColor: string
  accentColor: string
  background?: string
  transition: 'fade' | 'cut' | 'slide'
}

export interface PresentationState {
  sequence: number
  mode: 'idle' | 'preview' | 'live'
  itemId?: string
  title: string
  text: string
  reference: string
  nextTitle: string
  background?: string
  backgroundType?: 'image' | 'video' | 'solid'
  theme: Theme
  black: boolean
  clearText: boolean
  logo: boolean
  frozen: boolean
  clock?: string
  countdownSeconds?: number
  notes?: string
  video?: { playing: boolean; muted: boolean; volume: number; loop: boolean; seekDelta?: number; commandId?: number }
}

export interface BibleTranslation { code: string; name: string; license: string }

export interface BibleCatalogItem {
  code: string
  name: string
  language: string
  status: 'download' | 'import'
  license: string
  source: string
  url?: string
}

export interface AppData {
  verses: Verse[]
  translations: BibleTranslation[]
  songs: Song[]
  media: MediaItem[]
  services: { id: string; title: string; date: string; items: ServiceItem[] }[]
  themes: Theme[]
  settings: Record<string, unknown>
  favorites: number[]
}

export interface VerseFlowApi {
  getDisplays: () => Promise<DisplayInfo[]>
  openOutput: (kind: OutputKind, displayId: number) => Promise<{ ok: boolean; error?: string }>
  closeOutput: (kind: OutputKind) => Promise<void>
  sendPresentationState: (state: PresentationState) => void
  onPresentationState: (callback: (state: PresentationState) => void) => () => void
  getPresentationState: () => Promise<PresentationState | null>
  pickMedia: () => Promise<MediaItem[]>
  importBible: () => Promise<{ ok: boolean; imported?: number; translation?: string; error?: string }>
  getBibleCatalog: () => Promise<BibleCatalogItem[]>
  installBibleFromCatalog: (code: string) => Promise<{ ok: boolean; imported?: number; translation?: string; error?: string }>
  loadData: () => Promise<AppData>
  upsert: (entity: string, value: unknown) => Promise<{ ok: boolean; error?: string }>
  saveSetting: (key: string, value: unknown) => Promise<{ ok: boolean; error?: string }>
  remove: (entity: string, id: string | number) => Promise<{ ok: boolean; error?: string }>
  exportBackup: () => Promise<{ ok: boolean; path?: string; error?: string }>
  importBackup: () => Promise<{ ok: boolean; error?: string }>
  integrationHealth: (url: string) => Promise<{ ok: boolean; status?: number; error?: string }>
  appInfo: () => Promise<{ version: string; dataPath: string }>
}

declare global {
  interface Window { verseflow?: VerseFlowApi }
}
