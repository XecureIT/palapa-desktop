/* eslint-env browser */
/* global dcodeIO, libsignal */

/* eslint-disable camelcase, no-bitwise */

module.exports = {
  arrayBufferToBase64,
  typedArrayToArrayBuffer,
  base64ToArrayBuffer,
  bytesFromHexString,
  bytesFromString,
  concatenateBytes,
  constantTimeEqual,
  decryptAesCtr,
  decryptDeviceName,
  decryptAttachment,
  decryptFile,
  decryptSymmetric,
  deriveAccessKey,
  deriveStickerPackKey,
  encryptAesCtr,
  encryptDeviceName,
  encryptAttachment,
  encryptFile,
  encryptSymmetric,
  fromEncodedBinaryToArrayBuffer,
  getAccessKeyVerifier,
  getFirstBytes,
  getRandomBytes,
  getRandomValue,
  getViewOfArrayBuffer,
  getZeroes,
  hexFromBytes,
  highBitsToInt,
  hmacSha256,
  intsToByteHighAndLow,
  splitBytes,
  stringFromBytes,
  trimBytes,
  verifyAccessKey,
};

function typedArrayToArrayBuffer(typedArray) {
  const { buffer, byteOffset, byteLength } = typedArray;
  return buffer.slice(byteOffset, byteLength + byteOffset);
}

function arrayBufferToBase64(arrayBuffer) {
  return dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('base64');
}
function base64ToArrayBuffer(base64string) {
  return dcodeIO.ByteBuffer.wrap(base64string, 'base64').toArrayBuffer();
}

function fromEncodedBinaryToArrayBuffer(key) {
  return dcodeIO.ByteBuffer.wrap(key, 'binary').toArrayBuffer();
}

function bytesFromString(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'utf8').toArrayBuffer();
}
function stringFromBytes(buffer) {
  return dcodeIO.ByteBuffer.wrap(buffer).toString('utf8');
}
function hexFromBytes(buffer) {
  return dcodeIO.ByteBuffer.wrap(buffer).toString('hex');
}
function bytesFromHexString(string) {
  return dcodeIO.ByteBuffer.wrap(string, 'hex').toArrayBuffer();
}

async function deriveStickerPackKey(packKey) {
  const salt = getZeroes(32);
  const info = bytesFromString('Sticker Pack');

  const [part1, part2] = await libsignal.HKDF.deriveSecrets(
    packKey,
    salt,
    info
  );

  return concatenateBytes(part1, part2);
}

// High-level Operations

async function encryptDeviceName(deviceName, identityPublic) {
  const plaintext = bytesFromString(deviceName);
  const ephemeralKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
  const masterSecret = await libsignal.Curve.async.calculateAgreement(
    identityPublic,
    ephemeralKeyPair.privKey
  );

  const key1 = await hmacSha256(masterSecret, bytesFromString('auth'));
  const syntheticIv = getFirstBytes(await hmacSha256(key1, plaintext), 16);

  const key2 = await hmacSha256(masterSecret, bytesFromString('cipher'));
  const cipherKey = await hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const ciphertext = await encryptAesCtr(cipherKey, plaintext, counter);

  return {
    ephemeralPublic: ephemeralKeyPair.pubKey,
    syntheticIv,
    ciphertext,
  };
}

async function decryptDeviceName(
  { ephemeralPublic, syntheticIv, ciphertext } = {},
  identityPrivate
) {
  const masterSecret = await libsignal.Curve.async.calculateAgreement(
    ephemeralPublic,
    identityPrivate
  );

  const key2 = await hmacSha256(masterSecret, bytesFromString('cipher'));
  const cipherKey = await hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const plaintext = await decryptAesCtr(cipherKey, ciphertext, counter);

  const key1 = await hmacSha256(masterSecret, bytesFromString('auth'));
  const ourSyntheticIv = getFirstBytes(await hmacSha256(key1, plaintext), 16);

  if (!constantTimeEqual(ourSyntheticIv, syntheticIv)) {
    throw new Error('decryptDeviceName: synthetic IV did not match');
  }

  return stringFromBytes(plaintext);
}

