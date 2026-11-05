const { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, screen, Tray, Menu, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const isDev = !app.isPackaged;
const preloadPath = path.join(__dirname, 'preload.cjs');

const DEFAULT_PET_WIDTH = 360;
const DEFAULT_PET_HEIGHT = 430;

let dashboardWindow = null;
let petWindow = null;
let alarmWindow = null;
let tray = null;
let latestPetState = { pet: null, speechBubble: null };
let overlayVisible = false;
let isQuitting = false;
let activeWidgetPanel = null;
let widgetAnchorX = null;
let widgetBottomY = null;

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, { timeout: 800 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

let cachedDevPort = null;
async function findActiveDevPort(maxWaitMs = 12000) {
  if (cachedDevPort && (await checkPort(cachedDevPort))) {
    return cachedDevPort;
  }
  const startTime = Date.now();
  const candidatePorts = [5173, 5174, 5175, 5176];

  while (Date.now() - startTime < maxWaitMs) {
    for (const port of candidatePorts) {
      if (await checkPort(port)) {
        cachedDevPort = port;
        return port;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

async function loadRenderer(window, mode) {
  if (isDev) {
    if (process.env.ELECTRON_START_URL) {
      const url = new URL(process.env.ELECTRON_START_URL);
      if (mode) url.searchParams.set('mode', mode);
      return window.loadURL(url.toString()).catch((e) => console.warn('Start URL error:', e));
    }

    const activePort = await findActiveDevPort(10000);
    if (activePort) {
      const url = new URL(`http://localhost:${activePort}`);
      if (mode) url.searchParams.set('mode', mode);
      return window.loadURL(url.toString()).catch(async (err) => {
        console.warn(`Failed loading http://localhost:${activePort}, trying fallback...`, err);
        const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
        if (fs.existsSync(indexPath)) {
          return window.loadFile(indexPath, mode ? { query: { mode } } : undefined);
        }
      });
    }

    console.warn('Vite dev server not found within 10s, checking dist/index.html...');
  }

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    return window.loadFile(indexPath, mode ? { query: { mode } } : undefined);
  }

  return window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html style="background:#181528;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="text-align:center;padding:24px;">
        <h2 style="color:#fbbf24;">Đang khởi động OfficePet...</h2>
        <p>Vui lòng đợi vài giây hoặc chạy máy chủ web: <code>npm run dev</code></p>
      </div>
    </html>
  `)}`);
}

function setPetWindowBounds(newBounds) {
  if (!petWindow || petWindow.isDestroyed()) return;
  try {
    petWindow.setBounds({
      x: Math.round(newBounds.x),
      y: Math.round(newBounds.y),
      width: Math.round(newBounds.width),
      height: Math.round(newBounds.height)
    });
  } catch (err) {
    console.warn('Failed to update petWindow bounds:', err);
  }
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore();
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
      sandbox: false,
      backgroundThrottling: false
    }
  });

  void loadRenderer(dashboardWindow);

  dashboardWindow.on('focus', () => {
    if (!overlayVisible && petWindow && !petWindow.isDestroyed()) {
      applyWidgetPanelLayout(null);
      petWindow.hide();
    }
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
  dashboardWindow.on('close', (event) => {
    if (!isQuitting) {
      // Keep the floating pet alive on desktop when the user closes the dashboard window
      if (overlayVisible && latestPetState.pet) {
        event.preventDefault();
        dashboardWindow?.hide();
        const pw = createPetWindow();
        pw.showInactive();
        pw.setAlwaysOnTop(true, 'screen-saver');
        pw.moveTop();
        pw.webContents.send('pet:update', {
          pet: latestPetState.pet,
          speechBubble: 'Bảng điều khiển đã thu gọn! Em vẫn ở đây đồng hành cùng đại ca nhé! (Nhấp 🖥️ để mở lại)'
        });
        return;
      }
      if (isDev) {
        isQuitting = true;
        app.quit();
        return;
      }
      event.preventDefault();
      dashboardWindow?.hide();
    }
  });
  return dashboardWindow;
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) return petWindow;

  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  const defaultX = x + width - DEFAULT_PET_WIDTH - 20;
  const defaultY = y + height - DEFAULT_PET_HEIGHT - 10;

  petWindow = new BrowserWindow({
    width: DEFAULT_PET_WIDTH,
    height: DEFAULT_PET_HEIGHT,
    x: defaultX,
    y: defaultY,
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: overlayVisible,
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  if (overlayVisible) {
    petWindow.setAlwaysOnTop(true, 'screen-saver');
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  void loadRenderer(petWindow, 'overlay');

  petWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('PetWindow render process gone:', details);
    if (overlayVisible && !isQuitting) {
      console.log('Restoring petWindow after renderer crash...');
      petWindow = null;
      const pw = createPetWindow();
      pw.showInactive();
      pw.setAlwaysOnTop(true, 'screen-saver');
      if (latestPetState.pet) {
        pw.webContents.send('pet:update', latestPetState);
      }
    }
  });

  petWindow.on('ready-to-show', () => {
    petWindow?.webContents.send('pet:update', latestPetState);
    if (overlayVisible) {
      petWindow?.showInactive();
      petWindow?.setAlwaysOnTop(true, 'screen-saver');
    } else {
      petWindow?.hide();
    }
  });
  petWindow.on('closed', () => {
    petWindow = null;
  });
  return petWindow;
}

function resetPetPosition() {
  if (!petWindow || petWindow.isDestroyed()) return;
  stopWalking();
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  const currentBounds = petWindow.getBounds();
  const targetWidth = activeWidgetPanel ? currentBounds.width : DEFAULT_PET_WIDTH;
  const targetHeight = activeWidgetPanel ? currentBounds.height : DEFAULT_PET_HEIGHT;
  const targetX = x + width - targetWidth - 20;
  const targetY = y + height - targetHeight - 10;
  widgetAnchorX = null;
  widgetBottomY = null;
  setPetWindowBounds({
    x: targetX,
    y: targetY,
    width: targetWidth,
    height: targetHeight
  });
  petWindow.showInactive();
  petWindow.moveTop();
}

function createTray() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#8da399"/><path d="M10 14c-2 0-3-2-2-4 1-2 3-2 4 0l1 2m7 2c2 0 3-2 2-4-1-2-3-2-4 0l-1 2m-8 8c0-3 3-6 7-6s7 3 7 6c0 3-3 4-7 4s-7-1-7-4Z" fill="#fff" stroke="#27312e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`));
  tray.setToolTip('OfficePet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở bảng điều khiển', click: () => createDashboardWindow() },
    {
      label: 'Hiện thú cưng trên desktop',
      click: () => setOverlayVisible(true)
    },
    {
      label: 'Ẩn thú cưng trên desktop',
      click: () => setOverlayVisible(false)
    },
    {
      label: 'Đặt lại vị trí thú cưng (Góc phải dưới)',
      click: () => {
        setOverlayVisible(true);
        resetPetPosition();
      }
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

function walkTo(rawTargetX) {
  if (!petWindow || petWindow.isDestroyed() || activeWidgetPanel || !overlayVisible) return;
  if (walkInterval) clearInterval(walkInterval);

  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const minX = area.x + 12;
  const maxX = Math.max(minX, area.x + area.width - bounds.width - 12);
  const targetX = Math.max(minX, Math.min(maxX, Math.round(rawTargetX)));

  const currentX = bounds.x;
  const currentY = bounds.y;
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
      try {
        petWindow.setPosition(targetX, currentY);
      } catch {}
      stopWalking();
    } else {
      try {
        petWindow.setPosition(Math.round(currentPos), currentY);
      } catch {}
    }
  }, 25);
}

function applyWidgetPanelLayout(panel) {
  if (![null, 'menu', 'chat', 'pomodoro', 'music', 'voice'].includes(panel)) return;
  if (!petWindow || petWindow.isDestroyed()) return;
  if (panel) stopWalking();

  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;

  const isExpandedPanel = ['menu', 'chat', 'pomodoro', 'music', 'voice'].includes(panel);
  const width = isExpandedPanel ? Math.min(600, area.width - 16) : DEFAULT_PET_WIDTH;
  const requestedHeight = isExpandedPanel ? 520 : DEFAULT_PET_HEIGHT;
  const height = Math.min(requestedHeight, area.height - 16);

  if (activeWidgetPanel === panel && bounds.width === width && bounds.height === height) return;

  if (!activeWidgetPanel && panel) {
    widgetAnchorX = bounds.x + bounds.width / 2;
    widgetBottomY = bounds.y + bounds.height;
  }

  activeWidgetPanel = panel;

  const anchorX = widgetAnchorX ?? (bounds.x + bounds.width / 2);
  const bottomY = widgetBottomY ?? (bounds.y + bounds.height);
  const petSide = anchorX < area.x + area.width / 2 ? 'left' : 'right';
  const petColumnWidth = 150;
  const petCenterOffset = petSide === 'left' ? petColumnWidth / 2 : width - petColumnWidth / 2;

  const rawX = isExpandedPanel ? Math.round(anchorX - petCenterOffset) : Math.round(anchorX - width / 2);
  const x = Math.max(area.x + 8, Math.min(area.x + area.width - width - 8, rawX));
  const y = Math.max(area.y + 8, Math.min(area.y + area.height - height - 8, Math.round(bottomY - height)));

  setPetWindowBounds({ x, y, width, height });

  if (isExpandedPanel) {
    try {
      petWindow.setIgnoreMouseEvents(false);
    } catch {}
    petWindow.webContents.send('overlay:panel-layout', petSide);
  } else {
    widgetAnchorX = null;
    widgetBottomY = null;
  }
}

function setOverlayVisible(visible) {
  if (overlayVisible === visible) {
    if (visible && petWindow && !petWindow.isDestroyed() && !petWindow.isVisible()) {
      petWindow.showInactive();
      petWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    return;
  }
  overlayVisible = visible;
  if (visible) {
    const pw = createPetWindow();
    pw.showInactive();
    pw.setAlwaysOnTop(true, 'screen-saver');
    pw.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    pw.moveTop();
    if (latestPetState.pet) {
      pw.webContents.send('pet:update', latestPetState);
    } else {
      dashboardWindow?.webContents.send('pet:request-sync');
    }
  } else {
    stopWalking();
    applyWidgetPanelLayout(null);
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.hide();
    }
  }
  dashboardWindow?.webContents.send('overlay:visibility', visible);
}

ipcMain.on('overlay:set-ignore-mouse', (event, ignore) => {
  if (event.sender !== petWindow?.webContents) return;
  if (!petWindow || petWindow.isDestroyed()) return;
  try {
    if (ignore && !activeWidgetPanel) {
      petWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      petWindow.setIgnoreMouseEvents(false);
    }
  } catch (err) {
    console.warn('setIgnoreMouseEvents failed:', err);
  }
});

ipcMain.on('pet:drag-move', (event, delta) => {
  if (event.sender !== petWindow?.webContents) return;
  if (!petWindow || petWindow.isDestroyed() || !delta) return;
  const dx = Number(delta.dx) || 0;
  const dy = Number(delta.dy) || 0;
  if (dx === 0 && dy === 0) return;

  stopWalking();
  const bounds = petWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;

  const nextX = Math.max(area.x - 20, Math.min(area.x + area.width - bounds.width + 20, bounds.x + dx));
  const nextY = Math.max(area.y - 10, Math.min(area.y + area.height - bounds.height + 10, bounds.y + dy));

  const actualDx = nextX - bounds.x;
  const actualDy = nextY - bounds.y;
  if (widgetAnchorX !== null) widgetAnchorX += actualDx;
  if (widgetBottomY !== null) widgetBottomY += actualDy;

  setPetWindowBounds({
    x: nextX,
    y: nextY,
    width: bounds.width,
    height: bounds.height
  });
});

ipcMain.on('pet:reset-position', (event) => {
  if (event.sender !== petWindow?.webContents && event.sender !== dashboardWindow?.webContents) return;
  resetPetPosition();
});

ipcMain.on('pet:walk-to', (event, targetX) => {
  if (event.sender !== petWindow?.webContents) return;
  if (typeof targetX === 'number') walkTo(targetX);
});

ipcMain.on('pet:walk-stop', (event) => {
  if (event.sender !== petWindow?.webContents) return;
  stopWalking();
});

ipcMain.on('pet:sync', (event, state) => {
  if (event.sender !== dashboardWindow?.webContents && event.sender !== petWindow?.webContents) return;
  if (!state || typeof state !== 'object') return;
  if (state.pet && typeof state.pet === 'object') {
    latestPetState.pet = state.pet;
  }
  if (typeof state.speechBubble === 'string' || state.speechBubble === null) {
    latestPetState.speechBubble = state.speechBubble;
  }

  if (!latestPetState.pet) {
    return;
  }

  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:update', latestPetState);
    if (overlayVisible) {
      petWindow.showInactive();
      petWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      petWindow.hide();
    }
  }
});

