const {
  contextBridge,
  ipcRenderer,
  webUtils
} = require('electron');

contextBridge.exposeInMainWorld('pocket', {


  // Items
  list: () =>
    ipcRenderer.invoke('items:list'),

  importFiles: (paths) =>
    ipcRenderer.invoke('items:import', paths),

  addText: (text) =>
    ipcRenderer.invoke('items:addText', text),

  remove: (id) =>
    ipcRenderer.invoke('items:remove', id),

  // Native file drag-out
  startDrag: (path) =>
    ipcRenderer.send('drag:file', path),

  // Window
  hide: () =>
    ipcRenderer.send('window:hide'),

  getBounds: () =>
    ipcRenderer.invoke('window:getBounds'),

  setBounds: (bounds) =>
    ipcRenderer.send('window:setBounds', bounds),

  moveBy: (dx, dy) =>
    ipcRenderer.send('window:moveBy', {
      dx,
      dy
    }),

  // File path from dropped File object
  pathForFile: (file) =>
    webUtils.getPathForFile(file),

  // Character Studio
  getCharacter: () =>
    ipcRenderer.invoke(
      'character:get'
    ),

  pickCharacter: () =>
    ipcRenderer.invoke(
      'character:pick'
    ),

  saveCharacterSettings: (
    settings
  ) =>
    ipcRenderer.invoke(
      'character:saveSettings',
      settings
    ),

  clearCharacter: () =>
    ipcRenderer.invoke(
      'character:clear'
    ),
});