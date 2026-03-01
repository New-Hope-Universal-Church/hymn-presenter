const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hymnAPI', {

  // ── Books ──────────────────────────────────────────────
  getBooks:   ()     => ipcRenderer.invoke('get-books'),
  addBook:    (name) => ipcRenderer.invoke('add-book', name),
  deleteBook: (id)   => ipcRenderer.invoke('delete-book', id),

  // ── Hymns ──────────────────────────────────────────────
  searchHymns:  (query, bookId) => ipcRenderer.invoke('search-hymns', { query, bookId }),
  addHymn:      (data)          => ipcRenderer.invoke('add-hymn', data),
  updateHymn:   (data)          => ipcRenderer.invoke('update-hymn', data),
  deleteHymn:   (id)            => ipcRenderer.invoke('delete-hymn', id),

  // ── Blocks ─────────────────────────────────────────────
  getHymnBlocks: (hymnId) => ipcRenderer.invoke('get-hymn-blocks', hymnId),
  updateBlock:   (data)   => ipcRenderer.invoke('update-block', data),
  deleteBlock:   (id)     => ipcRenderer.invoke('delete-block', id),
  addBlock:      (data)   => ipcRenderer.invoke('add-block', data),
  reorderBlocks: (data)   => ipcRenderer.invoke('reorder-blocks', data),

  // ── Projection ─────────────────────────────────────────
  openProjection:  ()     => ipcRenderer.invoke('open-projection'),
  closeProjection: ()     => ipcRenderer.invoke('close-projection'),
  isProjecting:    ()     => ipcRenderer.invoke('is-projecting'),
  projectBlock:    (data) => ipcRenderer.invoke('project-block', data),
  blankScreen:     ()     => ipcRenderer.invoke('blank-screen'),
  setFontSize:     (size) => ipcRenderer.invoke('set-font-size', size),

  // ── Editor Auth ────────────────────────────────────────
  verifyEditorPassword: (pwd) => ipcRenderer.invoke('verify-editor-password', pwd),
  isEditorUnlocked:     ()    => ipcRenderer.invoke('is-editor-unlocked'),
  openEditor:           ()    => ipcRenderer.invoke('open-editor'),

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
  onMenuOpenEditor:   (cb) => ipcRenderer.on('menu-open-editor', cb),
  onManualDbSync:     (cb) => ipcRenderer.on('manual-db-sync', cb),
  onDbSyncProgress:   (cb) => ipcRenderer.on('db-sync-progress', (e, pct) => cb(pct)),
  onDbSyncDone:       (cb) => ipcRenderer.on('db-sync-done', (e, result) => cb(result)),
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available', (e, info) => cb(info)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress', (e, pct) => cb(pct)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
});
