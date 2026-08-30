const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('verseflow', {
  getDisplays: () => ipcRenderer.invoke('display:list'),
  identifyDisplays: () => ipcRenderer.invoke('display:identify'),
  getDisplayStatus: (displayId) => ipcRenderer.invoke('display:status', displayId),
  onDisplaysChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('display:changed', listener)
    return () => ipcRenderer.removeListener('display:changed', listener)
  },
  openOutput: (kind, displayId) => ipcRenderer.invoke('display:open', { kind, displayId }),
  closeOutput: (kind) => ipcRenderer.invoke('display:close', kind),
  sendPresentationState: (state) => ipcRenderer.send('presentation:set', state),
  onPresentationState: (callback) => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('presentation:state', listener)
    return () => ipcRenderer.removeListener('presentation:state', listener)
  },
  getPresentationState: () => ipcRenderer.invoke('presentation:get'),
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  importBible: () => ipcRenderer.invoke('bible:import'),
  getBibleCatalog: () => ipcRenderer.invoke('bible:catalog'),
  getBibleVerses: (code) => ipcRenderer.invoke('bible:verses', code),
  getBibleBooks: (code) => ipcRenderer.invoke('bible:books', code),
  getBibleChapters: (code, book) => ipcRenderer.invoke('bible:chapters', { code, book }),
  getBibleChapter: (code, book, chapter) => ipcRenderer.invoke('bible:chapter', { code, book, chapter }),
  searchBible: (query, code, limit) => ipcRenderer.invoke('bible:search', { query, code, limit }),
  getBibleReference: (reference, code) => ipcRenderer.invoke('bible:reference', { reference, code }),
  suggestBibleReferences: (reference, code, limit) => ipcRenderer.invoke('bible:suggest', { reference, code, limit }),
  installBibleFromCatalog: (code) => ipcRenderer.invoke('bible:install-catalog', code),
  loadData: () => ipcRenderer.invoke('data:load'),
  upsert: (entity, value) => ipcRenderer.invoke('data:upsert', { entity, value }),
  saveSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  remove: (entity, id) => ipcRenderer.invoke('data:remove', { entity, id }),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  integrationHealth: (url) => ipcRenderer.invoke('integration:health', url),
  appInfo: () => ipcRenderer.invoke('app:info'),
  toolStatus: () => ipcRenderer.invoke('tools:status'),
  openOptionalToolsInstaller: () => ipcRenderer.invoke('tools:open-installer'),
  smartCommand: (command, context) => ipcRenderer.invoke('smart:command', { command, context }),
  internetToolsStatus: () => ipcRenderer.invoke('internet:status'),
  installInternetAgentTools: () => ipcRenderer.invoke('internet:install'),
  searchInternetSongs: (query) => ipcRenderer.invoke('lyrics:internet-search', { query }),
  extractInternetPage: (url) => ipcRenderer.invoke('internet:extract', { url }),
  openInternetSource: (url) => ipcRenderer.invoke('internet:open-source', { url }),
  importAuthorizedLyrics: () => ipcRenderer.invoke('lyrics:import-authorized'),
  exportLyricsText: (title, text) => ipcRenderer.invoke('lyrics:export-text', { title, text }),
  organizeLyrics: (text) => ipcRenderer.invoke('lyrics:organize', { text }),
  generateOriginalLyrics: (prompt) => ipcRenderer.invoke('lyrics:generate-original', { prompt }),
  downloadMediaUrl: (url) => ipcRenderer.invoke('media:download-url', url),
  mpvLaunch: (path, screenIndex) => ipcRenderer.invoke('mpv:launch', { path, screenIndex }),
  mpvCommand: (command) => ipcRenderer.invoke('mpv:command', command),
  ffmpegProbe: (path) => ipcRenderer.invoke('ffmpeg:probe', path),
  ffmpegCompatible: (path) => ipcRenderer.invoke('ffmpeg:compatible', path),
  whisperStart: (language) => ipcRenderer.invoke('whisper:start', language),
  whisperStop: () => ipcRenderer.invoke('whisper:stop'),
  onWhisperCaption: (callback) => {
    const listener = (_event, text) => callback(text)
    ipcRenderer.on('whisper:caption', listener)
    return () => ipcRenderer.removeListener('whisper:caption', listener)
  },
  onCompanionAction: (callback) => {
    const listener = (_event, action) => callback(action)
    ipcRenderer.on('companion:action', listener)
    return () => ipcRenderer.removeListener('companion:action', listener)
  },
  onTaskProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('task:progress', listener)
    return () => ipcRenderer.removeListener('task:progress', listener)
  },
  obsOpen: () => ipcRenderer.invoke('obs:open'),
  obsConnect: (host, port, password) => ipcRenderer.invoke('obs:connect', { host, port, password }),
  obsScenes: () => ipcRenderer.invoke('obs:scenes'),
  obsSetScene: (scene) => ipcRenderer.invoke('obs:set-scene', scene),
  obsControl: (action) => ipcRenderer.invoke('obs:control', action),
  companionOpen: () => ipcRenderer.invoke('companion:open'),
  copyText: (text) => ipcRenderer.invoke('clipboard:copy', text),
  systemCheck: () => ipcRenderer.invoke('diagnostics:run'),
  logError: (source, message, stack) => ipcRenderer.invoke('diagnostics:log-error', { source, message, stack })
})
