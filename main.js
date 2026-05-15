const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// GPU acceleration and performance flags
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-hardware-overlays');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

let mainWindow;
let toolbarView;
let youtubeView;

// --- YouTube Ad Blocker ---
function setupAdBlocker() {
  // Strip ALL YouTube CSP headers to allow our preload scripts to run consistently
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.youtube.com/*'] },
    (details, callback) => {
      const responseHeaders = details.responseHeaders;
      const cspHeaders = [
        'content-security-policy',
        'x-webkit-csp',
        'content-security-policy-report-only'
      ];
      
      Object.keys(responseHeaders).forEach(key => {
        if (cspHeaders.includes(key.toLowerCase())) {
          delete responseHeaders[key];
        }
      });
      
      callback({ cancel: false, responseHeaders });
    }
  );

  // Block known ad infrastructure domains + googlevideo.com ad streams
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;

    // Hard-block only the absolute primary ad domains
    const isAdDomain =
      url.includes('pagead2.googlesyndication.com') ||
      url.includes('tpc.googlesyndication.com') ||
      url.includes('ad.doubleclick.net') ||
      url.includes('googleads.g.doubleclick.net') ||
      url.includes('adservice.google.com') ||
      url.includes('ads.youtube.com') ||
      url.includes('static.doubleclick.net') ||
      url.includes('googleadservices.com');

    callback({ cancel: isAdDomain });
  });

  console.log('[AdBlocker] Minimal domain blocking active');
}

function createWindow() {
  // Use a standard window frame to ensure perfect maximization and taskbar behavior
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'YT - Reigen',
    icon: path.join(__dirname, 'yt_icon_red_digital.png'),
    autoHideMenuBar: true, // Hides the File/Edit/View menu
    backgroundColor: '#000000'
  });

  // 1. Create Toolbar View (Back, Forward, Reload)
  toolbarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-toolbar.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  toolbarView.webContents.loadFile('toolbar.html');
  mainWindow.contentView.addChildView(toolbarView);

  // 2. Create YouTube View
  youtubeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload-youtube.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  youtubeView.webContents.loadURL('https://www.youtube.com');
  youtubeView.webContents.on('did-fail-load', (e, code, desc) => {
    console.error(`[Main Process] YouTube failed to load: ${code} - ${desc}`);
  });
  mainWindow.contentView.addChildView(youtubeView);

  function resizeViews() {
    if (!mainWindow || !toolbarView || !youtubeView) return;
    
    const bounds = mainWindow.getContentBounds();
    const isFullScreen = mainWindow.isFullScreen();
    
    if (isFullScreen) {
      // In Fullscreen, hide toolbar and make YouTube fill the whole content area
      toolbarView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      youtubeView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
      // In true fullscreen, resizing shouldn't be possible anyway, but this ensures it
    } else {
      // Toolbar at the top of the client area
      toolbarView.setBounds({
        x: 0,
        y: 0,
        width: bounds.width,
        height: 40
      });

      // YouTube below the toolbar
      youtubeView.setBounds({
        x: 0,
        y: 40,
        width: bounds.width,
        height: bounds.height - 40
      });
    }
  }

  mainWindow.on('resize', resizeViews);
  mainWindow.on('maximize', resizeViews);
  mainWindow.on('unmaximize', resizeViews);
  mainWindow.on('enter-full-screen', resizeViews);
  mainWindow.on('leave-full-screen', resizeViews);
  
  resizeViews();
  mainWindow.show();

  // Handle IPC from toolbar
  ipcMain.on('go-back', () => {
    if (youtubeView.webContents.navigationHistory.canGoBack()) youtubeView.webContents.navigationHistory.goBack();
  });
  
  ipcMain.on('go-forward', () => {
    if (youtubeView.webContents.navigationHistory.canGoForward()) youtubeView.webContents.navigationHistory.goForward();
  });

  ipcMain.on('reload', () => {
    youtubeView.webContents.reload();
  });

  // For debugging
  // youtubeView.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(async () => {
  setupAdBlocker();
  // Small delay to ensure webRequest handlers are fully registered
  setTimeout(() => {
    createWindow();
    
    // Configure and check for updates
    autoUpdater.on('update-available', () => {
      console.log('[Updater] Update available.');
    });
    autoUpdater.on('update-downloaded', () => {
      console.log('[Updater] Update downloaded.');
      // Optional: Prompt the user to install and restart here, or it will happen on next launch
    });
    autoUpdater.checkForUpdatesAndNotify();
  }, 500);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
