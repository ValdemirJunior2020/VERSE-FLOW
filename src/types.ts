export type ModuleKey = 'dashboard' | 'bible' | 'songs' | 'media' | 'playlists' | 'present' | 'themes' | 'production' | 'settings'
export type OutputKind = 'audience' | 'stage'

export interface DisplayInfo {
  id: number
  index: number
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
  role?: 'media' | 'background'
}

export interface ServiceItem {
  id: string
  type: 'scripture' | 'song' | 'image' | 'video' | 'audio' | 'announcement'
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
  youtubeId?: string
  youtubeAutoplay?: boolean
  theme: Theme
  black: boolean
  clearText: boolean
  logo: boolean
  frozen: boolean
  clock?: string
  countdownSeconds?: number
  notes?: string
  layout?: 'center' | 'lower-third' | 'countdown'
  timerEndAt?: number
  timerLabel?: string
  video?: { playing: boolean; muted: boolean; volume: number; loop: boolean; seekDelta?: number; commandId?: number }
  audio?: { path: string; playing: boolean; volume: number; loop: boolean }
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
  bundledFile?: string
}

export interface AppData {
  verses: Verse[]
  verseCount: number
  translations: BibleTranslation[]
  songs: Song[]
  media: MediaItem[]
  services: { id: string; title: string; date: string; items: ServiceItem[] }[]
  themes: Theme[]
  settings: Record<string, unknown>
  favorites: number[]
}


export type SmartAction = 'SHOW_VERSE' | 'SHOW_TEXT' | 'BLACK' | 'CLEAR_TEXT' | 'LOGO' | 'SET_TEXT_COLOR' | 'SET_ACCENT_COLOR' | 'FIND_SONG' | 'FIND_MEDIA' | 'START_TIMER' | 'SHOW_LOWER_THIRD' | 'STOP_AUDIO' | 'NO_ACTION'

export interface SmartPlan {
  action: SmartAction
  reference?: string
  translation?: string
  text?: string
  query?: string
  color?: string
  message?: string
  minutes?: number
  label?: string
}

export interface ToolStatus {
  ollamaInstalled: boolean
  ollamaRunning: boolean
  ollamaVersion?: string
  modelInstalled: boolean
  model: string
  ytDlpInstalled: boolean
  ytDlpVersion?: string
  denoInstalled: boolean
  denoVersion?: string
  ffmpegInstalled: boolean
  ffmpegVersion?: string
  mpvInstalled: boolean
  mpvVersion?: string
  whisperInstalled: boolean
  whisperModelInstalled: boolean
  obsInstalled: boolean
  obsRunning: boolean
  hyperframesInstalled: boolean
  hyperframesVersion?: string
  companionInstalled: boolean
  companionRunning: boolean
  companionApi: string
}

export interface SystemCheckItem { id: string; label: string; ok: boolean; detail: string; optional?: boolean }
export interface SystemCheckResult { ok: boolean; summary: string; checks: SystemCheckItem[]; logPath: string }

export interface DisplayStatus { connected: boolean; open: boolean; openOnSelected: boolean; selectedDisplayId: number | null; selected: DisplayInfo | null; displays: DisplayInfo[] }

export interface VerseFlowApi {
  getDisplays: () => Promise<DisplayInfo[]>
  identifyDisplays: () => Promise<{ ok: boolean; displays: DisplayInfo[]; error?: string }>
  getDisplayStatus: (displayId?: number | null) => Promise<DisplayStatus>
  onDisplaysChanged: (callback: () => void) => () => void
  openOutput: (kind: OutputKind, displayId: number) => Promise<{ ok: boolean; error?: string }>
  closeOutput: (kind: OutputKind) => Promise<void>
  sendPresentationState: (state: PresentationState) => void
  onPresentationState: (callback: (state: PresentationState) => void) => () => void
  getPresentationState: () => Promise<PresentationState | null>
  pickMedia: () => Promise<MediaItem[]>
  importBible: () => Promise<{ ok: boolean; imported?: number; translation?: string; error?: string }>
  getBibleCatalog: () => Promise<BibleCatalogItem[]>
  getBibleVerses: (code: string) => Promise<Verse[]>
  getBibleBooks: (code: string) => Promise<string[]>
  getBibleChapters: (code: string, book: string) => Promise<number[]>
  getBibleChapter: (code: string, book: string, chapter: number) => Promise<Verse[]>
  searchBible: (query: string, code?: string, limit?: number) => Promise<Verse[]>
  getBibleReference: (reference: string, code?: string) => Promise<Verse | null>
  installBibleFromCatalog: (code: string) => Promise<{ ok: boolean; imported?: number; translation?: string; error?: string }>
  loadData: () => Promise<AppData>
  upsert: (entity: string, value: unknown) => Promise<{ ok: boolean; error?: string }>
  saveSetting: (key: string, value: unknown) => Promise<{ ok: boolean; error?: string }>
  remove: (entity: string, id: string | number) => Promise<{ ok: boolean; error?: string }>
  exportBackup: () => Promise<{ ok: boolean; path?: string; error?: string }>
  importBackup: () => Promise<{ ok: boolean; error?: string }>
  integrationHealth: (url: string) => Promise<{ ok: boolean; status?: number; error?: string }>
  appInfo: () => Promise<{ version: string; dataPath: string }>
  toolStatus: () => Promise<ToolStatus>
  openOptionalToolsInstaller: () => Promise<{ ok: boolean; error?: string }>
  smartCommand: (command: string, context: Record<string, unknown>) => Promise<{ ok: boolean; engine?: string; plan?: SmartPlan; error?: string }>
  downloadMediaUrl: (url: string) => Promise<{ ok: boolean; item?: MediaItem; error?: string }>
  mpvLaunch: (path: string, screenIndex?: number) => Promise<{ ok: boolean; error?: string }>
  mpvCommand: (command: 'pause'|'stop'|'seekBack'|'seekForward'|'volume50'|'volume100') => Promise<{ ok: boolean; error?: string }>
  ffmpegProbe: (path: string) => Promise<{ ok: boolean; summary?: string; error?: string }>
  ffmpegCompatible: (path: string) => Promise<{ ok: boolean; item?: MediaItem; error?: string }>
  whisperStart: (language?: string) => Promise<{ ok: boolean; error?: string }>
  whisperStop: () => Promise<{ ok: boolean; error?: string }>
  onWhisperCaption: (callback: (text: string) => void) => () => void
  onCompanionAction: (callback: (action: string) => void) => () => void
  obsOpen: () => Promise<{ ok: boolean; error?: string }>
  obsConnect: (host: string, port: number, password: string) => Promise<{ ok: boolean; scenes?: string[]; currentScene?: string; error?: string }>
  obsScenes: () => Promise<{ ok: boolean; scenes?: string[]; currentScene?: string; error?: string }>
  obsSetScene: (scene: string) => Promise<{ ok: boolean; error?: string }>
  obsControl: (action: 'startRecord'|'stopRecord'|'startStream'|'stopStream') => Promise<{ ok: boolean; error?: string }>
  hyperframesStudio: () => Promise<{ ok: boolean; url?: string; error?: string }>
  hyperframesRender: () => Promise<{ ok: boolean; path?: string; error?: string }>
  companionOpen: () => Promise<{ ok: boolean; error?: string }>
  copyText: (text: string) => Promise<{ ok: boolean }>
  systemCheck: () => Promise<SystemCheckResult>
  logError: (source: string, message: string, stack?: string) => Promise<{ ok: boolean; path?: string }>
}


declare global {
  interface Window { verseflow?: VerseFlowApi }
}