// Path structure: 'fa/facdf99c22945b1c9393345599a276f4b36ad7ccdc8c2467f5441b742c2d11fa'
function getAttachmentLabel(path) {
  const filename = path.slice(3);
  return base64ToArrayBuffer(filename);
}

const PUB_KEY_LENGTH = 32;
async function encryptAttachment(staticPublicKey, path, plaintext) {
  const uniqueId = getAttachmentLabel(path);
  return encryptFile(staticPublicKey, uniqueId, plaintext);
}

async function decryptAttachment(staticPrivateKey, path, data) {
  const uniqueId = getAttachmentLabel(path);
  return decryptFile(staticPrivateKey, uniqueId, data);
}

async function encryptFile(staticPublicKey, uniqueId, plaintext) {
  const ephemeralKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
  const agreement = await libsignal.Curve.async.calculateAgreement(
    staticPublicKey,
    ephemeralKeyPair.privKey
  );
  const key = await hmacSha256(agreement, uniqueId);

  const prefix = ephemeralKeyPair.pubKey.slice(1);
  return concatenateBytes(prefix, await encryptSymmetric(key, plaintext));
}

async function decryptFile(staticPrivateKey, uniqueId, data) {
  const ephemeralPublicKey = getFirstBytes(data, PUB_KEY_LENGTH);
  const ciphertext = _getBytes(data, PUB_KEY_LENGTH, data.byteLength);
  const agreement = await libsignal.Curve.async.calculateAgreement(
    ephemeralPublicKey,
    staticPrivateKey
  );

  const key = await hmacSha256(agreement, uniqueId);

  return decryptSymmetric(key, ciphertext);
}

async function deriveAccessKey(profileKey) {
  const iv = getZeroes(12);
  const plaintext = getZeroes(16);
  const accessKey = await _encrypt_aes_gcm(profileKey, iv, plaintext);
  return getFirstBytes(accessKey, 16);
}

async function getAccessKeyVerifier(accessKey) {
  const plaintext = getZeroes(32);
  const hmac = await hmacSha256(accessKey, plaintext);

  return hmac;
}

async function verifyAccessKey(accessKey, theirVerifier) {
  const ourVerifier = await getAccessKeyVerifier(accessKey);

  if (constantTimeEqual(ourVerifier, theirVerifier)) {
    return true;
  }

  return false;
}

const IV_LENGTH = 16;
const MAC_LENGTH = 16;
const NONCE_LENGTH = 16;

async function encryptSymmetric(key, plaintext) {
  const iv = getZeroes(IV_LENGTH);
  const nonce = getRandomBytes(NONCE_LENGTH);

  const cipherKey = await hmacSha256(key, nonce);
  const macKey = await hmacSha256(key, cipherKey);

  const cipherText = await _encrypt_aes256_CBC_PKCSPadding(
    cipherKey,
    iv,
    plaintext
  );
  const mac = getFirstBytes(await hmacSha256(macKey, cipherText), MAC_LENGTH);

  return concatenateBytes(nonce, cipherText, mac);
}

async function decryptSymmetric(key, data) {
  const iv = getZeroes(IV_LENGTH);

  const nonce = getFirstBytes(data, NONCE_LENGTH);
  const cipherText = _getBytes(
    data,
    NONCE_LENGTH,
    data.byteLength - NONCE_LENGTH - MAC_LENGTH
  );
  const theirMac = _getBytes(data, data.byteLength - MAC_LENGTH, MAC_LENGTH);

  const cipherKey = await hmacSha256(key, nonce);
  const macKey = await hmacSha256(key, cipherKey);

  const ourMac = getFirstBytes(
    await hmacSha256(macKey, cipherText),
    MAC_LENGTH
  );
  if (!constantTimeEqual(theirMac, ourMac)) {
    throw new Error(
      'decryptSymmetric: Failed to decrypt; MAC verification failed'
    );
  }

  return _decrypt_aes256_CBC_PKCSPadding(cipherKey, iv, cipherText);
}

function constantTimeEqual(left, right) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let result = 0;
  const ta1 = new Uint8Array(left);
  const ta2 = new Uint8Array(right);
  for (let i = 0, max = left.byteLength; i < max; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ta1[i] ^ ta2[i];
  }
  return result === 0;
}

