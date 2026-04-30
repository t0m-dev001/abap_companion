const {
  app, BrowserWindow, ipcMain, Tray,
  Menu, nativeImage, screen, shell
} = require('electron');
const path = require('path');
const Store = require('electron-store');

const DEFAULT_REMINDERS = [
  { id: 'r1', emoji: '☀',  label: 'Morning',    time: '08:00', enabled: true },
  { id: 'r2', emoji: '⚡', label: 'Midday',     time: '13:00', enabled: true },
  { id: 'r3', emoji: '🌙', label: 'End of Day', time: '17:30', enabled: true },
];

const WIN_W        = 320;
const WIN_H        = 660;
const WIN_COLLAPSED_W = 130;
const WIN_COLLAPSED_H = 150;

const store = new Store({
  name: 'bapi-data',
  encryptionKey: 'bapi-companion-secure-2025',
  defaults: {
    apiKey:           '',
    apiModel:         '',
    apiProvider:      'google',
    windowBounds:     null,
    chatHistory:      [],
    startOnLogin:     false,
    remindersEnabled: true,
    reminders:        DEFAULT_REMINDERS,
    theme:            'hacker',
    opacity:          1.0,
    collapsed:        false,
  },
});

let mainWindow  = null;
let readerWin   = null;
let tray        = null;
let scheduler   = null;
let isQuitting  = false;
let isCollapsed = false;

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const saved = store.get('windowBounds');
  const { workAreaSize } = screen.getPrimaryDisplay();
  const collapsed = store.get('collapsed', false);
  const w = collapsed ? WIN_COLLAPSED_W : (saved && saved.width  ? saved.width  : WIN_W);
  const h = collapsed ? WIN_COLLAPSED_H : (saved && saved.height ? saved.height : WIN_H);
  const defaultX = workAreaSize.width  - WIN_W - 24;
  const defaultY = Math.floor((workAreaSize.height - WIN_H) / 2);

  mainWindow = new BrowserWindow({
    width: w, height: h,
    minWidth:  260,   // allow user to shrink but keep usable
    minHeight: 420,
    x: saved ? saved.x : defaultX,
    y: saved ? saved.y : defaultY,
    frame:       false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable:   true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      devTools:         !app.isPackaged,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // Apply stored opacity
    const opacity = store.get('opacity', 1.0);
    mainWindow.setOpacity(opacity);
    mainWindow.show();
    isCollapsed = collapsed;
    if (!scheduler) scheduler = require('./scheduler')(triggerReminder, store);
  });

  // Save position AND size on resize/move
  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    store.set('windowBounds', { x: b.x, y: b.y, width: b.width, height: b.height });
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Reader window ─────────────────────────────────────────────────────────────
function openReaderWindow(content, theme) {
  if (readerWin && !readerWin.isDestroyed()) {
    readerWin.focus();
    store.set('_readerContent', { content, theme, ts: Date.now() });
    readerWin.webContents.send('bapi:reader-refresh');
    return;
  }

  store.set('_readerContent', { content, theme, ts: Date.now() });

  readerWin = new BrowserWindow({
    width: 660, height: 540,
    minWidth: 480, minHeight: 360,
    frame: true,
    show: false,
    title: 'BAPI — Response Reader',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  readerWin.loadFile(path.join(__dirname, 'renderer', 'reader.html'));
  readerWin.setMenu(null);
  readerWin.once('ready-to-show', () => readerWin.show());
  readerWin.on('closed', () => { readerWin = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let img;
  try {
    img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) throw new Error();
  } catch { img = nativeImage.createEmpty(); }

  tray = new Tray(img);
  tray.setToolTip('BAPI — ABAP Companion');
  rebuildTrayMenu();
  tray.on('click', () => toggleWindow());
  tray.on('double-click', () => showWindow());
}

function rebuildTrayMenu() {
  if (!tray) return;
  const reminders = store.get('reminders', DEFAULT_REMINDERS);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: mainWindow?.isVisible() ? 'Hide BAPI' : 'Show BAPI', click: toggleWindow },
    { type: 'separator' },
    ...reminders.filter(r => r.enabled).map(r => ({
      label: `${r.emoji}  ${r.label} (${r.time})`,
      click: () => triggerReminder(r),
    })),
    { type: 'separator' },
    { label: '⚙  Settings', click: () => { showWindow(); mainWindow?.webContents.send('bapi:open-settings'); } },
    { type: 'separator' },
    { label: 'Quit BAPI', click: () => { isQuitting = true; app.quit(); } },
  ]));
}

function toggleWindow() {
  if (!mainWindow) return;
  mainWindow.isVisible() ? mainWindow.hide() : showWindow();
}
function showWindow() {
  if (!mainWindow) return;
  mainWindow.show(); mainWindow.focus();
}

