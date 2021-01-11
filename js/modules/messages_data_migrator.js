// Module to upgrade the schema of messages, e.g. migrate attachments to disk.
// `dangerouslyProcessAllWithoutIndex` purposely doesn’t rely on our Backbone
// IndexedDB adapter to prevent automatic migrations. Rather, it uses direct
// IndexedDB access. This includes avoiding usage of `storage` module which uses
// Backbone under the hood.

/* global IDBKeyRange, window */

const { isFunction, isNumber, isObject, isString, last } = require('lodash');

const database = require('./database');
const Message = require('./types/message');
const settings = require('./settings');

const MESSAGES_STORE_NAME = 'messages';

exports.processNext = async ({
  BackboneMessage,
  BackboneMessageCollection,
  numMessagesPerBatch,
  upgradeMessageSchema,
  getMessagesNeedingUpgrade,
  saveMessage,
  maxVersion = Message.CURRENT_SCHEMA_VERSION,
} = {}) => {
  if (!isFunction(BackboneMessage)) {
    throw new TypeError(
      "'BackboneMessage' (Whisper.Message) constructor is required"
    );
  }

  if (!isFunction(BackboneMessageCollection)) {
    throw new TypeError(
      "'BackboneMessageCollection' (Whisper.MessageCollection)" +
        ' constructor is required'
    );
  }

  if (!isNumber(numMessagesPerBatch)) {
    throw new TypeError("'numMessagesPerBatch' is required");
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError("'upgradeMessageSchema' is required");
  }

  const startTime = Date.now();

  const fetchStartTime = Date.now();
  let messagesRequiringSchemaUpgrade;
  try {
    messagesRequiringSchemaUpgrade = await getMessagesNeedingUpgrade(
      numMessagesPerBatch,
      {
        maxVersion,
        MessageCollection: BackboneMessageCollection,
      }
    );
  } catch (error) {
    window.log.error(
      'processNext error:',
      error && error.stack ? error.stack : error
    );
    return {
      done: true,
      numProcessed: 0,
    };
  }
  const fetchDuration = Date.now() - fetchStartTime;

  const upgradeStartTime = Date.now();
  const upgradedMessages = await Promise.all(
    messagesRequiringSchemaUpgrade.map(message =>
      upgradeMessageSchema(message, { maxVersion })
    )
  );
  const upgradeDuration = Date.now() - upgradeStartTime;

  const saveStartTime = Date.now();
  await Promise.all(
    upgradedMessages.map(message =>
      saveMessage(message, { Message: BackboneMessage })
    )
  );
  const saveDuration = Date.now() - saveStartTime;

  const totalDuration = Date.now() - startTime;
  const numProcessed = messagesRequiringSchemaUpgrade.length;
  const done = numProcessed < numMessagesPerBatch;
  return {
    done,
    numProcessed,
    fetchDuration,
    upgradeDuration,
    saveDuration,
    totalDuration,
  };
};