// Encryption

async function hmacSha256(key, plaintext) {
  const algorithm = {
    name: 'HMAC',
    hash: 'SHA-256',
  };
  const extractable = false;

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['sign']
  );

  return window.crypto.subtle.sign(algorithm, cryptoKey, plaintext);
}

async function _encrypt_aes256_CBC_PKCSPadding(key, iv, plaintext) {
  const algorithm = {
    name: 'AES-CBC',
    iv,
  };
  const extractable = false;

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['encrypt']
  );

  return window.crypto.subtle.encrypt(algorithm, cryptoKey, plaintext);
}

async function _decrypt_aes256_CBC_PKCSPadding(key, iv, plaintext) {
  const algorithm = {
    name: 'AES-CBC',
    iv,
  };
  const extractable = false;

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['decrypt']
  );
  return window.crypto.subtle.decrypt(algorithm, cryptoKey, plaintext);
}

async function encryptAesCtr(key, plaintext, counter) {
  const extractable = false;
  const algorithm = {
    name: 'AES-CTR',
    counter: new Uint8Array(counter),
    length: 128,
  };

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    algorithm,
    cryptoKey,
    plaintext
  );

  return ciphertext;
}

async function decryptAesCtr(key, ciphertext, counter) {
  const extractable = false;
  const algorithm = {
    name: 'AES-CTR',
    counter: new Uint8Array(counter),
    length: 128,
  };

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    algorithm,
    cryptoKey,
    ciphertext
  );
  return plaintext;
}

async function _encrypt_aes_gcm(key, iv, plaintext) {
  const algorithm = {
    name: 'AES-GCM',
    iv,
  };
  const extractable = false;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    algorithm,
    extractable,
    ['encrypt']
  );
  return crypto.subtle.encrypt(algorithm, cryptoKey, plaintext);
}

// Utility

function getRandomBytes(n) {
  const bytes = new Uint8Array(n);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

function getRandomValue(low, high) {
  const diff = high - low;
  const bytes = new Uint32Array(1);
  window.crypto.getRandomValues(bytes);

  // Because high and low are inclusive
  const mod = diff + 1;
  return (bytes[0] % mod) + low;
}

function getZeroes(n) {
  const result = new Uint8Array(n);

  const value = 0;
  const startIndex = 0;
  const endExclusive = n;
  result.fill(value, startIndex, endExclusive);

  return result;
}

function highBitsToInt(byte) {
  return (byte & 0xff) >> 4;
}

function intsToByteHighAndLow(highValue, lowValue) {
  return ((highValue << 4) | lowValue) & 0xff;
}

function trimBytes(buffer, length) {
  return getFirstBytes(buffer, length);
}

function getViewOfArrayBuffer(buffer, start, finish) {
  const source = new Uint8Array(buffer);
  const result = source.slice(start, finish);
  return result.buffer;
}

function concatenateBytes(...elements) {
  const length = elements.reduce(
    (total, element) => total + element.byteLength,
    0
  );

  const result = new Uint8Array(length);
  let position = 0;

  for (let i = 0, max = elements.length; i < max; i += 1) {
    const element = new Uint8Array(elements[i]);
    result.set(element, position);
    position += element.byteLength;
  }
  if (position !== result.length) {
    throw new Error('problem concatenating!');
  }

  return result.buffer;
}

function splitBytes(buffer, ...lengths) {
  const total = lengths.reduce((acc, length) => acc + length, 0);

  if (total !== buffer.byteLength) {
    throw new Error(
      `Requested lengths total ${total} does not match source total ${buffer.byteLength}`
    );
  }

  const source = new Uint8Array(buffer);
  const results = [];
  let position = 0;

  for (let i = 0, max = lengths.length; i < max; i += 1) {
    const length = lengths[i];
    const result = new Uint8Array(length);
    const section = source.slice(position, position + length);
    result.set(section);
    position += result.byteLength;

    results.push(result);
  }

  return results;
}

function getFirstBytes(data, n) {
  const source = new Uint8Array(data);
  return source.subarray(0, n);
}

// Internal-only

function _getBytes(data, start, n) {
  const source = new Uint8Array(data);
  return source.subarray(start, start + n);
}
