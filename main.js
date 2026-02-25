const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Database = require('./data/database');

let operatorWindow = null;
let projectionWindow = null;
let db = null;

// ─────────────────────────────────────────────
// Create Operator Window (your laptop screen)
// ─────────────────────────────────────────────
function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'NHUC Hymn Projector',
    backgroundColor: '#0f0f17',
    icon: path.join(__dirname, 'assets/icons', 'logo-sharpened.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  operatorWindow.loadFile('operator/index.html');

  operatorWindow.on('closed', () => {
    operatorWindow = null;
    if (projectionWindow) projectionWindow.close();
    app.quit();
  });
}

// ─────────────────────────────────────────────
// Create Projection Window (the projector screen)
// ─────────────────────────────────────────────
function createProjectionWindow() {
  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays.length > 1
      ? displays.find((d) => d.id !== screen.getPrimaryDisplay().id)
      : displays[0];

  const { x, y, width, height } = targetDisplay.bounds;

  projectionWindow = new BrowserWindow({
    x, y, width, height,
    fullscreen: displays.length > 1,
    frame: displays.length === 1,
    alwaysOnTop: displays.length > 1,
    backgroundColor: '#000000',
    title: 'NHUC — Projection',
    icon: path.join(__dirname, 'assets/icons', 'logo-sharpened.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  projectionWindow.loadFile('projection/projection.html');

  projectionWindow.on('closed', () => {
    projectionWindow = null;
    if (operatorWindow) {
      operatorWindow.webContents.send('projection-closed');
    }
  });

  return projectionWindow;
}

// ─────────────────────────────────────────────
// App Ready
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  // Initialize database (async with sql.js)
  db = new Database();
  await db.connect();

  createOperatorWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────

ipcMain.handle('search-hymns', (event, query) => {
  try {
    if (!query || query.trim() === '') return db.getAllHymns();
    const trimmed = query.trim();
    if (/^\d+$/.test(trimmed)) return db.searchByNumber(parseInt(trimmed));
    return db.searchByTitle(trimmed);
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
});

ipcMain.handle('get-hymn-blocks', (event, hymnId) => {
  try {
    return db.getHymnBlocks(hymnId);
  } catch (err) {
    console.error('Get blocks error:', err);
    return [];
  }
});

ipcMain.handle('open-projection', () => {
  if (!projectionWindow) createProjectionWindow();
  return true;
});

ipcMain.handle('close-projection', () => {
  if (projectionWindow) {
    projectionWindow.close();
    projectionWindow = null;
  }
  return true;
});

ipcMain.handle('project-block', (event, data) => {
  if (!projectionWindow) {
    createProjectionWindow();
    setTimeout(() => {
      projectionWindow.webContents.send('display-block', data);
    }, 800);
  } else {
    projectionWindow.webContents.send('display-block', data);
  }
  return true;
});

ipcMain.handle('blank-screen', () => {
  if (projectionWindow) projectionWindow.webContents.send('blank-screen');
  return true;
});

ipcMain.handle('is-projecting', () => {
  return projectionWindow !== null && !projectionWindow.isDestroyed();
});
