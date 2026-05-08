const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let win;
let simHandler = null;
let flightActiveInRenderer = false;
let pendingInstall = false;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 720,
    resizable: false,
    frame: true,
    backgroundColor: '#080612',
    title: 'Bravo ACARS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  win.webContents.on('did-finish-load', () => {
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
  });
});

app.on('window-all-closed', () => {
  if (simHandler) simHandler.disconnect();
  app.quit();
});

// ── AUTO-UPDATE EVENTS ──────────────────────────────────────
autoUpdater.on('update-available', (info) => {
  if (win && !win.isDestroyed())
    win.webContents.send('update:available', { version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  if (win && !win.isDestroyed())
    win.webContents.send('update:progress', Math.round(progress.percent));
});

autoUpdater.on('update-downloaded', () => {
  if (win && !win.isDestroyed())
    win.webContents.send('update:ready');
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err.message);
  if (win && !win.isDestroyed())
    win.webContents.send('update:error', err.message);
});

ipcMain.on('flight:state', (_, { active }) => {
  flightActiveInRenderer = active;
  if (!active && pendingInstall) {
    pendingInstall = false;
    setTimeout(() => autoUpdater.quitAndInstall(), 3000);
  }
});

ipcMain.on('update:install', () => {
  if (flightActiveInRenderer) {
    pendingInstall = true;
    if (win && !win.isDestroyed())
      win.webContents.send('update:deferred');
    return;
  }
  autoUpdater.quitAndInstall();
});

ipcMain.on('get:version', (e) => {
  e.returnValue = app.getVersion();
});

// ── IPC: conectar ao simulador ──────────────────────────────
ipcMain.handle('sim:connect', async (_e, { type }) => {
  if (simHandler) simHandler.disconnect();

  if (type === 'msfs') {
    const MSFSHandler = require('./sim/msfs');
    simHandler = new MSFSHandler();
  } else {
    const XPlaneHandler = require('./sim/xplane');
    simHandler = new XPlaneHandler();
  }

  simHandler.onData = (data) => {
    if (win && !win.isDestroyed()) win.webContents.send('sim:data', data);
  };

  simHandler.onStatus = (status) => {
    if (win && !win.isDestroyed()) win.webContents.send('sim:status', status);
  };

  try {
    await simHandler.connect();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('sim:disconnect', async () => {
  if (simHandler) {
    simHandler.disconnect();
    simHandler = null;
  }
  if (win && !win.isDestroyed())
    win.webContents.send('sim:status', { connected: false, type: null });
  return { ok: true };
});
