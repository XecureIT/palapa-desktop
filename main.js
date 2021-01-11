/* eslint-disable no-console */

const path = require('path');
const url = require('url');
const os = require('os');
const fs = require('fs-extra');
const crypto = require('crypto');
const qs = require('qs');
const normalizePath = require('normalize-path');
const fg = require('fast-glob');
const PQueue = require('p-queue').default;

const _ = require('lodash');
const pify = require('pify');
const electron = require('electron');

const packageJson = require('./package.json');
const GlobalErrors = require('./app/global_errors');

GlobalErrors.addHandler();

// Set umask early on in the process lifecycle to ensure file permissions are
// set such that only we have read access to our files
process.umask(0o077);

const getRealPath = pify(fs.realpath);
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain: ipc,
  Menu,
  protocol: electronProtocol,
  session,
  shell,
} = electron;

const appUserModelId = `id.xecureworld.${packageJson.name}`;
console.log('Set Windows Application User Model ID (AUMID)', {
  appUserModelId,
});
app.setAppUserModelId(appUserModelId);

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function getMainWindow() {
  return mainWindow;
}

// Tray icon and related objects
let tray = null;
const startInTray = process.argv.some(arg => arg === '--start-in-tray');
const usingTrayIcon =
  startInTray || process.argv.some(arg => arg === '--use-tray-icon');

const disableFlashFrame = process.argv.some(
  arg => arg === '--disable-flash-frame'
);

const config = require('./app/config');

// Very important to put before the single instance check, since it is based on the
//   userData directory.
const userConfig = require('./app/user_config');

const importMode =
  process.argv.some(arg => arg === '--import') || config.get('import');

const development = config.environment === 'development';

// We generally want to pull in our own modules after this point, after the user
//   data directory has been set.
const attachments = require('./app/attachments');
const attachmentChannel = require('./app/attachment_channel');
const updater = require('./ts/updater/index');
const createTrayIcon = require('./app/tray_icon');
const dockIcon = require('./app/dock_icon');
const ephemeralConfig = require('./app/ephemeral_config');
const logging = require('./app/logging');
const sql = require('./app/sql');
const sqlChannels = require('./app/sql_channel');
const windowState = require('./app/window_state');
const { createTemplate } = require('./app/menu');
const {
  installFileHandler,
  installWebHandler,
} = require('./app/protocol_filter');
const { installPermissionsHandler } = require('./app/permissions');

function showWindow() {
  if (!mainWindow) {
    return;
  }

  // Using focus() instead of show() seems to be important on Windows when our window
  //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
  //   the window to reposition:
  //   https://github.com/signalapp/Signal-Desktop/issues/1429
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
  }

  // toggle the visibility of the show/hide tray icon menu entries
  if (tray) {
    tray.updateContextMenu();
  }

  // show the app on the Dock in case it was hidden before
  dockIcon.show();
}

if (!process.mas) {
  console.log('making app single instance');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log('quitting; we are the second instance');
    app.exit();
  } else {
    app.on('second-instance', (e, argv) => {
      // Someone tried to run a second instance, we should focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        showWindow();
      }
      // Are they trying to open a sgnl link?
      const incomingUrl = getIncomingUrl(argv);
      if (incomingUrl) {
        handleSgnlLink(incomingUrl);
      }
      // Handled
      return true;
    });
  }
}

const windowFromUserConfig = userConfig.get('window');
const windowFromEphemeral = ephemeralConfig.get('window');
let windowConfig = windowFromEphemeral || windowFromUserConfig;
if (windowFromUserConfig) {
  userConfig.set('window', null);
  ephemeralConfig.set('window', windowConfig);
}

const loadLocale = require('./app/locale').load;

// Both of these will be set after app fires the 'ready' event
let logger;
let locale;

function prepareURL(pathSegments, moreKeys) {
  const parsed = url.parse(path.join(...pathSegments));

  return url.format({
    ...parsed,
    protocol: parsed.protocol || 'file:',
    slashes: true,
    query: {
      name: packageJson.productName,
      locale: locale.name,
      version: app.getVersion(),
      buildExpiration: config.get('buildExpiration'),
      serverUrl: config.get('serverUrl'),
      cdnUrl: config.get('cdnUrl'),
      certificateAuthority: config.get('certificateAuthority'),
      environment: config.environment,
      node_version: process.versions.node,
      hostname: os.hostname(),
      appInstance: process.env.NODE_APP_INSTANCE,
      proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy,
      contentProxyUrl: config.contentProxyUrl,
      importMode: importMode ? true : undefined, // for stringify()
      serverTrustRoot: config.get('serverTrustRoot'),
      ...moreKeys,
    },
  });
}