// ── Reminder ──────────────────────────────────────────────────────────────────
function triggerReminder(reminder) {
  if (!store.get('remindersEnabled')) return;
  // Auto-expand when reminder fires
  if (isCollapsed && mainWindow) {
    mainWindow.setSize(WIN_W, WIN_H);
    isCollapsed = false;
    store.set('collapsed', false);
  }
  showWindow();
  mainWindow?.webContents.send('bapi:reminder', reminder);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function setupIPC() {

  // ── Multi-provider chat ──
  ipcMain.handle('bapi:chat', async (_e, { messages, system }) => {
    const apiKey   = store.get('apiKey', '');
    const model    = store.get('apiModel', '');
    const provider = store.get('apiProvider', 'google');
    if (!apiKey) return { error: 'no_api_key' };

    try {
      if (provider === 'anthropic') {
        const m = model || 'claude-sonnet-4-6';
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: m, max_tokens: 1200, system, messages }),
        });
        const data = await resp.json();
        if (data.error) return { error: data.error.message };
        return data;
      }

      if (provider === 'google') {
        const m = model || 'gemma-3-27b-it';
        const contents = messages.map(msg => ({
          role:  msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));
        const isGemma = m.startsWith('gemma');
        const finalContents = isGemma
          ? [{ role: 'user',  parts: [{ text: `[System — follow strictly]:\n${system}` }] },
             { role: 'model', parts: [{ text: 'Understood. Following those instructions.' }] },
             ...contents]
          : contents;
        const body = { contents: finalContents, generationConfig: { maxOutputTokens: 1200 } };
        if (!isGemma) body.systemInstruction = { parts: [{ text: system }] };
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await resp.json();
        if (data.error) return { error: data.error.message };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { content: [{ type: 'text', text }] };
      }

      return { error: `Unknown provider: ${provider}` };
    } catch (e) { return { error: e.message }; }
  });

  // ── Google model list ──
  ipcMain.handle('bapi:list-models', async () => {
    const apiKey   = store.get('apiKey', '');
    const provider = store.get('apiProvider', 'google');
    if (!apiKey || provider !== 'google') return { error: 'Need a Google API key set first.' };
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`);
      const data = await resp.json();
      if (data.error) return { error: data.error.message };
      const models = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => ({
          id:          m.name.replace('models/', ''),
          displayName: m.displayName || m.name,
          description: m.description || '',
        }));
      return { models };
    } catch (e) { return { error: e.message }; }
  });

  // ── Smooth window drag (replaces -webkit-app-region which causes lag) ──
  // Uses screen.getCursorScreenPoint() polled at 60fps in main process.
  // Renderer sends drag-start on mousedown, drag-end on mouseup.
  let dragInterval  = null;
  let dragStartMouse = null;
  let dragStartBounds = null;

  ipcMain.on('bapi:drag-start', () => {
    if (dragInterval) { clearInterval(dragInterval); dragInterval = null; }
    dragStartMouse  = screen.getCursorScreenPoint();
    dragStartBounds = mainWindow ? mainWindow.getBounds() : null;
    if (!dragStartBounds) return;

    dragInterval = setInterval(() => {
      if (!mainWindow) { clearInterval(dragInterval); return; }
      const cur = screen.getCursorScreenPoint();
      const dx  = cur.x - dragStartMouse.x;
      const dy  = cur.y - dragStartMouse.y;
      mainWindow.setPosition(dragStartBounds.x + dx, dragStartBounds.y + dy);
    }, 16); // ~60 fps
  });

  ipcMain.on('bapi:drag-end', () => {
    if (dragInterval) { clearInterval(dragInterval); dragInterval = null; }
    // Persist new position
    if (mainWindow) {
      const b = mainWindow.getBounds();
      store.set('windowBounds', { x: b.x, y: b.y });
    }
  });

  // ── Store ──
  ipcMain.handle('bapi:store-get',    (_e, k)    => store.get(k));
  ipcMain.handle('bapi:store-set',    (_e, k, v) => { store.set(k, v); });
  ipcMain.handle('bapi:store-delete', (_e, k)    => store.delete(k));

  // ── Window controls ──
  ipcMain.on('bapi:hide',     () => mainWindow?.hide());
  ipcMain.on('bapi:minimize', () => mainWindow?.minimize());
  ipcMain.on('bapi:open-url', (_e, url) => shell.openExternal(url));
  ipcMain.on('bapi:devtools', () => { if (!app.isPackaged) mainWindow?.webContents.toggleDevTools(); });

  // ── Opacity ──
  ipcMain.on('bapi:set-opacity', (_e, val) => {
    const v = Math.max(0.15, Math.min(1.0, val));
    mainWindow?.setOpacity(v);
    store.set('opacity', v);
  });

  // ── Collapse / Expand ──
  ipcMain.on('bapi:collapse', () => {
    if (!mainWindow) return;
    mainWindow.setSize(WIN_COLLAPSED_W, WIN_COLLAPSED_H);
    isCollapsed = true;
    store.set('collapsed', true);
  });
  ipcMain.on('bapi:expand', () => {
    if (!mainWindow) return;
    mainWindow.setSize(WIN_W, WIN_H);
    isCollapsed = false;
    store.set('collapsed', false);
  });

  // ── Open reader popup ──
  ipcMain.on('bapi:open-reader', (_e, { content, theme }) => {
    openReaderWindow(content, theme);
  });

  // ── Settings saved ──
  ipcMain.on('bapi:settings-saved', (_e, settings) => {
    app.setLoginItemSettings({ openAtLogin: !!settings.startOnLogin });
    if (scheduler) scheduler.update(settings.reminders || []);
    rebuildTrayMenu();
  });

  // ── Trigger reminder (pill click) ──
  ipcMain.on('bapi:trigger-reminder', (_e, reminder) => triggerReminder(reminder));

  // ── Reader refresh ──
  ipcMain.on('bapi:reader-refresh', () => {
    readerWin?.webContents.send('bapi:reader-refresh');
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.on('second-instance', () => showWindow());
  setupIPC();
  createWindow();
  createTray();
  app.setLoginItemSettings({ openAtLogin: store.get('startOnLogin', false) });
});

app.on('window-all-closed', () => { if (process.platform === 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); else showWindow(); });
app.on('before-quit', () => { isQuitting = true; scheduler?.destroy(); });
