const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acars', {
  // renderer → main
  connectSim:    (type) => ipcRenderer.invoke('sim:connect', { type }),
  disconnectSim: ()     => ipcRenderer.invoke('sim:disconnect'),
  installUpdate: ()     => ipcRenderer.send('update:install'),
  getVersion:    ()     => require('electron').ipcRenderer.sendSync('get:version'),

  // main → renderer
  onSimData:      (cb) => ipcRenderer.on('sim:data',       (_e, d) => cb(d)),
  onSimStatus:    (cb) => ipcRenderer.on('sim:status',     (_e, s) => cb(s)),
  onUpdateAvail:  (cb) => ipcRenderer.on('update:available',(_e, i) => cb(i)),
  onUpdateReady:    (cb) => ipcRenderer.on('update:ready',    () => cb()),
  onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_e, pct) => cb(pct)),
  onUpdateError:    (cb) => ipcRenderer.on('update:error',    (_e, msg) => cb(msg)),

  removeListeners: () => {
    ipcRenderer.removeAllListeners('sim:data');
    ipcRenderer.removeAllListeners('sim:status');
    ipcRenderer.removeAllListeners('update:available');
    ipcRenderer.removeAllListeners('update:ready');
  }
});
