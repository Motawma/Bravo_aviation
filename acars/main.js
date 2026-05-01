const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let win;
let simHandler = null;

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
  autoUpdater.checkForUpdatesAndNotify();
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

autoUpdater.on('update-downloaded', () => {
  if (win && !win.isDestroyed())
    win.webContents.send('update:ready');
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err.message);
});

ipcMain.on('update:install', () => {
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
