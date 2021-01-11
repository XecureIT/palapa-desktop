const { join } = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const sql = require('@journeyapps/sqlcipher');
const { app, dialog, clipboard } = require('electron');
const { redactAll } = require('../js/modules/privacy');
const { remove: removeUserConfig } = require('./user_config');
const { combineNames } = require('../ts/util/combineNames');

const pify = require('pify');
const uuidv4 = require('uuid/v4');
const {
  forEach,
  fromPairs,
  isNumber,
  isObject,
  isString,
  last,
  map,
  pick,
} = require('lodash');

module.exports = {
  initialize,
  close,
  removeDB,
  removeIndexedDBFiles,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,
  getAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  bulkAddPreKeys,
  removePreKeyById,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  getAllSignedPreKeys,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  bulkAddItems,
  removeItemById,
  removeAllItems,

  createOrUpdateSession,
  createOrUpdateSessions,
  getSessionById,
  getSessionsByNumber,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByNumber,
  removeAllSessions,
  getAllSessions,

  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  updateConversations,
  removeConversation,
  getAllConversations,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllGroupsInvolvingId,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  saveMessages,
  removeMessage,
  getUnreadByConversation,
  getMessageBySender,
  getMessageById,
  getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getNextTapToViewMessageToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getNewerMessagesByConversation,
  getMessageMetricsForConversation,

  getUnprocessedCount,
  getAllUnprocessed,
  saveUnprocessed,
  updateUnprocessedAttempts,
  updateUnprocessedWithData,
  updateUnprocessedsWithData,
  getUnprocessedById,
  saveUnprocesseds,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  setAttachmentDownloadJobPending,
  resetAttachmentDownloadPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  createOrUpdateStickerPack,
  updateStickerPackStatus,
  createOrUpdateSticker,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  deleteStickerPack,
  getAllStickerPacks,
  getAllStickers,
  getRecentStickers,

  updateEmojiUsage,
  getRecentEmojis,

  removeAll,
  removeAllConfiguration,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  removeKnownAttachments,
  removeKnownStickers,
  removeKnownDraftAttachments,
};

function generateUUID() {
  return uuidv4();
}

function objectToJSON(data) {
  return JSON.stringify(data);
}
function jsonToObject(json) {
  return JSON.parse(json);
}

async function openDatabase(filePath) {
  return new Promise((resolve, reject) => {
    const instance = new sql.Database(filePath, error => {
      if (error) {
        return reject(error);
      }

      return resolve(instance);
    });
  });
}

function promisify(rawInstance) {
  /* eslint-disable no-param-reassign */
  rawInstance.close = pify(rawInstance.close.bind(rawInstance));
  rawInstance.run = pify(rawInstance.run.bind(rawInstance));
  rawInstance.get = pify(rawInstance.get.bind(rawInstance));
  rawInstance.all = pify(rawInstance.all.bind(rawInstance));
  rawInstance.each = pify(rawInstance.each.bind(rawInstance));
  rawInstance.exec = pify(rawInstance.exec.bind(rawInstance));
  rawInstance.prepare = pify(rawInstance.prepare.bind(rawInstance));
  /* eslint-enable */

  return rawInstance;
}

async function getSQLiteVersion(instance) {
  const row = await instance.get('select sqlite_version() AS sqlite_version');
  return row.sqlite_version;
}

async function getSchemaVersion(instance) {
  const row = await instance.get('PRAGMA schema_version;');
  return row.schema_version;
}

async function setUserVersion(instance, version) {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }
  await instance.get(`PRAGMA user_version = ${version};`);
}
async function keyDatabase(instance, key) {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  await instance.run(`PRAGMA key = "x'${key}'";`);
}
async function getUserVersion(instance) {
  const row = await instance.get('PRAGMA user_version;');
  return row.user_version;
}

async function getSQLCipherVersion(instance) {
  const row = await instance.get('PRAGMA cipher_version;');
  try {
    return row.cipher_version;
  } catch (e) {
    return null;
  }
}

async function getSQLCipherIntegrityCheck(instance) {
  const row = await instance.get('PRAGMA cipher_integrity_check;');
  if (row) {
    return row.cipher_integrity_check;
  }

  return null;
}

async function getSQLIntegrityCheck(instance) {
  const row = await instance.get('PRAGMA integrity_check;');
  if (row && row.integrity_check !== 'ok') {
    return row.integrity_check;
  }

  return null;
}

async function migrateSchemaVersion(instance) {
  const userVersion = await getUserVersion(instance);
  if (userVersion > 0) {
    return;
  }

  const schemaVersion = await getSchemaVersion(instance);
  const newUserVersion = schemaVersion > 18 ? 16 : schemaVersion;
  console.log(
    `migrateSchemaVersion: Migrating from schema_version ${schemaVersion} to user_version ${newUserVersion}`
  );

  await setUserVersion(instance, newUserVersion);
}

async function openAndMigrateDatabase(filePath, key) {
  let promisified;

  // First, we try to open the database without any cipher changes
  try {
    const instance = await openDatabase(filePath);
    promisified = promisify(instance);
    keyDatabase(promisified, key);

    await migrateSchemaVersion(promisified);

    return promisified;
  } catch (error) {
    if (promisified) {
      await promisified.close();
    }
    console.log('migrateDatabase: Migration without cipher change failed');
  }

  // If that fails, we try to open the database with 3.x compatibility to extract the
  //   user_version (previously stored in schema_version, blown away by cipher_migrate).
  const instance = await openDatabase(filePath);
  promisified = promisify(instance);
  keyDatabase(promisified, key);

  // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
  await promisified.run('PRAGMA cipher_compatibility = 3;');
  await migrateSchemaVersion(promisified);
  await promisified.close();

  // After migrating user_version -> schema_version, we reopen database, because we can't
  //   migrate to the latest ciphers after we've modified the defaults.
  const instance2 = await openDatabase(filePath);
  promisified = promisify(instance2);
  keyDatabase(promisified, key);

  await promisified.run('PRAGMA cipher_migrate;');
  return promisified;
}

const INVALID_KEY = /[^0-9A-Fa-f]/;
async function openAndSetUpSQLCipher(filePath, { key }) {
  const match = INVALID_KEY.exec(key);
  if (match) {
    throw new Error(`setupSQLCipher: key '${key}' is not valid`);
  }

  const instance = await openAndMigrateDatabase(filePath, key);

  // Because foreign key support is not enabled by default!
  await instance.run('PRAGMA foreign_keys = ON;');

  return instance;
}