ipcMain.on('overlay:ready', (event) => {
  if (event.sender !== petWindow?.webContents) return;
  event.sender.send('pet:update', latestPetState);
  if (overlayVisible && latestPetState.pet) {
    petWindow?.showInactive();
    petWindow?.setAlwaysOnTop(true, 'screen-saver');
  }
});

ipcMain.on('overlay:widget-panel', (event, panel) => {
  if (event.sender !== petWindow?.webContents) return;
  applyWidgetPanelLayout(panel);
});

ipcMain.on('overlay:set-visible', (event, visible) => {
  if (event.sender !== dashboardWindow?.webContents || typeof visible !== 'boolean') return;
  if (visible === overlayVisible) return;
  setOverlayVisible(visible);
});

ipcMain.on('overlay:pop-out', (event, panel) => {
  if (event.sender !== dashboardWindow?.webContents) return;
  setOverlayVisible(true);
  const pw = createPetWindow();
  try {
    pw.setIgnoreMouseEvents(false);
  } catch {}
  pw.showInactive();
  pw.setAlwaysOnTop(true, 'screen-saver');
  pw.moveTop();

  if (panel && ['menu', 'chat', 'pomodoro', 'music', 'voice'].includes(panel)) {
    applyWidgetPanelLayout(panel);
    pw.webContents.send('overlay:open-panel', panel);
  } else if (latestPetState.pet) {
    pw.webContents.send('pet:update', {
      pet: latestPetState.pet,
      speechBubble: 'Em đang nổi trên màn hình Desktop cùng đại ca đây! Kéo thả hoặc nhấp vào em nhé! 🐾'
    });
  }

  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.minimize();
  }
});