exports.dangerouslyProcessAllWithoutIndex = async ({
  databaseName,
  minDatabaseVersion,
  numMessagesPerBatch,
  upgradeMessageSchema,
  logger,
  maxVersion = Message.CURRENT_SCHEMA_VERSION,
  saveMessage,
  BackboneMessage,
} = {}) => {
  if (!isString(databaseName)) {
    throw new TypeError("'databaseName' must be a string");
  }

  if (!isNumber(minDatabaseVersion)) {
    throw new TypeError("'minDatabaseVersion' must be a number");
  }

  if (!isNumber(numMessagesPerBatch)) {
    throw new TypeError("'numMessagesPerBatch' must be a number");
  }
  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError("'upgradeMessageSchema' is required");
  }
  if (!isFunction(BackboneMessage)) {
    throw new TypeError("'upgradeMessageSchema' is required");
  }
  if (!isFunction(saveMessage)) {
    throw new TypeError("'upgradeMessageSchema' is required");
  }

  const connection = await database.open(databaseName);
  const databaseVersion = connection.version;
  const isValidDatabaseVersion = databaseVersion >= minDatabaseVersion;
  logger.info('Database status', {
    databaseVersion,
    isValidDatabaseVersion,
    minDatabaseVersion,
  });
  if (!isValidDatabaseVersion) {
    throw new Error(
      `Expected database version (${databaseVersion})` +
        ` to be at least ${minDatabaseVersion}`
    );
  }

  // NOTE: Even if we make this async using `then`, requesting `count` on an
  // IndexedDB store blocks all subsequent transactions, so we might as well
  // explicitly wait for it here:
  const numTotalMessages = await exports.getNumMessages({ connection });

  const migrationStartTime = Date.now();
  let numCumulativeMessagesProcessed = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const status = await _processBatch({
      connection,
      numMessagesPerBatch,
      upgradeMessageSchema,
      maxVersion,
      saveMessage,
      BackboneMessage,
    });
    if (status.done) {
      break;
    }
    numCumulativeMessagesProcessed += status.numMessagesProcessed;
    logger.info(
      'Upgrade message schema:',
      Object.assign({}, status, {
        numTotalMessages,
        numCumulativeMessagesProcessed,
      })
    );
  }

  logger.info('Close database connection');
  connection.close();

  const totalDuration = Date.now() - migrationStartTime;
  logger.info('Attachment migration complete:', {
    totalDuration,
    totalMessagesProcessed: numCumulativeMessagesProcessed,
  });
};

exports.processNextBatchWithoutIndex = async ({
  databaseName,
  minDatabaseVersion,
  numMessagesPerBatch,
  upgradeMessageSchema,
  maxVersion,
  BackboneMessage,
  saveMessage,
} = {}) => {
  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError("'upgradeMessageSchema' is required");
  }

  const connection = await _getConnection({ databaseName, minDatabaseVersion });
  const batch = await _processBatch({
    connection,
    numMessagesPerBatch,
    upgradeMessageSchema,
    maxVersion,
    BackboneMessage,
    saveMessage,
  });
  return batch;
};

// Private API
const _getConnection = async ({ databaseName, minDatabaseVersion }) => {
  if (!isString(databaseName)) {
    throw new TypeError("'databaseName' must be a string");
  }

  if (!isNumber(minDatabaseVersion)) {
    throw new TypeError("'minDatabaseVersion' must be a number");
  }

  const connection = await database.open(databaseName);
  const databaseVersion = connection.version;
  const isValidDatabaseVersion = databaseVersion >= minDatabaseVersion;
  if (!isValidDatabaseVersion) {
    throw new Error(
      `Expected database version (${databaseVersion})` +
        ` to be at least ${minDatabaseVersion}`
    );
  }

  return connection;
};