async function updateToSchemaVersion1(currentVersion, instance) {
  if (currentVersion >= 1) {
    return;
  }

  console.log('updateToSchemaVersion1: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `CREATE TABLE messages(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      unread INTEGER,
      expires_at INTEGER,
      sent_at INTEGER,
      schemaVersion INTEGER,
      conversationId STRING,
      received_at INTEGER,
      source STRING,
      sourceDevice STRING,
      hasAttachments INTEGER,
      hasFileAttachments INTEGER,
      hasVisualMediaAttachments INTEGER
    );`
    );

    await instance.run(`CREATE INDEX messages_unread ON messages (
      unread
    );`);
    await instance.run(`CREATE INDEX messages_expires_at ON messages (
      expires_at
    );`);
    await instance.run(`CREATE INDEX messages_receipt ON messages (
      sent_at
    );`);
    await instance.run(`CREATE INDEX messages_schemaVersion ON messages (
      schemaVersion
    );`);

    await instance.run(`CREATE INDEX messages_conversation ON messages (
      conversationId,
      received_at
    );`);

    await instance.run(`CREATE INDEX messages_duplicate_check ON messages (
      source,
      sourceDevice,
      sent_at
    );`);
    await instance.run(`CREATE INDEX messages_hasAttachments ON messages (
      conversationId,
      hasAttachments,
      received_at
    );`);
    await instance.run(`CREATE INDEX messages_hasFileAttachments ON messages (
      conversationId,
      hasFileAttachments,
      received_at
    );`);
    await instance.run(`CREATE INDEX messages_hasVisualMediaAttachments ON messages (
      conversationId,
      hasVisualMediaAttachments,
      received_at
    );`);

    await instance.run(`CREATE TABLE unprocessed(
    id STRING,
    timestamp INTEGER,
    json TEXT
  );`);
    await instance.run(`CREATE INDEX unprocessed_id ON unprocessed (
    id
  );`);
    await instance.run(`CREATE INDEX unprocessed_timestamp ON unprocessed (
    timestamp
  );`);

    await instance.run('PRAGMA user_version = 1;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion1: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion2(currentVersion, instance) {
  if (currentVersion >= 2) {
    return;
  }

  console.log('updateToSchemaVersion2: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN expireTimer INTEGER;`
    );

    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN expirationStartTimestamp INTEGER;`
    );

    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN type STRING;`
    );

    await instance.run(`CREATE INDEX messages_expiring ON messages (
      expireTimer,
      expirationStartTimestamp,
      expires_at
    );`);

    await instance.run(
      `UPDATE messages SET
      expirationStartTimestamp = json_extract(json, '$.expirationStartTimestamp'),
      expireTimer = json_extract(json, '$.expireTimer'),
      type = json_extract(json, '$.type');`
    );

    await instance.run('PRAGMA user_version = 2;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion2: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion3(currentVersion, instance) {
  if (currentVersion >= 3) {
    return;
  }

  console.log('updateToSchemaVersion3: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run('DROP INDEX messages_expiring;');
    await instance.run('DROP INDEX messages_unread;');

    await instance.run(`CREATE INDEX messages_without_timer ON messages (
      expireTimer,
      expires_at,
      type
    ) WHERE expires_at IS NULL AND expireTimer IS NOT NULL;`);

    await instance.run(`CREATE INDEX messages_unread ON messages (
      conversationId,
      unread
    ) WHERE unread IS NOT NULL;`);

    await instance.run('ANALYZE;');
    await instance.run('PRAGMA user_version = 3;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion3: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion4(currentVersion, instance) {
  if (currentVersion >= 4) {
    return;
  }

  console.log('updateToSchemaVersion4: starting...');

  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `CREATE TABLE conversations(
      id STRING PRIMARY KEY ASC,
      json TEXT,

      active_at INTEGER,
      type STRING,
      members TEXT,
      name TEXT,
      profileName TEXT
    );`
    );

    await instance.run(`CREATE INDEX conversations_active ON conversations (
      active_at
    ) WHERE active_at IS NOT NULL;`);

    await instance.run(`CREATE INDEX conversations_type ON conversations (
      type
    ) WHERE type IS NOT NULL;`);

    await instance.run('PRAGMA user_version = 4;');
    await instance.run('COMMIT TRANSACTION;');

    console.log('updateToSchemaVersion4: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion6(currentVersion, instance) {
  if (currentVersion >= 6) {
    return;
  }
  console.log('updateToSchemaVersion6: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // key-value, ids are strings, one extra column
    await instance.run(
      `CREATE TABLE sessions(
      id STRING PRIMARY KEY ASC,
      number STRING,
      json TEXT
    );`
    );

    await instance.run(`CREATE INDEX sessions_number ON sessions (
    number
  ) WHERE number IS NOT NULL;`);

    // key-value, ids are strings
    await instance.run(
      `CREATE TABLE groups(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
    );
    await instance.run(
      `CREATE TABLE identityKeys(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
    );
    await instance.run(
      `CREATE TABLE items(
      id STRING PRIMARY KEY ASC,
      json TEXT
    );`
    );

    // key-value, ids are integers
    await instance.run(
      `CREATE TABLE preKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );`
    );
    await instance.run(
      `CREATE TABLE signedPreKeys(
      id INTEGER PRIMARY KEY ASC,
      json TEXT
    );`
    );

    await instance.run('PRAGMA user_version = 6;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion6: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion7(currentVersion, instance) {
  if (currentVersion >= 7) {
    return;
  }
  console.log('updateToSchemaVersion7: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // SQLite has been coercing our STRINGs into numbers, so we force it with TEXT
    // We create a new table then copy the data into it, since we can't modify columns

    await instance.run('DROP INDEX sessions_number;');
    await instance.run('ALTER TABLE sessions RENAME TO sessions_old;');

    await instance.run(
      `CREATE TABLE sessions(
      id TEXT PRIMARY KEY,
      number TEXT,
      json TEXT
    );`
    );

    await instance.run(`CREATE INDEX sessions_number ON sessions (
    number
  ) WHERE number IS NOT NULL;`);

    await instance.run(`INSERT INTO sessions(id, number, json)
    SELECT "+" || id, number, json FROM sessions_old;
  `);

    await instance.run('DROP TABLE sessions_old;');

    await instance.run('PRAGMA user_version = 7;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion7: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion8(currentVersion, instance) {
  if (currentVersion >= 8) {
    return;
  }
  console.log('updateToSchemaVersion8: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // First, we pull a new body field out of the message table's json blob
    await instance.run(
      `ALTER TABLE messages
     ADD COLUMN body TEXT;`
    );
    await instance.run(
      "UPDATE messages SET body = json_extract(json, '$.body')"
    );

    // Then we create our full-text search table and populate it
    await instance.run(`
    CREATE VIRTUAL TABLE messages_fts
    USING fts5(id UNINDEXED, body);
  `);
    await instance.run(`
    INSERT INTO messages_fts(id, body)
    SELECT id, body FROM messages;
  `);

    // Then we set up triggers to keep the full-text search table up to date
    await instance.run(`
    CREATE TRIGGER messages_on_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts (
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);
    await instance.run(`
    CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;
  `);
    await instance.run(`
    CREATE TRIGGER messages_on_update AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(
        id,
        body
      ) VALUES (
        new.id,
        new.body
      );
    END;
  `);

    // For formatting search results:
    //   https://sqlite.org/fts5.html#the_highlight_function
    //   https://sqlite.org/fts5.html#the_snippet_function

    await instance.run('PRAGMA user_version = 8;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion8: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion9(currentVersion, instance) {
  if (currentVersion >= 9) {
    return;
  }
  console.log('updateToSchemaVersion9: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`CREATE TABLE attachment_downloads(
    id STRING primary key,
    timestamp INTEGER,
    pending INTEGER,
    json TEXT
  );`);

    await instance.run(`CREATE INDEX attachment_downloads_timestamp
    ON attachment_downloads (
      timestamp
  ) WHERE pending = 0;`);
    await instance.run(`CREATE INDEX attachment_downloads_pending
    ON attachment_downloads (
      pending
  ) WHERE pending != 0;`);

    await instance.run('PRAGMA user_version = 9;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion9: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion10(currentVersion, instance) {
  if (currentVersion >= 10) {
    return;
  }
  console.log('updateToSchemaVersion10: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run('DROP INDEX unprocessed_id;');
    await instance.run('DROP INDEX unprocessed_timestamp;');
    await instance.run('ALTER TABLE unprocessed RENAME TO unprocessed_old;');

    await instance.run(`CREATE TABLE unprocessed(
    id STRING,
    timestamp INTEGER,
    version INTEGER,
    attempts INTEGER,
    envelope TEXT,
    decrypted TEXT,
    source TEXT,
    sourceDevice TEXT,
    serverTimestamp INTEGER
  );`);

    await instance.run(`CREATE INDEX unprocessed_id ON unprocessed (
    id
  );`);
    await instance.run(`CREATE INDEX unprocessed_timestamp ON unprocessed (
    timestamp
  );`);

    await instance.run(`INSERT INTO unprocessed (
    id,
    timestamp,
    version,
    attempts,
    envelope,
    decrypted,
    source,
    sourceDevice,
    serverTimestamp
  ) SELECT
    id,
    timestamp,
    json_extract(json, '$.version'),
    json_extract(json, '$.attempts'),
    json_extract(json, '$.envelope'),
    json_extract(json, '$.decrypted'),
    json_extract(json, '$.source'),
    json_extract(json, '$.sourceDevice'),
    json_extract(json, '$.serverTimestamp')
  FROM unprocessed_old;
  `);

    await instance.run('DROP TABLE unprocessed_old;');

    await instance.run('PRAGMA user_version = 10;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion10: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion11(currentVersion, instance) {
  if (currentVersion >= 11) {
    return;
  }
  console.log('updateToSchemaVersion11: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run('DROP TABLE groups;');

    await instance.run('PRAGMA user_version = 11;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion11: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion12(currentVersion, instance) {
  if (currentVersion >= 12) {
    return;
  }

  console.log('updateToSchemaVersion12: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`CREATE TABLE sticker_packs(
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,

    author STRING,
    coverStickerId INTEGER,
    createdAt INTEGER,
    downloadAttempts INTEGER,
    installedAt INTEGER,
    lastUsed INTEGER,
    status STRING,
    stickerCount INTEGER,
    title STRING
  );`);

    await instance.run(`CREATE TABLE stickers(
    id INTEGER NOT NULL,
    packId TEXT NOT NULL,

    emoji STRING,
    height INTEGER,
    isCoverOnly INTEGER,
    lastUsed INTEGER,
    path STRING,
    width INTEGER,

    PRIMARY KEY (id, packId),
    CONSTRAINT stickers_fk
      FOREIGN KEY (packId)
      REFERENCES sticker_packs(id)
      ON DELETE CASCADE
  );`);

    await instance.run(`CREATE INDEX stickers_recents
    ON stickers (
      lastUsed
  ) WHERE lastUsed IS NOT NULL;`);

    await instance.run(`CREATE TABLE sticker_references(
    messageId STRING,
    packId TEXT,
    CONSTRAINT sticker_references_fk
      FOREIGN KEY(packId)
      REFERENCES sticker_packs(id)
      ON DELETE CASCADE
  );`);

    await instance.run('PRAGMA user_version = 12;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion12: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion13(currentVersion, instance) {
  if (currentVersion >= 13) {
    return;
  }

  console.log('updateToSchemaVersion13: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      'ALTER TABLE sticker_packs ADD COLUMN attemptedStatus STRING;'
    );

    await instance.run('PRAGMA user_version = 13;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion13: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion14(currentVersion, instance) {
  if (currentVersion >= 14) {
    return;
  }

  console.log('updateToSchemaVersion14: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(`CREATE TABLE emojis(
    shortName STRING PRIMARY KEY,
    lastUsage INTEGER
  );`);

    await instance.run(`CREATE INDEX emojis_lastUsage
    ON emojis (
      lastUsage
  );`);

    await instance.run('PRAGMA user_version = 14;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion14: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion15(currentVersion, instance) {
  if (currentVersion >= 15) {
    return;
  }

  console.log('updateToSchemaVersion15: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // SQLite has again coerced our STRINGs into numbers, so we force it with TEXT
    // We create a new table then copy the data into it, since we can't modify columns

    await instance.run('DROP INDEX emojis_lastUsage;');
    await instance.run('ALTER TABLE emojis RENAME TO emojis_old;');

    await instance.run(`CREATE TABLE emojis(
      shortName TEXT PRIMARY KEY,
      lastUsage INTEGER
    );`);
    await instance.run(`CREATE INDEX emojis_lastUsage
      ON emojis (
        lastUsage
    );`);

    await instance.run('DELETE FROM emojis WHERE shortName = 1');
    await instance.run(`INSERT INTO emojis(shortName, lastUsage)
      SELECT shortName, lastUsage FROM emojis_old;
    `);

    await instance.run('DROP TABLE emojis_old;');

    await instance.run('PRAGMA user_version = 15;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion15: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion16(currentVersion, instance) {
  if (currentVersion >= 16) {
    return;
  }

  console.log('updateToSchemaVersion16: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN messageTimer INTEGER;`
    );
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN messageTimerStart INTEGER;`
    );
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN messageTimerExpiresAt INTEGER;`
    );
    await instance.run(
      `ALTER TABLE messages
      ADD COLUMN isErased INTEGER;`
    );

    await instance.run(`CREATE INDEX messages_message_timer ON messages (
      messageTimer,
      messageTimerStart,
      messageTimerExpiresAt,
      isErased
    ) WHERE messageTimer IS NOT NULL;`);

    // Updating full-text triggers to avoid anything with a messageTimer set

    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_delete;');
    await instance.run('DROP TRIGGER messages_on_update;');

    await instance.run(`
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
      WHEN new.messageTimer IS NULL
      BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);
    await instance.run(`
      CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;
    `);
    await instance.run(`
      CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
      WHEN new.messageTimer IS NULL
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
        INSERT INTO messages_fts(
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);

    await instance.run('PRAGMA user_version = 16;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion16: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion17(currentVersion, instance) {
  if (currentVersion >= 17) {
    return;
  }

  console.log('updateToSchemaVersion17: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    try {
      await instance.run(
        `ALTER TABLE messages
        ADD COLUMN isViewOnce INTEGER;`
      );

      await instance.run('DROP INDEX messages_message_timer;');
    } catch (error) {
      console.log(
        'updateToSchemaVersion17: Message table already had isViewOnce column'
      );
    }

    try {
      await instance.run('DROP INDEX messages_view_once;');
    } catch (error) {
      console.log(
        'updateToSchemaVersion17: Index messages_view_once did not already exist'
      );
    }
    await instance.run(`CREATE INDEX messages_view_once ON messages (
      isErased
    ) WHERE isViewOnce = 1;`);

    // Updating full-text triggers to avoid anything with isViewOnce = 1

    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_update;');

    await instance.run(`
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
      WHEN new.isViewOnce != 1
      BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);
    await instance.run(`
      CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
      WHEN new.isViewOnce != 1
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
        INSERT INTO messages_fts(
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);

    await instance.run('PRAGMA user_version = 17;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion17: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}

async function updateToSchemaVersion18(currentVersion, instance) {
  if (currentVersion >= 18) {
    return;
  }

  console.log('updateToSchemaVersion18: starting...');
  await instance.run('BEGIN TRANSACTION;');

  try {
    // Delete and rebuild full-text search index to capture everything

    await instance.run('DELETE FROM messages_fts;');
    await instance.run(
      "INSERT INTO messages_fts(messages_fts) VALUES('rebuild');"
    );

    await instance.run(`
      INSERT INTO messages_fts(id, body)
      SELECT id, body FROM messages WHERE isViewOnce IS NULL OR isViewOnce != 1;
    `);

    // Fixing full-text triggers

    await instance.run('DROP TRIGGER messages_on_insert;');
    await instance.run('DROP TRIGGER messages_on_update;');

    await instance.run(`
      CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
      WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
      BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);
    await instance.run(`
      CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
      WHEN new.isViewOnce IS NULL OR new.isViewOnce != 1
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
        INSERT INTO messages_fts(
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
    `);

    await instance.run('PRAGMA user_version = 18;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion18: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}
async function updateToSchemaVersion19(currentVersion, instance) {
  if (currentVersion >= 19) {
    return;
  }

  console.log('updateToSchemaVersion19: starting...');
  await instance.run('BEGIN TRANSACTION;');

  await instance.run(
    `ALTER TABLE conversations
     ADD COLUMN profileFamilyName TEXT;`
  );
  await instance.run(
    `ALTER TABLE conversations
     ADD COLUMN profileFullName TEXT;`
  );

  // Preload new field with the profileName we already have
  await instance.run('UPDATE conversations SET profileFullName = profileName');

  try {
    await instance.run('PRAGMA user_version = 19;');
    await instance.run('COMMIT TRANSACTION;');
    console.log('updateToSchemaVersion19: success!');
  } catch (error) {
    await instance.run('ROLLBACK;');
    throw error;
  }
}
const SCHEMA_VERSIONS = [
  updateToSchemaVersion1,
  updateToSchemaVersion2,
  updateToSchemaVersion3,
  updateToSchemaVersion4,
  () => null, // version 5 was dropped
  updateToSchemaVersion6,
  updateToSchemaVersion7,
  updateToSchemaVersion8,
  updateToSchemaVersion9,
  updateToSchemaVersion10,
  updateToSchemaVersion11,
  updateToSchemaVersion12,
  updateToSchemaVersion13,
  updateToSchemaVersion14,
  updateToSchemaVersion15,
  updateToSchemaVersion16,
  updateToSchemaVersion17,
  updateToSchemaVersion18,
  updateToSchemaVersion19,
];

async function updateSchema(instance) {
  const sqliteVersion = await getSQLiteVersion(instance);
  const sqlcipherVersion = await getSQLCipherVersion(instance);
  const userVersion = await getUserVersion(instance);
  const schemaVersion = await getSchemaVersion(instance);

  console.log(
    'updateSchema:\n',
    ` Current user_version: ${userVersion};\n`,
    ` Most recent db schema: ${SCHEMA_VERSIONS.length};\n`,
    ` SQLite version: ${sqliteVersion};\n`,
    ` SQLCipher version: ${sqlcipherVersion};\n`,
    ` (deprecated) schema_version: ${schemaVersion};\n`
  );

  for (let index = 0, max = SCHEMA_VERSIONS.length; index < max; index += 1) {
    const runSchemaUpdate = SCHEMA_VERSIONS[index];

    // Yes, we really want to do this asynchronously, in order
    // eslint-disable-next-line no-await-in-loop
    await runSchemaUpdate(userVersion, instance);
  }
}

let db;
let filePath;
let indexedDBPath;

async function initialize({ configDir, key, messages }) {
  if (db) {
    throw new Error('Cannot initialize more than once!');
  }

  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }
  if (!isObject(messages)) {
    throw new Error('initialize: message is required!');
  }

  indexedDBPath = join(configDir, 'IndexedDB');

  const dbDir = join(configDir, 'sql');
  mkdirp.sync(dbDir);

  filePath = join(dbDir, 'db.sqlite');

  let promisified;

  try {
    promisified = await openAndSetUpSQLCipher(filePath, { key });

    // promisified.on('trace', async statement => {
    //   if (
    //     !db ||
    //     statement.startsWith('--') ||
    //     statement.includes('COMMIT') ||
    //     statement.includes('BEGIN') ||
    //     statement.includes('ROLLBACK')
    //   ) {
    //     return;
    //   }

    //   // Note that this causes problems when attempting to commit transactions - this
    //   //   statement is running, and we get at SQLITE_BUSY error. So we delay.
    //   await new Promise(resolve => setTimeout(resolve, 1000));

    //   const data = await db.get(`EXPLAIN QUERY PLAN ${statement}`);
    //   console._log(`EXPLAIN QUERY PLAN ${statement}\n`, data && data.detail);
    // });

    await updateSchema(promisified);

    // test database

    const cipherIntegrityResult = await getSQLCipherIntegrityCheck(promisified);
    if (cipherIntegrityResult) {
      console.log(
        'Database cipher integrity check failed:',
        cipherIntegrityResult
      );
      throw new Error(
        `Cipher integrity check failed: ${cipherIntegrityResult}`
      );
    }
    const integrityResult = await getSQLIntegrityCheck(promisified);
    if (integrityResult) {
      console.log('Database integrity check failed:', integrityResult);
      throw new Error(`Integrity check failed: ${integrityResult}`);
    }

    // At this point we can allow general access to the database
    db = promisified;

    // test database
    await getMessageCount();
  } catch (error) {
    console.log('Database startup error:', error.stack);
    const buttonIndex = dialog.showMessageBoxSync({
      buttons: [
        messages.copyErrorAndQuit.message,
        messages.deleteAndRestart.message,
      ],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: messages.databaseError.message,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 0) {
      clipboard.writeText(
        `Database startup error:\n\n${redactAll(error.stack)}`
      );
    } else {
      if (promisified) {
        await promisified.close();
      }
      await removeDB();
      removeUserConfig();
      app.relaunch();
    }

    app.exit(1);
    return false;
  }

  return true;
}

async function close() {
  if (!db) {
    return;
  }

  const dbRef = db;
  db = null;
  await dbRef.close();
}

async function removeDB() {
  if (db) {
    throw new Error('removeDB: Cannot erase database when it is open!');
  }

  rimraf.sync(filePath);
}

async function removeIndexedDBFiles() {
  if (!indexedDBPath) {
    throw new Error(
      'removeIndexedDBFiles: Need to initialize and set indexedDBPath first!'
    );
  }

  const pattern = join(indexedDBPath, '*.leveldb');
  rimraf.sync(pattern);
  indexedDBPath = null;
}

const IDENTITY_KEYS_TABLE = 'identityKeys';
async function createOrUpdateIdentityKey(data) {
  return createOrUpdate(IDENTITY_KEYS_TABLE, data);
}
async function getIdentityKeyById(id) {
  return getById(IDENTITY_KEYS_TABLE, id);
}
async function bulkAddIdentityKeys(array) {
  return bulkAdd(IDENTITY_KEYS_TABLE, array);
}
async function removeIdentityKeyById(id) {
  return removeById(IDENTITY_KEYS_TABLE, id);
}
async function removeAllIdentityKeys() {
  return removeAllFromTable(IDENTITY_KEYS_TABLE);
}
async function getAllIdentityKeys() {
  return getAllFromTable(IDENTITY_KEYS_TABLE);
}

const PRE_KEYS_TABLE = 'preKeys';
async function createOrUpdatePreKey(data) {
  return createOrUpdate(PRE_KEYS_TABLE, data);
}
async function getPreKeyById(id) {
  return getById(PRE_KEYS_TABLE, id);
}
async function bulkAddPreKeys(array) {
  return bulkAdd(PRE_KEYS_TABLE, array);
}
async function removePreKeyById(id) {
  return removeById(PRE_KEYS_TABLE, id);
}
async function removeAllPreKeys() {
  return removeAllFromTable(PRE_KEYS_TABLE);
}
async function getAllPreKeys() {
  return getAllFromTable(PRE_KEYS_TABLE);
}

const SIGNED_PRE_KEYS_TABLE = 'signedPreKeys';
async function createOrUpdateSignedPreKey(data) {
  return createOrUpdate(SIGNED_PRE_KEYS_TABLE, data);
}
async function getSignedPreKeyById(id) {
  return getById(SIGNED_PRE_KEYS_TABLE, id);
}
async function getAllSignedPreKeys() {
  const rows = await db.all('SELECT json FROM signedPreKeys ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddSignedPreKeys(array) {
  return bulkAdd(SIGNED_PRE_KEYS_TABLE, array);
}
async function removeSignedPreKeyById(id) {
  return removeById(SIGNED_PRE_KEYS_TABLE, id);
}
async function removeAllSignedPreKeys() {
  return removeAllFromTable(SIGNED_PRE_KEYS_TABLE);
}

const ITEMS_TABLE = 'items';
async function createOrUpdateItem(data) {
  return createOrUpdate(ITEMS_TABLE, data);
}
async function getItemById(id) {
  return getById(ITEMS_TABLE, id);
}
async function getAllItems() {
  const rows = await db.all('SELECT json FROM items ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddItems(array) {
  return bulkAdd(ITEMS_TABLE, array);
}
async function removeItemById(id) {
  return removeById(ITEMS_TABLE, id);
}
async function removeAllItems() {
  return removeAllFromTable(ITEMS_TABLE);
}

const SESSIONS_TABLE = 'sessions';
async function createOrUpdateSession(data) {
  const { id, number } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateSession: Provided data did not have a truthy id'
    );
  }
  if (!number) {
    throw new Error(
      'createOrUpdateSession: Provided data did not have a truthy number'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO sessions (
      id,
      number,
      json
    ) values (
      $id,
      $number,
      $json
    )`,
    {
      $id: id,
      $number: number,
      $json: objectToJSON(data),
    }
  );
}
async function createOrUpdateSessions(array) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([...map(array, item => createOrUpdateSession(item))]);
    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
createOrUpdateSessions.needsSerial = true;

async function getSessionById(id) {
  return getById(SESSIONS_TABLE, id);
}
async function getSessionsByNumber(number) {
  const rows = await db.all('SELECT * FROM sessions WHERE number = $number;', {
    $number: number,
  });
  return map(rows, row => jsonToObject(row.json));
}
async function bulkAddSessions(array) {
  return bulkAdd(SESSIONS_TABLE, array);
}
async function removeSessionById(id) {
  return removeById(SESSIONS_TABLE, id);
}
async function removeSessionsByNumber(number) {
  await db.run('DELETE FROM sessions WHERE number = $number;', {
    $number: number,
  });
}
async function removeAllSessions() {
  return removeAllFromTable(SESSIONS_TABLE);
}
async function getAllSessions() {
  return getAllFromTable(SESSIONS_TABLE);
}

async function createOrUpdate(table, data) {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  await db.run(
    `INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )`,
    {
      $id: id,
      $json: objectToJSON(data),
    }
  );
}

async function bulkAdd(table, array) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([...map(array, data => createOrUpdate(table, data))]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}

async function getById(table, id) {
  const row = await db.get(`SELECT * FROM ${table} WHERE id = $id;`, {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function removeById(table, id) {
  if (!Array.isArray(id)) {
    await db.run(`DELETE FROM ${table} WHERE id = $id;`, { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM ${table} WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function removeAllFromTable(table) {
  await db.run(`DELETE FROM ${table};`);
}

async function getAllFromTable(table) {
  const rows = await db.all(`SELECT json FROM ${table};`);
  return rows.map(row => jsonToObject(row.json));
}

// Conversations

async function getConversationCount() {
  const row = await db.get('SELECT count(*) from conversations;');

  if (!row) {
    throw new Error(
      'getConversationCount: Unable to get count of conversations'
    );
  }

  return row['count(*)'];
}

async function saveConversation(data) {
  const {
    id,
    // eslint-disable-next-line camelcase
    active_at,
    type,
    members,
    name,
    profileName,
    profileFamilyName,
  } = data;

  await db.run(
    `INSERT INTO conversations (
    id,
    json,

    active_at,
    type,
    members,
    name,
    profileName,
    profileFamilyName,
    profileFullName
  ) values (
    $id,
    $json,

    $active_at,
    $type,
    $members,
    $name,
    $profileName,
    $profileFamilyName,
    $profileFullName
  );`,
    {
      $id: id,
      $json: objectToJSON(data),

      $active_at: active_at,
      $type: type,
      $members: members ? members.join(' ') : null,
      $name: name,
      $profileName: profileName,
      $profileFamilyName: profileFamilyName,
      $profileFullName: combineNames(profileName, profileFamilyName),
    }
  );
}

async function saveConversations(arrayOfConversations) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfConversations, conversation =>
        saveConversation(conversation)
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
saveConversations.needsSerial = true;

async function updateConversation(data) {
  const {
    id,
    // eslint-disable-next-line camelcase
    active_at,
    type,
    members,
    name,
    profileName,
    profileFamilyName,
  } = data;

  await db.run(
    `UPDATE conversations SET
      json = $json,

      active_at = $active_at,
      type = $type,
      members = $members,
      name = $name,
      profileName = $profileName,
      profileFamilyName = $profileFamilyName,
      profileFullName = $profileFullName
    WHERE id = $id;`,
    {
      $id: id,
      $json: objectToJSON(data),

      $active_at: active_at,
      $type: type,
      $members: members ? members.join(' ') : null,
      $name: name,
      $profileName: profileName,
      $profileFamilyName: profileFamilyName,
      $profileFullName: combineNames(profileName, profileFamilyName),
    }
  );
}
async function updateConversations(array) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([...map(array, item => updateConversation(item))]);
    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
updateConversations.needsSerial = true;

async function removeConversation(id) {
  if (!Array.isArray(id)) {
    await db.run('DELETE FROM conversations WHERE id = $id;', { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM conversations WHERE id IN ( ${id
      .map(() => '?')
      .join(', ')} );`,
    id
  );
}

async function getConversationById(id) {
  const row = await db.get('SELECT * FROM conversations WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getAllConversations() {
  const rows = await db.all('SELECT json FROM conversations ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}

async function getAllConversationIds() {
  const rows = await db.all('SELECT id FROM conversations ORDER BY id ASC;');
  return map(rows, row => row.id);
}

async function getAllPrivateConversations() {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      type = 'private'
     ORDER BY id ASC;`
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getAllGroupsInvolvingId(id) {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      type = 'group' AND
      members LIKE $id
     ORDER BY id ASC;`,
    {
      $id: `%${id}%`,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function searchConversations(query, { limit } = {}) {
  const rows = await db.all(
    `SELECT json FROM conversations WHERE
      (
        id LIKE $id OR
        name LIKE $name OR
        profileFullName LIKE $profileFullName
      )
     ORDER BY active_at DESC
     LIMIT $limit`,
    {
      $id: `%${query}%`,
      $name: `%${query}%`,
      $profileFullName: `%${query}%`,
      $limit: limit || 100,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function searchMessages(query, { limit } = {}) {
  const rows = await db.all(
    `SELECT
      messages.json,
      snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 15) as snippet
    FROM messages_fts
    INNER JOIN messages on messages_fts.id = messages.id
    WHERE
      messages_fts match $query
    ORDER BY messages.received_at DESC
    LIMIT $limit;`,
    {
      $query: query,
      $limit: limit || 500,
    }
  );

  return map(rows, row => ({
    json: row.json,
    snippet: row.snippet,
  }));
}

async function searchMessagesInConversation(
  query,
  conversationId,
  { limit } = {}
) {
  const rows = await db.all(
    `SELECT
      messages.json,
      snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 15) as snippet
    FROM messages_fts
    INNER JOIN messages on messages_fts.id = messages.id
    WHERE
      messages_fts match $query AND
      messages.conversationId = $conversationId
    ORDER BY messages.received_at DESC
    LIMIT $limit;`,
    {
      $query: query,
      $conversationId: conversationId,
      $limit: limit || 100,
    }
  );

  return map(rows, row => ({
    json: row.json,
    snippet: row.snippet,
  }));
}

async function getMessageCount() {
  const row = await db.get('SELECT count(*) from messages;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of messages');
  }

  return row['count(*)'];
}

async function saveMessage(data, { forceSave } = {}) {
  const {
    body,
    conversationId,
    // eslint-disable-next-line camelcase
    expires_at,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    id,
    isErased,
    isViewOnce,
    // eslint-disable-next-line camelcase
    received_at,
    schemaVersion,
    // eslint-disable-next-line camelcase
    sent_at,
    source,
    sourceDevice,
    type,
    unread,
    expireTimer,
    expirationStartTimestamp,
  } = data;

  const payload = {
    $id: id,
    $json: objectToJSON(data),

    $body: body,
    $conversationId: conversationId,
    $expirationStartTimestamp: expirationStartTimestamp,
    $expires_at: expires_at,
    $expireTimer: expireTimer,
    $hasAttachments: hasAttachments,
    $hasFileAttachments: hasFileAttachments,
    $hasVisualMediaAttachments: hasVisualMediaAttachments,
    $isErased: isErased,
    $isViewOnce: isViewOnce,
    $received_at: received_at,
    $schemaVersion: schemaVersion,
    $sent_at: sent_at,
    $source: source,
    $sourceDevice: sourceDevice,
    $type: type,
    $unread: unread,
  };

  if (id && !forceSave) {
    await db.run(
      `UPDATE messages SET
        id = $id,
        json = $json,

        body = $body,
        conversationId = $conversationId,
        expirationStartTimestamp = $expirationStartTimestamp,
        expires_at = $expires_at,
        expireTimer = $expireTimer,
        hasAttachments = $hasAttachments,
        hasFileAttachments = $hasFileAttachments,
        hasVisualMediaAttachments = $hasVisualMediaAttachments,
        isErased = $isErased,
        isViewOnce = $isViewOnce,
        received_at = $received_at,
        schemaVersion = $schemaVersion,
        sent_at = $sent_at,
        source = $source,
        sourceDevice = $sourceDevice,
        type = $type,
        unread = $unread
      WHERE id = $id;`,
      payload
    );

    return id;
  }

  const toCreate = {
    ...data,
    id: id || generateUUID(),
  };

  await db.run(
    `INSERT INTO messages (
    id,
    json,

    body,
    conversationId,
    expirationStartTimestamp,
    expires_at,
    expireTimer,
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
    isErased,
    isViewOnce,
    received_at,
    schemaVersion,
    sent_at,
    source,
    sourceDevice,
    type,
    unread
  ) values (
    $id,
    $json,

    $body,
    $conversationId,
    $expirationStartTimestamp,
    $expires_at,
    $expireTimer,
    $hasAttachments,
    $hasFileAttachments,
    $hasVisualMediaAttachments,
    $isErased,
    $isViewOnce,
    $received_at,
    $schemaVersion,
    $sent_at,
    $source,
    $sourceDevice,
    $type,
    $unread
  );`,
    {
      ...payload,
      $id: toCreate.id,
      $json: objectToJSON(toCreate),
    }
  );

  return toCreate.id;
}

async function saveMessages(arrayOfMessages, { forceSave } = {}) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfMessages, message => saveMessage(message, { forceSave })),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
saveMessages.needsSerial = true;

async function removeMessage(id) {
  if (!Array.isArray(id)) {
    await db.run('DELETE FROM messages WHERE id = $id;', { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeMessages: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM messages WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function getMessageById(id) {
  const row = await db.get('SELECT * FROM messages WHERE id = $id;', {
    $id: id,
  });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

async function getAllMessages() {
  const rows = await db.all('SELECT json FROM messages ORDER BY id ASC;');
  return map(rows, row => jsonToObject(row.json));
}

async function getAllMessageIds() {
  const rows = await db.all('SELECT id FROM messages ORDER BY id ASC;');
  return map(rows, row => row.id);
}

// eslint-disable-next-line camelcase
async function getMessageBySender({ source, sourceDevice, sent_at }) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      source = $source AND
      sourceDevice = $sourceDevice AND
      sent_at = $sent_at;`,
    {
      $source: source,
      $sourceDevice: sourceDevice,
      $sent_at: sent_at,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getUnreadByConversation(conversationId) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      unread = $unread AND
      conversationId = $conversationId
     ORDER BY received_at DESC;`,
    {
      $unread: 1,
      $conversationId: conversationId,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getOlderMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = Number.MAX_VALUE } = {}
) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
       conversationId = $conversationId AND
       received_at < $received_at
     ORDER BY received_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $received_at: receivedAt,
      $limit: limit,
    }
  );

  return rows.reverse();
}

async function getNewerMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = 0 } = {}
) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
       conversationId = $conversationId AND
       received_at > $received_at
     ORDER BY received_at ASC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $received_at: receivedAt,
      $limit: limit,
    }
  );

  return rows;
}
async function getOldestMessageForConversation(conversationId) {
  const row = await db.get(
    `SELECT * FROM messages WHERE
       conversationId = $conversationId
     ORDER BY received_at ASC
     LIMIT 1;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return row;
}
async function getNewestMessageForConversation(conversationId) {
  const row = await db.get(
    `SELECT * FROM messages WHERE
       conversationId = $conversationId
     ORDER BY received_at DESC
     LIMIT 1;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return row;
}
async function getOldestUnreadMessageForConversation(conversationId) {
  const row = await db.get(
    `SELECT * FROM messages WHERE
       conversationId = $conversationId AND
       unread = 1
     ORDER BY received_at ASC
     LIMIT 1;`,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    return null;
  }

  return row;
}

async function getTotalUnreadForConversation(conversationId) {
  const row = await db.get(
    `SELECT count(id) from messages WHERE
       conversationId = $conversationId AND
       unread = 1;
    `,
    {
      $conversationId: conversationId,
    }
  );

  if (!row) {
    throw new Error('getTotalUnreadForConversation: Unable to get count');
  }

  return row['count(id)'];
}

async function getMessageMetricsForConversation(conversationId) {
  const results = await Promise.all([
    getOldestMessageForConversation(conversationId),
    getNewestMessageForConversation(conversationId),
    getOldestUnreadMessageForConversation(conversationId),
    getTotalUnreadForConversation(conversationId),
  ]);

  const [oldest, newest, oldestUnread, totalUnread] = results;

  return {
    oldest: oldest ? pick(oldest, ['received_at', 'id']) : null,
    newest: newest ? pick(newest, ['received_at', 'id']) : null,
    oldestUnread: oldestUnread
      ? pick(oldestUnread, ['received_at', 'id'])
      : null,
    totalUnread,
  };
}
getMessageMetricsForConversation.needsSerial = true;

async function getMessagesBySentAt(sentAt) {
  const rows = await db.all(
    `SELECT * FROM messages
     WHERE sent_at = $sent_at
     ORDER BY received_at DESC;`,
    {
      $sent_at: sentAt,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getExpiredMessages() {
  const now = Date.now();

  const rows = await db.all(
    `SELECT json FROM messages WHERE
      expires_at IS NOT NULL AND
      expires_at <= $expires_at
     ORDER BY expires_at ASC;`,
    {
      $expires_at: now,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getOutgoingWithoutExpiresAt() {
  const rows = await db.all(`
    SELECT json FROM messages
    INDEXED BY messages_without_timer
    WHERE
      expireTimer > 0 AND
      expires_at IS NULL AND
      type IS 'outgoing'
    ORDER BY expires_at ASC;
  `);

  return map(rows, row => jsonToObject(row.json));
}

async function getNextExpiringMessage() {
  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows = await db.all(`
    SELECT json FROM messages
    WHERE expires_at > 0
    ORDER BY expires_at ASC
    LIMIT 1;
  `);

  return map(rows, row => jsonToObject(row.json));
}

async function getNextTapToViewMessageToAgeOut() {
  const rows = await db.all(`
    SELECT json FROM messages
    WHERE
      isViewOnce = 1
      AND (isErased IS NULL OR isErased != 1)
    ORDER BY received_at ASC
    LIMIT 1;
  `);

  if (!rows || rows.length < 1) {
    return null;
  }

  return jsonToObject(rows[0].json);
}

async function getTapToViewMessagesNeedingErase() {
  const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const rows = await db.all(
    `SELECT json FROM messages
    WHERE
      isViewOnce = 1
      AND (isErased IS NULL OR isErased != 1)
      AND received_at <= $THIRTY_DAYS_AGO
    ORDER BY received_at ASC;`,
    {
      $THIRTY_DAYS_AGO: THIRTY_DAYS_AGO,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function saveUnprocessed(data, { forceSave } = {}) {
  const { id, timestamp, version, attempts, envelope } = data;
  if (!id) {
    throw new Error('saveUnprocessed: id was falsey');
  }

  if (forceSave) {
    await db.run(
      `INSERT INTO unprocessed (
        id,
        timestamp,
        version,
        attempts,
        envelope
      ) values (
        $id,
        $timestamp,
        $version,
        $attempts,
        $envelope
      );`,
      {
        $id: id,
        $timestamp: timestamp,
        $version: version,
        $attempts: attempts,
        $envelope: envelope,
      }
    );

    return id;
  }

  await db.run(
    `UPDATE unprocessed SET
      timestamp = $timestamp,
      version = $version,
      attempts = $attempts,
      envelope = $envelope
    WHERE id = $id;`,
    {
      $id: id,
      $timestamp: timestamp,
      $version: version,
      $attempts: attempts,
      $envelope: envelope,
    }
  );

  return id;
}

async function saveUnprocesseds(arrayOfUnprocessed, { forceSave } = {}) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfUnprocessed, unprocessed =>
        saveUnprocessed(unprocessed, { forceSave })
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
saveUnprocesseds.needsSerial = true;

async function updateUnprocessedAttempts(id, attempts) {
  await db.run('UPDATE unprocessed SET attempts = $attempts WHERE id = $id;', {
    $id: id,
    $attempts: attempts,
  });
}
async function updateUnprocessedWithData(id, data = {}) {
  const { source, sourceDevice, serverTimestamp, decrypted } = data;

  await db.run(
    `UPDATE unprocessed SET
      source = $source,
      sourceDevice = $sourceDevice,
      serverTimestamp = $serverTimestamp,
      decrypted = $decrypted
    WHERE id = $id;`,
    {
      $id: id,
      $source: source,
      $sourceDevice: sourceDevice,
      $serverTimestamp: serverTimestamp,
      $decrypted: decrypted,
    }
  );
}
async function updateUnprocessedsWithData(arrayOfUnprocessed) {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      ...map(arrayOfUnprocessed, ({ id, data }) =>
        updateUnprocessedWithData(id, data)
      ),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
updateUnprocessedsWithData.needsSerial = true;

async function getUnprocessedById(id) {
  const row = await db.get('SELECT * FROM unprocessed WHERE id = $id;', {
    $id: id,
  });

  return row;
}

async function getUnprocessedCount() {
  const row = await db.get('SELECT count(*) from unprocessed;');

  if (!row) {
    throw new Error('getMessageCount: Unable to get count of unprocessed');
  }

  return row['count(*)'];
}

async function getAllUnprocessed() {
  const rows = await db.all(
    'SELECT * FROM unprocessed ORDER BY timestamp ASC;'
  );

  return rows;
}

async function removeUnprocessed(id) {
  if (!Array.isArray(id)) {
    await db.run('DELETE FROM unprocessed WHERE id = $id;', { $id: id });
    return;
  }

  if (!id.length) {
    throw new Error('removeUnprocessed: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  await db.run(
    `DELETE FROM unprocessed WHERE id IN ( ${id.map(() => '?').join(', ')} );`,
    id
  );
}

async function removeAllUnprocessed() {
  await db.run('DELETE FROM unprocessed;');
}

// Attachment Downloads

const ATTACHMENT_DOWNLOADS_TABLE = 'attachment_downloads';
async function getNextAttachmentDownloadJobs(limit, options = {}) {
  const timestamp = options.timestamp || Date.now();

  const rows = await db.all(
    `SELECT json FROM attachment_downloads
    WHERE pending = 0 AND timestamp < $timestamp
    ORDER BY timestamp DESC
    LIMIT $limit;`,
    {
      $limit: limit,
      $timestamp: timestamp,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}
async function saveAttachmentDownloadJob(job) {
  const { id, pending, timestamp } = job;
  if (!id) {
    throw new Error(
      'saveAttachmentDownloadJob: Provided job did not have a truthy id'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO attachment_downloads (
      id,
      pending,
      timestamp,
      json
    ) values (
      $id,
      $pending,
      $timestamp,
      $json
    )`,
    {
      $id: id,
      $pending: pending,
      $timestamp: timestamp,
      $json: objectToJSON(job),
    }
  );
}
async function setAttachmentDownloadJobPending(id, pending) {
  await db.run(
    'UPDATE attachment_downloads SET pending = $pending WHERE id = $id;',
    {
      $id: id,
      $pending: pending,
    }
  );
}
async function resetAttachmentDownloadPending() {
  await db.run(
    'UPDATE attachment_downloads SET pending = 0 WHERE pending != 0;'
  );
}
async function removeAttachmentDownloadJob(id) {
  return removeById(ATTACHMENT_DOWNLOADS_TABLE, id);
}
async function removeAllAttachmentDownloadJobs() {
  return removeAllFromTable(ATTACHMENT_DOWNLOADS_TABLE);
}

// Stickers

async function createOrUpdateStickerPack(pack) {
  const {
    attemptedStatus,
    author,
    coverStickerId,
    createdAt,
    downloadAttempts,
    id,
    installedAt,
    key,
    lastUsed,
    status,
    stickerCount,
    title,
  } = pack;
  if (!id) {
    throw new Error(
      'createOrUpdateStickerPack: Provided data did not have a truthy id'
    );
  }

  const rows = await db.all('SELECT id FROM sticker_packs WHERE id = $id;', {
    $id: id,
  });
  const payload = {
    $attemptedStatus: attemptedStatus,
    $author: author,
    $coverStickerId: coverStickerId,
    $createdAt: createdAt || Date.now(),
    $downloadAttempts: downloadAttempts || 1,
    $id: id,
    $installedAt: installedAt,
    $key: key,
    $lastUsed: lastUsed || null,
    $status: status,
    $stickerCount: stickerCount,
    $title: title,
  };

  if (rows && rows.length) {
    await db.run(
      `UPDATE sticker_packs SET
        attemptedStatus = $attemptedStatus,
        author = $author,
        coverStickerId = $coverStickerId,
        createdAt = $createdAt,
        downloadAttempts = $downloadAttempts,
        installedAt = $installedAt,
        key = $key,
        lastUsed = $lastUsed,
        status = $status,
        stickerCount = $stickerCount,
        title = $title
      WHERE id = $id;`,
      payload
    );
    return;
  }

  await db.run(
    `INSERT INTO sticker_packs (
      attemptedStatus,
      author,
      coverStickerId,
      createdAt,
      downloadAttempts,
      id,
      installedAt,
      key,
      lastUsed,
      status,
      stickerCount,
      title
    ) values (
      $attemptedStatus,
      $author,
      $coverStickerId,
      $createdAt,
      $downloadAttempts,
      $id,
      $installedAt,
      $key,
      $lastUsed,
      $status,
      $stickerCount,
      $title
    )`,
    payload
  );
}
async function updateStickerPackStatus(id, status, options) {
  // Strange, but an undefined parameter gets coerced into null via ipc
  const timestamp = (options || {}).timestamp || Date.now();
  const installedAt = status === 'installed' ? timestamp : null;

  await db.run(
    `UPDATE sticker_packs
    SET status = $status, installedAt = $installedAt
    WHERE id = $id;
    )`,
    {
      $id: id,
      $status: status,
      $installedAt: installedAt,
    }
  );
}
async function createOrUpdateSticker(sticker) {
  const {
    emoji,
    height,
    id,
    isCoverOnly,
    lastUsed,
    packId,
    path,
    width,
  } = sticker;
  if (!isNumber(id)) {
    throw new Error(
      'createOrUpdateSticker: Provided data did not have a numeric id'
    );
  }
  if (!packId) {
    throw new Error(
      'createOrUpdateSticker: Provided data did not have a truthy id'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO stickers (
      emoji,
      height,
      id,
      isCoverOnly,
      lastUsed,
      packId,
      path,
      width
    ) values (
      $emoji,
      $height,
      $id,
      $isCoverOnly,
      $lastUsed,
      $packId,
      $path,
      $width
    )`,
    {
      $emoji: emoji,
      $height: height,
      $id: id,
      $isCoverOnly: isCoverOnly,
      $lastUsed: lastUsed,
      $packId: packId,
      $path: path,
      $width: width,
    }
  );
}
async function updateStickerLastUsed(packId, stickerId, lastUsed) {
  await db.run(
    `UPDATE stickers
    SET lastUsed = $lastUsed
    WHERE id = $id AND packId = $packId;`,
    {
      $id: stickerId,
      $packId: packId,
      $lastUsed: lastUsed,
    }
  );
  await db.run(
    `UPDATE sticker_packs
    SET lastUsed = $lastUsed
    WHERE id = $id;`,
    {
      $id: packId,
      $lastUsed: lastUsed,
    }
  );
}
async function addStickerPackReference(messageId, packId) {
  if (!messageId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy messageId'
    );
  }
  if (!packId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy packId'
    );
  }

  await db.run(
    `INSERT OR REPLACE INTO sticker_references (
      messageId,
      packId
    ) values (
      $messageId,
      $packId
    )`,
    {
      $messageId: messageId,
      $packId: packId,
    }
  );
}
async function deleteStickerPackReference(messageId, packId) {
  if (!messageId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy messageId'
    );
  }
  if (!packId) {
    throw new Error(
      'addStickerPackReference: Provided data did not have a truthy packId'
    );
  }

  try {
    // We use an immediate transaction here to immediately acquire an exclusive lock,
    //   which would normally only happen when we did our first write.

    // We need this to ensure that our five queries are all atomic, with no other changes
    //   happening while we do it:
    // 1. Delete our target messageId/packId references
    // 2. Check the number of references still pointing at packId
    // 3. If that number is zero, get pack from sticker_packs database
    // 4. If it's not installed, then grab all of its sticker paths
    // 5. If it's not installed, then sticker pack (which cascades to all stickers and
    //      references)
    await db.run('BEGIN IMMEDIATE TRANSACTION;');

    await db.run(
      `DELETE FROM sticker_references
      WHERE messageId = $messageId AND packId = $packId;`,
      {
        $messageId: messageId,
        $packId: packId,
      }
    );

    const countRow = await db.get(
      `SELECT count(*) FROM sticker_references
      WHERE packId = $packId;`,
      { $packId: packId }
    );
    if (!countRow) {
      throw new Error(
        'deleteStickerPackReference: Unable to get count of references'
      );
    }
    const count = countRow['count(*)'];
    if (count > 0) {
      await db.run('COMMIT TRANSACTION;');
      return null;
    }

    const packRow = await db.get(
      `SELECT status FROM sticker_packs
      WHERE id = $packId;`,
      { $packId: packId }
    );
    if (!packRow) {
      console.log('deleteStickerPackReference: did not find referenced pack');
      await db.run('COMMIT TRANSACTION;');
      return null;
    }
    const { status } = packRow;

    if (status === 'installed') {
      await db.run('COMMIT TRANSACTION;');
      return null;
    }

    const stickerPathRows = await db.all(
      `SELECT path FROM stickers
      WHERE packId = $packId;`,
      {
        $packId: packId,
      }
    );
    await db.run(
      `DELETE FROM sticker_packs
      WHERE id = $packId;`,
      { $packId: packId }
    );

    await db.run('COMMIT TRANSACTION;');

    return (stickerPathRows || []).map(row => row.path);
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
deleteStickerPackReference.needsSerial = true;

async function deleteStickerPack(packId) {
  if (!packId) {
    throw new Error(
      'deleteStickerPack: Provided data did not have a truthy packId'
    );
  }

  try {
    // We use an immediate transaction here to immediately acquire an exclusive lock,
    //   which would normally only happen when we did our first write.

    // We need this to ensure that our two queries are atomic, with no other changes
    //   happening while we do it:
    // 1. Grab all of target pack's sticker paths
    // 2. Delete sticker pack (which cascades to all stickers and references)
    await db.run('BEGIN IMMEDIATE TRANSACTION;');

    const stickerPathRows = await db.all(
      `SELECT path FROM stickers
      WHERE packId = $packId;`,
      {
        $packId: packId,
      }
    );
    await db.run(
      `DELETE FROM sticker_packs
      WHERE id = $packId;`,
      { $packId: packId }
    );

    await db.run('COMMIT TRANSACTION;');

    return (stickerPathRows || []).map(row => row.path);
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
deleteStickerPack.needsSerial = true;

async function getStickerCount() {
  const row = await db.get('SELECT count(*) from stickers;');

  if (!row) {
    throw new Error('getStickerCount: Unable to get count of stickers');
  }

  return row['count(*)'];
}
async function getAllStickerPacks() {
  const rows = await db.all(
    `SELECT * FROM sticker_packs
    ORDER BY installedAt DESC, createdAt DESC`
  );

  return rows || [];
}
async function getAllStickers() {
  const rows = await db.all(
    `SELECT * FROM stickers
    ORDER BY packId ASC, id ASC`
  );

  return rows || [];
}
async function getRecentStickers({ limit } = {}) {
  // Note: we avoid 'IS NOT NULL' here because it does seem to bypass our index
  const rows = await db.all(
    `SELECT stickers.* FROM stickers
    JOIN sticker_packs on stickers.packId = sticker_packs.id
    WHERE stickers.lastUsed > 0 AND sticker_packs.status = 'installed'
    ORDER BY stickers.lastUsed DESC
    LIMIT $limit`,
    {
      $limit: limit || 24,
    }
  );

  return rows || [];
}

// Emojis
async function updateEmojiUsage(shortName, timeUsed = Date.now()) {
  await db.run('BEGIN TRANSACTION;');

  try {
    const rows = await db.get(
      'SELECT * FROM emojis WHERE shortName = $shortName;',
      {
        $shortName: shortName,
      }
    );

    if (rows) {
      await db.run(
        'UPDATE emojis SET lastUsage = $timeUsed WHERE shortName = $shortName;',
        { $shortName: shortName, $timeUsed: timeUsed }
      );
    } else {
      await db.run(
        'INSERT INTO emojis(shortName, lastUsage) VALUES ($shortName, $timeUsed);',
        { $shortName: shortName, $timeUsed: timeUsed }
      );
    }

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
updateEmojiUsage.needsSerial = true;

async function getRecentEmojis(limit = 32) {
  const rows = await db.all(
    'SELECT * FROM emojis ORDER BY lastUsage DESC LIMIT $limit;',
    {
      $limit: limit,
    }
  );

  return rows || [];
}

// All data in database
async function removeAll() {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      db.run('DELETE FROM conversations;'),
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM messages;'),
      db.run('DELETE FROM preKeys;'),
      db.run('DELETE FROM sessions;'),
      db.run('DELETE FROM signedPreKeys;'),
      db.run('DELETE FROM unprocessed;'),
      db.run('DELETE FROM attachment_downloads;'),
      db.run('DELETE FROM messages_fts;'),
      db.run('DELETE FROM stickers;'),
      db.run('DELETE FROM sticker_packs;'),
      db.run('DELETE FROM sticker_references;'),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
removeAll.needsSerial = true;

// Anything that isn't user-visible data
async function removeAllConfiguration() {
  await db.run('BEGIN TRANSACTION;');

  try {
    await Promise.all([
      db.run('DELETE FROM identityKeys;'),
      db.run('DELETE FROM items;'),
      db.run('DELETE FROM preKeys;'),
      db.run('DELETE FROM sessions;'),
      db.run('DELETE FROM signedPreKeys;'),
      db.run('DELETE FROM unprocessed;'),
    ]);

    await db.run('COMMIT TRANSACTION;');
  } catch (error) {
    await db.run('ROLLBACK;');
    throw error;
  }
}
removeAllConfiguration.needsSerial = true;

async function getMessagesNeedingUpgrade(limit, { maxVersion }) {
  const rows = await db.all(
    `SELECT json FROM messages
     WHERE schemaVersion IS NULL OR schemaVersion < $maxVersion
     LIMIT $limit;`,
    {
      $maxVersion: maxVersion,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesWithVisualMediaAttachments(
  conversationId,
  { limit }
) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      conversationId = $conversationId AND
      hasVisualMediaAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

async function getMessagesWithFileAttachments(conversationId, { limit }) {
  const rows = await db.all(
    `SELECT json FROM messages WHERE
      conversationId = $conversationId AND
      hasFileAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`,
    {
      $conversationId: conversationId,
      $limit: limit,
    }
  );

  return map(rows, row => jsonToObject(row.json));
}

function getExternalFilesForMessage(message) {
  const { attachments, contact, quote, preview, sticker } = message;
  const files = [];

  forEach(attachments, attachment => {
    const { path: file, thumbnail, screenshot } = attachment;
    if (file) {
      files.push(file);
    }

    if (thumbnail && thumbnail.path) {
      files.push(thumbnail.path);
    }

    if (screenshot && screenshot.path) {
      files.push(screenshot.path);
    }
  });

  if (quote && quote.attachments && quote.attachments.length) {
    forEach(quote.attachments, attachment => {
      const { thumbnail } = attachment;

      if (thumbnail && thumbnail.path) {
        files.push(thumbnail.path);
      }
    });
  }

  if (contact && contact.length) {
    forEach(contact, item => {
      const { avatar } = item;

      if (avatar && avatar.avatar && avatar.avatar.path) {
        files.push(avatar.avatar.path);
      }
    });
  }

  if (preview && preview.length) {
    forEach(preview, item => {
      const { image } = item;

      if (image && image.path) {
        files.push(image.path);
      }
    });
  }

  if (sticker && sticker.data && sticker.data.path) {
    files.push(sticker.data.path);

    if (sticker.data.thumbnail && sticker.data.thumbnail.path) {
      files.push(sticker.data.thumbnail.path);
    }
  }

  return files;
}

function getExternalFilesForConversation(conversation) {
  const { avatar, profileAvatar } = conversation;
  const files = [];

  if (avatar && avatar.path) {
    files.push(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    files.push(profileAvatar.path);
  }

  return files;
}

function getExternalDraftFilesForConversation(conversation) {
  const draftAttachments = conversation.draftAttachments || [];
  const files = [];

  forEach(draftAttachments, attachment => {
    const { path: file, screenshotPath } = attachment;
    if (file) {
      files.push(file);
    }

    if (screenshotPath) {
      files.push(screenshotPath);
    }
  });

  return files;
}

async function removeKnownAttachments(allAttachments) {
  const lookup = fromPairs(map(allAttachments, file => [file, true]));
  const chunkSize = 50;

  const total = await getMessageCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${total} messages`
  );

  let count = 0;
  let complete = false;
  let id = '';

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.all(
      `SELECT json FROM messages
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const messages = map(rows, row => jsonToObject(row.json));
    forEach(messages, message => {
      const externalFiles = getExternalFilesForMessage(message);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(messages);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = messages.length < chunkSize;
    count += messages.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} messages`);

  complete = false;
  count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  id = 0;

  const conversationTotal = await getConversationCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${conversationTotal} conversations`
  );

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.all(
      `SELECT json FROM conversations
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const conversations = map(rows, row => jsonToObject(row.json));
    forEach(conversations, conversation => {
      const externalFiles = getExternalFilesForConversation(conversation);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} conversations`);

  return Object.keys(lookup);
}

async function removeKnownStickers(allStickers) {
  const lookup = fromPairs(map(allStickers, file => [file, true]));
  const chunkSize = 50;

  const total = await getStickerCount();
  console.log(
    `removeKnownStickers: About to iterate through ${total} stickers`
  );

  let count = 0;
  let complete = false;
  let rowid = 0;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.all(
      `SELECT rowid, path FROM stickers
       WHERE rowid > $rowid
       ORDER BY rowid ASC
       LIMIT $chunkSize;`,
      {
        $rowid: rowid,
        $chunkSize: chunkSize,
      }
    );

    const files = map(rows, row => row.path);
    forEach(files, file => {
      delete lookup[file];
    });

    const lastSticker = last(rows);
    if (lastSticker) {
      ({ rowid } = lastSticker);
    }
    complete = rows.length < chunkSize;
    count += rows.length;
  }

  console.log(`removeKnownStickers: Done processing ${count} stickers`);

  return Object.keys(lookup);
}

async function removeKnownDraftAttachments(allStickers) {
  const lookup = fromPairs(map(allStickers, file => [file, true]));
  const chunkSize = 50;

  const total = await getConversationCount();
  console.log(
    `removeKnownDraftAttachments: About to iterate through ${total} conversations`
  );

  let complete = false;
  let count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  let id = 0;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await db.all(
      `SELECT json FROM conversations
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`,
      {
        $id: id,
        $chunkSize: chunkSize,
      }
    );

    const conversations = map(rows, row => jsonToObject(row.json));
    forEach(conversations, conversation => {
      const externalFiles = getExternalDraftFilesForConversation(conversation);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(
    `removeKnownDraftAttachments: Done processing ${count} conversations`
  );

  return Object.keys(lookup);
}
