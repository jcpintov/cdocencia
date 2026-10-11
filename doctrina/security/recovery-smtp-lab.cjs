'use strict';
// Standalone local-only recovery laboratory. No database or SMTP credentials.
const crypto = require('node:crypto');
const TOKEN_BYTES = 32;
const TTL_MS = 30 * 60 * 1000;
const hashToken = token => crypto.createHash('sha256').update(token, 'utf8').digest('hex');
function issue({ email, now = Date.now(), randomBytes = crypto.randomBytes }) {
  if (typeof email !== 'string' || !email.trim()) throw new TypeError('email required');
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, record: { email: email.trim().toLowerCase(), tokenHash: hashToken(token), expiresAt: now + TTL_MS, consumedAt: null } };
}
function consume(record, suppliedToken, now = Date.now()) {
  if (!record || record.consumedAt !== null || now >= record.expiresAt || typeof suppliedToken !== 'string') return false;
  const candidate = Buffer.from(hashToken(suppliedToken), 'hex');
  const expected = Buffer.from(record.tokenHash, 'hex');
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) return false;
  record.consumedAt = now;
  return true;
}
function createMail({ to, token, origin }) {
  const url = new URL('/recuperar', origin);
  url.searchParams.set('token', token);
  return { to, subject: 'Recuperación de acceso', text: 'Si solicitó recuperar su acceso, abra este enlace (30 minutos): ' + url.toString() };
}
const PUBLIC_RESPONSE = Object.freeze({ message: 'Si el correo está registrado, recibirá instrucciones.' });
module.exports = { issue, consume, createMail, PUBLIC_RESPONSE, hashToken, TTL_MS };
