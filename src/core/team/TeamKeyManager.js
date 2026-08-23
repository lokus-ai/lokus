import { invoke } from '@tauri-apps/api/core';

const ALGORITHM = 'x25519-hkdf-aesgcm-v1';
const ENVELOPE_DOMAIN = 'lokus-team-key-envelope-v1';

export class TeamKeyManager {
  constructor({ invokeFn = invoke } = {}) {
    this.invoke = invokeFn;
    this.identity = null;
    this.initializations = new Map();
  }

  initialize(userId) {
    if (this.identity?.userId === userId) {
      return Promise.resolve(this.publicIdentity());
    }
    const pending = this.initializations.get(userId);
    if (pending) return pending;
    const initialization = this.initializeDevice(userId)
      .finally(() => this.initializations.delete(userId));
    this.initializations.set(userId, initialization);
    return initialization;
  }

  async initializeDevice(userId) {
    const privateStorageKey = `team-device-private:${userId}`;
    const publicStorageKey = `lokus-team-device-public:${userId}`;
    const deviceStorageKey = `lokus-team-device-id:${userId}`;
    const storedPrivate = await this.invoke('secure_store_get', {
      key: privateStorageKey,
    });
    const storedPublic = localStorage.getItem(publicStorageKey);
    let deviceId = localStorage.getItem(deviceStorageKey);
    let privateKey;
    let publicKey;

    if (storedPrivate && storedPublic) {
      privateKey = await crypto.subtle.importKey(
        'pkcs8',
        fromBase64(storedPrivate),
        { name: 'X25519' },
        true,
        ['deriveBits'],
      );
      publicKey = fromBase64(storedPublic);
    } else {
      const pair = await crypto.subtle.generateKey(
        { name: 'X25519' },
        true,
        ['deriveBits'],
      );
      privateKey = pair.privateKey;
      publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
      const privatePkcs8 = new Uint8Array(
        await crypto.subtle.exportKey('pkcs8', pair.privateKey),
      );
      await this.invoke('secure_store_set', {
        key: privateStorageKey,
        value: toBase64(privatePkcs8),
      });
      localStorage.setItem(publicStorageKey, toBase64(publicKey));
    }
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(deviceStorageKey, deviceId);
    }
    const publicKeyFingerprint = new Uint8Array(
      await crypto.subtle.digest('SHA-256', publicKey),
    );
    this.identity = {
      userId,
      deviceId,
      privateKey,
      publicKey,
      publicKeyFingerprint,
    };
    return this.publicIdentity();
  }

  publicIdentity() {
    this.assertInitialized();
    return {
      deviceId: this.identity.deviceId,
      publicKey: new Uint8Array(this.identity.publicKey),
      publicKeyFingerprint: new Uint8Array(this.identity.publicKeyFingerprint),
    };
  }

  async wrapKeyForDevice(keyBytes, recipientPublicKeyBytes, context) {
    this.assertInitialized();
    if (!(keyBytes instanceof Uint8Array) || keyBytes.length !== 32) {
      throw new Error('team content keys must be 32 bytes');
    }
    const wrappingKey = await this.deriveWrappingKey(recipientPublicKeyBytes);
    const binding = envelopeBinding({
      ...context,
      senderDeviceId: this.identity.deviceId,
    });
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const aesKey = await deriveAesKey(wrappingKey, salt, binding, ['encrypt']);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: binding },
      aesKey,
      keyBytes,
    ));
    const wrappedKey = new Uint8Array(1 + salt.length + encrypted.length);
    wrappedKey[0] = 1;
    wrappedKey.set(salt, 1);
    wrappedKey.set(encrypted, 1 + salt.length);
    return { wrappedKey, nonce, algorithm: ALGORITHM };
  }

  async unwrapKeyEnvelope(envelope, senderPublicKeyBytes, context) {
    this.assertInitialized();
    if (envelope?.algorithm !== ALGORITHM || envelope?.wrappedKey?.[0] !== 1) {
      throw new Error('unsupported key envelope');
    }
    const salt = envelope.wrappedKey.slice(1, 33);
    const ciphertext = envelope.wrappedKey.slice(33);
    const wrappingKey = await this.deriveWrappingKey(senderPublicKeyBytes);
    const binding = envelopeBinding({
      ...context,
      recipientDeviceId: this.identity.deviceId,
    });
    const aesKey = await deriveAesKey(wrappingKey, salt, binding, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: envelope.nonce, additionalData: binding },
      aesKey,
      ciphertext,
    );
    return new Uint8Array(plaintext);
  }

  async deriveWrappingKey(publicKeyBytes) {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'X25519' },
      false,
      [],
    );
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'X25519', public: publicKey },
      this.identity.privateKey,
      256,
    ));
  }

  assertInitialized() {
    if (!this.identity) throw new Error('team device identity is not initialized');
  }
}

async function deriveAesKey(sharedSecret, salt, info, usages) {
  const material = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

function envelopeBinding({
  scopeKind,
  scopeId,
  epoch,
  senderDeviceId,
  recipientDeviceId,
}) {
  if (
    !['team', 'space'].includes(scopeKind)
    || !scopeId
    || !Number.isInteger(epoch)
    || epoch < 1
    || !senderDeviceId
    || !recipientDeviceId
  ) {
    throw new Error('complete key-envelope context is required');
  }
  return new TextEncoder().encode(JSON.stringify([
    ENVELOPE_DOMAIN,
    scopeKind,
    scopeId,
    epoch,
    senderDeviceId,
    recipientDeviceId,
  ]));
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export const teamKeyManager = new TeamKeyManager();
