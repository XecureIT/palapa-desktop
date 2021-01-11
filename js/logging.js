/* eslint-env node */

/* eslint strict: ['error', 'never'] */
/* eslint-disable no-console */

const electron = require('electron');
const _ = require('lodash');

const debuglogs = require('./modules/debuglogs');
const Privacy = require('./modules/privacy');
const { createBatcher } = require('../ts/util/batcher');

const ipc = electron.ipcRenderer;

// Default Bunyan levels: https://github.com/trentm/node-bunyan#levels
// To make it easier to visually scan logs, we make all levels the same length
const BLANK_LEVEL = '     ';
const LEVELS = {
  60: 'fatal',
  50: 'error',
  40: 'warn ',
  30: 'info ',
  20: 'debug',
  10: 'trace',
};

// Backwards-compatible logging, simple strings and no level (defaulted to INFO)
function now() {
  const date = new Date();
  return date.toJSON();
}

// To avoid [Object object] in our log since console.log handles non-strings smoothly
function cleanArgsForIPC(args) {
  const str = args.map(item => {
    if (typeof item !== 'string') {
      try {
        return JSON.stringify(item);
      } catch (error) {
        return item;
      }
    }

    return item;
  });

  return str.join(' ');
}

function log(...args) {
  logAtLevel('info', 'INFO ', ...args);
}

if (window.console) {
  console._log = console.log;
  console.log = log;
}

// The mechanics of preparing a log for publish

function getHeader() {
  let header = window.navigator.userAgent;

  header += ` node/${window.getNodeVersion()}`;
  header += ` env/${window.getEnvironment()}`;

  return header;
}

function getLevel(level) {
  const text = LEVELS[level];
  if (!text) {
    return BLANK_LEVEL;
  }

  return text.toUpperCase();
}

function formatLine(entry) {
  return `${getLevel(entry.level)} ${entry.time} ${entry.msg}`;
}

function format(entries) {
  return Privacy.redactAll(entries.map(formatLine).join('\n'));
}

function fetch() {
  return new Promise(resolve => {
    ipc.send('fetch-log');

    ipc.on('fetched-log', (event, text) => {
      const result = `${getHeader()}\n${format(text)}`;
      resolve(result);
    });
  });
}

const publish = debuglogs.upload;

// A modern logging interface for the browser

const env = window.getEnvironment();
const IS_PRODUCTION = env === 'production';

const ipcBatcher = createBatcher({
  wait: 500,
  size: 20,
  processBatch: items => {
    ipc.send('batch-log', items);
  },
});

// The Bunyan API: https://github.com/trentm/node-bunyan#log-method-api
function logAtLevel(level, prefix, ...args) {
  if (!IS_PRODUCTION) {
    console._log(prefix, now(), ...args);
  }

  const str = cleanArgsForIPC(args);
  const logText = Privacy.redactAll(str);

  ipcBatcher.add({
    timestamp: Date.now(),
    level,
    logText,
  });
}

window.log = {
  fatal: _.partial(logAtLevel, 'fatal', 'FATAL'),
  error: _.partial(logAtLevel, 'error', 'ERROR'),
  warn: _.partial(logAtLevel, 'warn', 'WARN '),
  info: _.partial(logAtLevel, 'info', 'INFO '),
  debug: _.partial(logAtLevel, 'debug', 'DEBUG'),
  trace: _.partial(logAtLevel, 'trace', 'TRACE'),
  fetch,
  publish,
};

window.onerror = (message, script, line, col, error) => {
  const errorInfo = error && error.stack ? error.stack : JSON.stringify(error);
  window.log.error(`Top-level unhandled error: ${errorInfo}`);
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  window.log.error(
    `Top-level unhandled promise rejection: ${rejectionEvent.reason}`
  );
});
