import { supabase } from '../auth/supabase';
import { deriveWrappingKey, generateMEK, wrapMEK, unwrapMEK } from './encryption';

const MEK_CACHE_KEY = 'lokus-mek-cache';

export class KeyManager {
  constructor() {
    this.mek = null;
  }

  async initialize(userId) {
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
    const kwk = await deriveWrappingKey(userId, salt);
    const { wrapped, nonce } = await wrapMEK(mek, kwk);

    const { error } = await supabase.from('user_encryption_keys').upsert({
      user_id: userId,
      wrapped_key: Array.from(wrapped),
      wrapping_nonce: Array.from(nonce),
      wrapping_salt: Array.from(salt),
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

    const kwk = await deriveWrappingKey(userId, new Uint8Array(data.wrapping_salt));
    return unwrapMEK(new Uint8Array(data.wrapped_key), new Uint8Array(data.wrapping_nonce), kwk);
  }

  async _saveToCache(mek) {
    try {
      const exported = await crypto.subtle.exportKey('raw', mek);
      localStorage.setItem(MEK_CACHE_KEY, JSON.stringify(Array.from(new Uint8Array(exported))));
    } catch { /* cache is best-effort */ }
  }

  async _loadFromCache() {
    try {
      const cached = localStorage.getItem(MEK_CACHE_KEY);
      if (!cached) return null;
      const keyBytes = new Uint8Array(JSON.parse(cached));
      return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    } catch { return null; }
  }

  clearCache() {
    localStorage.removeItem(MEK_CACHE_KEY);
    this.mek = null;
  }
}

export const keyManager = new KeyManager();
