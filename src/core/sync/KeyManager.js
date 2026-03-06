import { supabase } from '../auth/supabase';
import { deriveWrappingKey, generateMEK, wrapMEK, unwrapMEK } from './encryption';

// Application-level pepper combined with userId for wrapping key derivation.
// This ensures an attacker needs both the userId AND the application source to
// reconstruct the wrapping key, rather than the userId alone (which is a public
// UUID). This is NOT a substitute for proper E2EE with a user-supplied
// passphrase -- a future version should prompt the user for a passphrase and
// derive the wrapping key from that instead.
const APP_KEY_PEPPER = 'lokus-e2ee-v1-2026';

function toBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class KeyManager {
  constructor() {
    this.mek = null;
    this.userId = null;
  }

  /**
   * Returns the localStorage cache key scoped to a specific user.
   * This prevents one user's cached MEK from being read by another
   * user on the same device.
   */
  _cacheKey(userId) {
    return `lokus-mek-${userId}`;
  }

  async initialize(userId) {
    this.userId = userId;

    // Try loading from local cache first
    this.mek = await this._loadFromCache();
    if (this.mek) return;

    // Try loading from Supabase
    this.mek = await this._loadFromServer(userId);
    if (this.mek) {
      await this._saveToCache(this.mek);
      return;
    }

    // First time: generate new MEK
    this.mek = await this._createAndStore(userId);
    await this._saveToCache(this.mek);
  }

  getMEK() {
    if (!this.mek) throw new Error('Encryption not initialized');
    return this.mek;
  }

  async _createAndStore(userId) {
    const mek = await generateMEK();
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const kwk = await deriveWrappingKey(userId + APP_KEY_PEPPER, salt);
    const { wrapped, nonce } = await wrapMEK(mek, kwk);

    const { error } = await supabase.from('user_encryption_keys').upsert({
      user_id: userId,
      wrapped_key: toBase64(new Uint8Array(wrapped)),
      wrapping_nonce: toBase64(nonce),
      wrapping_salt: toBase64(salt),
      key_version: 1,
    });

    if (error) throw new Error(`Failed to store key: ${error.message}`);
    return mek;
  }

  async _loadFromServer(userId) {
    const { data, error } = await supabase
      .from('user_encryption_keys')
      .select('wrapped_key, wrapping_nonce, wrapping_salt')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    try {
      const salt = fromBase64(data.wrapping_salt);
      const kwk = await deriveWrappingKey(userId + APP_KEY_PEPPER, salt);
      return await unwrapMEK(
        fromBase64(data.wrapped_key),
        fromBase64(data.wrapping_nonce),
        kwk
      );
    } catch (err) {
      console.error('[KeyManager] Failed to unwrap key from server:', err.message);
      return null;
    }
  }

  async _saveToCache(mek) {
    if (!this.userId) return;
    try {
      const exported = await crypto.subtle.exportKey('raw', mek);
      localStorage.setItem(this._cacheKey(this.userId), toBase64(new Uint8Array(exported)));
    } catch { /* cache is best-effort */ }
  }

  async _loadFromCache() {
    if (!this.userId) return null;
    try {
      const cached = localStorage.getItem(this._cacheKey(this.userId));
      if (!cached) return null;
      const keyBytes = fromBase64(cached);
      return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    } catch { return null; }
  }

  /**
   * Clears the cached MEK for the current user.
   */
  clearCache() {
    if (this.userId) {
      localStorage.removeItem(this._cacheKey(this.userId));
    }
    this.mek = null;
  }

  /**
   * MUST be called on user logout to wipe the in-memory MEK and remove the
   * cached key material from localStorage. Failing to call this leaves
   * decrypted key material accessible to the next user of the device.
   */
  onLogout() {
    if (this.userId) {
      localStorage.removeItem(this._cacheKey(this.userId));
    }
    this.mek = null;
    this.userId = null;
  }
}

export const keyManager = new KeyManager();
