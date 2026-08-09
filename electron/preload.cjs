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
  obsOpen: () => ipcRenderer.invoke('obs:open'),
  obsConnect: (host, port, password) => ipcRenderer.invoke('obs:connect', { host, port, password }),
  obsScenes: () => ipcRenderer.invoke('obs:scenes'),
  obsSetScene: (scene) => ipcRenderer.invoke('obs:set-scene', scene),
  obsControl: (action) => ipcRenderer.invoke('obs:control', action),
  hyperframesStudio: () => ipcRenderer.invoke('hyperframes:studio'),
  hyperframesRender: () => ipcRenderer.invoke('hyperframes:render'),
  companionOpen: () => ipcRenderer.invoke('companion:open'),
  copyText: (text) => ipcRenderer.invoke('clipboard:copy', text),
  systemCheck: () => ipcRenderer.invoke('diagnostics:run'),
  logError: (source, message, stack) => ipcRenderer.invoke('diagnostics:log-error', { source, message, stack })
})