ipcMain.on('overlay:action', (event, action, payload) => {
  if (event.sender !== petWindow?.webContents) return;
  const allowedActions = new Set([
    'feed', 'stroke', 'drink', 'levelUp', 'openTimer', 'hideOverlay',
    'stopMusic', 'resumeBgm', 'resumeMusic', 'nextTrack', 'prevTrack',
    'changeRoom', 'navigateTab', 'openModal', 'changeScale', 'petAction',
    'startRoaming', 'stopRoaming', 'showDashboard'
  ]);
  if (!allowedActions.has(action)) return;

  if (action === 'hideOverlay') {
    setOverlayVisible(false);
    // If dashboard was hidden while overlay gets hidden, restore dashboard so user isn't left with no windows
    if (!dashboardWindow || dashboardWindow.isDestroyed() || !dashboardWindow.isVisible()) {
      createDashboardWindow();
    }
  }
  if (action === 'showDashboard' || action === 'navigateTab' || action === 'openModal') {
    createDashboardWindow();
  }
  if (action === 'stopRoaming') stopWalking();
  if (action === 'startRoaming') {
    const bounds = petWindow ? petWindow.getBounds() : { width: DEFAULT_PET_WIDTH };
    const area = screen.getPrimaryDisplay().workArea;
    const targetX = Math.round(area.x + 40 + Math.random() * Math.max(60, area.width - bounds.width - 80));
    walkTo(targetX);
  }
  if (action === 'openTimer') {
    applyWidgetPanelLayout('pomodoro');
    petWindow?.webContents.send('overlay:open-panel', 'pomodoro');
  }
  dashboardWindow?.webContents.send('overlay:action', action, payload);
});