async function handleUrl(event, target) {
  event.preventDefault();
  const { protocol, hostname } = url.parse(target);
  const isDevServer = config.enableHttp && hostname === 'localhost';
  // We only want to specially handle urls that aren't requesting the dev server
  if ((protocol === 'http:' || protocol === 'https:') && !isDevServer) {
    try {
      await shell.openExternal(target);
    } catch (error) {
      console.log(`Failed to open url: ${error.stack}`);
    }
  }
}

function handleCommonWindowEvents(window) {
  window.webContents.on('will-navigate', handleUrl);
  window.webContents.on('new-window', handleUrl);
  window.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error(`Preload error in ${preloadPath}: `, error.message);
  });
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 610;
const MIN_WIDTH = 680;
const MIN_HEIGHT = 550;
const BOUNDS_BUFFER = 100;

function isVisible(window, bounds) {
  const boundsX = _.get(bounds, 'x') || 0;
  const boundsY = _.get(bounds, 'y') || 0;
  const boundsWidth = _.get(bounds, 'width') || DEFAULT_WIDTH;
  const boundsHeight = _.get(bounds, 'height') || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound =
    window.x + window.width >= boundsX + BOUNDS_BUFFER;
  const leftSideClearOfRightBound =
    window.x <= boundsX + boundsWidth - BOUNDS_BUFFER;

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound =
    window.y <= boundsY + boundsHeight - BOUNDS_BUFFER;

  return (
    rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound
  );
}

