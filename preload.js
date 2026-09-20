const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hymnAPI', {

  // ── Books ──────────────────────────────────────────────
  getBooks:   ()     => ipcRenderer.invoke('get-books'),

  // ── Hymns ──────────────────────────────────────────────
  searchHymns:  (query, bookId) => ipcRenderer.invoke('search-hymns', { query, bookId }),

  // ── Blocks ─────────────────────────────────────────────
  getHymnBlocks: (hymnId) => ipcRenderer.invoke('get-hymn-blocks', hymnId),

  // ── Projection ─────────────────────────────────────────
  openProjection:  ()     => ipcRenderer.invoke('open-projection'),
  closeProjection: ()     => ipcRenderer.invoke('close-projection'),
  isProjecting:    ()     => ipcRenderer.invoke('is-projecting'),
  projectBlock:    (data) => ipcRenderer.invoke('project-block', data),
  blankScreen:     ()     => ipcRenderer.invoke('blank-screen'),
  setFontSize:     (size) => ipcRenderer.invoke('set-font-size', size),

  // ── CSV Export ────────────────────────────────────────
  exportCsv:    ()               => ipcRenderer.invoke('export-csv'),
  saveCsvFile:  (data)           => ipcRenderer.invoke('save-csv-file', data),

  // ── Hymn import page (opens in the browser) ────────────
  openImportPage: () => ipcRenderer.invoke('open-import-page'),

  // ── DB Sync ────────────────────────────────────────────
  triggerDbSync:    ()    => ipcRenderer.invoke('trigger-db-sync'),

  // ── App Updates ────────────────────────────────────────
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate:  () => ipcRenderer.invoke('install-update'),

  // ── Listeners ──────────────────────────────────────────
  onProjectionClosed: (cb) => ipcRenderer.on('projection-closed', cb),
  onDisplayBlock:     (cb) => ipcRenderer.on('display-block', (e, data) => cb(data)),
  onBlankScreen:      (cb) => ipcRenderer.on('blank-screen', cb),
  onSetFontSize:      (cb) => ipcRenderer.on('set-font-size', (e, size) => cb(size)),
  onManualDbSync:     (cb) => ipcRenderer.on('manual-db-sync', cb),
  onDbSyncProgress:   (cb) => ipcRenderer.on('db-sync-progress', (e, pct) => cb(pct)),
  onDbSyncDone:       (cb) => ipcRenderer.on('db-sync-done', (e, result) => cb(result)),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available', (e, info) => cb(info)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress', (e, pct) => cb(pct)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  onUpdateError:      (cb) => ipcRenderer.on('update-error', (e, msg) => cb(msg)),

  // ── Themes ─────────────────────────────────────────
  getThemes:      ()         => ipcRenderer.invoke('get-themes'),
  getActiveTheme: ()         => ipcRenderer.invoke('get-active-theme'),
  setTheme:       (themeId)  => ipcRenderer.invoke('set-theme', themeId),
  onApplyTheme:   (cb)       => ipcRenderer.on('apply-theme', (e, theme) => cb(theme)),
});