ipcMain.on('dashboard:show', (event) => {
  if (event.sender !== petWindow?.webContents) return;
  createDashboardWindow();
});

function createAlarmWindow(alarmData) {
  if (alarmWindow && !alarmWindow.isDestroyed()) {
    alarmWindow.show();
    alarmWindow.setAlwaysOnTop(true, 'screen-saver');
    alarmWindow.moveTop();
    alarmWindow.focus();
    alarmWindow.flashFrame(true);
    alarmWindow.webContents.send('alarm:popup-data', {
      ...alarmData,
      pet: latestPetState.pet
    });
    return alarmWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width: screenW, height: screenH } = primaryDisplay.workArea;
  const POPUP_W = 490;
  const POPUP_H = 320;
  const popupX = Math.round(x + (screenW - POPUP_W) / 2);
  const popupY = Math.round(y + (screenH - POPUP_H) / 2);

  alarmWindow = new BrowserWindow({
    width: POPUP_W,
    height: POPUP_H,
    x: popupX,
    y: popupY,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: true,
    show: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  alarmWindow.setAlwaysOnTop(true, 'screen-saver');
  alarmWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  alarmWindow.moveTop();
  alarmWindow.focus();
  alarmWindow.flashFrame(true);

  void loadRenderer(alarmWindow, 'alarm-modal');

  const sendData = () => {
    if (alarmWindow && !alarmWindow.isDestroyed()) {
      alarmWindow.show();
      alarmWindow.setAlwaysOnTop(true, 'screen-saver');
      alarmWindow.moveTop();
      alarmWindow.focus();
      alarmWindow.webContents.send('alarm:popup-data', {
        ...alarmData,
        pet: latestPetState.pet
      });
    }
  };
  alarmWindow.webContents.once('did-finish-load', sendData);
  alarmWindow.once('ready-to-show', sendData);

  alarmWindow.on('closed', () => {
    alarmWindow = null;
  });

  return alarmWindow;
}

function closeAlarmWindow() {
  if (alarmWindow && !alarmWindow.isDestroyed()) {
    alarmWindow.close();
    alarmWindow = null;
  }
}

ipcMain.on('alarm:raise', (event, alarmData) => {
  // 1. CHỈ BẬT DUY NHẤT CỬA SỔ THÔNG BÁO BÁO THỨC TRÊN MÀN HÌNH MÁY TÍNH
  createAlarmWindow(alarmData);

  // 2. Không mở bung tab dashboard, chỉ flash taskbar nhẹ nhàng nếu cửa sổ đang có
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.flashFrame(true);
    dashboardWindow.webContents.send('alarm:triggered', alarmData);
  }

  // 3. Thú cưng Desktop giữ nguyên kích thước nhỏ nhắn, chỉ hiện bong bóng thoại, KHÔNG bung mở panel
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('alarm:triggered', alarmData);
    if (latestPetState.pet) {
      const timeLabel = alarmData && alarmData.clockTimeTriggered
        ? 'đã đến ' + alarmData.clockTimeTriggered
        : 'đã hết ' + ((alarmData && alarmData.completedMins) || 25) + ' phút';
      petWindow.webContents.send('pet:update', {
        pet: latestPetState.pet,
        speechBubble: '⏰ ĐẠI CA ƠI! HẾT GIỜ RỒI! (' + timeLabel + ') 🔔'
      });
    }
  }
});

