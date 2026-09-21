const { app, BrowserWindow, ipcMain, screen, Menu, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path   = require('path');
const Database        = require('./data/database');
const { syncDatabase } = require('./data/db-sync');
const { importPageUrl } = require('./data/api');
const { setupLogger, getLogPath } = require('./logger');
const { THEMES, DEFAULT_THEME } = require('./themes');


let operatorWindow   = null;
let projectionWindow = null;
let db = null;

let activeTheme     = DEFAULT_THEME;

// ─────────────────────────────────────────────
// Operator Window
// ─────────────────────────────────────────────
function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: 1200, height: 750, minWidth: 900, minHeight: 600,
    title: 'HopeSongs',
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
    title: 'HopeSongs — Projection',
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
// App Menu
// ─────────────────────────────────────────────
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Hymns (opens in browser)',
          accelerator: 'CmdOrCtrl+E',
          click: () => { openImportPage(); }
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
        {
          label: 'Check for App Updates',
          click: async () => {
            if (!app.isPackaged) {
              dialog.showMessageBox({ type: 'info', message: 'Updater is disabled in development mode.' });
              return;
            }
            autoUpdater.checkForUpdates().catch(err => {
              dialog.showMessageBox({ type: 'error', title: 'Update Check Failed', message: err.message });
            });
          }
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
          label: 'About HopeSongs',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About HopeSongs',
              message: 'HopeSongs',
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

  // The window shows the cache straight away. When the background sync brings in
  // new hymns, tell the window to reload its lists. On a fresh install the cache
  // starts empty, so without this the list would stay empty until a restart.
  db.syncing.then((result) => {
    if (result && result.changed && operatorWindow) {
      operatorWindow.webContents.send('hymns-updated', result);
    }
  });
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────
// Hymn import page
// Hymns are corrected on the lyrics API's own page, not inside this app. The
// page asks for a name and password, so the app never handles credentials.
// ─────────────────────────────────────────────
async function openImportPage() {
  const url = importPageUrl();
  if (!url) {
    const message = 'The lyrics API address is not set. Add it to data/api-config.json.';
    dialog.showMessageBox({ type: 'info', title: 'Import Hymns', message });
    return { opened: false, message };
  }
  await shell.openExternal(url);
  return { opened: true };
}

ipcMain.handle('open-import-page', () => openImportPage());

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

// ─────────────────────────────────────────────
// IPC — Blocks
// ─────────────────────────────────────────────
ipcMain.handle('get-hymn-blocks', (event, hymnId) => {
  try { return db.getHymnBlocks(hymnId); } catch (err) { console.error(err); return []; }
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
  // Only check for updates in packaged app
  if (!app.isPackaged) {
    console.log('Auto-updater disabled in development.');
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Add error handler so failures are logged clearly
  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message);
    if (operatorWindow) {
      operatorWindow.webContents.send('update-error', err.message);
    }
  });

  // Check for updates 5 seconds after launch
  setTimeout(() => {
    console.log('Checking for updates...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Update check failed:', err.message);
    });
  }, 5000);

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (operatorWindow) {
      operatorWindow.webContents.send('update-available', { version: info.version });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`Download progress: ${Math.round(progress.percent)}%`);
    if (operatorWindow) {
      operatorWindow.webContents.send('update-progress', Math.round(progress.percent));
    }
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded — ready to install.');
    if (operatorWindow) {
      operatorWindow.webContents.send('update-downloaded');
    }
  });
}

// ─────────────────────────────────────────────
// IPC — App Updates
// Registered outside setupAutoUpdater so they
// are always available regardless of isPackaged
// ─────────────────────────────────────────────
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return true;
  } catch (err) {
    console.error('Download update failed:', err.message);
    return false;
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
  return true;
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { message: 'Updater disabled in development' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { checking: true };
  } catch (err) {
    console.error('Manual update check failed:', err.message);
    return { error: err.message };
  }
});

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