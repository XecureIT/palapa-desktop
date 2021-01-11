/* global _: false */
/* global Backbone: false */

/* global Whisper: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  const { getPlaceholderMigrations } = window.Signal.Migrations;

  window.Whisper = window.Whisper || {};
  window.Whisper.Database = window.Whisper.Database || {};
  window.Whisper.Database.id = window.Whisper.Database.id || 'signal';
  window.Whisper.Database.nolog = true;

  Whisper.Database.handleDOMException = (prefix, error, reject) => {
    window.log.error(
      `${prefix}:`,
      error && error.name,
      error && error.message,
      error && error.code
    );
    reject(error || new Error(prefix));
  };

  function clearStores(db, names) {
    return new Promise((resolve, reject) => {
      const storeNames = names || db.objectStoreNames;
      window.log.info('Clearing these indexeddb stores:', storeNames);
      const transaction = db.transaction(storeNames, 'readwrite');

      let finished = false;
      const finish = via => {
        window.log.info('clearing all stores done via', via);
        if (finished) {
          resolve();
        }
        finished = true;
      };

      transaction.oncomplete = finish.bind(null, 'transaction complete');
      transaction.onerror = () => {
        Whisper.Database.handleDOMException(
          'clearStores transaction error',
          transaction.error,
          reject
        );
      };

      let count = 0;

      // can't use built-in .forEach because db.objectStoreNames is not a plain array
      _.forEach(storeNames, storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          count += 1;
          window.log.info('Done clearing store', storeName);

          if (count >= storeNames.length) {
            window.log.info('Done clearing indexeddb stores');
            finish('clears complete');
          }
        };

        request.onerror = () => {
          Whisper.Database.handleDOMException(
            'clearStores request error',
            request.error,
            reject
          );
        };
      });
    });
  }

  Whisper.Database.open = () => {
    const { migrations } = Whisper.Database;
    const { version } = migrations[migrations.length - 1];
    const DBOpenRequest = window.indexedDB.open(Whisper.Database.id, version);

    return new Promise((resolve, reject) => {
      // these two event handlers act on the IDBDatabase object,
      // when the database is opened successfully, or not
      DBOpenRequest.onerror = reject;
      DBOpenRequest.onsuccess = () => resolve(DBOpenRequest.result);

      // This event handles the event whereby a new version of
      // the database needs to be created Either one has not
      // been created before, or a new version number has been
      // submitted via the window.indexedDB.open line above
      DBOpenRequest.onupgradeneeded = reject;
    });
  };

  Whisper.Database.clear = async () => {
    const db = await Whisper.Database.open();
    await clearStores(db);
    db.close();
  };

  Whisper.Database.clearStores = async storeNames => {
    const db = await Whisper.Database.open();
    await clearStores(db, storeNames);
    db.close();
  };

  Whisper.Database.close = () => window.wrapDeferred(Backbone.sync('closeall'));

  Whisper.Database.drop = () =>
    new Promise((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(Whisper.Database.id);

      request.onblocked = () => {
        reject(new Error('Error deleting database: Blocked.'));
      };
      request.onupgradeneeded = () => {
        reject(new Error('Error deleting database: Upgrade needed.'));
      };
      request.onerror = () => {
        reject(new Error('Error deleting database.'));
      };

      request.onsuccess = resolve;
    });

  Whisper.Database.migrations = getPlaceholderMigrations();
})();
