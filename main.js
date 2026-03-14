const { app, BrowserWindow, ipcMain, screen, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');
const path   = require('path');
const Database        = require('./data/database');
const { syncDatabase } = require('./data/db-sync');
const { setupLogger, getLogPath } = require('./logger');
const { THEMES, DEFAULT_THEME } = require('./themes');


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
let editorUnlocked  = false;
let activeTheme     = DEFAULT_THEME;

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
  projectionWindow.webContents.once('did-finish-load', () => {
    if (THEMES[activeTheme]) {
      projectionWindow.webContents.send('apply-theme', THEMES[activeTheme]);
    }
  });
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
          label: 'Projection Theme',
          submenu: Object.entries(THEMES).map(([id, t]) => ({
            label: t.label,
            type:  'radio',
            checked: id === activeTheme,
            click: () => {
              // Update all radio items
              activeTheme = id;
              if (projectionWindow) {
                projectionWindow.webContents.send('apply-theme', THEMES[id]);
              }
              const fs   = require('fs');
              const path = require('path');
              const settingsPath = path.join(app.getPath('userData'), 'settings.json');
              try {
                const existing = fs.existsSync(settingsPath)
                  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
                existing.theme = id;
                fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf8');
              } catch (err) { console.error('Failed to save theme:', err.message); }
            }
          }))
        },
        {
          label: 'Show Log File',
          click: () => {
            const { shell } = require('electron');
            const logPath = getLogPath();
            if (logPath) shell.showItemInFolder(logPath);
          }
        },
        { type: 'separator' },
        {
          label: 'About NHUC Hymn Projector',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About NHUC Hymn Projector',
              message: 'NHUC Hymn Projector',
              detail: [
                `Version: ${app.getVersion()}`,
                `Built for New Hope Universal Church, Ghana`,
                ``,
                `Developer: Aaron Kudadjie`,
                `Email: akkudadjie@gmail.com`,
                `Github: https://www.github.com/Adehwam21`,
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
  setupLogger();
  (function loadPersistedTheme() {
    const fs   = require('fs');
    const path = require('path');
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (s.theme && THEMES[s.theme]) activeTheme = s.theme;
      }
    } catch { /* use default */ }
  })();
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
  const result = await syncDatabase(db);
  if (operatorWindow) operatorWindow.webContents.send('db-sync-done', result);
  return result;
});

// ─────────────────────────────────────────────
// IPC — Themes
// ─────────────────────────────────────────────
ipcMain.handle('get-themes', () => {
  return Object.entries(THEMES).map(([id, t]) => ({
    id, label: t.label, description: t.description, season: t.season
  }));
});

ipcMain.handle('get-active-theme', () => activeTheme);

ipcMain.handle('set-theme', (event, themeId) => {
  if (!THEMES[themeId]) return false;
  activeTheme = themeId;
  if (projectionWindow) {
    projectionWindow.webContents.send('apply-theme', THEMES[themeId]);
  }
  const fs   = require('fs');
  const path = require('path');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const existing = fs.existsSync(settingsPath)
      ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
    existing.theme = themeId;
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf8');
  } catch (err) { console.error('Failed to save theme:', err.message); }
  return true;
});

// ─────────────────────────────────────────────
// IPC — Books
// ─────────────────────────────────────────────
ipcMain.handle('get-books', () => {
  try { return db.getAllBooks(); } catch (err) { console.error(err); return []; }
});

ipcMain.handle('add-book', async (event, name) => {
  try { return await db.addBook(name); } catch (err) { console.error(err); return null; }
});

ipcMain.handle('delete-book', async (event, id) => {
  try { await db.deleteBook(id); return true; } catch (err) { console.error(err); return false; }
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

ipcMain.handle('add-hymn', async (event, data) => {
  try { return await db.addHymn(data); } catch (err) { console.error(err); return null; }
});

ipcMain.handle('update-hymn', async (event, data) => {
  try { await db.updateHymn(data); return true; } catch (err) { console.error(err); return false; }
});

ipcMain.handle('delete-hymn', async (event, id) => {
  try { await db.deleteHymn(id); return true; } catch (err) { console.error(err); return false; }
});

// ─────────────────────────────────────────────
// IPC — Blocks
// ─────────────────────────────────────────────
ipcMain.handle('get-hymn-blocks', (event, hymnId) => {
  try { return db.getHymnBlocks(hymnId); } catch (err) { console.error(err); return []; }
});

ipcMain.handle('update-block', async (event, { id, label, text, type }) => {
  try { await db.updateBlock({ id, label, text, type }); return true; }
  catch (err) { console.error(err); return false; }
});

ipcMain.handle('delete-block', async (event, id) => {
  try { await db.deleteBlock(id); return true; }
  catch (err) { console.error(err); return false; }
});

ipcMain.handle('add-block', async (event, { hymnId, type, label, text, position }) => {
  try { return await db.addBlock({ hymnId, type, label, text, position }); }
  catch (err) { console.error(err); return null; }
});

ipcMain.handle('reorder-blocks', async (event, blocks) => {
  try { await db.reorderBlocks(blocks); return true; }
  catch (err) { console.error(err); return false; }
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

// ─────────────────────────────────────────────
// IPC — Export to CSV (one-time Supabase import)
// ─────────────────────────────────────────────
ipcMain.handle('export-csv', () => {
  try {
    const books  = db.query(`SELECT id, name FROM books ORDER BY id`);
    const hymns  = db.query(`SELECT id, number, title, author, book_id FROM hymns ORDER BY id`);
    const blocks = db.query(`SELECT id, hymn_id, position, type, label, text FROM hymn_blocks ORDER BY id`);

    const toCSV = (rows) => {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const escape  = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const lines = [
        headers.join(','),
        ...rows.map(row => headers.map(h => escape(row[h])).join(','))
      ];
      return lines.join('\n');
    };

    return {
      books:  toCSV(books),
      hymns:  toCSV(hymns),
      blocks: toCSV(blocks),
      counts: { books: books.length, hymns: hymns.length, blocks: blocks.length }
    };
  } catch (err) {
    console.error('Export error:', err);
    return null;
  }
});

ipcMain.handle('save-csv-file', async (event, { filename, content }) => {
  const { dialog } = require('electron');
  const fs = require('fs');

  const { filePath } = await dialog.showSaveDialog({
    title: `Save ${filename}`,
    defaultPath: filename,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
});