const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Database = require('./data/database');

let operatorWindow  = null;
let projectionWindow = null;
let editorWindow    = null;
let db = null;

// ─────────────────────────────────────────────
// Operator Window
// ─────────────────────────────────────────────
function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: 1200, height: 750, minWidth: 900, minHeight: 600,
    title: 'NHUC Hymn Projector',
    backgroundColor: '#0f0f17',
    icon: path.join(__dirname, 'assets/icons', 'logo-sharpened.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
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
// Projection Window
// ─────────────────────────────────────────────
function createProjectionWindow() {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays.length > 1
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
      contextIsolation: true, nodeIntegration: false,
    },
  });
  projectionWindow.loadFile('projection/projection.html');
  projectionWindow.on('closed', () => {
    projectionWindow = null;
    if (operatorWindow) operatorWindow.webContents.send('projection-closed');
  });
  return projectionWindow;
}

// ─────────────────────────────────────────────
// Editor Window
// ─────────────────────────────────────────────
function createEditorWindow() {
  if (editorWindow) { editorWindow.focus(); return; }
  editorWindow = new BrowserWindow({
    width: 1200, height: 750, minWidth: 1000, minHeight: 600,
    title: 'Hymn Editor — NHUC',
    backgroundColor: '#0f0f17',
    icon: path.join(__dirname, 'assets/icons', 'logo-sharpened.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  editorWindow.loadFile('editor/editor.html');
  editorWindow.on('closed', () => { editorWindow = null; });
}

// ─────────────────────────────────────────────
// App Ready
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
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
// IPC — Books
// ─────────────────────────────────────────────
ipcMain.handle('get-books', () => {
  try { return db.getAllBooks(); }
  catch (err) { console.error(err); return []; }
});

ipcMain.handle('add-book', (event, name) => {
  try { return db.addBook(name); }
  catch (err) { console.error(err); return null; }
});

ipcMain.handle('delete-book', (event, id) => {
  try { db.deleteBook(id); return true; }
  catch (err) { console.error(err); return false; }
});

// ─────────────────────────────────────────────
// IPC — Hymns
// ─────────────────────────────────────────────
ipcMain.handle('search-hymns', (event, { query, bookId } = {}) => {
  try {
    if (!query || query.trim() === '') return db.getAllHymns(bookId);
    const trimmed = query.trim();
    if (/^\d+$/.test(trimmed)) return db.searchByNumber(parseInt(trimmed), bookId);
    return db.searchByTitle(trimmed, bookId);
  } catch (err) { console.error(err); return []; }
});

ipcMain.handle('add-hymn', (event, data) => {
  try { return db.addHymn(data); }
  catch (err) { console.error(err); return null; }
});

ipcMain.handle('update-hymn', (event, data) => {
  try { db.updateHymn(data); return true; }
  catch (err) { console.error(err); return false; }
});

ipcMain.handle('delete-hymn', (event, id) => {
  try { db.deleteHymn(id); return true; }
  catch (err) { console.error(err); return false; }
});

// ─────────────────────────────────────────────
// IPC — Blocks
// ─────────────────────────────────────────────
ipcMain.handle('get-hymn-blocks', (event, hymnId) => {
  try { return db.getHymnBlocks(hymnId); }
  catch (err) { console.error(err); return []; }
});

ipcMain.handle('update-block', (event, { id, label, text, type }) => {
  try {
    db.run(`UPDATE hymn_blocks SET label=?, text=?, type=? WHERE id=?`, [label, text, type, id]);
    return true;
  } catch (err) { console.error(err); return false; }
});

ipcMain.handle('delete-block', (event, id) => {
  try { db.run(`DELETE FROM hymn_blocks WHERE id=?`, [id]); return true; }
  catch (err) { console.error(err); return false; }
});

ipcMain.handle('add-block', (event, { hymnId, type, label, text, position }) => {
  try {
    db.run(
      `INSERT INTO hymn_blocks (hymn_id, type, label, text, position) VALUES (?,?,?,?,?)`,
      [hymnId, type, label, text, position]
    );
    const row = db.query(`SELECT id, hymn_id, position, type, label, text FROM hymn_blocks WHERE rowid = last_insert_rowid()`);
    return row[0] || null;
  } catch (err) { console.error(err); return null; }
});

ipcMain.handle('reorder-blocks', (event, blocks) => {
  try {
    blocks.forEach(({ id, position }) => {
      db.run(`UPDATE hymn_blocks SET position=? WHERE id=?`, [position, id]);
    });
    return true;
  } catch (err) { console.error(err); return false; }
});

// ─────────────────────────────────────────────
// IPC — Projection
// ─────────────────────────────────────────────
ipcMain.handle('open-projection', () => {
  if (!projectionWindow) createProjectionWindow();
  return true;
});

ipcMain.handle('close-projection', () => {
  if (projectionWindow) { projectionWindow.close(); projectionWindow = null; }
  return true;
});

ipcMain.handle('project-block', (event, data) => {
  if (!projectionWindow) {
    createProjectionWindow();
    setTimeout(() => projectionWindow.webContents.send('display-block', data), 800);
  } else {
    projectionWindow.webContents.send('display-block', data);
  }
  return true;
});

ipcMain.handle('blank-screen', () => {
  if (projectionWindow) projectionWindow.webContents.send('blank-screen');
  return true;
});

ipcMain.handle('is-projecting', () => projectionWindow !== null && !projectionWindow.isDestroyed());

ipcMain.handle('set-font-size', (event, size) => {
  if (projectionWindow) projectionWindow.webContents.send('set-font-size', size);
  return true;
});

// ─────────────────────────────────────────────
// IPC — Windows
// ─────────────────────────────────────────────
ipcMain.handle('open-editor', () => { createEditorWindow(); return true; });