const { app, BrowserWindow, ipcMain, screen, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');
const path   = require('path');
const Database        = require('./data/database');
const { syncDatabase } = require('./data/db-sync');

let operatorWindow   = null;
let projectionWindow = null;
let editorWindow     = null;
let db = null;

// ─────────────────────────────────────────────
// Editor Auth
// To generate your own hash, run in terminal:
// node -e "console.log(require('crypto').createHash('sha256').update('yourpassword').digest('hex'))"
// Default password: nhuc2024
// ─────────────────────────────────────────────
const EDITOR_PASSWORD_HASH = 'fa970510078cb0cf57571eb735d0cd23319f49357cdf844a1343edcf89e027ad';
let editorUnlocked = false;

// ─────────────────────────────────────────────
// Operator Window
// ─────────────────────────────────────────────
function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: 1200, height: 750, minWidth: 900, minHeight: 600,
    title: 'Hymn Presemter',
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
// App Menu
// ─────────────────────────────────────────────
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Hymn Editor',
          accelerator: 'CmdOrCtrl+E',
          click: () => { if (operatorWindow) operatorWindow.webContents.send('menu-open-editor'); }
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Database Updates',
          click: () => { if (operatorWindow) operatorWindow.webContents.send('manual-db-sync'); }
        },
        { type: 'separator' },
        {
          label: 'About NHUC Hymn Projector',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Hymn Presenter',
              message: 'Hymn Presenter',
              detail: [
                `Version: ${app.getVersion()}`,
                `Built for New Hope Universal Church, Ghana`,
                ``,
                `Developer: Aaron Katey Kudadjie`,
                `GitHub: https://github.com/Adehwam21/`,
                ``,
                `© ${new Date().getFullYear()} NHUC. All rights reserved.`
              ].join('\n')
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─────────────────────────────────────────────
// App Ready
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  createAppMenu();
  db = new Database();
  await db.connect();
  createOperatorWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow();
  });
});

app.on('window-all-closed', () => {
  editorUnlocked = false;
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────
// IPC — Editor Auth
// ─────────────────────────────────────────────
ipcMain.handle('verify-editor-password', (event, password) => {
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash === EDITOR_PASSWORD_HASH) {
    editorUnlocked = true;
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('is-editor-unlocked', () => editorUnlocked);

ipcMain.handle('open-editor', () => {
  if (!editorUnlocked) return { locked: true };
  createEditorWindow();
  return { locked: false };
});

// ─────────────────────────────────────────────
// IPC — DB Sync
// ─────────────────────────────────────────────
ipcMain.handle('trigger-db-sync', async () => {
  const result = await syncDatabase((pct) => {
    if (operatorWindow) operatorWindow.webContents.send('db-sync-progress', pct);
  });
  if (result.status === 'updated') {
    try { await db.connect(); } catch (err) { console.error('DB reload failed:', err.message); }
  }
  if (operatorWindow) operatorWindow.webContents.send('db-sync-done', result);
  return result;
});

// ─────────────────────────────────────────────
// IPC — Books
// ─────────────────────────────────────────────
ipcMain.handle('get-books', () => {
  try { return db.getAllBooks(); } catch (err) { console.error(err); return []; }
});

ipcMain.handle('add-book', (event, name) => {
  try { return db.addBook(name); } catch (err) { console.error(err); return null; }
});

ipcMain.handle('delete-book', (event, id) => {
  try { db.deleteBook(id); return true; } catch (err) { console.error(err); return false; }
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
  try { return db.addHymn(data); } catch (err) { console.error(err); return null; }
});

ipcMain.handle('update-hymn', (event, data) => {
  try { db.updateHymn(data); return true; } catch (err) { console.error(err); return false; }
});

ipcMain.handle('delete-hymn', (event, id) => {
  try { db.deleteHymn(id); return true; } catch (err) { console.error(err); return false; }
});

// ─────────────────────────────────────────────
// IPC — Blocks
// ─────────────────────────────────────────────
ipcMain.handle('get-hymn-blocks', (event, hymnId) => {
  try { return db.getHymnBlocks(hymnId); } catch (err) { console.error(err); return []; }
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
// Auto Updater (app version updates)
// ─────────────────────────────────────────────
function setupAutoUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => console.log('Update check failed:', err.message));
  }, 5000);

  autoUpdater.on('update-available', (info) => {
    if (operatorWindow) operatorWindow.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => console.log('App is up to date.'));

  ipcMain.handle('download-update', () => { autoUpdater.downloadUpdate(); return true; });

  autoUpdater.on('download-progress', (progress) => {
    if (operatorWindow) operatorWindow.webContents.send('update-progress', Math.round(progress.percent));
  });

  autoUpdater.on('update-downloaded', () => {
    if (operatorWindow) operatorWindow.webContents.send('update-downloaded');
  });

  ipcMain.handle('install-update', () => { autoUpdater.quitAndInstall(); return true; });
}
