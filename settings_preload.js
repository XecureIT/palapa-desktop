/* global window */

const { ipcRenderer, remote } = require('electron');

const url = require('url');
const i18n = require('./js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

const { systemPreferences } = remote.require('electron');

window.platform = process.platform;
window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

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

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

// So far we're only using this for Signal.Types
const Signal = require('./js/modules/signal');

window.Signal = Signal.setup({
  Attachments: null,
  userDataPath: null,
  getRegionCode: () => null,
});

window.closeSettings = () => ipcRenderer.send('close-settings');

window.getDeviceName = makeGetter('device-name');

window.getThemeSetting = makeGetter('theme-setting');
window.setThemeSetting = makeSetter('theme-setting');
window.getHideMenuBar = makeGetter('hide-menu-bar');
window.setHideMenuBar = makeSetter('hide-menu-bar');

window.getSpellCheck = makeGetter('spell-check');
window.setSpellCheck = makeSetter('spell-check');

window.getNotificationSetting = makeGetter('notification-setting');
window.setNotificationSetting = makeSetter('notification-setting');
window.getAudioNotification = makeGetter('audio-notification');
window.setAudioNotification = makeSetter('audio-notification');

window.getMediaPermissions = makeGetter('media-permissions');
window.setMediaPermissions = makeSetter('media-permissions');

window.isPrimary = makeGetter('is-primary');
window.makeSyncRequest = makeGetter('sync-request');
window.getLastSyncTime = makeGetter('sync-time');
window.setLastSyncTime = makeSetter('sync-time');

window.deleteAllData = () => ipcRenderer.send('delete-all-data');

function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipcRenderer.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipcRenderer.send(`get-${name}`);
    });
}

function makeSetter(name) {
  return value =>
    new Promise((resolve, reject) => {
      ipcRenderer.once(`set-success-${name}`, (event, error) => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
      ipcRenderer.send(`set-${name}`, value);
    });
}

require('./js/logging');
