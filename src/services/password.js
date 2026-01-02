// src/services/password.js
// Simple password hashing and verification using SubtleCrypto (SHA-256).

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const fromBase64 = (b64) => {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const hashPassword = async (password) => {
  if (!password) return null;
  if (!window.crypto || !window.crypto.subtle) {
    // Fallback to naive Base64 (not recommended) if Web Crypto is unavailable
    return btoa(password);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return toBase64(hashBuffer);
};

export const verifyPassword = async (password, hashB64) => {
  if (!hashB64) return false;
  const computed = await hashPassword(password);
  return computed === hashB64;
};
