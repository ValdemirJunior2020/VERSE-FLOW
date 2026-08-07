const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('verseflow', {
  getDisplays: () => ipcRenderer.invoke('display:list'),
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
  loadData: () => ipcRenderer.invoke('data:load'),
  upsert: (entity, value) => ipcRenderer.invoke('data:upsert', { entity, value }),
  saveSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  remove: (entity, id) => ipcRenderer.invoke('data:remove', { entity, id }),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  integrationHealth: (url) => ipcRenderer.invoke('integration:health', url),
  appInfo: () => ipcRenderer.invoke('app:info')
})