function createWindow() {
  const { screen } = electron;
  const windowOptions = Object.assign(
    {
      show: !startInTray, // allow to start minimised in tray
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      autoHideMenuBar: false,
      backgroundColor:
        config.environment === 'test' || config.environment === 'test-lib'
          ? '#ffffff' // Tests should always be rendered on a white background
          : '#f65552',
      vibrancy: 'appearance-based',
      webPreferences: {
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js'),
        nativeWindowOpen: true,
      },
      icon: path.join(__dirname, 'images', 'icon_256.png'),
    },
    _.pick(windowConfig, ['autoHideMenuBar', 'width', 'height', 'x', 'y'])
  );

  if (!_.isNumber(windowOptions.width) || windowOptions.width < MIN_WIDTH) {
    windowOptions.width = DEFAULT_WIDTH;
  }
  if (!_.isNumber(windowOptions.height) || windowOptions.height < MIN_HEIGHT) {
    windowOptions.height = DEFAULT_HEIGHT;
  }
  if (!_.isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), display => {
    if (!_.isNumber(windowOptions.x) || !_.isNumber(windowOptions.y)) {
      return false;
    }

    return isVisible(windowOptions, _.get(display, 'bounds'));
  });
  if (!visibleOnAnyScreen) {
    console.log('Location reset needed');
    delete windowOptions.x;
    delete windowOptions.y;
  }

  logger.info(
    'Initializing BrowserWindow config: %s',
    JSON.stringify(windowOptions)
  );

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);
  if (!usingTrayIcon && windowConfig && windowConfig.maximized) {
    mainWindow.maximize();
  }
  if (!usingTrayIcon && windowConfig && windowConfig.fullscreen) {
    mainWindow.setFullScreen(true);
  }

  function captureAndSaveWindowStats() {
    if (!mainWindow) {
      return;
    }

    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      autoHideMenuBar: mainWindow.isMenuBarAutoHide(),
      fullscreen: mainWindow.isFullScreen(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1],
    };

    logger.info(
      'Updating BrowserWindow config: %s',
      JSON.stringify(windowConfig)
    );
    ephemeralConfig.set('window', windowConfig);
  }

  const debouncedCaptureStats = _.debounce(captureAndSaveWindowStats, 500);
  mainWindow.on('resize', debouncedCaptureStats);
  mainWindow.on('move', debouncedCaptureStats);

  // Ingested in preload.js via a sendSync call
  ipc.on('locale-data', event => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = locale.messages;
  });

  if (config.environment === 'test') {
    mainWindow.loadURL(prepareURL([__dirname, 'test', 'index.html']));
  } else if (config.environment === 'test-lib') {
    mainWindow.loadURL(
      prepareURL([__dirname, 'libtextsecure', 'test', 'index.html'])
    );
  } else {
    mainWindow.loadURL(prepareURL([__dirname, 'background.html']));
  }

  if (config.get('openDevTools')) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  }

  handleCommonWindowEvents(mainWindow);

  // Emitted when the window is about to be closed.
  // Note: We do most of our shutdown logic here because all windows are closed by
  //   Electron before the app quits.
  mainWindow.on('close', async e => {
    console.log('close event', {
      readyForShutdown: mainWindow ? mainWindow.readyForShutdown : null,
      shouldQuit: windowState.shouldQuit(),
    });
    // If the application is terminating, just do the default
    if (
      config.environment === 'test' ||
      config.environment === 'test-lib' ||
      (mainWindow.readyForShutdown && windowState.shouldQuit())
    ) {
      return;
    }

    // Prevent the shutdown
    e.preventDefault();
    mainWindow.hide();

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    if (
      !windowState.shouldQuit() &&
      (usingTrayIcon || process.platform === 'darwin')
    ) {
      // toggle the visibility of the show/hide tray icon menu entries
      if (tray) {
        tray.updateContextMenu();
      }

      // hide the app from the Dock on macOS if the tray icon is enabled
      if (usingTrayIcon) {
        dockIcon.hide();
      }

      return;
    }

    await requestShutdown();
    if (mainWindow) {
      mainWindow.readyForShutdown = true;
    }
    app.quit();
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

ipc.on('show-window', () => {
  showWindow();
});

let isReadyForUpdates = false;
async function readyForUpdates() {
  if (isReadyForUpdates) {
    return;
  }

  isReadyForUpdates = true;

  // First, install requested sticker pack
  const incomingUrl = getIncomingUrl(process.argv);
  if (incomingUrl) {
    handleSgnlLink(incomingUrl);
  }

  // Second, start checking for app updates
  try {
    await updater.start(getMainWindow, locale, logger);
  } catch (error) {
    logger.error(
      'Error starting update checks:',
      error && error.stack ? error.stack : error
    );
  }
}

ipc.once('ready-for-updates', readyForUpdates);

const TEN_MINUTES = 10 * 60 * 1000;
setTimeout(readyForUpdates, TEN_MINUTES);

function openReleaseNotes() {
  shell.openExternal(
    `https://github.com/signalapp/Signal-Desktop/releases/tag/v${app.getVersion()}`
  );
}

function openNewBugForm() {
  shell.openExternal('https://github.com/signalapp/Signal-Desktop/issues/new');
}

function openSupportPage() {
  shell.openExternal(
    'https://support.signal.org/hc/en-us/categories/202319038-Desktop'
  );
}

function openForums() {
  shell.openExternal('https://community.signalusers.org/');
}

function showKeyboardShortcuts() {
  if (mainWindow) {
    mainWindow.webContents.send('show-keyboard-shortcuts');
  }
}

function setupAsNewDevice() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-new-device');
  }
}

function setupAsStandalone() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-standalone');
  }
}

let aboutWindow;
function showAbout() {
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }

  const options = {
    width: 500,
    height: 400,
    resizable: false,
    title: locale.messages.aboutDesktop.message,
    autoHideMenuBar: true,
    //backgroundColor: '#2090EA',
    show: false,
    vibrancy: 'appearance-based',
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'about_preload.js'),
      nativeWindowOpen: true,
    },
    parent: mainWindow,
  };

  aboutWindow = new BrowserWindow(options);

  handleCommonWindowEvents(aboutWindow);

  aboutWindow.loadURL(prepareURL([__dirname, 'about.html']));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });
}

