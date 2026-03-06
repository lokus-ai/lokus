/**
 * Client-side file encryption for sync.
 * AES-256-GCM with HKDF-derived key wrapping.
 * Files are encrypted before leaving the device.
 */

const ENCRYPTION_VERSION = 0x01;
const INFO_STRING = 'lokus-file-encryption-v1';

// --- Key Management ---

export async function deriveWrappingKey(secret, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(INFO_STRING) },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export async function generateMEK() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function wrapMEK(mek, kwk) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey('raw', mek, kwk, { name: 'AES-GCM', iv: nonce });
  return { wrapped: new Uint8Array(wrapped), nonce };
}

export async function unwrapMEK(wrappedKey, nonce, kwk) {
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kwk,
    { name: 'AES-GCM', iv: nonce },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- File Encryption ---

export async function encryptFile(mek, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, mek, plaintext);

  // Pack: version(1) + iv(12) + ciphertext(N)
  const packed = new Uint8Array(1 + 12 + ciphertext.byteLength);
  packed[0] = ENCRYPTION_VERSION;
  packed.set(iv, 1);
  packed.set(new Uint8Array(ciphertext), 13);
  return packed;
}

export async function decryptFile(mek, packed) {
  const bytes = new Uint8Array(packed);
  if (bytes[0] !== ENCRYPTION_VERSION) throw new Error(`Unknown encryption version: ${bytes[0]}`);

  const iv = bytes.slice(1, 13);
  const ciphertext = bytes.slice(13);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, mek, ciphertext);
}

// --- Hashing ---

export async function sha256(data) {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
