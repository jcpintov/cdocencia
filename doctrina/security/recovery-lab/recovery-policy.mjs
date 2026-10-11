/**
 * Pure, side-effect-free policy helpers for a future Docencia recovery service.
 * Not wired to the application and not a complete recovery endpoint.
 */
export const RECOVERY_TOKEN_BYTES = 32;
export const RECOVERY_TOKEN_TTL_MS = 15 * 60 * 1000;
export const RECOVERY_PUBLIC_MESSAGE = 'Si el correo está registrado, recibirás instrucciones para recuperar el acceso.';

export function generateRecoveryToken() {
  const bytes = new Uint8Array(RECOVERY_TOKEN_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashRecoveryToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new TypeError('Invalid recovery token format');
  }
  const encoded = new TextEncoder().encode(token);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export function recoveryPublicResponse() {
  return { ok: true, message: RECOVERY_PUBLIC_MESSAGE };
}

export function isExpired(expiresAt, now = Date.now()) {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || !Number.isFinite(now) || now >= expiry;
}