let settingsWindow;
async function showSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    return;
  }
  if (!mainWindow) {
    return;
  }

  addDarkOverlay();

  const size = mainWindow.getSize();
  const options = {
    width: Math.min(500, size[0]),
    height: Math.max(size[1] - 100, MIN_HEIGHT),
    frame: false,
    resizable: false,
    title: locale.messages.signalDesktopPreferences.message,
    autoHideMenuBar: true,
    //backgroundColor: '#2090EA',
    show: false,
    modal: true,
    vibrancy: 'appearance-based',
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'settings_preload.js'),
      nativeWindowOpen: true,
    },
    parent: mainWindow,
  };

  settingsWindow = new BrowserWindow(options);

  handleCommonWindowEvents(settingsWindow);

  settingsWindow.loadURL(prepareURL([__dirname, 'settings.html']));

  settingsWindow.on('closed', () => {
    removeDarkOverlay();
    settingsWindow = null;
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });
}

async function getIsLinked() {
  try {
    const number = await sql.getItemById('number_id');
    const password = await sql.getItemById('password');
    return Boolean(number && password);
  } catch (e) {
    return false;
  }
}
/* Remove sticker upload
let stickerCreatorWindow;
async function showStickerCreator() {
  if (!(await getIsLinked())) {
    const { message } = locale.messages[
      'StickerCreator--Authentication--error'
    ];

    dialog.showMessageBox({
      type: 'warning',
      message,
    });

    return;
  }

  if (stickerCreatorWindow) {
    stickerCreatorWindow.show();
    return;
  }

  const { x = 0, y = 0 } = windowConfig || {};

  const options = {
    x: x + 100,
    y: y + 100,
    width: 800,
    minWidth: 800,
    height: 650,
    title: locale.messages.signalDesktopStickerCreator,
    autoHideMenuBar: true,
    //backgroundColor: '#2090EA',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'sticker-creator/preload.js'),
      nativeWindowOpen: true,
    },
  };

  stickerCreatorWindow = new BrowserWindow(options);

  handleCommonWindowEvents(stickerCreatorWindow);

  const appUrl = config.enableHttp
    ? prepareURL(['http://localhost:6380/sticker-creator/dist/index.html'])
    : prepareURL([__dirname, 'sticker-creator/dist/index.html']);

  stickerCreatorWindow.loadURL(appUrl);

  stickerCreatorWindow.on('closed', () => {
    stickerCreatorWindow = null;
  });

  stickerCreatorWindow.once('ready-to-show', () => {
    stickerCreatorWindow.show();

    if (config.get('openDevTools')) {
      // Open the DevTools.
      stickerCreatorWindow.webContents.openDevTools();
    }
  });
}
*/

let debugLogWindow;
async function showDebugLogWindow() {
  if (debugLogWindow) {
    debugLogWindow.show();
    return;
  }

  const theme = await pify(getDataFromMainWindow)('theme-setting');
  const size = mainWindow.getSize();
  const options = {
    width: Math.max(size[0] - 100, MIN_WIDTH),
    height: Math.max(size[1] - 100, MIN_HEIGHT),
    resizable: false,
    title: locale.messages.debugLog.message,
    autoHideMenuBar: true,
    //backgroundColor: '#2090EA',
    show: false,
    modal: true,
    vibrancy: 'appearance-based',
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'debug_log_preload.js'),
      nativeWindowOpen: true,
    },
    parent: mainWindow,
  };

  debugLogWindow = new BrowserWindow(options);

  handleCommonWindowEvents(debugLogWindow);

  debugLogWindow.loadURL(prepareURL([__dirname, 'debug_log.html'], { theme }));

  debugLogWindow.on('closed', () => {
    removeDarkOverlay();
    debugLogWindow = null;
  });

  debugLogWindow.once('ready-to-show', () => {
    addDarkOverlay();
    debugLogWindow.show();
  });
}

