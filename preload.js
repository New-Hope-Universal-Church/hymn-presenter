const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer processes
contextBridge.exposeInMainWorld('hymnAPI', {

  // Search hymns by number or title
  searchHymns: (query) => ipcRenderer.invoke('search-hymns', query),

  // Get all blocks for a hymn
  getHymnBlocks: (hymnId) => ipcRenderer.invoke('get-hymn-blocks', hymnId),

  // Projection controls
  openProjection: () => ipcRenderer.invoke('open-projection'),
  closeProjection: () => ipcRenderer.invoke('close-projection'),
  isProjecting: () => ipcRenderer.invoke('is-projecting'),

  // Project a block to the projection screen
  projectBlock: (data) => ipcRenderer.invoke('project-block', data),

  // Blank the projection screen
  blankScreen: () => ipcRenderer.invoke('blank-screen'),

  // Listen for projection window closed event
  onProjectionClosed: (callback) => {
    ipcRenderer.on('projection-closed', callback);
  },

  // Listen for display-block event (used by projection window)
  onDisplayBlock: (callback) => {
    ipcRenderer.on('display-block', (event, data) => callback(data));
  },

  // Listen for blank screen event (used by projection window)
  onBlankScreen: (callback) => {
    ipcRenderer.on('blank-screen', callback);
  },
});
