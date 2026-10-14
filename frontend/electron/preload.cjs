const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('officePet', {
  updatePet: (pet, speechBubble) => ipcRenderer.send('pet:sync', { pet, speechBubble }),
  setOverlayVisible: (visible) => ipcRenderer.send('overlay:set-visible', visible),
  setWidgetPanel: (panel) => ipcRenderer.send('overlay:widget-panel', panel),
  onPanelLayout: (callback) => {
    const listener = (_event, side) => callback(side);
    ipcRenderer.on('overlay:panel-layout', listener);
    return () => ipcRenderer.removeListener('overlay:panel-layout', listener);
  },
  performPetAction: (action) => ipcRenderer.send('overlay:action', action),
  showDashboard: () => ipcRenderer.send('dashboard:show'),
  overlayReady: () => ipcRenderer.send('overlay:ready'),
  onPetUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:update', listener);
    return () => ipcRenderer.removeListener('pet:update', listener);
  },
  onPetAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('overlay:action', listener);
    return () => ipcRenderer.removeListener('overlay:action', listener);
  },
  onOverlayVisibility: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on('overlay:visibility', listener);
    return () => ipcRenderer.removeListener('overlay:visibility', listener);
  },
  walkTo: (targetX) => ipcRenderer.send('pet:walk-to', targetX),
  stopWalking: () => ipcRenderer.send('pet:walk-stop'),
  onWalkState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:walk-state', listener);
    return () => ipcRenderer.removeListener('pet:walk-state', listener);
  }
});