let permissionsPopupWindow;
async function showPermissionsPopupWindow() {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.show();
    return;
  }
  if (!mainWindow) {
    return;
  }

  const theme = await pify(getDataFromMainWindow)('theme-setting');
  const size = mainWindow.getSize();
  const options = {
    width: Math.min(400, size[0]),
    height: Math.min(150, size[1]),
    resizable: false,
    title: locale.messages.allowAccess.message,
    autoHideMenuBar: true,
    //backgroundColor: '#2090EA',
    show: false,
    modal: true,
    vibrancy: 'appearance-based',
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'permissions_popup_preload.js'),
      nativeWindowOpen: true,
    },
    parent: mainWindow,
  };

  permissionsPopupWindow = new BrowserWindow(options);

  handleCommonWindowEvents(permissionsPopupWindow);

  permissionsPopupWindow.loadURL(
    prepareURL([__dirname, 'permissions_popup.html'], { theme })
  );

  permissionsPopupWindow.on('closed', () => {
    removeDarkOverlay();
    permissionsPopupWindow = null;
  });

  permissionsPopupWindow.once('ready-to-show', () => {
    addDarkOverlay();
    permissionsPopupWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;
app.on('ready', async () => {
  const userDataPath = await getRealPath(app.getPath('userData'));
  const installPath = await getRealPath(app.getAppPath());

  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'test-lib') {
    installFileHandler({
      protocol: electronProtocol,
      userDataPath,
      installPath,
      isWindows: process.platform === 'win32',
    });
  }

  installWebHandler({
    enableHttp: config.enableHttp,
    protocol: electronProtocol,
  });

  installPermissionsHandler({ session, userConfig });

  await logging.initialize();
  logger = logging.getLogger();
  logger.info('app ready');
  logger.info(`starting version ${packageJson.version}`);

  if (!locale) {
    const appLocale = process.env.NODE_ENV === 'test' ? 'en' : app.getLocale();
    locale = loadLocale({ appLocale, logger });
  }

  GlobalErrors.updateLocale(locale.messages);

  let key = userConfig.get('key');
  if (!key) {
    console.log(
      'key/initialize: Generating new encryption key, since we did not find it on disk'
    );
    // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
    key = crypto.randomBytes(32).toString('hex');
    userConfig.set('key', key);
  }
  const success = await sql.initialize({
    configDir: userDataPath,
    key,
    messages: locale.messages,
  });
  if (!success) {
    console.log('sql.initialize was unsuccessful; returning early');
    return;
  }
  await sqlChannels.initialize();

  try {
    const IDB_KEY = 'indexeddb-delete-needed';
    const item = await sql.getItemById(IDB_KEY);
    if (item && item.value) {
      await sql.removeIndexedDBFiles();
      await sql.removeItemById(IDB_KEY);
    }
  } catch (error) {
    console.log(
      '(ready event handler) error deleting IndexedDB:',
      error && error.stack ? error.stack : error
    );
  }

  async function cleanupOrphanedAttachments() {
    const allAttachments = await attachments.getAllAttachments(userDataPath);
    const orphanedAttachments = await sql.removeKnownAttachments(
      allAttachments
    );
    await attachments.deleteAll({
      userDataPath,
      attachments: orphanedAttachments,
    });

    const allStickers = await attachments.getAllStickers(userDataPath);
    const orphanedStickers = await sql.removeKnownStickers(allStickers);
    await attachments.deleteAllStickers({
      userDataPath,
      stickers: orphanedStickers,
    });

    const allDraftAttachments = await attachments.getAllDraftAttachments(
      userDataPath
    );
    const orphanedDraftAttachments = await sql.removeKnownDraftAttachments(
      allDraftAttachments
    );
    await attachments.deleteAllDraftAttachments({
      userDataPath,
      stickers: orphanedDraftAttachments,
    });
  }

  try {
    await attachments.clearTempPath(userDataPath);
  } catch (error) {
    logger.error(
      'main/ready: Error deleting temp dir:',
      error && error.stack ? error.stack : error
    );
  }
  await attachmentChannel.initialize({
    configDir: userDataPath,
    cleanupOrphanedAttachments,
  });

  ready = true;

  createWindow();

  if (usingTrayIcon) {
    tray = createTrayIcon(getMainWindow, locale.messages);
  }

  setupMenu();

  ensureFilePermissions(['config.json', 'sql/db.sqlite']);
});

function setupMenu(options) {
  const { platform } = process;
  const menuOptions = {
    ...options,
    development,
    showDebugLog: showDebugLogWindow,
    showKeyboardShortcuts,
    showWindow,
    showAbout,
    showSettings: showSettingsWindow,
    /*showStickerCreator,*/
    openReleaseNotes,
    openNewBugForm,
    openSupportPage,
    openForums,
    platform,
    setupAsNewDevice,
    setupAsStandalone,
  };
  const template = createTemplate(menuOptions, locale.messages);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function requestShutdown() {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  console.log('requestShutdown: Requesting close of mainWindow...');
  const request = new Promise((resolve, reject) => {
    ipc.once('now-ready-for-shutdown', (_event, error) => {
      console.log('requestShutdown: Response received');

      if (error) {
        return reject(error);
      }

      return resolve();
    });
    mainWindow.webContents.send('get-ready-for-shutdown');

    // We'll wait two minutes, then force the app to go down. This can happen if someone
    //   exits the app before we've set everything up in preload() (so the browser isn't
    //   yet listening for these events), or if there are a whole lot of stacked-up tasks.
    // Note: two minutes is also our timeout for SQL tasks in data.js in the browser.
    setTimeout(() => {
      console.log(
        'requestShutdown: Response never received; forcing shutdown.'
      );
      resolve();
    }, 2 * 60 * 1000);
  });

  try {
    await request;
  } catch (error) {
    console.log(
      'requestShutdown error:',
      error && error.stack ? error.stack : error
    );
  }
}

app.on('before-quit', () => {
  console.log('before-quit event', {
    readyForShutdown: mainWindow ? mainWindow.readyForShutdown : null,
    shouldQuit: windowState.shouldQuit(),
  });

  windowState.markShouldQuit();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (
    process.platform !== 'darwin' ||
    config.environment === 'test' ||
    config.environment === 'test-lib'
  ) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!ready) {
    return;
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

// Defense in depth. We never intend to open webviews or windows. Prevent it completely.
app.on('web-contents-created', (createEvent, contents) => {
  contents.on('will-attach-webview', attachEvent => {
    attachEvent.preventDefault();
  });
  contents.on('new-window', newEvent => {
    newEvent.preventDefault();
  });
});

app.setAsDefaultProtocolClient('sgnl');
app.on('will-finish-launching', () => {
  // open-url must be set from within will-finish-launching for macOS
  // https://stackoverflow.com/a/43949291
  app.on('open-url', (event, incomingUrl) => {
    event.preventDefault();
    handleSgnlLink(incomingUrl);
  });
});

ipc.on('set-badge-count', (event, count) => {
  app.setBadgeCount(count);
});

ipc.on('remove-setup-menu-items', () => {
  setupMenu();
});

ipc.on('add-setup-menu-items', () => {
  setupMenu({
    includeSetup: true,
  });
});

ipc.on('draw-attention', () => {
  if (!mainWindow) {
    return;
  }
  if (disableFlashFrame) {
    return;
  }

  if (process.platform === 'win32' || process.platform === 'linux') {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', () => {
  app.relaunch();
  app.quit();
});

ipc.on('set-auto-hide-menu-bar', (event, autoHide) => {
  if (mainWindow) {
    mainWindow.setAutoHideMenuBar(autoHide);
  }
});

ipc.on('set-menu-bar-visibility', (event, visibility) => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(visibility);
  }
});

ipc.on('close-about', () => {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

ipc.on('update-tray-icon', (event, unreadCount) => {
  if (tray) {
    tray.updateIcon(unreadCount);
  }
});

// Debug Log-related IPC calls

ipc.on('show-debug-log', showDebugLogWindow);
ipc.on('close-debug-log', () => {
  if (debugLogWindow) {
    debugLogWindow.close();
  }
});

// Permissions Popup-related IPC calls

ipc.on('show-permissions-popup', showPermissionsPopupWindow);
ipc.on('close-permissions-popup', () => {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.close();
  }
});

// Settings-related IPC calls

function addDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('add-dark-overlay');
  }
}
function removeDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('remove-dark-overlay');
  }
}