ipcMain.on('alarm:stop', () => {
  closeAlarmWindow();
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.flashFrame(false);
    dashboardWindow.webContents.send('alarm:stop');
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('alarm:stop');
  }
});

ipcMain.on('alarm:dismiss', () => {
  closeAlarmWindow();
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.flashFrame(false);
    dashboardWindow.webContents.send('alarm:stop');
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('alarm:stop');
  }
});

ipcMain.on('alarm:action', (event, action, payload) => {
  closeAlarmWindow();
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.flashFrame(false);
    dashboardWindow.webContents.send('alarm:action', action, payload);
    if (action === 'SHOW_DASHBOARD') {
      createDashboardWindow();
    }
  } else if (action === 'SHOW_DASHBOARD') {
    createDashboardWindow();
  }
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('alarm:action', action, payload);
  }
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

  let lastOverlayToggleTime = 0;
  globalShortcut.register('CommandOrControl+Shift+P', () => {
    const now = Date.now();
    if (now - lastOverlayToggleTime < 350) return;
    lastOverlayToggleTime = now;
    setOverlayVisible(!overlayVisible);
  });

  setInterval(() => {
    if (overlayVisible && petWindow && !petWindow.isDestroyed() && !petWindow.isVisible()) {
      petWindow.showInactive();
      petWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 10000);

  app.on('second-instance', () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      if (dashboardWindow.isMinimized()) dashboardWindow.restore();
      dashboardWindow.show();
      dashboardWindow.focus();
    } else {
      createDashboardWindow();
    }
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
