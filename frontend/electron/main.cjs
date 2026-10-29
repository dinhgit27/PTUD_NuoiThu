const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, screen, Tray, Menu, session } = require('electron');
const path = require('path');
const http = require('http');

app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const isDev = !app.isPackaged;
const rendererUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
const preloadPath = path.join(__dirname, 'preload.cjs');

let dashboardWindow = null;
let petWindow = null;
let tray = null;
let latestPetState = { pet: null, speechBubble: null };
let overlayVisible = true;
let isQuitting = false;

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: 600 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function loadRenderer(window, mode) {
  if (isDev) {
    let port = 5173;
    const is5173 = await checkPort(5173);
    const is5174 = await checkPort(5174);
    if (!is5173 && is5174) {
      port = 5174;
    }

    const url = new URL(`http://localhost:${port}`);
    if (mode) url.searchParams.set('mode', mode);

    return window.loadURL(url.toString()).catch(async (err) => {
      console.warn(`Failed loading http://localhost:${port}, trying fallback...`, err);
      const altPort = port === 5173 ? 5174 : 5173;
      const altUrl = new URL(`http://localhost:${altPort}`);
      if (mode) altUrl.searchParams.set('mode', mode);
      return window.loadURL(altUrl.toString()).catch((e) => console.warn('Fallback error:', e));
    });
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  return window.loadFile(indexPath, mode ? { query: { mode } } : undefined);
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return dashboardWindow;
  }

  dashboardWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 680,
    title: 'OfficePet - Bảng điều khiển',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  void loadRenderer(dashboardWindow);
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
  dashboardWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      dashboardWindow?.hide();
    }
  });
  return dashboardWindow;
}

let activeWidgetPanel = null;
let widgetAnchorX = null;

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) return petWindow;

  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  const defaultWidth = 280;
  const defaultHeight = 260;
  const defaultX = x + width - defaultWidth - 24;
  const defaultY = y + height - defaultHeight - 16;

  petWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: defaultX,
    y: defaultY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void loadRenderer(petWindow, 'overlay');
  petWindow.on('ready-to-show', () => {
    petWindow?.webContents.send('pet:update', latestPetState);
    if (overlayVisible && latestPetState.pet) petWindow?.showInactive();
  });
  petWindow.on('closed', () => {
    petWindow = null;
  });
  return petWindow;
}

function createTray() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#8da399"/><path d="M10 14c-2 0-3-2-2-4 1-2 3-2 4 0l1 2m7 2c2 0 3-2 2-4-1-2-3-2-4 0l-1 2m-8 8c0-3 3-6 7-6s7 3 7 6c0 3-3 4-7 4s-7-1-7-4Z" fill="#fff" stroke="#27312e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`));
  tray.setToolTip('OfficePet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở bảng điều khiển', click: () => createDashboardWindow() },
    {
      label: 'Ẩn thú cưng trên desktop',
      click: () => setOverlayVisible(false)
    },
    {
      label: 'Hiện thú cưng trên desktop',
      click: () => setOverlayVisible(true)
    },
    { type: 'separator' },
    {
      label: 'Thoát OfficePet',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('double-click', () => createDashboardWindow());
}

let walkInterval = null;
let isWalking = false;

function stopWalking() {
  if (walkInterval) {
    clearInterval(walkInterval);
    walkInterval = null;
  }
  if (isWalking) {
    isWalking = false;
    petWindow?.webContents.send('pet:walk-state', { isWalking: false });
  }
}

function walkTo(targetX) {
  if (!petWindow || petWindow.isDestroyed() || activeWidgetPanel || !overlayVisible) return;
  if (walkInterval) clearInterval(walkInterval);

  const [currentX, currentY] = petWindow.getPosition();
  const dx = targetX - currentX;
  if (Math.abs(dx) < 15) return;

  const direction = dx > 0 ? 1 : -1;
  const speed = 2; // 2px per tick
  let currentPos = currentX;
  isWalking = true;

  petWindow.webContents.send('pet:walk-state', { isWalking: true, direction });

  walkInterval = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed() || activeWidgetPanel || !overlayVisible) {
      stopWalking();
      return;
    }

    currentPos += direction * speed;
    const reached = direction > 0 ? currentPos >= targetX : currentPos <= targetX;

    if (reached) {
      petWindow.setPosition(targetX, currentY);
      stopWalking();
    } else {
      petWindow.setPosition(Math.round(currentPos), currentY);
    }
  }, 25);
}