ipc.on('show-settings', showSettingsWindow);
ipc.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

installSettingsGetter('device-name');

installSettingsGetter('theme-setting');
installSettingsSetter('theme-setting');
installSettingsGetter('hide-menu-bar');
installSettingsSetter('hide-menu-bar');

installSettingsGetter('notification-setting');
installSettingsSetter('notification-setting');
installSettingsGetter('audio-notification');
installSettingsSetter('audio-notification');

installSettingsGetter('spell-check');
installSettingsSetter('spell-check');

// This one is different because its single source of truth is userConfig, not IndexedDB
ipc.on('get-media-permissions', event => {
  event.sender.send(
    'get-success-media-permissions',
    null,
    userConfig.get('mediaPermissions') || false
  );
});
ipc.on('set-media-permissions', (event, value) => {
  userConfig.set('mediaPermissions', value);

  // We reinstall permissions handler to ensure that a revoked permission takes effect
  installPermissionsHandler({ session, userConfig });

  event.sender.send('set-success-media-permissions', null);
});

installSettingsGetter('is-primary');
installSettingsGetter('sync-request');
installSettingsGetter('sync-time');
installSettingsSetter('sync-time');

ipc.on('delete-all-data', () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('delete-all-data');
  }
});

ipc.on('get-built-in-images', async () => {
  try {
    const images = await attachments.getBuiltInImages();
    mainWindow.webContents.send('get-success-built-in-images', null, images);
  } catch (error) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('get-success-built-in-images', error.message);
    } else {
      console.error('Error handling get-built-in-images:', error.stack);
    }
  }
});

