// src/services/crypto.js
// Simple Web Crypto wrapper to encrypt small secrets (token, user) using AES-GCM.
// This uses an app-local generated AES key stored in IndexedDB 'secrets' store via dbService.

import { dbService } from './db';

const KEY_ID = 'app-aes-key-v1';
const IV_LENGTH = 12; // AES-GCM recommended IV length

const toBase64 = (arr) => {
  return btoa(String.fromCharCode(...new Uint8Array(arr)));
};

const fromBase64 = (b64) => {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const cryptoService = {
  async ensureKey() {
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('Web Crypto not available; falling back to unencrypted storage');
      return null;
    }

    try {
      const existing = await dbService.get('secrets', KEY_ID);
      if (existing && existing.key) {
        return existing.key; // Structured clone will keep CryptoKey
      }

      // Generate AES-GCM 256-bit key
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable true to allow storing across contexts (some browsers require extractable for IDB storage); keep it extractable for portability but consider security tradeoffs
        ['encrypt', 'decrypt']
      );

      // Store key in IndexedDB secrets store
      await dbService.put('secrets', { id: KEY_ID, key });
      return key;
    } catch (err) {
      console.error('Failed to ensure crypto key', err);
      return null;
    }
  },

  async encrypt(obj) {
    try {
      const key = await this.ensureKey();
      if (!key) return { success: false, encrypted: null };

      const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const encoder = new TextEncoder();
      const plain = encoder.encode(JSON.stringify(obj));

      const cipher = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plain
      );

      return {
        success: true,
        encrypted: JSON.stringify({ iv: toBase64(iv), data: toBase64(cipher) })
      };
    } catch (err) {
      console.error('Encryption failed', err);
      return { success: false, encrypted: null };
    }
  },

  async decrypt(encryptedStr) {
    try {
      if (!encryptedStr) return { success: false, data: null };
      const key = await this.ensureKey();
      if (!key) return { success: false, data: null };

      const parsed = JSON.parse(encryptedStr);
      const iv = fromBase64(parsed.iv);
      const data = fromBase64(parsed.data);

      const plain = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        data
      );

      const decoder = new TextDecoder();
      const text = decoder.decode(plain);
      return { success: true, data: JSON.parse(text) };
    } catch (err) {
      console.error('Decryption failed', err);
      return { success: false, data: null };
    }
  }
};
