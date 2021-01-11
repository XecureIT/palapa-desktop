/* global Whisper, window */

/* eslint-disable global-require, no-inner-declarations */

try {
  const electron = require('electron');
  const semver = require('semver');
  const curve = require('curve25519-n');
  const { installGetter, installSetter } = require('./preload_utils');

  const { deferredToPromise } = require('./js/modules/deferred_to_promise');

  const { remote } = electron;
  const { app } = remote;
  const { systemPreferences } = remote.require('electron');

  window.PROTO_ROOT = 'protos';
  const config = require('url').parse(window.location.toString(), true).query;

  let title = config.name;
  if (config.environment !== 'production') {
    title += ` - ${config.environment}`;
  }
  if (config.appInstance) {
    title += ` - ${config.appInstance}`;
  }

  window.platform = process.platform;
  window.getTitle = () => title;
  window.getEnvironment = () => config.environment;
  window.getAppInstance = () => config.appInstance;
  window.getVersion = () => config.version;
  window.getExpiration = () => config.buildExpiration;
  window.getNodeVersion = () => config.node_version;
  window.getHostName = () => config.hostname;
  window.getServerTrustRoot = () => config.serverTrustRoot;
  window.isBehindProxy = () => Boolean(config.proxyUrl);

  function setSystemTheme() {
    window.systemTheme = systemPreferences.isDarkMode() ? 'dark' : 'light';
  }

  setSystemTheme();

  window.subscribeToSystemThemeChange = fn => {
    if (!systemPreferences.subscribeNotification) {
      return;
    }
    systemPreferences.subscribeNotification(
      'AppleInterfaceThemeChangedNotification',
      () => {
        setSystemTheme();
        fn();
      }
    );
  };

  window.isBeforeVersion = (toCheck, baseVersion) => {
    try {
      return semver.lt(toCheck, baseVersion);
    } catch (error) {
      window.log.error(
        `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
        error && error.stack ? error.stack : error
      );
      return true;
    }
  };

  window.wrapDeferred = deferredToPromise;

  const ipc = electron.ipcRenderer;
  const localeMessages = ipc.sendSync('locale-data');

  window.setBadgeCount = count => ipc.send('set-badge-count', count);

  // We never do these in our code, so we'll prevent it everywhere
  window.open = () => null;
  // eslint-disable-next-line no-eval, no-multi-assign
  window.eval = global.eval = () => null;

  window.drawAttention = () => {
    window.log.info('draw attention');
    ipc.send('draw-attention');
  };
  window.showWindow = () => {
    window.log.info('show window');
    ipc.send('show-window');
  };

  window.setAutoHideMenuBar = autoHide =>
    ipc.send('set-auto-hide-menu-bar', autoHide);

  window.setMenuBarVisibility = visibility =>
    ipc.send('set-menu-bar-visibility', visibility);

  window.restart = () => {
    window.log.info('restart');
    ipc.send('restart');
  };

  window.closeAbout = () => ipc.send('close-about');
  window.readyForUpdates = () => ipc.send('ready-for-updates');

  window.updateTrayIcon = unreadCount =>
    ipc.send('update-tray-icon', unreadCount);

  ipc.on('set-up-as-new-device', () => {
    Whisper.events.trigger('setupAsNewDevice');
  });

  ipc.on('set-up-as-standalone', () => {
    Whisper.events.trigger('setupAsStandalone');
  });

  // Settings-related events

  window.showSettings = () => ipc.send('show-settings');
  window.showPermissionsPopup = () => ipc.send('show-permissions-popup');

  ipc.on('show-keyboard-shortcuts', () => {
    window.Events.showKeyboardShortcuts();
  });
  ipc.on('add-dark-overlay', () => {
    window.Events.addDarkOverlay();
  });
  ipc.on('remove-dark-overlay', () => {
    window.Events.removeDarkOverlay();
  });

  installGetter('device-name', 'getDeviceName');

  installGetter('theme-setting', 'getThemeSetting');
  installSetter('theme-setting', 'setThemeSetting');
  installGetter('hide-menu-bar', 'getHideMenuBar');
  installSetter('hide-menu-bar', 'setHideMenuBar');

  installGetter('notification-setting', 'getNotificationSetting');
  installSetter('notification-setting', 'setNotificationSetting');
  installGetter('audio-notification', 'getAudioNotification');
  installSetter('audio-notification', 'setAudioNotification');

  installGetter('spell-check', 'getSpellCheck');
  installSetter('spell-check', 'setSpellCheck');

  window.getMediaPermissions = () =>
    new Promise((resolve, reject) => {
      ipc.once('get-success-media-permissions', (_event, error, value) => {
        if (error) {
          return reject(new Error(error));
        }

        return resolve(value);
      });
      ipc.send('get-media-permissions');
    });

  window.getBuiltInImages = () =>
    new Promise((resolve, reject) => {
      ipc.once('get-success-built-in-images', (_event, error, value) => {
        if (error) {
          return reject(new Error(error));
        }

        return resolve(value);
      });
      ipc.send('get-built-in-images');
    });

  installGetter('is-primary', 'isPrimary');
  installGetter('sync-request', 'getSyncRequest');
  installGetter('sync-time', 'getLastSyncTime');
  installSetter('sync-time', 'setLastSyncTime');

  ipc.on('delete-all-data', () => {
    const { deleteAllData } = window.Events;
    if (deleteAllData) {
      deleteAllData();
    }
  });

  ipc.on('show-sticker-pack', (_event, info) => {
    const { packId, packKey } = info;
    const { showStickerPack } = window.Events;
    if (showStickerPack) {
      showStickerPack(packId, packKey);
    }
  });

  ipc.on('install-sticker-pack', (_event, info) => {
    const { packId, packKey } = info;
    const { installStickerPack } = window.Events;
    if (installStickerPack) {
      installStickerPack(packId, packKey);
    }
  });

  ipc.on('get-ready-for-shutdown', async () => {
    const { shutdown } = window.Events || {};
    if (!shutdown) {
      window.log.error('preload shutdown handler: shutdown method not found');
      ipc.send('now-ready-for-shutdown');
      return;
    }

    try {
      await shutdown();
      ipc.send('now-ready-for-shutdown');
    } catch (error) {
      ipc.send(
        'now-ready-for-shutdown',
        error && error.stack ? error.stack : error
      );
    }
  });

  window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');
  window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');

  // We pull these dependencies in now, from here, because they have Node.js dependencies

  require('./js/logging');

  if (config.proxyUrl) {
    window.log.info('Using provided proxy url');
  }

  window.nodeSetImmediate = setImmediate;

  const { initialize: initializeWebAPI } = require('./js/modules/web_api');

  window.WebAPI = initializeWebAPI({
    url: config.serverUrl,
    cdnUrl: config.cdnUrl,
    certificateAuthority: config.certificateAuthority,
    contentProxyUrl: config.contentProxyUrl,
    proxyUrl: config.proxyUrl,
    version: config.version,
  });

  // Linux seems to periodically let the event loop stop, so this is a global workaround
  setInterval(() => {
    window.nodeSetImmediate(() => {});
  }, 1000);

  const { autoOrientImage } = require('./js/modules/auto_orient_image');

  window.autoOrientImage = autoOrientImage;
  window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
  window.emojiData = require('emoji-datasource');
  window.filesize = require('filesize');
  window.libphonenumber = require('google-libphonenumber').PhoneNumberUtil.getInstance();
  window.libphonenumber.PhoneNumberFormat = require('google-libphonenumber').PhoneNumberFormat;
  window.loadImage = require('blueimp-load-image');
  window.getGuid = require('uuid/v4');

  window.React = require('react');
  window.ReactDOM = require('react-dom');
  window.moment = require('moment');
  window.PQueue = require('p-queue').default;

  const Signal = require('./js/modules/signal');
  const i18n = require('./js/modules/i18n');
  const Attachments = require('./app/attachments');

  const { locale } = config;
  window.i18n = i18n.setup(locale, localeMessages);
  window.moment.updateLocale(locale, {
    relativeTime: {
      s: window.i18n('timestamp_s'),
      m: window.i18n('timestamp_m'),
      h: window.i18n('timestamp_h'),
    },
  });
  window.moment.locale(locale);

  const userDataPath = app.getPath('userData');
  window.baseAttachmentsPath = Attachments.getPath(userDataPath);
  window.baseStickersPath = Attachments.getStickersPath(userDataPath);
  window.baseTempPath = Attachments.getTempPath(userDataPath);
  window.baseDraftPath = Attachments.getDraftPath(userDataPath);
  window.Signal = Signal.setup({
    Attachments,
    userDataPath,
    getRegionCode: () => window.storage.get('regionCode'),
    logger: window.log,
  });

  function wrapWithPromise(fn) {
    return (...args) => Promise.resolve(fn(...args));
  }
  function typedArrayToArrayBuffer(typedArray) {
    const { buffer, byteOffset, byteLength } = typedArray;
    return buffer.slice(byteOffset, byteLength + byteOffset);
  }
  const externalCurve = {
    generateKeyPair: () => {
      const { privKey, pubKey } = curve.generateKeyPair();

      return {
        privKey: typedArrayToArrayBuffer(privKey),
        pubKey: typedArrayToArrayBuffer(pubKey),
      };
    },
    createKeyPair: incomingKey => {
      const incomingKeyBuffer = Buffer.from(incomingKey);
      const { privKey, pubKey } = curve.createKeyPair(incomingKeyBuffer);

      return {
        privKey: typedArrayToArrayBuffer(privKey),
        pubKey: typedArrayToArrayBuffer(pubKey),
      };
    },
    calculateAgreement: (pubKey, privKey) => {
      const pubKeyBuffer = Buffer.from(pubKey);
      const privKeyBuffer = Buffer.from(privKey);

      const buffer = curve.calculateAgreement(pubKeyBuffer, privKeyBuffer);

      return typedArrayToArrayBuffer(buffer);
    },
    verifySignature: (pubKey, message, signature) => {
      const pubKeyBuffer = Buffer.from(pubKey);
      const messageBuffer = Buffer.from(message);
      const signatureBuffer = Buffer.from(signature);

      const result = curve.verifySignature(
        pubKeyBuffer,
        messageBuffer,
        signatureBuffer
      );

      return result;
    },
    calculateSignature: (privKey, message) => {
      const privKeyBuffer = Buffer.from(privKey);
      const messageBuffer = Buffer.from(message);

      const buffer = curve.calculateSignature(privKeyBuffer, messageBuffer);

      return typedArrayToArrayBuffer(buffer);
    },
    validatePubKeyFormat: pubKey => {
      const pubKeyBuffer = Buffer.from(pubKey);

      return curve.validatePubKeyFormat(pubKeyBuffer);
    },
  };
  externalCurve.ECDHE = externalCurve.calculateAgreement;
  externalCurve.Ed25519Sign = externalCurve.calculateSignature;
  externalCurve.Ed25519Verify = externalCurve.verifySignature;
  const externalCurveAsync = {
    generateKeyPair: wrapWithPromise(externalCurve.generateKeyPair),
    createKeyPair: wrapWithPromise(externalCurve.createKeyPair),
    calculateAgreement: wrapWithPromise(externalCurve.calculateAgreement),
    verifySignature: async (...args) => {
      // The async verifySignature function has a different signature than the
      //   sync function
      const verifyFailed = externalCurve.verifySignature(...args);
      if (verifyFailed) {
        throw new Error('Invalid signature');
      }
    },
    calculateSignature: wrapWithPromise(externalCurve.calculateSignature),
    validatePubKeyFormat: wrapWithPromise(externalCurve.validatePubKeyFormat),
    ECDHE: wrapWithPromise(externalCurve.ECDHE),
    Ed25519Sign: wrapWithPromise(externalCurve.Ed25519Sign),
    Ed25519Verify: wrapWithPromise(externalCurve.Ed25519Verify),
  };
  window.libsignal = window.libsignal || {};
  window.libsignal.externalCurve = externalCurve;
  window.libsignal.externalCurveAsync = externalCurveAsync;

  // Pulling these in separately since they access filesystem, electron
  window.Signal.Backup = require('./js/modules/backup');
  window.Signal.Debug = require('./js/modules/debug');
  window.Signal.Logs = require('./js/modules/logs');

  // Add right-click listener for selected text and urls
  const contextMenu = require('electron-context-menu');

  contextMenu({
    showInspectElement: false,
    shouldShowMenu: (event, params) =>
      Boolean(
        !params.isEditable &&
          params.mediaType === 'none' &&
          (params.linkURL || params.selectionText)
      ),
  });

  // We pull this in last, because the native module involved appears to be sensitive to
  //   /tmp mounted as noexec on Linux.
  require('./js/spell_check');

  if (config.environment === 'test') {
    /* eslint-disable global-require, import/no-extraneous-dependencies */
    window.test = {
      fastGlob: require('fast-glob'),
      normalizePath: require('normalize-path'),
      fse: require('fs-extra'),
      tmp: require('tmp'),
      path: require('path'),
      basePath: __dirname,
      attachmentsPath: window.Signal.Migrations.attachmentsPath,
    };
    /* eslint-enable global-require, import/no-extraneous-dependencies */
  }
} catch (error) {
  /* eslint-disable no-console */
  if (console._log) {
    console._log('preload error!', error.stack);
  } else {
    console.log('preload error!', error.stack);
  }
  /* eslint-enable no-console */

  throw error;
}

window.log.info('preload complete');