const _processBatch = async ({
  connection,
  numMessagesPerBatch,
  upgradeMessageSchema,
  maxVersion,
  BackboneMessage,
  saveMessage,
} = {}) => {
  if (!isObject(connection)) {
    throw new TypeError('_processBatch: connection must be a string');
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError('_processBatch: upgradeMessageSchema is required');
  }

  if (!isNumber(numMessagesPerBatch)) {
    throw new TypeError('_processBatch: numMessagesPerBatch is required');
  }
  if (!isNumber(maxVersion)) {
    throw new TypeError('_processBatch: maxVersion is required');
  }
  if (!isFunction(BackboneMessage)) {
    throw new TypeError('_processBatch: BackboneMessage is required');
  }
  if (!isFunction(saveMessage)) {
    throw new TypeError('_processBatch: saveMessage is required');
  }

  const isAttachmentMigrationComplete = await settings.isAttachmentMigrationComplete(
    connection
  );
  if (isAttachmentMigrationComplete) {
    return {
      done: true,
    };
  }

  const lastProcessedIndex = await settings.getAttachmentMigrationLastProcessedIndex(
    connection
  );

  const fetchUnprocessedMessagesStartTime = Date.now();
  let unprocessedMessages;
  try {
    unprocessedMessages = await _dangerouslyFetchMessagesRequiringSchemaUpgradeWithoutIndex(
      {
        connection,
        count: numMessagesPerBatch,
        lastIndex: lastProcessedIndex,
      }
    );
  } catch (error) {
    window.log.error(
      '_processBatch error:',
      error && error.stack ? error.stack : error
    );
    await settings.markAttachmentMigrationComplete(connection);
    await settings.deleteAttachmentMigrationLastProcessedIndex(connection);
    return {
      done: true,
    };
  }
  const fetchDuration = Date.now() - fetchUnprocessedMessagesStartTime;

  const upgradeStartTime = Date.now();
  const upgradedMessages = await Promise.all(
    unprocessedMessages.map(message =>
      upgradeMessageSchema(message, { maxVersion })
    )
  );
  const upgradeDuration = Date.now() - upgradeStartTime;

  const saveMessagesStartTime = Date.now();
  const transaction = connection.transaction(MESSAGES_STORE_NAME, 'readwrite');
  const transactionCompletion = database.completeTransaction(transaction);
  await Promise.all(
    upgradedMessages.map(message =>
      saveMessage(message, { Message: BackboneMessage })
    )
  );
  await transactionCompletion;
  const saveDuration = Date.now() - saveMessagesStartTime;

  const numMessagesProcessed = upgradedMessages.length;
  const done = numMessagesProcessed < numMessagesPerBatch;
  const lastMessage = last(upgradedMessages);
  const newLastProcessedIndex = lastMessage ? lastMessage.id : null;
  if (!done) {
    await settings.setAttachmentMigrationLastProcessedIndex(
      connection,
      newLastProcessedIndex
    );
  } else {
    await settings.markAttachmentMigrationComplete(connection);
    await settings.deleteAttachmentMigrationLastProcessedIndex(connection);
  }

  const batchTotalDuration = Date.now() - fetchUnprocessedMessagesStartTime;

  return {
    batchTotalDuration,
    done,
    fetchDuration,
    lastProcessedIndex,
    newLastProcessedIndex,
    numMessagesProcessed,
    saveDuration,
    targetSchemaVersion: Message.CURRENT_SCHEMA_VERSION,
    upgradeDuration,
  };
};

// NOTE: Named ‘dangerous’ because it is not as efficient as using our
// `messages` `schemaVersion` index:
const _dangerouslyFetchMessagesRequiringSchemaUpgradeWithoutIndex = ({
  connection,
  count,
  lastIndex,
} = {}) => {
  if (!isObject(connection)) {
    throw new TypeError("'connection' is required");
  }

  if (!isNumber(count)) {
    throw new TypeError("'count' is required");
  }

  if (lastIndex && !isString(lastIndex)) {
    throw new TypeError("'lastIndex' must be a string");
  }

  const hasLastIndex = Boolean(lastIndex);

  const transaction = connection.transaction(MESSAGES_STORE_NAME, 'readonly');
  const messagesStore = transaction.objectStore(MESSAGES_STORE_NAME);

  const excludeLowerBound = true;
  const range = hasLastIndex
    ? IDBKeyRange.lowerBound(lastIndex, excludeLowerBound)
    : undefined;
  return new Promise((resolve, reject) => {
    const items = [];
    const request = messagesStore.openCursor(range);
    request.onsuccess = event => {
      const cursor = event.target.result;
      const hasMoreData = Boolean(cursor);
      if (!hasMoreData || items.length === count) {
        resolve(items);
        return;
      }
      const item = cursor.value;
      items.push(item);
      cursor.continue();
    };
    request.onerror = event => reject(event.target.error);
  });
};

exports.getNumMessages = async ({ connection } = {}) => {
  if (!isObject(connection)) {
    throw new TypeError("'connection' is required");
  }

  const transaction = connection.transaction(MESSAGES_STORE_NAME, 'readonly');
  const messagesStore = transaction.objectStore(MESSAGES_STORE_NAME);
  const numTotalMessages = await database.getCount({ store: messagesStore });
  await database.completeTransaction(transaction);

  return numTotalMessages;
};