function setOverlayVisible(visible) {
  overlayVisible = visible;
  if (visible && latestPetState.pet) {
    createPetWindow().showInactive();
  } else {
    stopWalking();
    petWindow?.hide();
  }
  dashboardWindow?.webContents.send('overlay:visibility', visible);
}

ipcMain.on('pet:walk-to', (event, targetX) => {
  if (event.sender !== petWindow?.webContents) return;
  if (typeof targetX === 'number') walkTo(targetX);
});

ipcMain.on('pet:walk-stop', (event) => {
  if (event.sender !== petWindow?.webContents) return;
  stopWalking();
});

ipcMain.on('pet:sync', (event, state) => {
  if (event.sender !== dashboardWindow?.webContents) return;
  if (!state || typeof state !== 'object') return;
  latestPetState = {
    pet: state.pet && typeof state.pet === 'object' ? state.pet : null,
    speechBubble: typeof state.speechBubble === 'string' ? state.speechBubble : null
  };

  if (!latestPetState.pet) {
    petWindow?.hide();
    return;
  }

  createPetWindow().webContents.send('pet:update', latestPetState);
  if (overlayVisible) petWindow?.showInactive();
});

ipcMain.on('overlay:ready', (event) => {
  if (event.sender !== petWindow?.webContents) return;
  event.sender.send('pet:update', latestPetState);
});

ipcMain.on('overlay:widget-panel', (event, panel) => {
  if (event.sender !== petWindow?.webContents) return;
  if (![null, 'menu', 'chat', 'pomodoro', 'music', 'voice'].includes(panel)) return;
  if (!petWindow || petWindow.isDestroyed()) return;
  if (activeWidgetPanel === panel) return;
  if (panel) stopWalking();

  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  if (!activeWidgetPanel && panel) widgetAnchorX = bounds.x + bounds.width / 2;

  activeWidgetPanel = panel;
  const isUtilityPanel = ['chat', 'pomodoro', 'music', 'voice'].includes(panel);
  const width = isUtilityPanel || panel === 'menu' ? Math.min(600, area.width) : panel ? Math.min(420, area.width) : 280;
  const requestedHeight = panel === 'music' ? 560 : panel === 'pomodoro' ? 560 : panel === 'chat' ? 520 : panel === 'voice' ? 440 : panel === 'menu' ? 500 : 260;
  const height = Math.min(requestedHeight, area.height);
  const anchorX = widgetAnchorX ?? (bounds.x + bounds.width / 2);
  const petSide = anchorX < area.x + area.width / 2 ? 'left' : 'right';
  const petColumnWidth = 160;
  const petCenterOffset = petSide === 'left' ? petColumnWidth / 2 : width - petColumnWidth / 2;
  const x = isUtilityPanel
    ? Math.max(area.x, Math.min(area.x + area.width - width, Math.round(anchorX - petCenterOffset)))
    : Math.max(area.x, Math.min(area.x + area.width - width, Math.round(anchorX - width / 2)));
  const y = area.y + area.height - height - 12;
  petWindow.setBounds({ x, y, width: Math.min(width, area.width), height });
  if (isUtilityPanel) petWindow.webContents.send('overlay:panel-layout', petSide);
  if (!panel) widgetAnchorX = null;
});

ipcMain.on('overlay:set-visible', (event, visible) => {
  if (event.sender !== dashboardWindow?.webContents || typeof visible !== 'boolean') return;
  setOverlayVisible(visible);
});

ipcMain.on('overlay:action', (event, action) => {
  if (event.sender !== petWindow?.webContents) return;
  const allowedActions = new Set(['feed', 'stroke', 'drink', 'levelUp', 'openTimer', 'hideOverlay']);
  if (!allowedActions.has(action)) return;

  if (action === 'hideOverlay') setOverlayVisible(false);
  if (action === 'openTimer') {
    createDashboardWindow();
    petWindow?.webContents.send('overlay:widget-panel', 'pomodoro');
  }
  dashboardWindow?.webContents.send('overlay:action', action);
});

ipcMain.on('dashboard:show', (event) => {
  if (event.sender !== petWindow?.webContents) return;
  createDashboardWindow();
});

app.whenReady().then(() => {
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
        return callback(true);
      }
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
        return true;
      }
      return true;
    });
  }

  createDashboardWindow();
  createTray();
  createPetWindow();
  petWindow?.hide();

  globalShortcut.register('CommandOrControl+Shift+P', () => {
    setOverlayVisible(!overlayVisible);
  });

  app.on('activate', () => createDashboardWindow());
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
