const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('officePet', {
  updatePet: (pet, speechBubble) => ipcRenderer.send('pet:sync', { pet, speechBubble }),
  setOverlayVisible: (visible) => ipcRenderer.send('overlay:set-visible', visible),
  popOutToDesktop: (panel) => ipcRenderer.send('overlay:pop-out', panel ?? null),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('overlay:set-ignore-mouse', Boolean(ignore)),
  dragMove: (dx, dy) => ipcRenderer.send('pet:drag-move', { dx, dy }),
  resetPosition: () => ipcRenderer.send('pet:reset-position'),
  setWidgetPanel: (panel) => ipcRenderer.send('overlay:widget-panel', panel),
  onPanelLayout: (callback) => {
    const listener = (_event, side) => callback(side);
    ipcRenderer.on('overlay:panel-layout', listener);
    return () => ipcRenderer.removeListener('overlay:panel-layout', listener);
  },
  onOpenPanel: (callback) => {
    const listener = (_event, panel) => callback(panel);
    ipcRenderer.on('overlay:open-panel', listener);
    return () => ipcRenderer.removeListener('overlay:open-panel', listener);
  },
  performPetAction: (action, payload) => ipcRenderer.send('overlay:action', action, payload),
  showDashboard: () => ipcRenderer.send('dashboard:show'),
  overlayReady: () => ipcRenderer.send('overlay:ready'),
  onPetUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:update', listener);
    return () => ipcRenderer.removeListener('pet:update', listener);
  },
  onPetAction: (callback) => {
    const listener = (_event, action, payload) => callback(action, payload);
    ipcRenderer.on('overlay:action', listener);
    return () => ipcRenderer.removeListener('overlay:action', listener);
  },
  onOverlayVisibility: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on('overlay:visibility', listener);
    return () => ipcRenderer.removeListener('overlay:visibility', listener);
  },
  onRequestSync: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('pet:request-sync', listener);
    return () => ipcRenderer.removeListener('pet:request-sync', listener);
  },
  walkTo: (targetX) => ipcRenderer.send('pet:walk-to', targetX),
  stopWalking: () => ipcRenderer.send('pet:walk-stop'),
  raiseAlarmNotification: (alarmData) => ipcRenderer.send('alarm:raise', alarmData),
  stopAlarmNotification: () => ipcRenderer.send('alarm:stop'),
  onAlarmTriggered: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('alarm:triggered', listener);
    return () => ipcRenderer.removeListener('alarm:triggered', listener);
  },
  onAlarmStopped: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('alarm:stop', listener);
    return () => ipcRenderer.removeListener('alarm:stop', listener);
  },
  onAlarmPopupData: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('alarm:popup-data', listener);
    return () => ipcRenderer.removeListener('alarm:popup-data', listener);
  },
  performAlarmAction: (action, payload) => ipcRenderer.send('alarm:action', action, payload),
  dismissAlarmWindow: () => ipcRenderer.send('alarm:dismiss'),
  onAlarmAction: (callback) => {
    const listener = (_event, action, payload) => callback(action, payload);
    ipcRenderer.on('alarm:action', listener);
    return () => ipcRenderer.removeListener('alarm:action', listener);
  },
  onWalkState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('pet:walk-state', listener);
    return () => ipcRenderer.removeListener('pet:walk-state', listener);
  }
});
