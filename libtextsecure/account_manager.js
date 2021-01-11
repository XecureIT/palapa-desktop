/* global
  window,
  textsecure,
  libsignal,
  WebSocketResource,
  btoa,
  Signal,
  getString,
  libphonenumber,
  Event,
  ConversationController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};

  const ARCHIVE_AGE = 7 * 24 * 60 * 60 * 1000;

  function AccountManager(username, password) {
    this.server = window.WebAPI.connect({ username, password });
    this.pending = Promise.resolve();
  }

  function getNumber(numberId) {
    if (!numberId || !numberId.length) {
      return numberId;
    }

    const parts = numberId.split('.');
    if (!parts.length) {
      return numberId;
    }

    return parts[0];
  }

  AccountManager.prototype = new textsecure.EventTarget();
  AccountManager.prototype.extend({
    constructor: AccountManager,
    requestVoiceVerification(number) {
      return this.server.requestVerificationVoice(number);
    },
    requestSMSVerification(number) {
      return this.server.requestVerificationSMS(number);
    },
    async encryptDeviceName(name, providedIdentityKey) {
      if (!name) {
        return null;
      }
      const identityKey =
        providedIdentityKey ||
        (await textsecure.storage.protocol.getIdentityKeyPair());
      if (!identityKey) {
        throw new Error(
          'Identity key was not provided and is not in database!'
        );
      }
      const encrypted = await Signal.Crypto.encryptDeviceName(
        name,
        identityKey.pubKey
      );

      const proto = new textsecure.protobuf.DeviceName();
      proto.ephemeralPublic = encrypted.ephemeralPublic;
      proto.syntheticIv = encrypted.syntheticIv;
      proto.ciphertext = encrypted.ciphertext;

      const arrayBuffer = proto.encode().toArrayBuffer();
      return Signal.Crypto.arrayBufferToBase64(arrayBuffer);
    },
    async decryptDeviceName(base64) {
      const identityKey = await textsecure.storage.protocol.getIdentityKeyPair();

      const arrayBuffer = Signal.Crypto.base64ToArrayBuffer(base64);
      const proto = textsecure.protobuf.DeviceName.decode(arrayBuffer);
      const encrypted = {
        ephemeralPublic: proto.ephemeralPublic.toArrayBuffer(),
        syntheticIv: proto.syntheticIv.toArrayBuffer(),
        ciphertext: proto.ciphertext.toArrayBuffer(),
      };

      const name = await Signal.Crypto.decryptDeviceName(
        encrypted,
        identityKey.privKey
      );

      return name;
    },
    async maybeUpdateDeviceName() {
      const isNameEncrypted = textsecure.storage.user.getDeviceNameEncrypted();
      if (isNameEncrypted) {
        return;
      }
      const deviceName = await textsecure.storage.user.getDeviceName();
      const base64 = await this.encryptDeviceName(deviceName);

      await this.server.updateDeviceName(base64);
    },
    async deviceNameIsEncrypted() {
      await textsecure.storage.user.setDeviceNameEncrypted();
    },
    async maybeDeleteSignalingKey() {
      const key = await textsecure.storage.user.getSignalingKey();
      if (key) {
        await this.server.removeSignalingKey();
      }
    },
    registerSingleDevice(number, verificationCode) {
      const registerKeys = this.server.registerKeys.bind(this.server);
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 100);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      return this.queueTask(() =>
        libsignal.KeyHelper.generateIdentityKeyPair().then(
          async identityKeyPair => {
            const profileKey = textsecure.crypto.getRandomBytes(32);
            const accessKey = await window.Signal.Crypto.deriveAccessKey(
              profileKey
            );

            return createAccount(
              number,
              verificationCode,
              identityKeyPair,
              profileKey,
              null,
              null,
              null,
              { accessKey }
            )
              .then(clearSessionsAndPreKeys)
              .then(generateKeys)
              .then(keys => registerKeys(keys).then(() => confirmKeys(keys)))
              .then(() => registrationDone(number));
          }
        )
      );
    },
    registerSecondDevice(setProvisioningUrl, confirmNumber, progressCallback) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 100, progressCallback);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      const registerKeys = this.server.registerKeys.bind(this.server);
      const getSocket = this.server.getProvisioningSocket.bind(this.server);
      const queueTask = this.queueTask.bind(this);
      const provisioningCipher = new libsignal.ProvisioningCipher();
      let gotProvisionEnvelope = false;
      return provisioningCipher.getPublicKey().then(
        pubKey =>
          new Promise((resolve, reject) => {
            const socket = getSocket();
            socket.onclose = event => {
              window.log.info('provisioning socket closed. Code:', event.code);
              if (!gotProvisionEnvelope) {
                reject(new Error('websocket closed'));
              }
            };
            socket.onopen = () => {
              window.log.info('provisioning socket open');
            };
            const wsr = new WebSocketResource(socket, {
              keepalive: { path: '/v1/keepalive/provisioning' },
              handleRequest(request) {
                if (request.path === '/v1/address' && request.verb === 'PUT') {
                  const proto = textsecure.protobuf.ProvisioningUuid.decode(
                    request.body
                  );
                  setProvisioningUrl(
                    [
                      'tsdevice:/?uuid=',
                      proto.uuid,
                      '&pub_key=',
                      encodeURIComponent(btoa(getString(pubKey))),
                    ].join('')
                  );
                  request.respond(200, 'OK');
                } else if (
                  request.path === '/v1/message' &&
                  request.verb === 'PUT'
                ) {
                  const envelope = textsecure.protobuf.ProvisionEnvelope.decode(
                    request.body,
                    'binary'
                  );
                  request.respond(200, 'OK');
                  gotProvisionEnvelope = true;
                  wsr.close();
                  resolve(
                    provisioningCipher
                      .decrypt(envelope)
                      .then(provisionMessage =>
                        queueTask(() =>
                          confirmNumber(provisionMessage.number).then(
                            deviceName => {
                              if (
                                typeof deviceName !== 'string' ||
                                deviceName.length === 0
                              ) {
                                throw new Error('Invalid device name');
                              }
                              return createAccount(
                                provisionMessage.number,
                                provisionMessage.provisioningCode,
                                provisionMessage.identityKeyPair,
                                provisionMessage.profileKey,
                                deviceName,
                                provisionMessage.userAgent,
                                provisionMessage.readReceipts
                              )
                                .then(clearSessionsAndPreKeys)
                                .then(generateKeys)
                                .then(keys =>
                                  registerKeys(keys).then(() =>
                                    confirmKeys(keys)
                                  )
                                )
                                .then(() =>
                                  registrationDone(provisionMessage.number)
                                );
                            }
                          )
                        )
                      )
                  );
                } else {
                  window.log.error('Unknown websocket message', request.path);
                }
              },
            });
          })
      );
    },
    refreshPreKeys() {
      const generateKeys = this.generateKeys.bind(this, 100);
      const registerKeys = this.server.registerKeys.bind(this.server);

      return this.queueTask(() =>
        this.server.getMyKeys().then(preKeyCount => {
          window.log.info(`prekey count ${preKeyCount}`);
          if (preKeyCount < 10) {
            return generateKeys().then(registerKeys);
          }
          return null;
        })
      );
    },
    rotateSignedPreKey() {
      return this.queueTask(() => {
        const signedKeyId = textsecure.storage.get('signedKeyId', 1);
        if (typeof signedKeyId !== 'number') {
          throw new Error('Invalid signedKeyId');
        }

        const store = textsecure.storage.protocol;
        const { server, cleanSignedPreKeys } = this;

        return store
          .getIdentityKeyPair()
          .then(
            identityKey =>
              libsignal.KeyHelper.generateSignedPreKey(
                identityKey,
                signedKeyId
              ),
            () => {
              // We swallow any error here, because we don't want to get into
              //   a loop of repeated retries.
              window.log.error(
                'Failed to get identity key. Canceling key rotation.'
              );
            }
          )
          .then(res => {
            if (!res) {
              return null;
            }
            window.log.info('Saving new signed prekey', res.keyId);
            return Promise.all([
              textsecure.storage.put('signedKeyId', signedKeyId + 1),
              store.storeSignedPreKey(res.keyId, res.keyPair),
              server.setSignedPreKey({
                keyId: res.keyId,
                publicKey: res.keyPair.pubKey,
                signature: res.signature,
              }),
            ])
              .then(() => {
                const confirmed = true;
                window.log.info('Confirming new signed prekey', res.keyId);
                return Promise.all([
                  textsecure.storage.remove('signedKeyRotationRejected'),
                  store.storeSignedPreKey(res.keyId, res.keyPair, confirmed),
                ]);
              })
              .then(() => cleanSignedPreKeys());
          })
          .catch(e => {
            window.log.error(
              'rotateSignedPrekey error:',
              e && e.stack ? e.stack : e
            );

            if (
              e instanceof Error &&
              e.name === 'HTTPError' &&
              e.code >= 400 &&
              e.code <= 599
            ) {
              const rejections =
                1 + textsecure.storage.get('signedKeyRotationRejected', 0);
              textsecure.storage.put('signedKeyRotationRejected', rejections);
              window.log.error(
                'Signed key rotation rejected count:',
                rejections
              );
            } else {
              throw e;
            }
          });
      });
    },
    queueTask(task) {
      this.pendingQueue =
        this.pendingQueue || new window.PQueue({ concurrency: 1 });
      const taskWithTimeout = textsecure.createTaskWithTimeout(task);

      return this.pendingQueue.add(taskWithTimeout);
    },
    cleanSignedPreKeys() {
      const MINIMUM_KEYS = 3;
      const store = textsecure.storage.protocol;
      return store.loadSignedPreKeys().then(allKeys => {
        allKeys.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
        allKeys.reverse(); // we want the most recent first
        const confirmed = allKeys.filter(key => key.confirmed);
        const unconfirmed = allKeys.filter(key => !key.confirmed);

        const recent = allKeys[0] ? allKeys[0].keyId : 'none';
        const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
        window.log.info(`Most recent signed key: ${recent}`);
        window.log.info(`Most recent confirmed signed key: ${recentConfirmed}`);
        window.log.info(
          'Total signed key count:',
          allKeys.length,
          '-',
          confirmed.length,
          'confirmed'
        );

        let confirmedCount = confirmed.length;

        // Keep MINIMUM_KEYS confirmed keys, then drop if older than a week
        confirmed.forEach((key, index) => {
          if (index < MINIMUM_KEYS) {
            return;
          }
          const createdAt = key.created_at || 0;
          const age = Date.now() - createdAt;

          if (age > ARCHIVE_AGE) {
            window.log.info(
              'Removing confirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              new Date(createdAt).toJSON()
            );
            store.removeSignedPreKey(key.keyId);
            confirmedCount -= 1;
          }
        });

        const stillNeeded = MINIMUM_KEYS - confirmedCount;

        // If we still don't have enough total keys, we keep as many unconfirmed
        // keys as necessary. If not necessary, and over a week old, we drop.
        unconfirmed.forEach((key, index) => {
          if (index < stillNeeded) {
            return;
          }

          const createdAt = key.created_at || 0;
          const age = Date.now() - createdAt;
          if (age > ARCHIVE_AGE) {
            window.log.info(
              'Removing unconfirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              new Date(createdAt).toJSON()
            );
            store.removeSignedPreKey(key.keyId);
          }
        });
      });
    },
    async createAccount(
      number,
      verificationCode,
      identityKeyPair,
      profileKey,
      deviceName,
      userAgent,
      readReceipts,
      options = {}
    ) {
      const { accessKey } = options;
      let password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
      password = password.substring(0, password.length - 2);
      const registrationId = libsignal.KeyHelper.generateRegistrationId();

      const previousNumber = getNumber(textsecure.storage.get('number_id'));

      const encryptedDeviceName = await this.encryptDeviceName(
        deviceName,
        identityKeyPair
      );
      await this.deviceNameIsEncrypted();

      window.log.info(
        `createAccount: Number is ${number}, password has length: ${
          password ? password.length : 'none'
        }`
      );

      const response = await this.server.confirmCode(
        number,
        verificationCode,
        password,
        registrationId,
        encryptedDeviceName,
        { accessKey }
      );

      if (previousNumber && previousNumber !== number) {
        window.log.warn(
          'New number is different from old number; deleting all previous data'
        );

        try {
          await textsecure.storage.protocol.removeAllData();
          window.log.info('Successfully deleted previous data');
        } catch (error) {
          window.log.error(
            'Something went wrong deleting data from previous number',
            error && error.stack ? error.stack : error
          );
        }
      }

      await Promise.all([
        textsecure.storage.remove('identityKey'),
        textsecure.storage.remove('password'),
        textsecure.storage.remove('registrationId'),
        textsecure.storage.remove('number_id'),
        textsecure.storage.remove('device_name'),
        textsecure.storage.remove('regionCode'),
        textsecure.storage.remove('userAgent'),
        textsecure.storage.remove('profileKey'),
        textsecure.storage.remove('read-receipts-setting'),
      ]);

      // update our own identity key, which may have changed
      // if we're relinking after a reinstall on the master device
      await textsecure.storage.protocol.saveIdentityWithAttributes(number, {
        id: number,
        publicKey: identityKeyPair.pubKey,
        firstUse: true,
        timestamp: Date.now(),
        verified: textsecure.storage.protocol.VerifiedStatus.VERIFIED,
        nonblockingApproval: true,
      });

      await textsecure.storage.put('identityKey', identityKeyPair);
      await textsecure.storage.put('password', password);
      await textsecure.storage.put('registrationId', registrationId);
      if (profileKey) {
        await textsecure.storage.put('profileKey', profileKey);
      }
      if (userAgent) {
        await textsecure.storage.put('userAgent', userAgent);
      }

      await textsecure.storage.put(
        'read-receipt-setting',
        Boolean(readReceipts)
      );

      await textsecure.storage.user.setNumberAndDeviceId(
        number,
        response.deviceId || 1,
        deviceName
      );

      const regionCode = libphonenumber.util.getRegionCodeForNumber(number);
      await textsecure.storage.put('regionCode', regionCode);
      await textsecure.storage.protocol.hydrateCaches();
    },
    async clearSessionsAndPreKeys() {
      const store = textsecure.storage.protocol;

      window.log.info('clearing all sessions, prekeys, and signed prekeys');
      await Promise.all([
        store.clearPreKeyStore(),
        store.clearSignedPreKeysStore(),
        store.clearSessionStore(),
      ]);
    },
    // Takes the same object returned by generateKeys
    async confirmKeys(keys) {
      const store = textsecure.storage.protocol;
      const key = keys.signedPreKey;
      const confirmed = true;

      window.log.info('confirmKeys: confirming key', key.keyId);
      await store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
    },
    generateKeys(count, providedProgressCallback) {
      const progressCallback =
        typeof providedProgressCallback === 'function'
          ? providedProgressCallback
          : null;
      const startId = textsecure.storage.get('maxPreKeyId', 1);
      const signedKeyId = textsecure.storage.get('signedKeyId', 1);

      if (typeof startId !== 'number') {
        throw new Error('Invalid maxPreKeyId');
      }
      if (typeof signedKeyId !== 'number') {
        throw new Error('Invalid signedKeyId');
      }

      const store = textsecure.storage.protocol;
      return store.getIdentityKeyPair().then(identityKey => {
        const result = { preKeys: [], identityKey: identityKey.pubKey };
        const promises = [];

        for (let keyId = startId; keyId < startId + count; keyId += 1) {
          promises.push(
            libsignal.KeyHelper.generatePreKey(keyId).then(res => {
              store.storePreKey(res.keyId, res.keyPair);
              result.preKeys.push({
                keyId: res.keyId,
                publicKey: res.keyPair.pubKey,
              });
              if (progressCallback) {
                progressCallback();
              }
            })
          );
        }

        promises.push(
          libsignal.KeyHelper.generateSignedPreKey(
            identityKey,
            signedKeyId
          ).then(res => {
            store.storeSignedPreKey(res.keyId, res.keyPair);
            result.signedPreKey = {
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
              signature: res.signature,
              // server.registerKeys doesn't use keyPair, confirmKeys does
              keyPair: res.keyPair,
            };
          })
        );

        textsecure.storage.put('maxPreKeyId', startId + count);
        textsecure.storage.put('signedKeyId', signedKeyId + 1);
        return Promise.all(promises).then(() =>
          // This is primarily for the signed prekey summary it logs out
          this.cleanSignedPreKeys().then(() => result)
        );
      });
    },
    async registrationDone(number) {
      window.log.info('registration done');

      // Ensure that we always have a conversation for ourself
      await ConversationController.getOrCreateAndWait(number, 'private');

      window.log.info('dispatching registration event');

      this.dispatchEvent(new Event('registration'));
    },
  });
  textsecure.AccountManager = AccountManager;
})();