function getDataFromMainWindow(name, callback) {
  ipc.once(`get-success-${name}`, (_event, error, value) =>
    callback(error, value)
  );
  mainWindow.webContents.send(`get-${name}`);
}

function installSettingsGetter(name) {
  ipc.on(`get-${name}`, event => {
    if (mainWindow && mainWindow.webContents) {
      getDataFromMainWindow(name, (error, value) => {
        const contents = event.sender;
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`get-success-${name}`, error, value);
      });
    }
  });
}

function installSettingsSetter(name) {
  ipc.on(`set-${name}`, (event, value) => {
    if (mainWindow && mainWindow.webContents) {
      ipc.once(`set-success-${name}`, (_event, error) => {
        const contents = event.sender;
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`set-success-${name}`, error);
      });
      mainWindow.webContents.send(`set-${name}`, value);
    }
  });
}

function getIncomingUrl(argv) {
  return argv.find(arg => arg.startsWith('sgnl://'));
}

function handleSgnlLink(incomingUrl) {
  const { host: command, query } = url.parse(incomingUrl);
  const args = qs.parse(query);
  if (command === 'addstickers' && mainWindow && mainWindow.webContents) {
    console.log('Opening sticker pack from sgnl protocol link');
    const { pack_id: packId, pack_key: packKeyHex } = args;
    const packKey = Buffer.from(packKeyHex, 'hex').toString('base64');
    mainWindow.webContents.send('show-sticker-pack', { packId, packKey });
  } else {
    console.error('Unhandled sgnl link');
  }
}

ipc.on('install-sticker-pack', (_event, packId, packKeyHex) => {
  const packKey = Buffer.from(packKeyHex, 'hex').toString('base64');
  mainWindow.webContents.send('install-sticker-pack', { packId, packKey });
});

ipc.on('ensure-file-permissions', async event => {
  await ensureFilePermissions();
  event.reply('ensure-file-permissions-done');
});

/**
 * Ensure files in the user's data directory have the proper permissions.
 * Optionally takes an array of file paths to exclusively affect.
 *
 * @param {string[]} [onlyFiles] - Only ensure permissions on these given files
 */
async function ensureFilePermissions(onlyFiles) {
  console.log('Begin ensuring permissions');

  const start = Date.now();
  const userDataPath = await getRealPath(app.getPath('userData'));
  // fast-glob uses `/` for all platforms
  const userDataGlob = normalizePath(path.join(userDataPath, '**', '*'));

  // Determine files to touch
  const files = onlyFiles
    ? onlyFiles.map(f => path.join(userDataPath, f))
    : await fg(userDataGlob, {
        markDirectories: true,
        onlyFiles: false,
        ignore: ['**/Singleton*'],
      });

  console.log(`Ensuring file permissions for ${files.length} files`);

  // Touch each file in a queue
  const q = new PQueue({ concurrency: 5 });
  q.addAll(
    files.map(f => async () => {
      const isDir = f.endsWith('/');
      try {
        await fs.chmod(path.normalize(f), isDir ? 0o700 : 0o600);
      } catch (error) {
        console.error('ensureFilePermissions: Error from chmod', error.message);
      }
    })
  );

  await q.onEmpty();

  console.log(`Finish ensuring permissions in ${Date.now() - start}ms`);
}
